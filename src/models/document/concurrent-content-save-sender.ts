import { comparer, reaction } from "mobx";
import { getSnapshot } from "mobx-state-tree";
import { IExactThrough } from "../../lib/db-types";
import { LogEventName } from "../../lib/logger-types";
import { ICommittedEntry } from "../history/history-commits";
import { SessionExactness } from "../history/session-exactness";
import { getConcurrentHistoryState, getOpenEntries, getSnapshotBlockers, getTreeManager } from "./content-save-checks";
import { buildExactSave } from "./content-save-envelope";
import { ContentSaveSender, getSaveIndex, IQueuedSave, IWaitingSave } from "./content-save-sender";
import { SaveState } from "./document";
import { DocumentContentModelType, DocumentContentSnapshotType } from "./document-content";

// The most time a concurrent document's save waits, at random, before checking the envelope again.
export const kConcurrentSaveJitterMs = 200;

// The envelope children a concurrent document listens to.
const kEnvelopeFields = ["lastHistoryEntryId", "exactThrough"] as const;
type EnvelopeValues = Partial<Record<typeof kEnvelopeFields[number], unknown>>;

// The concurrent document sessions whose stop has been logged, so a later sender doesn't log it
// again.
const concurrentSessionsLoggedAsStopped = new WeakSet<SessionExactness>();

/**
 * The content save sender of a concurrent document, which other members save too. It also saves the
 * current content, stamped with the head of the shared chain, whenever its history settles past what
 * the envelope holds, since an idle member has no entries of its own to save. Other members save the
 * same envelope, so its save waits a random time and is dropped if the envelope already reaches its
 * entry, before and after that wait. A save by another member that covers this client's committed
 * changes shows them as saved.
 *
 * It makes no intermediate saves, and a page hide sends nothing early: the document has other
 * writers, so it saves through its usual checks.
 */
export class ConcurrentContentSaveSender extends ContentSaveSender {
  // The newest entry the envelope has been seen to hold.
  private envelopeEntry: ICommittedEntry | undefined;
  private envelopeValues: EnvelopeValues = {};
  private envelopeCheckScheduled = false;
  private stopEnvelopeListener: (() => void) | undefined;
  // The index of the newest entry reported to onContentSaved.
  private reportedIndex = -1;
  private settledCheckScheduled = false;

  start() {
    super.start();
    const treeManager = getTreeManager(this.document);
    if (!treeManager) return;
    const { lastHistoryEntryId, exactThrough } = this.document.savedEnvelope ?? {};
    if (lastHistoryEntryId && exactThrough) {
      this.advanceEnvelopeEntry({ id: lastHistoryEntryId, index: exactThrough.index });
    }
    this.listenToEnvelope();
    this.disposers.push(() => this.stopEnvelopeListener?.());
    // A concurrent document makes no intermediate saves, so this client saves no more content.
    this.disposers.push(reaction(() => treeManager.exactness.notExactReason, reason => {
      if (!reason || concurrentSessionsLoggedAsStopped.has(treeManager.exactness)) return;
      concurrentSessionsLoggedAsStopped.add(treeManager.exactness);
      this.logEvent(LogEventName.CONTENT_SAVE_CONCURRENT_STOPPED, { reason });
    }, { fireImmediately: true }));
    this.disposers.push(reaction(() => {
      const manager = getConcurrentHistoryState(this.document);
      return [manager?.isHistorySettled, manager?.applying, manager?.expectedRemoteHead,
        manager?.expectedRemoteHeadIndex, getOpenEntries(this.document).length,
        this.document.treeMonitor?.runningCallCount, treeManager.exactness.isExact];
    }, this.scheduleSettledCheck, { fireImmediately: true, equals: comparer.structural }));
  }

  protected handleRtdbEnvelopeRefChanged() {
    this.listenToEnvelope();
  }

  // A save by another member that reaches this client's newest committed entry also covers it.
  protected isLatestChangeSaved() {
    if (this.hasSaveWaiting()) return false;
    const committed = this.lastCommittedLocal;
    return this.savedSeq >= this.dirtySeq
      || (!!committed && committed.changeSeq >= this.dirtySeq && this.isReachedByEnvelope(committed.index));
  }

  // A save keeps the wait of the save it replaces, so commits that come faster than the jitter don't
  // keep putting the save off.
  protected queueSave(save: IWaitingSave) {
    if ("buildValues" in save) {
      const replaced = this.pendingSave;
      save.notBefore = replaced && !this.writesInFlight.has(replaced) && "buildValues" in replaced
          && replaced.notBefore !== undefined
        ? replaced.notBefore
        : Date.now() + (this.options.random ?? Math.random)() * kConcurrentSaveJitterMs;
    }
    super.queueSave(save);
  }

  protected isSuperseded(save: IWaitingSave) {
    return this.isReachedByEnvelope(getSaveIndex(save));
  }

  protected handleLocalEntriesCommitted() {
    this.checkSavedByAnotherMember();
  }

  protected reportSavedEntry(save: IQueuedSave) {
    if (!save.lastHistoryEntryId || save.index === undefined) {
      super.reportSavedEntry(save);
      return;
    }
    this.advanceEnvelopeEntry({ id: save.lastHistoryEntryId, index: save.index });
    // Another member's save may already have reported a newer entry.
    if (save.index > this.reportedIndex) {
      this.reportedIndex = save.index;
      this.reportContentSaved(save.lastHistoryEntryId);
    }
  }

  // Listens only to the envelope's id and exactThrough, not its content, so exactThrough's content
  // hash isn't checked. A client that doesn't know exactThrough stamps its own id over it, so a
  // match on the id is what is checked.
  private listenToEnvelope() {
    this.stopEnvelopeListener?.();
    this.envelopeValues = {};
    const { rtdbEnvelopeRef } = this.options;
    const removers = kEnvelopeFields.map(field => {
      const ref = rtdbEnvelopeRef.child(field);
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
    if (committed.changeSeq >= this.dirtySeq) {
      this.setSaveState(SaveState.Saved);
    }
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
    const manager = getConcurrentHistoryState(this.document);
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
    this.setSaveState(SaveState.Saved);
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
}
