import { reaction } from "mobx";
import { getPath, getSnapshot, onSnapshot } from "mobx-state-tree";
import { LogEventName } from "../../lib/logger-types";
import { HistoryEntryType } from "../history/history";
import { ICommitListener, ICommittedEntry, isCommitSource } from "../history/history-commits";
import { FAKE_HISTORY_ENTRY_ID, TreeManagerType } from "../history/tree-manager";
import { buildExactSave, getDocumentTools } from "./content-save-envelope";
import { DocumentModelType, SaveState } from "./document";
import { DocumentContentSnapshotType } from "./document-content";

export const kMinimumSaveGapMs = 1000;
export const kMaxRetryDelayMs = 30000;
export const kRetryingAfterFailures = 3;

export interface IValueRef {
  on(event: "value", cb: (snapshot: { val(): unknown }) => void): unknown;
  off(event: "value", cb: (snapshot: { val(): unknown }) => void): void;
}

// The parts of the RTDB reference to the document's content envelope that the sender uses.
export interface IContentRef {
  update(values: Record<string, unknown>): Promise<unknown>;
  child(path: string): IValueRef;
}

export type SaveKind = "exact" | "intermediate" | "settled";

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
  random?: () => number;
}

interface IQueuedSave extends IPendingSave {
  snapshot: DocumentContentSnapshotType;
  lastHistoryEntryId?: string;
  buildValues(changeCount: number): Record<string, unknown>;
}

// What was kept when a local entry completed, until that entry commits. The content snapshot is
// kept only when it is usable: exactly the history through its entry, once the entry commits.
type IKeptSnapshot =
  { usable: true; snapshot: DocumentContentSnapshotType; exactSince: string; changeSeq: number } |
  { usable: false; changeSeq: number };

// The state of a group document's history manager that the sender reads.
interface IGroupHistoryState {
  readonly applying: boolean;
}

// Document actions the sender calls itself. Like any action each one briefly opens a history
// entry, but they never change the content, so those entries don't block a snapshot.
const kContentFreeDocumentActions = ["setSaveState", "incChangeCount"];

const getTreeManager = (document: DocumentModelType) =>
  document.treeManagerAPI as TreeManagerType | undefined;

function isApplyingRemoteEntries(document: DocumentModelType) {
  if (!document.concurrent) return false;
  const manager = getTreeManager(document)?.historyManager as Partial<IGroupHistoryState> | undefined;
  return !!manager?.applying;
}

/**
 * Whether the content change being reported was made by this user rather than by a group
 * document's apply of remote entries. The apply's calls run with the fake history entry id, and a
 * call is still running when the content reports its change.
 */
function isLocalChange(document: DocumentModelType) {
  if (!isApplyingRemoteEntries(document)) return true;
  return !!document.treeMonitor?.getRunningCallsWithChanges()
    .some(call => call.historyEntryId !== FAKE_HISTORY_ENTRY_ID);
}

/**
 * Why a content snapshot taken now might hold changes that no completed history entry describes.
 * Empty when the snapshot is usable.
 */
export function getSnapshotBlockers(document: DocumentModelType): string[] {
  const blockers: string[] = [];
  const documentPath = getPath(document);
  const contentFreeActions = kContentFreeDocumentActions.map(name => `${documentPath}/${name}`);
  const openEntries = getTreeManager(document)?.activeHistoryEntries
    .filter(entry => !contentFreeActions.includes(entry.action ?? "")) ?? [];
  if (openEntries.length > 0) {
    blockers.push("open-entry");
  }
  if (document.treeMonitor?.getRunningCallsWithChanges().length) {
    blockers.push("running-call-with-changes");
  }
  if (isApplyingRemoteEntries(document)) {
    blockers.push("applying-remote-entries");
  }
  return blockers;
}

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
 * entry completes and is saved, marked settled, once that entry has committed. Only one write is
 * in flight at a time, and each write sends the newest save waiting by then.
 */
export class ContentSaveSender {
  private options: IContentSaveSenderOptions;
  private running = false;
  private disposers: Array<() => void> = [];
  private keptSnapshots = new Map<string, IKeptSnapshot>();
  private pendingSave: IQueuedSave | undefined;
  private writeInFlight = false;
  private writeTimer: ReturnType<typeof setTimeout> | undefined;
  private lastWriteStartedAt: number | undefined;
  private lastFailureAt: number | undefined;
  private consecutiveFailures = 0;
  // Counts the content changes. A save covers the changes up to its changeSeq.
  private dirtySeq = 0;
  private sentTools: string[] | undefined;

  constructor(private document: DocumentModelType, options: IContentSaveSenderOptions) {
    this.options = options;
    this.start();
  }

  attach(options: IContentSaveSenderOptions) {
    this.options = options;
    if (!this.running) {
      this.start();
    }
  }

  detach() {
    this.dispose();
  }

  dispose() {
    this.running = false;
    this.disposers.forEach(dispose => dispose());
    this.disposers = [];
    this.clearWriteTimer();
    this.keptSnapshots.clear();
    this.pendingSave = undefined;
    this.consecutiveFailures = 0;
  }

  private start() {
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
            changeSeq: this.dirtySeq }
        : { usable, changeSeq: this.dirtySeq });
    } catch (error) {
      console.error("Failed to keep the content snapshot of a history entry", error);
    }
  };

  private commitListener: ICommitListener = {
    onCommitted: (entries: ICommittedEntry[]) => {
      try {
        let newest: IQueuedSave | undefined;
        entries.forEach(entry => {
          const kept = this.keptSnapshots.get(entry.id);
          if (kept?.usable) {
            newest = this.createExactSave(entry, kept.snapshot, kept.exactSince, kept.changeSeq);
          }
          this.keptSnapshots.delete(entry.id);
        });
        if (newest) {
          this.queueSave(newest);
        }
      } catch (error) {
        console.error("Failed to queue the content save of committed history entries", error);
      }
    },
    onUncommittedVoided: () => {
      this.keptSnapshots.clear();
    }
  };

  private handleContentChanged = () => {
    if (!isLocalChange(this.document)) return;
    this.dirtySeq++;
    if (this.consecutiveFailures < kRetryingAfterFailures) {
      this.setSaveState(SaveState.Saving);
    }
  };

  private createExactSave(entry: ICommittedEntry, snapshot: DocumentContentSnapshotType, exactSince: string,
      changeSeq: number): IQueuedSave {
    return {
      kind: "exact",
      changeSeq,
      snapshot,
      lastHistoryEntryId: entry.id,
      buildValues: changeCount =>
        buildExactSave({ content: JSON.stringify(snapshot), changeCount, entry, exactSince })
    };
  }

  // Replaces any save that hasn't been sent yet.
  private queueSave(save: IQueuedSave) {
    this.pendingSave = save;
    this.scheduleWrite();
  }

  private scheduleWrite() {
    this.clearWriteTimer();
    const save = this.pendingSave;
    if (!this.running || this.writeInFlight || !save) return;
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

  private getWriteReadyAt(save: IQueuedSave) {
    let readyAt = 0;
    if (this.lastWriteStartedAt !== undefined) {
      const gap = this.options.getMinimumGapMs?.(save) ?? kMinimumSaveGapMs;
      readyAt = this.lastWriteStartedAt + gap;
    }
    if (this.consecutiveFailures > 0 && this.lastFailureAt !== undefined) {
      readyAt = Math.max(readyAt, this.lastFailureAt + getRetryDelayMs(this.consecutiveFailures));
    }
    return readyAt;
  }

  private clearWriteTimer() {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = undefined;
    }
  }

  private write(save: IQueuedSave) {
    this.writeInFlight = true;
    this.lastWriteStartedAt = Date.now();
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
    result.then(() => this.handleWriteSucceeded(save), error => this.handleWriteFailed(error));
  }

  private handleWriteSucceeded(save: IQueuedSave) {
    this.writeInFlight = false;
    if (!this.running) return;
    this.consecutiveFailures = 0;
    if (this.pendingSave === save) {
      this.pendingSave = undefined;
    }
    this.sendToolsIfChanged(save.snapshot);
    if (save.lastHistoryEntryId) {
      try {
        this.options.onContentSaved?.(this.document, save.lastHistoryEntryId);
      } catch (error) {
        console.error("Failed to report a content save", error);
      }
    }
    if (save.changeSeq >= this.dirtySeq) {
      this.setSaveState(SaveState.Saved);
    } else if (this.document.saveState === SaveState.Retrying) {
      this.setSaveState(SaveState.Saving);
    }
    this.scheduleWrite();
  }

  // The pending save stays in place, unless a newer one has replaced it, so the retry sends the newest.
  private handleWriteFailed(error: unknown) {
    this.writeInFlight = false;
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
  private setSaveState(state: SaveState) {
    if (this.document.saveState !== state) {
      this.document.setSaveState(state);
    }
  }
}
