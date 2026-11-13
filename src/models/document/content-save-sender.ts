import { comparer, reaction } from "mobx";
import { getSnapshot, isAlive, onSnapshot } from "mobx-state-tree";
import { IExactThrough, INotExactEvidence } from "../../lib/db-types";
import { LogEventName } from "../../lib/logger-types";
import { HistoryEntryType } from "../history/history";
import { ICommitListener, ICommittedEntry, isCommitSource } from "../history/history-commits";
import { SessionExactness } from "../history/session-exactness";
import { FAKE_HISTORY_ENTRY_ID, TreeManagerType } from "../history/tree-manager";
import { buildExactSave, buildIntermediateSave, getDocumentTools } from "./content-save-envelope";
import { DocumentModelType, SaveState } from "./document";
import { DocumentContentModelType, DocumentContentSnapshotType } from "./document-content";

export const kMinimumSaveGapMs = 1000;
// The gap before a save when no change since the last completed save was made by the user.
export const kBackgroundSaveGapMs = 3000;
export const kMaxRetryDelayMs = 30000;
export const kRetryingAfterFailures = 3;
export const kIntermediateSaveIntervalMs = 5000;
// The most uncommitted entry ids an intermediate save's evidence lists, keeping the newest.
export const kMaxEvidenceEntryIds = 20;
// The most time a group document's save waits, at random, before checking the envelope again.
export const kGroupSaveJitterMs = 200;
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
// group document's current content once its history settles. Both are exact saves.
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
  // Picks a group document save's wait, between 0 and 1. Math.random when unset.
  random?: () => number;
  // Called when the sender stops after it was detached, once its last save has been sent.
  onDrained?: () => void;
}

interface IQueuedSave extends IPendingSave {
  snapshot: DocumentContentSnapshotType;
  lastHistoryEntryId?: string;
  // The Firestore index of the entry the save is stamped with, when it is known.
  index?: number;
  // Set on a snapshot or settled save.
  exactSince?: string;
  // A group document's save isn't sent before this time.
  notBefore?: number;
  buildValues(changeCount: number): Record<string, unknown>;
  // Set on an intermediate save.
  evidence?: INotExactEvidence;
}

// An intermediate save is built from the content as it is when it is sent, so it waits unbuilt.
interface IUnbuiltIntermediateSave extends IPendingSave {
  kind: "intermediate";
}

type IWaitingSave = IQueuedSave | IUnbuiltIntermediateSave;

const getSaveIndex = (save: IWaitingSave) => "buildValues" in save ? save.index : undefined;

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

// The state of a group document's history manager that the sender reads.
interface IGroupHistoryState {
  readonly applying: boolean;
  readonly isHistorySettled: boolean;
  // The last entry on the shared chain, and its Firestore index when it is known.
  readonly expectedRemoteHead: string | null;
  readonly expectedRemoteHeadIndex: number | undefined;
}

// The envelope children a group document listens to.
const kEnvelopeFields = ["lastHistoryEntryId", "exactThrough"] as const;
type EnvelopeValues = Partial<Record<typeof kEnvelopeFields[number], unknown>>;

const getTreeManager = (document: DocumentModelType) =>
  document.treeManagerAPI as TreeManagerType | undefined;

function getGroupHistoryState(document: DocumentModelType) {
  if (!document.concurrent) return undefined;
  return getTreeManager(document)?.historyManager as Partial<IGroupHistoryState> | undefined;
}

function isApplyingRemoteEntries(document: DocumentModelType) {
  return !!getGroupHistoryState(document)?.applying;
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
 * The tree manager's open entries that may hold changes the tree monitor doesn't account for:
 * those that have recorded changes, or wait on something other than a finished call, such
 * as a shared model update or an undo. An entry that waits only on the exchanges of finished calls
 * is left to the tree monitor (see hasCallWithUnrecordedChanges), so an entry whose calls changed
 * nothing doesn't count. Many calls briefly open one, such as the sender's own document actions and
 * the setup calls of a tile that was just added.
 */
function getOpenEntries(document: DocumentModelType) {
  const monitor = document.treeMonitor;
  return getTreeManager(document)?.activeHistoryEntries.filter(entry =>
    entry.records.length > 0 ||
    Array.from(entry.activeExchanges.keys()).some(id => !monitor?.isFinishedCallExchange(id))) ?? [];
}

/**
 * Why a content snapshot taken now might hold changes that no completed history entry describes.
 * Empty when the snapshot is usable.
 */
export function getSnapshotBlockers(document: DocumentModelType): string[] {
  const blockers: string[] = [];
  if (getOpenEntries(document).length > 0) {
    blockers.push("open-entry");
  }
  if (document.treeMonitor?.hasCallWithUnrecordedChanges()) {
    blockers.push("call-with-unrecorded-changes");
  }
  if (isApplyingRemoteEntries(document)) {
    blockers.push("applying-remote-entries");
  }
  // The content holds the load's conversion, which history gets only with the next content change.
  if (getTreeManager(document)?.pendingLoadEntry) {
    blockers.push("pending-load-entry");
  }
  return blockers;
}

/**
 * What may keep the document's content from being exact, recorded with an intermediate save. The
 * envelope is written to the RTDB, which rejects undefined values, so unset fields are left out.
 */
export function collectNotExactEvidence(document: DocumentModelType, uncommittedEntryIds: string[],
    since: number): INotExactEvidence {
  const openEntries = getOpenEntries(document).map(entry => ({
    id: entry.id,
    ...(entry.model !== undefined && { model: entry.model }),
    ...(entry.action !== undefined && { action: entry.action }),
    exchanges: Array.from(entry.activeExchanges.values()),
    openedAt: entry.created.getTime()
  }));
  const runningFlows = (document.treeMonitor?.getRunningCallsWithChanges() ?? [])
    .map(({ action }) => ({ action }));
  const notExactReason = getTreeManager(document)?.exactness.notExactReason;
  return {
    openEntries,
    runningFlows,
    uncommittedEntryIds: uncommittedEntryIds.slice(-kMaxEvidenceEntryIds),
    ...(notExactReason && { notExactReason }),
    since
  };
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

// One sender for each document, see getContentSaveSender.
const senders = new WeakMap<DocumentModelType, ContentSaveSender>();

// The group document sessions whose stop has been logged, so a later sender doesn't log it again.
const groupSessionsLoggedAsStopped = new WeakSet<SessionExactness>();

interface IFallbackEpisode {
  startedAt: number;
  intermediateSaves: number;
}

/**
 * Saves a document's content to its RTDB envelope. A snapshot is taken when each local history
 * entry completes and is saved, marked with exactThrough, once that entry has committed. Only one write is
 * in flight at a time, and each write sends the newest save waiting by then. A write starts at
 * least 1 second after the previous one, or 3 seconds while every unsaved change was made by
 * background calls, such as a running program's ticks. Those changes don't show as saving.
 *
 * An individual document that has had unsaved changes and no exact save for 5 seconds falls back
 * to intermediate saves of its current content, which clear exactThrough and record why. Each
 * such stretch is logged once when its first intermediate save is sent, and once when it ends.
 *
 * A group document also saves its current content, stamped with the head of the shared chain,
 * whenever its history settles past what the envelope holds, since an idle member has no entries
 * of its own to save. Other members save the same envelope, so a group save waits a random time
 * and is dropped if the envelope already reaches its entry, before and after that wait. A save by
 * another member that covers this client's committed changes shows them as saved.
 *
 * Once every attachment is detached the sender keeps saving until a save covers the latest change,
 * which on an individual document has to be an exact save, or 30 seconds pass. Then an individual
 * document makes one intermediate save if the latest change isn't saved, and the sender is
 * disposed, after calling onDrained. Attaching it again before then keeps it going.
 */
export class ContentSaveSender {
  private options: IContentSaveSenderOptions;
  private running = false;
  private attachments = 1;
  private drainTimer: ReturnType<typeof setTimeout> | undefined;
  private disposers: Array<() => void> = [];
  private keptSnapshots = new Map<string, IKeptSnapshot>();
  private pendingSave: IWaitingSave | undefined;
  // More than one only after a page hide or the drain timeout, which don't wait for the write in flight.
  private writesInFlight = new Set<IWaitingSave>();
  private writeTimer: ReturnType<typeof setTimeout> | undefined;
  private lastWriteStartedAt: number | undefined;
  private lastFailureAt: number | undefined;
  private consecutiveFailures = 0;
  // Counts the content changes. A save covers the changes up to its changeSeq.
  private dirtySeq = 0;
  // The newest content change made by the user, rather than only by background calls. The save
  // indicator follows these changes, and saves holding only background changes wait longer.
  private lastUserChangeSeq = 0;
  // The newest content change the RTDB content is known to hold: from this sender's writes, or a group
  // envelope that reaches the head.
  private savedSeq = 0;
  // The newest content change an intermediate save has written. An exact save of older content
  // would undo changes the RTDB already holds, so it isn't sent.
  private intermediateSeq = 0;
  // When the current stretch with unsaved changes and no exact save began: the first change after
  // the content was exactly saved, or the last exact save when it left changes unsaved.
  private noExactSaveSince: number | undefined;
  private intermediateTimer: ReturnType<typeof setTimeout> | undefined;
  private intermediateDueAt: number | undefined;
  private lastIntermediateWriteAt: number | undefined;
  private fallbackEpisode: IFallbackEpisode | undefined;
  private sentTools: string[] | undefined;
  // This client's newest committed local entry, with the content change its snapshot was taken at.
  private lastCommittedLocal: { index: number; changeSeq: number } | undefined;
  // The newest entry a group document's envelope has been seen to hold.
  private envelopeEntry: ICommittedEntry | undefined;
  private envelopeValues: EnvelopeValues = {};
  private envelopeCheckScheduled = false;
  private stopEnvelopeListener: (() => void) | undefined;
  // The index of the newest entry reported to onContentSaved on a group document.
  private reportedIndex = -1;
  private settledCheckScheduled = false;

  constructor(private document: DocumentModelType, options: IContentSaveSenderOptions) {
    this.options = options;
    this.start();
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
    if (contentRefChanged && this.document.concurrent) {
      this.listenToEnvelope();
    }
  }

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

  private checkDrained() {
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

  /**
   * Whether a completed save covers the latest change. On an individual document that has to be an
   * exact save: an intermediate save leaves the envelope without exactThrough, and the next load can't
   * catch up from it.
   */
  private isLatestChangeSaved() {
    if (this.pendingSave || this.writesInFlight.size > 0) return false;
    if (!this.document.concurrent) return this.noExactSaveSince === undefined;
    const committed = this.lastCommittedLocal;
    return this.savedSeq >= this.dirtySeq
      || (!!committed && committed.changeSeq >= this.dirtySeq && this.isReachedByEnvelope(committed.index));
  }

  private handleDrainTimeout = () => {
    this.drainTimer = undefined;
    try {
      if (!this.document.concurrent && !this.isLatestChangeWritten()) {
        this.sendIntermediateSaveNow();
      }
    } catch (error) {
      console.error("Failed to send the last content save", error);
    }
    // A sender attached after this one has stopped would read the envelope before this write lands, so
    // the envelope is recorded as it will be now.
    if (Array.from(this.writesInFlight).some(save => save.kind === "intermediate")) {
      this.recordNotExactEnvelope();
    }
    this.finishDrain();
  };

  // Whether a completed write, or one in flight, holds the latest change.
  private isLatestChangeWritten() {
    return this.savedSeq >= this.dirtySeq
      || Array.from(this.writesInFlight).some(save => save.changeSeq >= this.dirtySeq);
  }

  private clearDrainTimer() {
    if (this.drainTimer) {
      clearTimeout(this.drainTimer);
      this.drainTimer = undefined;
    }
  }

  // Sent now, without waiting for the write in flight, the minimum gap or a backoff.
  private sendIntermediateSaveNow() {
    this.clearWriteTimer();
    this.clearIntermediateTimer();
    const save: IUnbuiltIntermediateSave = { kind: "intermediate", changeSeq: this.dirtySeq };
    this.pendingSave = save;
    this.write(save);
  }

  private handlePageHideEvent = () => {
    try {
      this.handlePageHide();
    } catch (error) {
      console.error("Failed to save content on page hide", error);
    }
  };

  /**
   * Sends the pending snapshot save now, without waiting for the minimum gap, a backoff or the write
   * in flight, since the page may be gone before they end. Changes that haven't committed are left
   * for the next load to catch up from history, so no intermediate save is made, unless the
   * document already relies on intermediate saves and no snapshot save covers the latest change. Then
   * an intermediate save is sent instead. A group document saves through its usual checks.
   */
  handlePageHide() {
    if (!this.running || this.document.concurrent) return;
    const save = this.pendingSave;
    const snapshotSaveCoversLatest = save?.kind === "snapshot" && save.changeSeq >= this.dirtySeq;
    if (this.isRelyingOnIntermediateSaves() && !snapshotSaveCoversLatest && !this.isLatestChangeWritten()) {
      this.sendIntermediateSaveNow();
      return;
    }
    if (save?.kind !== "snapshot" || this.writesInFlight.has(save) || this.isOlderThanIntermediateContent(save)) {
      return;
    }
    this.clearWriteTimer();
    this.write(save);
  }

  /**
   * Whether intermediate saves are already standing in for exact ones on this individual document.
   * They also are while the envelope the RTDB holds has no exactThrough, or there is none: the next
   * load catches up only from an envelope with exactThrough, so an intermediate save over it loses
   * nothing.
   */
  private isRelyingOnIntermediateSaves() {
    return !!this.fallbackEpisode || !getTreeManager(this.document)?.exactness.isExact
      || !this.document.savedEnvelope?.exactThrough;
  }

  dispose() {
    this.endFallbackEpisode("session-end");
    this.running = false;
    this.attachments = 0;
    if (senders.get(this.document) === this) {
      senders.delete(this.document);
    }
    this.disposers.forEach(dispose => dispose());
    this.disposers = [];
    this.clearDrainTimer();
    this.clearWriteTimer();
    this.clearIntermediateTimer();
    this.keptSnapshots.clear();
    this.pendingSave = undefined;
    this.consecutiveFailures = 0;
  }

  private start() {
    this.running = true;
    // Listened to here rather than by the component, so a page hide also reaches a sender that is
    // draining after the component unmounted. A group document has other writers, so it saves
    // through its usual checks.
    if (!this.document.concurrent) {
      window.addEventListener("pagehide", this.handlePageHideEvent);
      this.disposers.push(() => window.removeEventListener("pagehide", this.handlePageHideEvent));
    }
    const treeManager = getTreeManager(this.document);
    if (treeManager) {
      this.disposers.push(treeManager.addEntryCompletedListener(this.handleEntryCompleted));
      this.disposers.push(subscribeToCurrent(() => treeManager.historyManager,
        manager => isCommitSource(manager) ? manager.addCommitListener(this.commitListener) : undefined));
    }
    this.disposers.push(subscribeToCurrent(() => this.document.content,
      content => content ? onSnapshot(content, this.handleContentChanged) : undefined));
    if (this.document.concurrent && treeManager) {
      this.startGroupSaves(treeManager);
    } else {
      this.saveCaughtUpContent();
    }
  }

  /**
   * Saves the content as the load caught it up, when no entry has committed since. Otherwise the
   * RTDB content stays behind its history until the next edit commits, and every later load
   * catches it up again.
   */
  private saveCaughtUpContent() {
    const treeManager = getTreeManager(this.document);
    const manager = treeManager?.historyManager;
    const caughtUpTo = isCommitSource(manager) && !manager.lastCommitted ? manager.caughtUpTo : undefined;
    const { content } = this.document;
    const exactSince = treeManager?.exactness.exactSince;
    if (!caughtUpTo || !content || !treeManager?.exactness.isExact || exactSince === undefined
        || this.document.savedEnvelope?.lastHistoryEntryId === caughtUpTo.id
        || getSnapshotBlockers(this.document).length > 0) {
      return;
    }
    this.queueSave(this.createSnapshotSave(caughtUpTo, getSnapshot<DocumentContentSnapshotType>(content),
      exactSince, this.dirtySeq));
  }

  private startGroupSaves(treeManager: TreeManagerType) {
    const { lastHistoryEntryId, exactThrough } = this.document.savedEnvelope ?? {};
    if (lastHistoryEntryId && exactThrough) {
      this.advanceEnvelopeEntry({ id: lastHistoryEntryId, index: exactThrough.index });
    }
    this.listenToEnvelope();
    this.disposers.push(() => this.stopEnvelopeListener?.());
    // A group document makes no intermediate saves, so this client saves no more content.
    this.disposers.push(reaction(() => treeManager.exactness.notExactReason, reason => {
      if (!reason || groupSessionsLoggedAsStopped.has(treeManager.exactness)) return;
      groupSessionsLoggedAsStopped.add(treeManager.exactness);
      this.logEvent(LogEventName.CONTENT_SAVE_GROUP_STOPPED, { reason });
    }, { fireImmediately: true }));
    this.disposers.push(reaction(() => {
      const manager = getGroupHistoryState(this.document);
      return [manager?.isHistorySettled, manager?.applying, manager?.expectedRemoteHead,
        manager?.expectedRemoteHeadIndex, getOpenEntries(this.document).length,
        this.document.treeMonitor?.runningCallCount, treeManager.exactness.isExact];
    }, this.scheduleSettledCheck, { fireImmediately: true, equals: comparer.structural }));
  }

  // Listens only to the envelope's id and exactThrough, not its content, so exactThrough's content
  // hash isn't checked. A client that doesn't know exactThrough stamps its own id over it, so a
  // match on the id is what is checked.
  private listenToEnvelope() {
    this.stopEnvelopeListener?.();
    this.envelopeValues = {};
    const { contentRef } = this.options;
    const removers = kEnvelopeFields.map(field => {
      const ref = contentRef.child(field);
      const callback = (snapshot: { val(): unknown }) => {
        this.envelopeValues[field] = snapshot.val();
        // The fields of one update are reported one at a time, so they are read together.
        if (!this.envelopeCheckScheduled) {
          this.envelopeCheckScheduled = true;
          queueMicrotask(this.handleEnvelopeChanged);
        }
      };
      ref.on("value", callback);
      return () => ref.off("value", callback);
    });
    this.stopEnvelopeListener = () => {
      removers.forEach(remove => remove());
      this.stopEnvelopeListener = undefined;
    };
  }

  private handleEnvelopeChanged = () => {
    this.envelopeCheckScheduled = false;
    if (!this.running) return;
    try {
      const id = this.envelopeValues.lastHistoryEntryId;
      const exactThrough = this.envelopeValues.exactThrough as Partial<IExactThrough> | null | undefined;
      // An envelope whose exactThrough doesn't describe its id can't be ordered against a save.
      if (typeof id !== "string" || exactThrough?.id !== id || typeof exactThrough.index !== "number") return;
      const { index } = exactThrough;
      // The RTDB reports this client's own write before the server accepts it, and reverts it if
      // the write fails, so a write in flight isn't counted as saved.
      if (Array.from(this.writesInFlight).some(save => getSaveIndex(save) === index)) return;
      if (!this.advanceEnvelopeEntry({ id, index })) return;
      // A waiting save the envelope reaches is dropped.
      this.scheduleWrite();
      this.checkSavedByAnotherMember();
      this.scheduleSettledCheck();
    } catch (error) {
      console.error("Failed to handle a change to the content envelope", error);
    }
  };

  // Keeps the newest entry seen. Returns whether the entry is newer.
  private advanceEnvelopeEntry(entry: ICommittedEntry) {
    if (this.envelopeEntry && this.envelopeEntry.index >= entry.index) return false;
    this.envelopeEntry = entry;
    return true;
  }

  private isReachedByEnvelope(index: number | undefined) {
    return index !== undefined && !!this.envelopeEntry && this.envelopeEntry.index >= index;
  }

  /**
   * Shows this client's committed changes as saved when the envelope reaches its newest committed
   * entry, and reports the envelope's id, so the activity recorder counts the changes even when
   * another member saved them.
   */
  private checkSavedByAnotherMember() {
    const envelope = this.envelopeEntry;
    const committed = this.lastCommittedLocal;
    if (!envelope || !committed || envelope.index < committed.index) return;
    this.showSavedIfCovered(committed.changeSeq);
    if (envelope.index > this.reportedIndex) {
      this.reportedIndex = envelope.index;
      this.reportContentSaved(envelope.id);
    }
    this.checkDrained();
  }

  // Runs in a microtask: a call stops being tracked just before the entry that records it opens.
  private scheduleSettledCheck = () => {
    if (this.settledCheckScheduled) return;
    this.settledCheckScheduled = true;
    queueMicrotask(() => {
      this.settledCheckScheduled = false;
      try {
        this.checkSettledState();
      } catch (error) {
        console.error("Failed to queue the settled content save", error);
      }
    });
  };

  /**
   * When nothing on this client can make the content differ from the state at the head of the
   * shared chain, saves the content stamped with the head, unless the envelope or a save of this
   * client's already reaches it. Once the envelope reaches the head, it holds this content.
   */
  private checkSettledState() {
    const manager = getGroupHistoryState(this.document);
    if (!this.running || !manager?.isHistorySettled) return;
    // Every local entry has committed or been rolled back, so no kept snapshot will be saved.
    this.keptSnapshots.clear();
    const exactness = getTreeManager(this.document)?.exactness;
    const { content } = this.document;
    const id = manager.expectedRemoteHead;
    const index = manager.expectedRemoteHeadIndex;
    const exactSince = exactness?.exactSince;
    if (!content || !id || typeof index !== "number" || !exactness?.isExact || exactSince === undefined
        || getSnapshotBlockers(this.document).length > 0) {
      return;
    }
    if (this.isReachedByEnvelope(index)) {
      this.showAllChangesSaved();
      return;
    }
    const waiting = [this.pendingSave, ...this.writesInFlight];
    if (waiting.some(save => save && (getSaveIndex(save) ?? -1) >= index)) return;
    this.queueSave(this.createSettledSave({ id, index }, content, exactSince));
  }

  // The envelope holds the current content. Local changes a rollback undid never commit, so no
  // save of this client's covers them.
  private showAllChangesSaved() {
    if (this.savedSeq >= this.dirtySeq) return;
    this.savedSeq = this.dirtySeq;
    this.noExactSaveSince = undefined;
    this.showSavedIfCovered(this.dirtySeq);
    this.checkDrained();
  }

  private createSettledSave(entry: ICommittedEntry, content: DocumentContentModelType, exactSince: string)
      : IQueuedSave {
    const snapshot = getSnapshot<DocumentContentSnapshotType>(content);
    const { id, index } = entry;
    return {
      kind: "settled",
      changeSeq: this.dirtySeq,
      snapshot,
      lastHistoryEntryId: id,
      index,
      exactSince,
      buildValues: changeCount =>
        buildExactSave({ content: JSON.stringify(snapshot), changeCount, entry, exactSince })
    };
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
        this.checkSavedByAnotherMember();
      } catch (error) {
        console.error("Failed to queue the content save of committed history entries", error);
      }
    },
    // The snapshots are dropped, but the content changes they were taken at are kept.
    onUncommittedVoided: () => {
      this.keptSnapshots.forEach((kept, id) => this.dropSnapshot([id, kept]));
    }
  };

  private handleContentChanged = () => {
    if (!isLocalChange(this.document)) return;
    const background = !!this.document.treeMonitor?.areUnrecordedChangesAllBackground();
    this.dirtySeq++;
    if (this.noExactSaveSince === undefined) {
      this.noExactSaveSince = Date.now();
    }
    if (!background) {
      this.lastUserChangeSeq = this.dirtySeq;
      if (this.consecutiveFailures < kRetryingAfterFailures) {
        this.setSaveState(SaveState.Saving);
      }
    }
    this.scheduleIntermediateSave();
  };

  private createSnapshotSave(entry: ICommittedEntry, snapshot: DocumentContentSnapshotType, exactSince: string,
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

  // Holds the current content, so it is made again each time it is sent.
  private createIntermediateSave(): IQueuedSave {
    const { content } = this.document;
    if (!content) {
      throw new Error("The document has no content to save");
    }
    const snapshot = getSnapshot<DocumentContentSnapshotType>(content);
    const entry = this.getIntermediateStamp();
    const evidence = collectNotExactEvidence(this.document, Array.from(this.keptSnapshots.keys()),
      this.noExactSaveSince ?? Date.now());
    return {
      kind: "intermediate",
      changeSeq: this.dirtySeq,
      snapshot,
      lastHistoryEntryId: entry?.id,
      index: entry?.index,
      evidence,
      buildValues: changeCount =>
        buildIntermediateSave({ content: JSON.stringify(snapshot), changeCount, entry, evidence })
    };
  }

  // This session's last committed entry. When none has committed, the last entry the load caught
  // the content up to, or else the loaded envelope's entry.
  private getIntermediateStamp(): { id: string; index?: number } | undefined {
    const manager = getTreeManager(this.document)?.historyManager;
    const entry = isCommitSource(manager) ? manager.lastCommitted ?? manager.caughtUpTo : undefined;
    if (entry) return entry;
    const { lastHistoryEntryId, exactThrough } = this.document.savedEnvelope ?? {};
    return lastHistoryEntryId ? { id: lastHistoryEntryId, index: exactThrough?.index } : undefined;
  }

  // Undefined when no intermediate save is needed. Any pending save goes first, so an exact one wins.
  private getIntermediateSaveDueAt() {
    if (!this.running || this.document.concurrent || this.pendingSave
        || this.noExactSaveSince === undefined || this.savedSeq >= this.dirtySeq) {
      return undefined;
    }
    const since = Math.max(this.noExactSaveSince, this.lastIntermediateWriteAt ?? this.noExactSaveSince);
    return since + kIntermediateSaveIntervalMs;
  }

  private scheduleIntermediateSave() {
    const dueAt = this.getIntermediateSaveDueAt();
    if (dueAt === this.intermediateDueAt) return;
    this.clearIntermediateTimer();
    if (dueAt === undefined) return;
    this.intermediateDueAt = dueAt;
    this.intermediateTimer = setTimeout(this.handleIntermediateSaveDue, Math.max(0, dueAt - Date.now()));
  }

  private handleIntermediateSaveDue = () => {
    this.intermediateTimer = undefined;
    this.intermediateDueAt = undefined;
    if (this.getIntermediateSaveDueAt() === undefined) return;
    this.queueSave({ kind: "intermediate", changeSeq: this.dirtySeq });
  };

  private clearIntermediateTimer() {
    if (this.intermediateTimer) {
      clearTimeout(this.intermediateTimer);
      this.intermediateTimer = undefined;
    }
    this.intermediateDueAt = undefined;
  }

  private endFallbackEpisode(endedBy: "exact-save" | "session-end") {
    const episode = this.fallbackEpisode;
    if (!episode) return;
    this.fallbackEpisode = undefined;
    this.logEvent(LogEventName.CONTENT_SAVE_FALLBACK_END, {
      durationMs: Date.now() - episode.startedAt,
      intermediateSaves: episode.intermediateSaves,
      endedBy
    });
  }

  private logEvent(event: LogEventName, params: Record<string, unknown>) {
    try {
      this.options.logEvent?.(event, params);
    } catch (error) {
      console.error("Failed to log a content save event", error);
    }
  }

  // The newest content change written, or being written, by an intermediate save.
  private getIntermediateContentSeq() {
    let seq = this.intermediateSeq;
    this.writesInFlight.forEach(save => {
      if (save.kind === "intermediate") {
        seq = Math.max(seq, save.changeSeq);
      }
    });
    return seq;
  }

  private isOlderThanIntermediateContent(save: IPendingSave) {
    return save.kind !== "intermediate" && save.changeSeq < this.getIntermediateContentSeq();
  }

  // Replaces any save that hasn't been sent yet.
  private queueSave(save: IWaitingSave) {
    if (this.document.concurrent && "buildValues" in save) {
      save.notBefore = Date.now() + (this.options.random ?? Math.random)() * kGroupSaveJitterMs;
    }
    this.pendingSave = save;
    this.scheduleWrite();
    this.scheduleIntermediateSave();
  }

  private scheduleWrite() {
    this.clearWriteTimer();
    const waiting = this.pendingSave;
    if (waiting && !this.writesInFlight.has(waiting)
        && (this.isOlderThanIntermediateContent(waiting) || this.isReachedByEnvelope(getSaveIndex(waiting)))) {
      this.pendingSave = undefined;
      this.scheduleIntermediateSave();
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
      const gap = this.options.getMinimumGapMs?.(save)
        ?? (this.lastUserChangeSeq > this.savedSeq ? kMinimumSaveGapMs : kBackgroundSaveGapMs);
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

  private clearWriteTimer() {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = undefined;
    }
  }

  private write(queued: IWaitingSave) {
    this.writesInFlight.add(queued);
    this.lastWriteStartedAt = Date.now();
    let save: IQueuedSave;
    try {
      save = queued.kind === "intermediate" ? this.createIntermediateSave() : queued;
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
    if (save.kind === "intermediate") {
      this.lastIntermediateWriteAt = this.lastWriteStartedAt;
      if (!this.fallbackEpisode) {
        this.fallbackEpisode = { startedAt: this.lastWriteStartedAt, intermediateSaves: 0 };
        this.logEvent(LogEventName.CONTENT_SAVE_FALLBACK_START, { ...save.evidence });
      }
    }
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
    if (save.kind === "intermediate") {
      this.intermediateSeq = Math.max(this.intermediateSeq, save.changeSeq);
      if (this.fallbackEpisode) {
        this.fallbackEpisode.intermediateSaves++;
      }
    } else if (isNewest) {
      this.endFallbackEpisode("exact-save");
      this.noExactSaveSince = save.changeSeq >= this.dirtySeq ? undefined : Date.now();
    }
    if (isNewest) {
      this.reportWrite(save);
    }
    if (!this.showSavedIfCovered(save.changeSeq) && this.document.saveState === SaveState.Retrying) {
      this.setSaveState(SaveState.Saving);
    }
    this.scheduleWrite();
    this.scheduleIntermediateSave();
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

  // Records the envelope as an intermediate save leaves it, before that save lands.
  private recordNotExactEnvelope() {
    const lastHistoryEntryId = this.document.savedEnvelope?.lastHistoryEntryId;
    this.document.setSavedEnvelope(lastHistoryEntryId !== undefined ? { lastHistoryEntryId } : {});
  }

  // Sends the saved content's tools and reports the id the save was stamped with.
  private reportWrite(save: IQueuedSave) {
    this.sendToolsIfChanged(save.snapshot);
    if (this.document.concurrent && save.lastHistoryEntryId && save.index !== undefined) {
      this.advanceEnvelopeEntry({ id: save.lastHistoryEntryId, index: save.index });
      // Another member's save may already have reported a newer entry.
      if (save.index > this.reportedIndex) {
        this.reportedIndex = save.index;
        this.reportContentSaved(save.lastHistoryEntryId);
      }
    } else if (save.lastHistoryEntryId) {
      this.reportContentSaved(save.lastHistoryEntryId);
    }
  }

  private reportContentSaved(lastHistoryEntryId: string) {
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

  /**
   * Shows Saved when the indicator shows the user's changes as saving or retrying, and the content
   * through changeSeq, which holds the user's last change, is saved. Otherwise a save of background
   * changes would show Saved again each time the indicator clears it. Returns whether it showed Saved.
   */
  private showSavedIfCovered(changeSeq: number) {
    const { saveState } = this.document;
    if ((saveState !== SaveState.Saving && saveState !== SaveState.Retrying) || changeSeq < this.lastUserChangeSeq) {
      return false;
    }
    this.setSaveState(SaveState.Saved);
    return true;
  }

  // Each call is a document action, which the tree monitor records, so only call it on a change.
  private setSaveState(state: SaveState) {
    if (this.document.saveState !== state) {
      this.document.setSaveState(state);
    }
  }
}

/**
 * The document's sender, so a document has one writer however often it is attached. A sender that
 * is still saving after it was detached is attached again, and a disposed one is replaced.
 */
export function getContentSaveSender(document: DocumentModelType, options: IContentSaveSenderOptions) {
  const existing = senders.get(document);
  if (existing) {
    existing.attach(options);
    return existing;
  }
  const sender = new ContentSaveSender(document, options);
  senders.set(document, sender);
  return sender;
}
