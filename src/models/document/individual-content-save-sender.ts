import { getSnapshot } from "mobx-state-tree";
import { LogEventName } from "../../lib/logger-types";
import { isCommitSource } from "../history/history-commits";
import { collectNotExactEvidence, getSnapshotBlockers, getTreeManager } from "./content-save-checks";
import { buildIntermediateSave } from "./content-save-envelope";
import {
  ContentSaveSender, IPendingSave, IQueuedSave, IUnbuiltIntermediateSave, IWaitingSave
} from "./content-save-sender";
import { DocumentContentSnapshotType } from "./document-content";

export const kIntermediateSaveIntervalMs = 5000;

interface IFallbackEpisode {
  startedAt: number;
  intermediateSaves: number;
}

/**
 * The content save sender of a document with a single writer. One that has had unsaved changes and
 * no exact save for 5 seconds falls back to intermediate saves of its current content, which clear
 * exactThrough and record why. Each such stretch is logged once when its first intermediate save is
 * sent, and once when it ends.
 *
 * Only an exact save covers the latest change. When the drain times out before one does, one
 * intermediate save is sent. On page hide, the newest committed snapshot is sent at once.
 */
export class IndividualContentSaveSender extends ContentSaveSender {
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

  start() {
    super.start();
    // Listened to here rather than by the component, so a page hide also reaches a sender that is
    // draining after the component unmounted.
    window.addEventListener("pagehide", this.handlePageHideEvent);
    this.disposers.push(() => window.removeEventListener("pagehide", this.handlePageHideEvent));
    this.saveCaughtUpContent();
  }

  dispose() {
    this.endFallbackEpisode("session-end");
    super.dispose();
    this.clearIntermediateTimer();
  }

  // Only an exact save covers it: an intermediate save leaves the envelope without exactThrough, and
  // the next load can't catch up from it.
  protected isLatestChangeSaved() {
    return !this.hasSaveWaiting() && this.noExactSaveSince === undefined;
  }

  protected sendLastSave() {
    try {
      if (!this.isLatestChangeWritten()) {
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
  }

  // Whether a completed write, or one in flight, holds the latest change.
  private isLatestChangeWritten() {
    return this.savedSeq >= this.dirtySeq
      || Array.from(this.writesInFlight).some(save => save.changeSeq >= this.dirtySeq);
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
   * an intermediate save is sent instead.
   */
  handlePageHide() {
    if (!this.running) return;
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

  protected handleLocalChange() {
    if (this.noExactSaveSince === undefined) {
      this.noExactSaveSince = Date.now();
    }
    this.scheduleIntermediateSave();
  }

  protected handleSavesChanged() {
    this.scheduleIntermediateSave();
  }

  protected isSuperseded(save: IWaitingSave) {
    return this.isOlderThanIntermediateContent(save);
  }

  // An intermediate save is made from the content as it is each time it is sent.
  protected buildSave(save: IWaitingSave) {
    return save.kind === "intermediate" ? this.createIntermediateSave() : save;
  }

  protected handleWriteStarted(save: IQueuedSave, startedAt: number) {
    if (save.kind !== "intermediate") return;
    this.lastIntermediateWriteAt = startedAt;
    if (!this.fallbackEpisode) {
      this.fallbackEpisode = { startedAt, intermediateSaves: 0 };
      this.logEvent(LogEventName.CONTENT_SAVE_FALLBACK_START, { ...save.evidence });
    }
  }

  protected handleSaveWritten(save: IQueuedSave, isNewest: boolean) {
    if (save.kind === "intermediate") {
      this.intermediateSeq = Math.max(this.intermediateSeq, save.changeSeq);
      if (this.fallbackEpisode) {
        this.fallbackEpisode.intermediateSaves++;
      }
    } else if (isNewest) {
      this.endFallbackEpisode("exact-save");
      this.noExactSaveSince = save.changeSeq >= this.dirtySeq ? undefined : Date.now();
    }
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
    if (!this.running || this.pendingSave || this.noExactSaveSince === undefined
        || this.savedSeq >= this.dirtySeq) {
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

  // Records the envelope as an intermediate save leaves it, before that save lands.
  private recordNotExactEnvelope() {
    const lastHistoryEntryId = this.document.savedEnvelope?.lastHistoryEntryId;
    this.document.setSavedEnvelope(lastHistoryEntryId !== undefined ? { lastHistoryEntryId } : {});
  }
}
