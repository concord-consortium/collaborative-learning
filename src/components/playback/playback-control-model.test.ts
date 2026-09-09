import { IJsonPatch, Instance } from "mobx-state-tree";
import { createDocumentModel } from "../../models/document/document";
import { DocumentContentModel } from "../../models/document/document-content";
import { ProblemDocument } from "../../models/document/document-types";
import { CDocument, TreeManager } from "../../models/history/tree-manager";
import { HistoryEntry } from "../../models/history/history";
import { WithId } from "../../hooks/firestore-hooks";
import { CommentDocument } from "../../lib/firestore-schema";
import { kPlaybackStepMs, PlaybackControlModel, StopRequest } from "./playback-control-model";

// Playback logging reaches through the Logger into the global stores, which this test
// does not set up. The model is the subject here, not what it logs.
jest.mock("../../models/history/log-history-event", () => ({
  logCurrentHistoryEvent: jest.fn()
}));

// Entry N is created N minutes after this, so entries stay in a known time order.
const historyStart = new Date("2026-02-25T09:00:00").getTime();
const entryCreated = (index: number) => new Date(historyStart + index * 60 * 1000);
// Seconds rather than minutes, so a comment can be placed between two entries.
const commentCreated = (seconds: number) => new Date(historyStart + seconds * 1000);

// Patches pointing at a path the document does not have, so the entry throws
// whichever direction it is applied in.
const failingRecord = {
  tree: "test",
  action: "/setText",
  patches: [{ op: "replace", path: "/nothing/here", value: 1 }] as IJsonPatch[],
  inversePatches: [{ op: "replace", path: "/nothing/here", value: 0 }] as IJsonPatch[]
};

interface ISetupOptions {
  comments?: WithId<CommentDocument>[];
  // Where the document sits before the test starts. Defaults to the end of the history.
  appliedPosition?: number;
  // The one entry whose records cannot be applied.
  failingEntryIndex?: number;
  // What the reader has already asked for when the control opens. Absent means "end", the
  // way a control opens when no link is sending the document anywhere.
  initialRequest?: StopRequest | undefined;
}

function setupTreeManager(entryCount: number, options: ISetupOptions = {}) {
  const docModel = createDocumentModel({
    uid: "1",
    type: ProblemDocument,
    key: "test",
    content: DocumentContentModel.create({ tileMap: {} }) as any
  });
  const treeManager = docModel.treeManagerAPI as Instance<typeof TreeManager>;

  // Entries carry no patch records unless the test asks for a failing one, so seeking
  // between them moves the history position without needing tile content to replay against.
  const history = Array.from({ length: entryCount }, (_, index) => ({
    id: `entry-${index}`,
    tree: "test",
    model: "TestTile",
    action: "/setText",
    undoable: true,
    state: "complete" as const,
    created: entryCreated(index),
    records: index === options.failingEntryIndex ? [failingRecord] : []
  }));
  treeManager.setChangeDocument(CDocument.create({ history }));
  treeManager.setNumHistoryEntriesApplied(options.appliedPosition ?? entryCount);

  return treeManager;
}

function setupModel(entryCount: number, options: ISetupOptions = {}) {
  const treeManager = setupTreeManager(entryCount, options);
  const initialRequest = "initialRequest" in options ? options.initialRequest : "end";
  const model = new PlaybackControlModel(treeManager, initialRequest);
  model.setComments(options.comments ?? [], []);
  return { model, treeManager };
}

const addEntry = (treeManager: Instance<typeof TreeManager>, index: number) =>
  treeManager.addHistoryEntryAfterApplying(HistoryEntry.create({
    id: `entry-${index}`, tree: "test", model: "TestTile", action: "/setText",
    undoable: true, state: "complete", created: entryCreated(index), records: []
  }));

const makeComment = (id: string, createdAt: Date) => ({
  id, uid: "2", name: "Teacher 1", content: "Nice work", createdAt
}) as unknown as WithId<CommentDocument>;

// Only the playback timer is faked. A seek awaits its way through the tree, and faking the
// microtask scheduling it rides on would leave every seek in this file unresolved.
const kFakeOnlySetTimeout: Parameters<typeof jest.useFakeTimers>[0] = {
  doNotFake: [
    "Date", "hrtime", "nextTick", "performance", "queueMicrotask",
    "requestAnimationFrame", "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback",
    "setImmediate", "clearImmediate", "setInterval", "clearInterval"
  ]
};

// A run of the playback timer plus everything the seek it starts goes on to await.
// The seek resolves through a chain of already-resolved promises, so a handful of
// macrotask turns drains it.
const flushPromises = async () => {
  for (let i = 0; i < 5; i++) {
    await new Promise<void>(resolve => process.nextTick(resolve));
  }
};
const runPlaybackStep = async () => {
  jest.advanceTimersByTime(kPlaybackStepMs);
  await flushPromises();
};

describe("PlaybackControlModel", () => {
  beforeEach(() => {
    jest.useFakeTimers(kFakeOnlySetTimeout);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  describe("allComments", () => {
    it("merges the two comment queries into one list in created order", () => {
      const { model } = setupModel(2);
      model.setComments(
        [makeComment("late", commentCreated(90))],
        [makeComment("early", commentCreated(30))]
      );

      expect(model.allComments.map(c => c.id)).toEqual(["early", "late"]);
    });
  });

  describe("sliderStops", () => {
    it("starts with a stop for the document before any history was applied", () => {
      const { model } = setupModel(3);

      expect(model.sliderStops[0].kind).toBe("initial");
      expect(model.sliderStops.map(s => s.kind)).toEqual(["initial", "history", "history", "history"]);
    });

    it("places a comment after the last entry created before it", () => {
      // Entries are a minute apart, so 90 seconds in falls between entries 1 and 2.
      const { model } = setupModel(3, { comments: [makeComment("c1", commentCreated(90))] });

      expect(model.sliderStops.map(s => s.kind))
        .toEqual(["initial", "history", "history", "comment", "history"]);
    });

    it("keeps a comment written after the final entry at the end", () => {
      const { model } = setupModel(3, { comments: [makeComment("c1", commentCreated(600))] });

      expect(model.sliderStops.map(s => s.kind))
        .toEqual(["initial", "history", "history", "history", "comment"]);
    });

    it("grows as the document records new history entries", () => {
      const { model, treeManager } = setupModel(3);
      expect(model.sliderStops.length).toBe(4);

      treeManager.setChangeDocument(CDocument.create({
        history: [0, 1, 2, 3].map(index => ({
          id: `entry-${index}`, tree: "test", model: "TestTile", action: "/setText",
          undoable: true, state: "complete" as const, created: entryCreated(index), records: []
        }))
      }));

      expect(model.sliderStops.length).toBe(5);
    });
  });

  describe("historyPositionForStopIndex", () => {
    it("reports no entries applied at the initial stop", () => {
      const { model } = setupModel(3);

      expect(model.historyPositionForStopIndex(0)).toBe(0);
    });

    it("reports the entry a history stop applied", () => {
      const { model } = setupModel(3);

      // Stop 1 is entry 0 applied, which is a history position of 1.
      expect(model.historyPositionForStopIndex(1)).toBe(1);
    });

    it("reports the document a comment's author was looking at", () => {
      // Stops are [initial, h0, h1, comment, h2].
      const { model } = setupModel(3, { comments: [makeComment("c1", commentCreated(90))] });

      // Entries 0 and 1 were both applied before the comment was written.
      expect(model.historyPositionForStopIndex(3)).toBe(2);
    });
  });

  describe("stopIndexForHistoryPosition", () => {
    it("reports the initial stop for a document with no entries applied", () => {
      const { model } = setupModel(3);

      expect(model.stopIndexForHistoryPosition(0)).toBe(0);
    });

    it("reports the stop that applied the entry", () => {
      const { model } = setupModel(3);

      expect(model.stopIndexForHistoryPosition(2)).toBe(2);
    });

    it("reports the last history stop for the end of the history", () => {
      // Stops are [initial, h0, h1, h2, comment]. The end of the history is entry 2, which
      // is stop 3; the comment written after it stands beyond that stop, not in place of it.
      const { model } = setupModel(3, { comments: [makeComment("c1", commentCreated(600))] });

      expect(model.stopIndexForHistoryPosition(3)).toBe(3);
    });
  });

  describe("currentStopIndex", () => {
    it("starts at the end of the history", () => {
      const { model } = setupModel(5);

      expect(model.currentStopIndex).toBe(5);
    });

    it("follows the document when something else seeks it", async () => {
      const { model, treeManager } = setupModel(5);

      // A deep link into history seeks the document without touching the slider.
      await treeManager.goToHistoryEntryPosition(2);

      expect(model.currentStopIndex).toBe(2);
    });

    // Dragging to the end of the slider asks for the trailing comment, whose history position
    // is the end of the history, so the document agrees with the request and it stands.
    it("stays on the trailing comment after the reader drags back and forward again", async () => {
      // Stops are [initial, h0, h1, h2, comment].
      const { model } = setupModel(3, { comments: [makeComment("c1", commentCreated(600))] });

      await model.goToSliderStop(1);
      await model.goToSliderStop(model.lastStopIndex);

      expect(model.currentStopIndex).toBe(4);
      expect(model.sliderValue).toBe(4);
    });

    it("follows a new trailing comment after the reader drags back and forward again", async () => {
      // Stops are [initial, h0, h1, h2, c1].
      const { model } = setupModel(3, { comments: [makeComment("c1", commentCreated(600))] });
      await model.goToSliderStop(1);
      await model.goToSliderStop(model.lastStopIndex);

      model.setComments(
        [makeComment("c1", commentCreated(600)), makeComment("c2", commentCreated(900))], []);

      // Dragging to the end asks to be at the end, not to be pinned to whichever stop
      // happened to be last at the time.
      expect(model.currentStopIndex).toBe(5);
      expect(model.sliderValue).toBe(5);
    });

    // The readout names the entry a stop applied, so landing on the comment instead would
    // stop naming the change on screen.
    it("lands on the entry on screen when a seek it did not ask for reaches the end", async () => {
      // Stops are [initial, h0, h1, h2, comment].
      const { model, treeManager } = setupModel(3, {
        comments: [makeComment("c1", commentCreated(600))], appliedPosition: 0
      });
      await model.goToSliderStop(1);

      await treeManager.goToHistoryEntryPosition(3);

      expect(model.currentStopIndex).toBe(3);
    });

    // The reader who has not picked a stop sits at the end of the slider, and a comment
    // written after the final entry becomes the new end.
    it("follows a new trailing comment when the reader has not picked a stop", () => {
      const { model } = setupModel(3);
      expect(model.currentStopIndex).toBe(3);

      model.setComments([makeComment("c1", commentCreated(600))], []);

      expect(model.currentStopIndex).toBe(4);
    });

    // stopIndexForHistoryPosition answers the end of the history with the last stop, which is
    // the trailing comment. The reader asked for the entry, so requestedStopIndex has to
    // outrank that — which is why it cannot be kept for comment stops alone.
    it("stays on the last history stop when comments sit after the final entry", async () => {
      // Stops are [initial, h0, h1, h2, comment].
      const { model } = setupModel(3, { comments: [makeComment("c1", commentCreated(600))] });

      await model.goToSliderStop(3);

      expect(model.currentStopIndex).toBe(3);
    });

    it("stays on a comment stop that already represents the document's position", async () => {
      // Stops are [initial, h0, h1, comment, h2]; the comment and entry 1 share position 2.
      const { model } = setupModel(3, { comments: [makeComment("c1", commentCreated(90))] });

      await model.goToSliderStop(3);

      expect(model.currentStopIndex).toBe(3);
    });
  });

  describe("sliderValue", () => {
    // The document does not move until the seek finishes, so currentStopIndex still reports
    // where the reader came from. Showing that would snap the thumb back out from under
    // their cursor and let it crawl after them.
    it("shows where a running seek is headed, not where the document still is", async () => {
      const { model } = setupModel(5, { appliedPosition: 0 });

      const seek = model.goToSliderStop(4);

      expect(model.currentStopIndex).toBe(0);
      expect(model.sliderValue).toBe(4);
      await seek;
      expect(model.sliderValue).toBe(4);
    });

    it("shows where the document is once nothing is moving it", () => {
      const { model } = setupModel(5);

      expect(model.sliderValue).toBe(model.currentStopIndex);
    });

    // requestedStopIndex is kept after a seek lands, because it is the only record of which
    // of the stops sharing that history position was meant. A later seek must not resurrect
    // it as a destination.
    it("does not jump back to an earlier request when something else seeks again", async () => {
      const { model, treeManager } = setupModel(6);
      await model.goToSliderStop(4);

      // A link into the document's history moves it twice, without the slider being touched.
      await treeManager.goToHistoryEntryPosition(1);
      const secondSeek = treeManager.goToHistoryEntryPosition(3);

      // On its way from stop 1, not back at the stop requested before either seek.
      expect(model.sliderValue).toBe(1);
      await secondSeek;
      expect(model.sliderValue).toBe(3);
    });

    it("reports where playback stopped after an entry could not be applied", async () => {
      const { model } = setupModel(4, { appliedPosition: 0, failingEntryIndex: 2 });

      await jestSpyConsole("warn", async () => {
        await model.goToSliderStop(4);
      });

      // Not stop 4, which is what was asked for and never reached.
      expect(model.sliderValue).toBe(2);
    });

    // Otherwise the thumb flashes through the stop the blocked seek was asked for before
    // heading where the reader has just sent it.
    it("goes straight to a new destination after a blocked seek", async () => {
      const { model } = setupModel(4, { appliedPosition: 0, failingEntryIndex: 2 });
      await jestSpyConsole("warn", async () => {
        await model.goToSliderStop(4);
      });

      const seek = model.goToSliderStop(1);

      expect(model.sliderValue).toBe(1);
      await seek;
    });
  });

  describe("following the end of the history", () => {
    // Entries recorded while the reader watches do not move the document on their own, so a
    // reader sitting at the end would be left a stop behind the change that just happened.
    it("advances to a new history entry when the reader is at the end", async () => {
      const { model, treeManager } = setupModel(3);
      expect(model.currentStopIndex).toBe(3);

      addEntry(treeManager, 3);
      await flushPromises();

      expect(treeManager.numHistoryEventsApplied).toBe(4);
      expect(model.currentStopIndex).toBe(4);
      expect(model.sliderValue).toBe(4);
    });

    it("advances to a new history entry after the reader drags back and forward again",
        async () => {
      const { model, treeManager } = setupModel(3);
      await model.goToSliderStop(1);
      await model.goToSliderStop(model.lastStopIndex);

      addEntry(treeManager, 3);
      await flushPromises();

      expect(model.currentStopIndex).toBe(4);
    });

    // A link asking for one entry of a document opens the control with no request to be at
    // the end, because the reader asked for that entry instead.
    it("leaves a reader a link sent into the history where they are", async () => {
      const { model, treeManager } = setupModel(3, { initialRequest: undefined });
      await treeManager.goToHistoryEntryPosition(1);
      expect(model.currentStopIndex).toBe(1);

      addEntry(treeManager, 3);
      await flushPromises();

      expect(treeManager.numHistoryEventsApplied).toBe(1);
      expect(model.currentStopIndex).toBe(1);
    });

    // The control can open before the manager has finished looking up where the document
    // sits, so the position arrives afterwards. That is not the reader going anywhere.
    it("keeps following the end when the document's position arrives after it opens", async () => {
      const { model, treeManager } = setupModel(3, { appliedPosition: 0 });
      treeManager.setNumHistoryEntriesApplied(3);

      addEntry(treeManager, 3);
      await flushPromises();

      expect(model.currentStopIndex).toBe(4);
    });

    it("leaves a reader who has picked a stop where they are", async () => {
      const { model, treeManager } = setupModel(3);
      await model.goToSliderStop(1);

      addEntry(treeManager, 3);
      await flushPromises();

      expect(model.currentStopIndex).toBe(1);
    });
  });

  describe("goToSliderStop", () => {
    // rc-slider reports every mouse move of a drag, and each one used to start its own
    // replay through the trees on top of the ones already running.
    it("runs one seek at a time, skipping the stops a drag passed through", async () => {
      const { model, treeManager } = setupModel(6, { appliedPosition: 0 });
      const seekSpy = jest.spyOn(treeManager, "goToHistoryEntryPosition");

      const first = model.goToSliderStop(1);
      const second = model.goToSliderStop(3);
      const third = model.goToSliderStop(6);
      await Promise.all([first, second, third]);

      // The first request starts a seek; the two that arrive while it runs collapse into
      // one more seek to the last of them.
      expect(seekSpy.mock.calls.map(call => call[0])).toEqual([1, 6]);
      expect(treeManager.numHistoryEventsApplied).toBe(6);
      expect(model.sliderValue).toBe(6);
      seekSpy.mockRestore();
    });

    it("keeps the thumb on the newest destination while earlier requests are still settling",
        async () => {
      const { model } = setupModel(6, { appliedPosition: 0 });

      const first = model.goToSliderStop(1);
      const second = model.goToSliderStop(5);

      expect(model.sliderValue).toBe(5);
      await Promise.all([first, second]);
    });

    it("reports the moment the document is showing", async () => {
      const { model } = setupModel(3, { appliedPosition: 0 });

      await model.goToSliderStop(2);

      // Stop 2 is the document once entry 1 has been applied.
      expect(model.sliderStopTime).toEqual(entryCreated(1));
    });

    // The readouts sit beside the thumb and label it, so during a drag they have to name
    // where the reader is pointing rather than the stop the document has yet to leave.
    it("labels the stop the thumb is on while a seek is running", async () => {
      const { model } = setupModel(5, { appliedPosition: 0 });

      const seek = model.goToSliderStop(4);

      expect(model.currentStopIndex).toBe(0);
      expect(model.sliderStopHistoryIndex).toBe(3);
      expect(model.sliderStopTime).toEqual(entryCreated(3));
      await seek;
    });

    it("reports no moment at the initial stop, which describes no change", async () => {
      const { model } = setupModel(3);

      await model.goToSliderStop(0);

      expect(model.sliderStopTime).toBeUndefined();
    });

    it("warns and reports where playback stopped when an entry cannot be applied", async () => {
      // Stops are [initial, h0, h1, h2, h3] and entry 2 cannot be applied.
      const { model } = setupModel(4, { appliedPosition: 0, failingEntryIndex: 2 });

      await jestSpyConsole("warn", async () => {
        await model.goToSliderStop(4);
      });

      expect(model.playbackFailureWarning).toBeTruthy();
      // Entries 0 and 1 were applied before entry 2 blocked the move, so the
      // document stands at position 2, which is the stop that applied entry 1.
      expect(model.currentStopIndex).toBe(2);
    });

    it("clears an earlier warning once a seek lands where it was asked to", async () => {
      const { model } = setupModel(4, { appliedPosition: 0, failingEntryIndex: 2 });
      await jestSpyConsole("warn", async () => {
        await model.goToSliderStop(4);
      });
      expect(model.playbackFailureWarning).toBeTruthy();

      await model.goToSliderStop(1);

      expect(model.playbackFailureWarning).toBeNull();
      expect(model.currentStopIndex).toBe(1);
    });
  });

  describe("goToComment", () => {
    it("shows the document as it stood when the comment was written", async () => {
      const comment = makeComment("c1", commentCreated(90));
      const { model, treeManager } = setupModel(3, { comments: [comment] });

      await model.goToComment(comment);

      expect(treeManager.numHistoryEventsApplied).toBe(2);
      expect(model.currentStopIndex).toBe(3);
    });
  });

  describe("getCommentLocation", () => {
    it("places a comment along the rail by its stop index", () => {
      // Stops are [initial, h0, h1, comment, h2], so the comment is 3 of 4 along.
      const comment = makeComment("c1", commentCreated(90));
      const { model } = setupModel(3, { comments: [comment] });

      expect(model.getCommentLocation(comment)).toBe(75);
    });
  });

  describe("playback", () => {
    it("advances one stop at a time while playing", async () => {
      const { model } = setupModel(3, { appliedPosition: 0 });
      model.togglePlay(true);

      await runPlaybackStep();
      expect(model.currentStopIndex).toBe(1);

      await runPlaybackStep();
      expect(model.currentStopIndex).toBe(2);
    });

    it("stops playing once it reaches the end of the history", async () => {
      const { model } = setupModel(2, { appliedPosition: 0 });
      model.togglePlay(true);

      await runPlaybackStep();
      await runPlaybackStep();
      expect(model.currentStopIndex).toBe(2);

      await runPlaybackStep();
      expect(model.sliderPlaying).toBe(false);
    });

    it("stops playing when an entry cannot be applied", async () => {
      const { model } = setupModel(3, { appliedPosition: 0, failingEntryIndex: 1 });
      model.togglePlay(true);

      await jestSpyConsole("warn", async () => {
        await runPlaybackStep();
        await runPlaybackStep();
      });

      expect(model.playbackFailureWarning).toBeTruthy();
      expect(model.sliderPlaying).toBe(false);
    });

    it("stops advancing once disposed", async () => {
      const { model } = setupModel(3, { appliedPosition: 0 });
      model.togglePlay(true);

      model.dispose();
      await runPlaybackStep();

      expect(model.currentStopIndex).toBe(0);
    });

    it("stops advancing when disposed while a step is seeking", async () => {
      const { model } = setupModel(3, { appliedPosition: 0 });
      model.togglePlay(true);

      // The timer has already fired, so there is no pending one for disposal to clear. The
      // step in flight has to notice the disposal itself rather than schedule the next one.
      jest.advanceTimersByTime(kPlaybackStepMs);
      model.dispose();
      await flushPromises();
      expect(model.currentStopIndex).toBe(1);

      await runPlaybackStep();
      expect(model.currentStopIndex).toBe(1);
    });
  });

  describe("uniqueFailures", () => {
    it("reports one marker per failing entry however often it has failed", async () => {
      const { model } = setupModel(4, { appliedPosition: 0, failingEntryIndex: 2 });

      await jestSpyConsole("warn", async () => {
        await model.goToSliderStop(4);
        await model.goToSliderStop(0);
        await model.goToSliderStop(4);
      });

      expect(model.uniqueFailures.length).toBe(1);
      // The stop that would have applied entry 2 is stop 3, which is 3 of 4 along the rail.
      expect(model.uniqueFailures[0].location).toBe(75);
    });
  });
});
