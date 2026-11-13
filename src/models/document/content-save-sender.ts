import { reaction } from "mobx";
import { getSnapshot, isAlive, onSnapshot } from "mobx-state-tree";
import { INotExactEvidence } from "../../lib/db-types";
import { LogEventName } from "../../lib/logger-types";
import { HistoryEntryType } from "../history/history";
import { ICommitListener, ICommittedEntry, isCommitSource } from "../history/history-commits";
import { getSnapshotBlockers, getTreeManager, isLocalChange } from "./content-save-checks";
import { buildExactSave, getDocumentTools } from "./content-save-envelope";
import { DocumentModelType, SaveState } from "./document";
import { DocumentContentSnapshotType } from "./document-content";

export const kMinimumSaveGapMs = 1000;
export const kMaxRetryDelayMs = 30000;
export const kRetryingAfterFailures = 3;
// The most time a sender keeps saving after it is detached.
export const kSenderUnmountLimitMs = 30000;
// The most usable snapshots kept for entries waiting to commit. Older ones are dropped.
export const kMaxUsableSnapshots = 10;

export interface IValueRef {
  on(event: "value", cb: (snapshot: { val(): unknown }) => void): unknown;
  off(event: "value", cb: (snapshot: { val(): unknown }) => void): void;
}

// The parts of the RTDB reference to the document's content envelope that the sender uses.
export interface IContentRef {
  update(values: Record<string, unknown>): Promise<unknown>;
  child(path: string): IValueRef;
}

// A snapshot save holds the content kept when a local entry completed, and a settled save holds a
// concurrent document's current content once its history settles. Both are exact saves.
export type SaveKind = "snapshot" | "intermediate" | "settled";

export interface IPendingSave {
  kind: SaveKind;
  // The content change the save covers, see ContentSaveSender.dirtySeq.
  changeSeq: number;
}

export interface IContentSaveSenderOptions {
  contentRef: IContentRef;
  updateTools: (tools: string[]) => Promise<unknown>;
  // Called before each content write.
  beforeWrite?: () => void;
  // Called after each successful content write with the id the save was stamped with.
  onContentSaved?: (document: DocumentModelType, lastHistoryEntryId: string) => void;
  logEvent?: (event: LogEventName, params: Record<string, unknown>) => void;
  // The least time between the start of the previous write and the start of this save's write.
  getMinimumGapMs?: (save: IPendingSave) => number;
  // Picks a concurrent document save's wait, between 0 and 1. Math.random when unset.
  random?: () => number;
  // Called when the sender stops after it was detached, once its last save has been sent.
  onDrained?: () => void;
}

export interface IQueuedSave extends IPendingSave {
  snapshot: DocumentContentSnapshotType;
  lastHistoryEntryId?: string;
  // The Firestore index of the entry the save is stamped with, when it is known.
  index?: number;
  // Set on a snapshot or settled save.
  exactSince?: string;
  // A concurrent document's save isn't sent before this time.
  notBefore?: number;
  buildValues(changeCount: number): Record<string, unknown>;
  // Set on an intermediate save.
  evidence?: INotExactEvidence;
}

// An intermediate save is built from the content as it is when it is sent, so it waits unbuilt.
export interface IUnbuiltIntermediateSave extends IPendingSave {
  kind: "intermediate";
}

export type IWaitingSave = IQueuedSave | IUnbuiltIntermediateSave;

export const getSaveIndex = (save: IWaitingSave) => "buildValues" in save ? save.index : undefined;

// What was kept when a local entry completed, until that entry commits. The content snapshot is
// kept only when it is usable: exactly the history through its entry, once the entry commits.
interface IUsableSnapshot {
  usable: true;
  snapshot: DocumentContentSnapshotType;
  exactSince: string;
  changeSeq: number;
  takenAt: number;
}
type IKeptSnapshot = IUsableSnapshot | { usable: false; changeSeq: number };

function getRetryDelayMs(failures: number) {
  return Math.min(1000 * 2 ** (failures - 1), kMaxRetryDelayMs);
}

// Subscribes to the current value of the expression, and again each time it changes.
function subscribeToCurrent<T>(expression: () => T, subscribe: (value: T) => (() => void) | undefined) {
  let unsubscribe: (() => void) | undefined;
  const disposeReaction = reaction(expression, value => {
    unsubscribe?.();
    unsubscribe = subscribe(value);
  }, { fireImmediately: true });
  return () => {
    disposeReaction();
    unsubscribe?.();
  };
}

const sameTools = (a: string[], b: string[]) =>
  a.length === b.length && a.every((tool, index) => tool === b[index]);

/**
 * Saves a document's content to its RTDB envelope. A snapshot is taken when each local history
 * entry completes and is saved, marked with exactThrough, once that entry has committed. Only one write is
 * in flight at a time, and each write sends the newest save waiting by then.
 *
 * Once every attachment is detached the sender keeps saving until a save covers the latest change,
 * or 30 seconds pass. Then the sender is disposed, after calling onDrained. Attaching it again
 * before then keeps it going.
 *
 * IndividualContentSaveSender and ConcurrentContentSaveSender add what each kind of document
 * needs. getContentSaveSender makes the one a document needs.
 */
export abstract class ContentSaveSender {
  protected options: IContentSaveSenderOptions;
  protected running = false;
  private attachments = 1;
  private drainTimer: ReturnType<typeof setTimeout> | undefined;
  protected disposers: Array<() => void> = [];
  protected keptSnapshots = new Map<string, IKeptSnapshot>();
  protected pendingSave: IWaitingSave | undefined;
  // More than one only after a page hide or the drain timeout, which don't wait for the write in flight.
  protected writesInFlight = new Set<IWaitingSave>();
  private writeTimer: ReturnType<typeof setTimeout> | undefined;
  private lastWriteStartedAt: number | undefined;
  private lastFailureAt: number | undefined;
  private consecutiveFailures = 0;
  // Counts the content changes. A save covers the changes up to its changeSeq.
  protected dirtySeq = 0;
  // The newest content change the RTDB content is known to hold: from this sender's writes, or a
  // concurrent document's envelope that reaches the head.
  protected savedSeq = 0;
  private sentTools: string[] | undefined;
  // This client's newest committed local entry, with the content change its snapshot was taken at.
  protected lastCommittedLocal: { index: number; changeSeq: number } | undefined;

  /**
   * getContentSaveSender starts the sender once it is made. Starting it here would run a
   * subclass's start before the subclass's fields are set.
   */
  constructor(protected document: DocumentModelType, options: IContentSaveSenderOptions,
      private onDisposed: () => void) {
    this.options = options;
  }

  attach(options: IContentSaveSenderOptions) {
    const contentRefChanged = options.contentRef !== this.options.contentRef;
    this.options = options;
    if (!this.running) {
      this.attachments = 1;
      this.start();
      return;
    }
    this.attachments++;
    this.clearDrainTimer();
    if (contentRefChanged) {
      this.handleContentRefChanged();
    }
  }

  // Called when an attachment made while the sender runs brings a new content reference.
  protected handleContentRefChanged() {}

  // Once nothing is attached, the sender keeps saving until it has nothing left to save.
  detach() {
    if (!this.running || this.attachments === 0) return;
    this.attachments--;
    if (this.attachments > 0) return;
    this.drainTimer = setTimeout(this.handleDrainTimeout, kSenderUnmountLimitMs);
    this.checkDrained();
  }

  private get isDraining() {
    return this.running && this.attachments === 0;
  }

  protected checkDrained() {
    if (this.isDraining && this.isLatestChangeSaved()) {
      this.finishDrain();
    }
  }

  private finishDrain() {
    try {
      this.options.onDrained?.();
    } catch (error) {
      console.error("Failed to finish saving content", error);
    }
    this.dispose();
  }

  // Whether a completed save covers the latest change.
  protected abstract isLatestChangeSaved(): boolean;

  protected hasSaveWaiting() {
    return !!this.pendingSave || this.writesInFlight.size > 0;
  }

  private handleDrainTimeout = () => {
    this.drainTimer = undefined;
    this.sendLastSave();
    this.finishDrain();
  };

  // Called when the drain times out, just before the sender is disposed.
  protected sendLastSave() {}

  private clearDrainTimer() {
    if (this.drainTimer) {
      clearTimeout(this.drainTimer);
      this.drainTimer = undefined;
    }
  }

  dispose() {
    this.running = false;
    this.attachments = 0;
    this.onDisposed();
    this.disposers.forEach(dispose => dispose());
    this.disposers = [];
    this.clearDrainTimer();
    this.clearWriteTimer();
    this.keptSnapshots.clear();
    this.pendingSave = undefined;
    this.consecutiveFailures = 0;
  }

  // Starts saving. getContentSaveSender calls it after making the sender, and attach calls it again
  // once the sender has stopped.
  start() {
    this.running = true;
    const treeManager = getTreeManager(this.document);
    if (treeManager) {
      this.disposers.push(treeManager.addEntryCompletedListener(this.handleEntryCompleted));
      this.disposers.push(subscribeToCurrent(() => treeManager.historyManager,
        manager => isCommitSource(manager) ? manager.addCommitListener(this.commitListener) : undefined));
    }
    this.disposers.push(subscribeToCurrent(() => this.document.content,
      content => content ? onSnapshot(content, this.handleContentChanged) : undefined));
  }

  private handleEntryCompleted = (entry: HistoryEntryType) => {
    // This runs inside the tree manager's completion of the entry, so it must not throw.
    try {
      const { content } = this.document;
      const exactness = getTreeManager(this.document)?.exactness;
      if (!content || !exactness) return;
      const { exactSince } = exactness;
      const usable = exactness.isExact && exactSince !== undefined
        && getSnapshotBlockers(this.document).length === 0;
      this.keptSnapshots.set(entry.id, usable
        ? { usable, snapshot: getSnapshot<DocumentContentSnapshotType>(content), exactSince,
            changeSeq: this.dirtySeq, takenAt: Date.now() }
        : { usable, changeSeq: this.dirtySeq });
      if (usable) {
        this.thinUsableSnapshots();
      }
    } catch (error) {
      console.error("Failed to keep the content snapshot of a history entry", error);
    }
  };

  /**
   * Keeps few snapshots while entries wait to commit. The newest is always kept. An older one is kept
   * only when it was taken at least the minimum save gap after the one kept before it, since saves are
   * written no closer together than that. Past the limit, the oldest are dropped. A dropped snapshot's
   * entry keeps its content change, and a commit saves the newest snapshot kept among its entries.
   */
  private thinUsableSnapshots() {
    const usable = Array.from(this.keptSnapshots)
      .filter((pair): pair is [string, IUsableSnapshot] => pair[1].usable);
    // The snapshot before the newest was the newest until now, so the gap before it is checked now.
    const previous = usable[usable.length - 2];
    const beforePrevious = usable[usable.length - 3];
    if (previous && beforePrevious && previous[1].takenAt - beforePrevious[1].takenAt < kMinimumSaveGapMs) {
      this.dropSnapshot(previous);
      usable.splice(usable.length - 2, 1);
    }
    usable.slice(0, Math.max(0, usable.length - kMaxUsableSnapshots)).forEach(pair => this.dropSnapshot(pair));
  }

  private dropSnapshot([id, kept]: [string, IKeptSnapshot]) {
    this.keptSnapshots.set(id, { usable: false, changeSeq: kept.changeSeq });
  }

  private commitListener: ICommitListener = {
    onCommitted: (entries: ICommittedEntry[]) => {
      try {
        let newest: IQueuedSave | undefined;
        let changeSeq = this.lastCommittedLocal?.changeSeq ?? 0;
        entries.forEach(entry => {
          const kept = this.keptSnapshots.get(entry.id);
          if (kept) {
            changeSeq = kept.changeSeq;
          }
          if (kept?.usable) {
            newest = this.createSnapshotSave(entry, kept.snapshot, kept.exactSince, kept.changeSeq);
          }
          this.keptSnapshots.delete(entry.id);
        });
        const last = entries[entries.length - 1];
        if (last) {
          this.lastCommittedLocal = { index: last.index, changeSeq };
        }
        if (newest) {
          this.queueSave(newest);
        }
        this.handleLocalEntriesCommitted();
      } catch (error) {
        console.error("Failed to queue the content save of committed history entries", error);
      }
    },
    // The snapshots are dropped, but the content changes they were taken at are kept.
    onUncommittedVoided: () => {
      this.keptSnapshots.forEach((kept, id) => this.dropSnapshot([id, kept]));
    }
  };

  // Called after this client's entries commit, once the save of their snapshot is queued.
  protected handleLocalEntriesCommitted() {}

  private handleContentChanged = () => {
    if (!isLocalChange(this.document)) return;
    this.dirtySeq++;
    if (this.consecutiveFailures < kRetryingAfterFailures) {
      this.setSaveState(SaveState.Saving);
    }
    this.handleLocalChange();
  };

  // Called after each change this user makes to the content.
  protected handleLocalChange() {}

  protected createSnapshotSave(entry: ICommittedEntry, snapshot: DocumentContentSnapshotType, exactSince: string,
      changeSeq: number): IQueuedSave {
    return {
      kind: "snapshot",
      changeSeq,
      snapshot,
      lastHistoryEntryId: entry.id,
      index: entry.index,
      exactSince,
      buildValues: changeCount =>
        buildExactSave({ content: JSON.stringify(snapshot), changeCount, entry, exactSince })
    };
  }

  protected logEvent(event: LogEventName, params: Record<string, unknown>) {
    try {
      this.options.logEvent?.(event, params);
    } catch (error) {
      console.error("Failed to log a content save event", error);
    }
  }

  // Replaces any save that hasn't been sent yet.
  protected queueSave(save: IWaitingSave) {
    this.pendingSave = save;
    this.scheduleWrite();
    this.handleSavesChanged();
  }

  // Called when the waiting save or the saved content may have changed.
  protected handleSavesChanged() {}

  // Whether a waiting save would undo or repeat what the RTDB already holds, so it is dropped.
  protected abstract isSuperseded(save: IWaitingSave): boolean;

  protected scheduleWrite() {
    this.clearWriteTimer();
    const waiting = this.pendingSave;
    if (waiting && !this.writesInFlight.has(waiting) && this.isSuperseded(waiting)) {
      this.pendingSave = undefined;
      this.handleSavesChanged();
    }
    const save = this.pendingSave;
    if (!this.running || this.writesInFlight.size > 0 || !save) return;
    const delay = this.getWriteReadyAt(save) - Date.now();
    if (delay <= 0) {
      this.write(save);
    } else {
      this.writeTimer = setTimeout(() => {
        this.writeTimer = undefined;
        this.scheduleWrite();
      }, delay);
    }
  }

  private getWriteReadyAt(save: IWaitingSave) {
    let readyAt = 0;
    if (this.lastWriteStartedAt !== undefined) {
      const gap = this.options.getMinimumGapMs?.(save) ?? kMinimumSaveGapMs;
      readyAt = this.lastWriteStartedAt + gap;
    }
    if (this.consecutiveFailures > 0 && this.lastFailureAt !== undefined) {
      readyAt = Math.max(readyAt, this.lastFailureAt + getRetryDelayMs(this.consecutiveFailures));
    }
    if ("buildValues" in save && save.notBefore !== undefined) {
      readyAt = Math.max(readyAt, save.notBefore);
    }
    return readyAt;
  }

  protected clearWriteTimer() {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = undefined;
    }
  }

  protected write(queued: IWaitingSave) {
    this.writesInFlight.add(queued);
    const startedAt = Date.now();
    this.lastWriteStartedAt = startedAt;
    let save: IQueuedSave;
    try {
      save = this.buildSave(queued);
    } catch (error) {
      // Handled as a failed write, so it is retried.
      Promise.resolve().then(() => this.handleWriteFailed(queued, error));
      return;
    }
    this.writesInFlight.delete(queued);
    this.writesInFlight.add(save);
    if (this.pendingSave === queued) {
      this.pendingSave = save;
    }
    this.handleWriteStarted(save, startedAt);
    try {
      this.options.beforeWrite?.();
    } catch (error) {
      console.error("Failed to prepare a content save", error);
    }
    let result: Promise<unknown>;
    try {
      result = this.options.contentRef.update(save.buildValues(this.document.incChangeCount()));
    } catch (error) {
      result = Promise.reject(error);
    }
    result.then(() => this.handleWriteSucceeded(save), error => this.handleWriteFailed(save, error));
  }

  // The save as it is written. Only a subclass queues a save that it builds when it is sent.
  protected buildSave(save: IWaitingSave): IQueuedSave {
    if (!("buildValues" in save)) {
      throw new Error(`The ${save.kind} save was queued unbuilt`);
    }
    return save;
  }

  // Called when the write of a save starts.
  protected handleWriteStarted(save: IQueuedSave, startedAt: number) {}

  // Called when a write succeeds while the sender runs, before the save is reported.
  protected handleSaveWritten(save: IQueuedSave, isNewest: boolean) {}

  private handleWriteSucceeded(save: IQueuedSave) {
    this.writesInFlight.delete(save);
    // The write may land after the document is gone, and there is nothing left to tell.
    if (!isAlive(this.document)) return;
    // Two writes in flight can finish out of order. One that finishes after a newer one reports
    // nothing, since the newer content is what the RTDB holds.
    const isNewest = save.changeSeq >= this.savedSeq;
    this.savedSeq = Math.max(this.savedSeq, save.changeSeq);
    if (isNewest) {
      this.recordSavedEnvelope(save);
    }
    if (!this.running) {
      // A write sent before the sender stopped still reports what it saved.
      if (isNewest) {
        this.reportWrite(save);
      }
      return;
    }
    this.consecutiveFailures = 0;
    if (this.pendingSave === save) {
      this.pendingSave = undefined;
    }
    this.handleSaveWritten(save, isNewest);
    if (isNewest) {
      this.reportWrite(save);
    }
    if (save.changeSeq >= this.dirtySeq) {
      this.setSaveState(SaveState.Saved);
    } else if (this.document.saveState === SaveState.Retrying) {
      this.setSaveState(SaveState.Saving);
    }
    this.scheduleWrite();
    this.handleSavesChanged();
    this.checkDrained();
  }

  // The pending save stays in place, unless a newer one has replaced it, so the retry sends the newest.
  private handleWriteFailed(save: IWaitingSave, error: unknown) {
    this.writesInFlight.delete(save);
    if (!this.running) return;
    this.consecutiveFailures++;
    this.lastFailureAt = Date.now();
    const { type, key } = this.document;
    console.warn(`ERROR: Failed to update document content for ${type} document ${key}:`, error);
    if (this.consecutiveFailures >= kRetryingAfterFailures) {
      this.setSaveState(SaveState.Retrying);
    }
    this.scheduleWrite();
  }

  /**
   * Records the envelope the save left in the RTDB, which page hide and a later sender for this
   * document read. An intermediate save without an entry leaves the envelope's id and index as they were.
   */
  private recordSavedEnvelope(save: IQueuedSave) {
    const lastHistoryEntryId = save.lastHistoryEntryId ?? this.document.savedEnvelope?.lastHistoryEntryId;
    const { index, exactSince } = save;
    const exact = save.kind !== "intermediate" && index !== undefined && exactSince !== undefined;
    this.document.setSavedEnvelope({
      ...(lastHistoryEntryId !== undefined && { lastHistoryEntryId }),
      ...(exact && { exactThrough: { index, since: exactSince } })
    });
  }

  // Sends the saved content's tools and reports the id the save was stamped with.
  private reportWrite(save: IQueuedSave) {
    this.sendToolsIfChanged(save.snapshot);
    this.reportSavedEntry(save);
  }

  protected reportSavedEntry(save: IQueuedSave) {
    if (save.lastHistoryEntryId) {
      this.reportContentSaved(save.lastHistoryEntryId);
    }
  }

  protected reportContentSaved(lastHistoryEntryId: string) {
    try {
      this.options.onContentSaved?.(this.document, lastHistoryEntryId);
    } catch (error) {
      console.error("Failed to report a content save", error);
    }
  }

  private sendToolsIfChanged(snapshot: DocumentContentSnapshotType) {
    const tools = getDocumentTools(snapshot);
    if (this.sentTools && sameTools(tools, this.sentTools)) return;
    this.sentTools = tools;
    Promise.resolve()
      .then(() => this.options.updateTools(tools))
      .catch(error => {
        const { type, key } = this.document;
        console.warn(`ERROR: Failed to update document tools for ${type} document ${key}:`, error);
        // Send them again with the next save.
        if (this.sentTools === tools) {
          this.sentTools = undefined;
        }
      });
  }

  // Each call is a document action, which the tree monitor records, so only call it on a change.
  protected setSaveState(state: SaveState) {
    if (this.document.saveState !== state) {
      this.document.setSaveState(state);
    }
  }
}
