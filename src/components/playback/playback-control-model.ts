import {
  computed, IReactionDisposer, makeAutoObservable, observable, reaction, runInAction
} from "mobx";
import { Instance } from "mobx-state-tree";
import { WithId } from "../../hooks/firestore-hooks";
import { CommentDocument } from "../../lib/firestore-schema";
import { HistoryEntryType } from "../../models/history/history";
import { logCurrentHistoryEvent } from "../../models/history/log-history-event";
import { HistoryPlaybackFailure, TreeManager } from "../../models/history/tree-manager";

// How long each stop stays on screen while the history plays itself.
export const kPlaybackStepMs = 500;

const kPlaybackFailureWarning = "History playback could not apply some changes and was stopped.";

// A stop's array index is the slider value that selects it, so the document before any of its
// history was applied needs a stop of its own at index 0. It describes no change, so it has no
// date. This is history position 0, which is where a `studentDocumentHistoryId=first` link
// lands — "first" being the sentinel logDocumentEvent emits for a change made before the
// document had any history entry.
interface IInitialSliderStop {
  kind: "initial";
}
interface IHistorySliderStop {
  kind: "history";
  entry: HistoryEntryType;
  index: number;
  created: Date;
}
export interface ICommentSliderStop {
  kind: "comment";
  entry: WithId<CommentDocument>;
  created: Date;
}
export type ISliderStop = IInitialSliderStop | IHistorySliderStop | ICommentSliderStop;

// A request for one stop, or for wherever the end of the slider is.
export type StopRequest = number | "end";

export interface IFailureMarker {
  failure: HistoryPlaybackFailure;
  // Percentage along the rail, for positioning the marker.
  location: number;
}

/**
 * The state behind the playback control: where the reader is in a document's history, what
 * the slider offers them, and the auto-play that walks them through it.
 *
 * Comments are not read here. They arrive from Firestore through React Query hooks, so the
 * component pushes them in with `setComments`.
 */
export class PlaybackControlModel {
  comments: WithId<CommentDocument>[] = [];
  simplePathComments: WithId<CommentDocument>[] = [];
  /**
   * What the reader last asked to see.
   *
   * `"end"` is a request to be wherever the end of the slider is, rather than for the stop
   * that happens to be last right now — that is what following along means, and it is how a
   * control that has not been touched starts out. A number is a request for that one stop:
   * several stops can share a history position — a comment and the entry before it — so once
   * the document reaches it, this is the only record of which of them was meant.
   * `undefined` means no request stands, and the thumb simply follows the document. That is
   * how a control opens when a link is about to send the document to a particular entry:
   * the reader asked for that entry, not for the end.
   */
  requestedStop: StopRequest | undefined;
  sliderPlaying = false;
  playbackFailureWarning: string | null = null;
  selectedFailure: HistoryPlaybackFailure | null = null;

  private treeManager: Instance<typeof TreeManager>;
  private advanceTimer: ReturnType<typeof setTimeout> | undefined = undefined;
  // The stop this model is on its way to: queued for the seek loop, or being sought now.
  // rc-slider reports every mouse move of a drag, and only the last of them is worth
  // seeking to.
  private queuedStopIndex: number | undefined = undefined;
  private seekLoop: Promise<void> | undefined = undefined;
  private followEndDisposer: IReactionDisposer;

  /**
   * @param initialRequest what the reader has already asked for. `"end"` for a control
   * opened normally; `undefined` when a link is about to send the document to a particular
   * history entry, so that the thumb follows it there rather than holding it at the end.
   */
  constructor(treeManager: Instance<typeof TreeManager>, initialRequest: StopRequest | undefined) {
    this.treeManager = treeManager;
    this.requestedStop = initialRequest;
    makeAutoObservable<PlaybackControlModel,
                       "treeManager" | "advanceTimer" | "queuedStopIndex" | "seekLoop" |
                       "followEndDisposer" | "requestedStopIndex">(this, {
      // The comment queries hand back a new array whenever their results change, so tracking
      // the reference is enough, and it leaves the comment objects themselves alone.
      comments: observable.ref,
      simplePathComments: observable.ref,
      selectedFailure: observable.ref,
      // A TreeManager's volatile state is shallow, so pushes onto historyPlaybackFailures are
      // not observable and could not invalidate a cached computed.
      uniqueFailures: false,
      treeManager: false,
      advanceTimer: false,
      seekLoop: false,
      followEndDisposer: false,
      requestedStopIndex: computed,
      queuedStopIndex: observable
    }, { autoBind: true });

    // A reader following along asked for the end of the slider, so a new stop appearing past
    // them is a new answer to that request. Entries and comments arrive the same way here.
    this.followEndDisposer = reaction(
      () => this.lastStopIndex,
      lastStopIndex => {
        if (this.requestedStop === "end") void this.goToSliderStop(lastStopIndex);
      }
    );
  }

  // The stop a request names, which for a request to follow along is wherever the end is now.
  private get requestedStopIndex() {
    return this.requestedStop === "end" ? this.lastStopIndex : this.requestedStop;
  }

  setComments(comments?: WithId<CommentDocument>[], simplePathComments?: WithId<CommentDocument>[]) {
    this.comments = comments ?? [];
    this.simplePathComments = simplePathComments ?? [];
  }

  get allComments() {
    return [...this.comments, ...this.simplePathComments]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  get sliderStops(): ISliderStop[] {
    // History entries must stay in index order (their position in the array),
    // not sorted by created time. Created times can be out of order when
    // sub-actions complete before their parent action.
    const historyStops: IHistorySliderStop[] = this.treeManager.document.history.map(
      (entry, index) => ({ kind: "history", entry, created: entry.created, index }));

    // Insert comments at the correct position among history entries based
    // on the comment's created time. Each comment goes after the last
    // history entry whose created time is <= the comment's created time.
    // allComments is already in created order.
    const allComments = this.allComments;
    const stops: ISliderStop[] = [{ kind: "initial" }];
    let commentIdx = 0;
    for (const historyStop of historyStops) {
      while (commentIdx < allComments.length &&
             allComments[commentIdx].createdAt.getTime() < historyStop.created.getTime()) {
        const comment = allComments[commentIdx];
        stops.push({ kind: "comment", entry: comment, created: comment.createdAt });
        commentIdx++;
      }
      stops.push(historyStop);
    }
    while (commentIdx < allComments.length) {
      const comment = allComments[commentIdx];
      stops.push({ kind: "comment", entry: comment, created: comment.createdAt });
      commentIdx++;
    }
    return stops;
  }

  get lastStopIndex() {
    return this.sliderStops.length - 1;
  }

  /**
   * The stop the document is at.
   *
   * This follows the document rather than what was asked of it. Its history position can move
   * without the slider being touched — a link into a document's history seeks with
   * goToHistoryEntryPosition — and a seek can be left short of where it was asked to go by an
   * entry that fails to apply. While a seek is running this still reports where the document
   * has got to, so it is sliderValue, not this, that says where the thumb belongs.
   */
  get currentStopIndex() {
    const requested = this.requestedStopIndex;
    const historyPosition = this.treeManager.numHistoryEventsApplied;
    // The position is undefined only while the manager looks up the document's last history
    // entry. That lookup is fired alongside the history load this control waits for, so the
    // two can land in either order and the control can mount during it. There is nothing to
    // follow yet, so answer with the request — which, before the reader has made one, is the
    // end of the history.
    if (historyPosition === undefined) return requested ?? this.lastStopIndex;
    // Several stops can share one history position — a comment and the entry before it — so
    // a stop that already represents the position is left alone rather than snapped onto the
    // history entry.
    if (requested !== undefined &&
        this.historyPositionForStopIndex(requested) === historyPosition) {
      return requested;
    }
    return this.stopIndexForHistoryPosition(historyPosition);
  }

  /**
   * The value to show on the slider.
   *
   * While a seek of our own is running the document has not moved yet, so currentStopIndex
   * still reports where the reader came from. Showing that would snap the thumb out from
   * under their cursor and let it crawl after them, so the destination stands in until the
   * move settles.
   *
   * Anything else that moves the document goes through currentStopIndex, which checks
   * requestedStopIndex still describes where the document is before answering with it.
   * Reading requestedStopIndex here instead would skip that check and put the thumb back on
   * a stop the reader asked for before the document was moved out from under it.
   */
  get sliderValue() {
    return this.queuedStopIndex ?? this.currentStopIndex;
  }

  // The stop the thumb is on. The readouts label the thumb, so they follow it to where a
  // running seek is headed rather than staying on the stop the document has yet to leave.
  get sliderStop(): ISliderStop | undefined {
    return this.sliderStops[this.sliderValue];
  }

  // When the change or comment the thumb is on was made. Undefined at the initial stop,
  // which describes no change.
  get sliderStopTime() {
    const stop = this.sliderStop;
    return stop?.kind === "initial" ? undefined : stop?.created;
  }

  // The entry the thumb's stop applied, if it is a history stop rather than a comment.
  get sliderStopHistoryIndex() {
    const stop = this.sliderStop;
    return stop?.kind === "history" ? stop.index : undefined;
  }

  get playbackDisabled() {
    return this.treeManager.numHistoryEventsApplied === undefined ||
      this.currentStopIndex === this.lastStopIndex;
  }

  /**
   * A slider stop is a state of the document rather than a change to it. A history position
   * counts applied entries, so position p is the document with entries 0..p-1 applied.
   *
   * A history stop is the document once its entry has been applied. A comment stop takes the
   * position of the entry before it, which is the document its author was looking at. The
   * initial stop is the document before any of the history was applied.
   */
  historyPositionForStopIndex(stopIndex: number) {
    const stops = this.sliderStops;
    for (let i = stopIndex; i >= 0; i--) {
      const stop = stops[i];
      if (stop?.kind === "history") return stop.index + 1;
    }
    return 0;
  }

  // The inverse: the stop that represents a history position. Every position within the
  // history has a history stop of its own, including the last; a comment written after the
  // final entry stands beyond that stop rather than in place of it.
  stopIndexForHistoryPosition(historyPosition: number) {
    if (historyPosition <= 0) return 0;
    // Nothing should ask for a position past the end of the history, but the last stop is
    // the closest thing to one if anything does.
    if (historyPosition > this.treeManager.document.history.length) return this.lastStopIndex;
    return this.sliderStops.findIndex(s => s.kind === "history" && s.index === historyPosition - 1);
  }

  getCommentLocation(comment: WithId<CommentDocument>) {
    const index = this.sliderStops.findIndex(s => s.kind === "comment" && s.entry.id === comment.id);
    return this.railLocation(index);
  }

  // One marker per failing entry, however many times playback has run into it.
  get uniqueFailures(): IFailureMarker[] {
    if (this.lastStopIndex <= 0) return [];

    const seenIndices = new Set<number>();
    const markers: IFailureMarker[] = [];
    for (const failure of this.treeManager.historyPlaybackFailures) {
      if (seenIndices.has(failure.historyIndex)) continue;
      seenIndices.add(failure.historyIndex);
      // The stop that would have applied the failing entry, which is the one playback
      // could not reach.
      markers.push({
        failure,
        location: this.railLocation(this.stopIndexForHistoryPosition(failure.historyIndex + 1))
      });
    }
    return markers;
  }

  setSelectedFailure(failure: HistoryPlaybackFailure | null) {
    this.selectedFailure = failure;
  }

  async goToSliderStop(stopIndex: number) {
    // Asking for the last stop is asking to be at the end. The behavior we want when they
    // are at the end is to stay at the end as new stops are added, so record the request as
    // "end" rather than as the index that happens to be last right now.
    this.requestedStop = stopIndex >= this.lastStopIndex ? "end" : stopIndex;
    this.queuedStopIndex = stopIndex;
    // Only one seek runs at a time. A request arriving while one is running waits for it,
    // and the loop then goes to wherever the reader has got to by that point rather than
    // replaying every stop they dragged across.
    if (!this.seekLoop) {
      this.seekLoop = this.runSeekLoop().finally(() => { this.seekLoop = undefined; });
    }
    await this.seekLoop;
  }

  async goToComment(comment: WithId<CommentDocument>) {
    const index = this.sliderStops.findIndex(s => s.kind === "comment" && s.entry.id === comment.id);
    if (index !== -1) {
      await this.goToSliderStop(index);
    }
  }

  togglePlay(playing?: boolean) {
    const playStatus = playing !== undefined ? playing : !this.sliderPlaying;
    logCurrentHistoryEvent(this.treeManager, playStatus ? "playStart" : "playStop");
    this.sliderPlaying = playStatus;
    this.clearAdvanceTimer();
    if (playStatus) this.scheduleAdvance();
  }

  dispose() {
    // A step whose seek is still running has no timer left to clear, so it has to be told
    // to stop the same way pausing tells it: by clearing the playing flag it checks before
    // scheduling the next step. Set directly rather than through togglePlay, which would
    // log a pause the reader never asked for.
    this.sliderPlaying = false;
    this.clearAdvanceTimer();
    this.followEndDisposer();
  }

  private async runSeekLoop() {
    // A stop stays queued for as long as its own seek is running, not just while it waits,
    // so that sliderValue holds the destination from the first request until the document
    // has settled there.
    while (this.queuedStopIndex !== undefined) {
      const target = this.queuedStopIndex;
      const position = this.historyPositionForStopIndex(target);
      await this.treeManager.goToHistoryEntryPosition(position);
      runInAction(() => {
        // A failed entry can block the move, leaving the document short of where it was
        // asked to go. currentStopIndex reports where it landed; the warning says why that
        // is not where the reader clicked.
        const actual = this.treeManager.numHistoryEventsApplied;
        const blocked = actual !== undefined && actual !== position;
        this.playbackFailureWarning = blocked ? kPlaybackFailureWarning : null;
        // The stop that was asked for was never reached, so there is nothing left to prefer
        // over wherever the document actually stopped.
        if (blocked) this.requestedStop = undefined;
        // A newer request may have arrived while this seek ran. Leave its target for the
        // next turn of the loop.
        if (this.queuedStopIndex === target) this.queuedStopIndex = undefined;
      });
    }
  }

  // Percentage along the rail, which spans the stops after the initial one.
  private railLocation(stopIndex: number) {
    if (this.lastStopIndex <= 0) return 0;
    return Math.max(0, Math.min(100, 100 * (stopIndex / this.lastStopIndex)));
  }

  private scheduleAdvance() {
    this.advanceTimer = setTimeout(() => void this.advance(), kPlaybackStepMs);
  }

  private clearAdvanceTimer() {
    if (this.advanceTimer !== undefined) {
      clearTimeout(this.advanceTimer);
      this.advanceTimer = undefined;
    }
  }

  // Each step schedules the next once its seek has settled, so the pace does not depend on
  // how long the document takes to replay.
  private async advance() {
    this.advanceTimer = undefined;
    if (!this.sliderPlaying) return;
    if (this.currentStopIndex >= this.lastStopIndex) {
      this.togglePlay(false);
      return;
    }

    await this.goToSliderStop(this.currentStopIndex + 1);

    // Play may have been stopped, or the document disposed, while the seek was running.
    if (!this.sliderPlaying) return;
    // Stop at an entry that cannot be applied rather than retrying it every step.
    if (this.playbackFailureWarning) {
      this.togglePlay(false);
      return;
    }
    this.scheduleAdvance();
  }
}
