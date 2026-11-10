import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Instance } from "mobx-state-tree";
import { createDocumentModel } from "../../models/document/document";
import { DocumentContentModel } from "../../models/document/document-content";
import { ProblemDocument } from "../../models/document/document-types";
import { CDocument, TreeManager } from "../../models/history/tree-manager";
import { HistoryEntry } from "../../models/history/history";
import { IVirtualConversion, registerHistoryBridge } from "../../models/history/history-bridges";
import { kSeekProgressDelayMs, PlaybackControlComponent } from "./playback-control";
import { PlaybackControlModel } from "./playback-control-model";

// The slider is the subject of these tests, so everything the component pulls
// from stores and Firestore hooks is stubbed; only the TreeManager is real.
jest.mock("../../hooks/use-stores", () => ({
  useStores: () => ({
    user: { id: "1" },
    displayedActiveNavTab: "my-work",
    // Read by the ChatAvatar inside each comment marker.
    class: { getUserById: () => undefined }
  }),
  usePersistentUIStore: () => ({ focusDocument: "test" })
}));

// Both hooks must hand back the same array identity on every call, the way the real
// query hooks do. Returning a fresh [] each render makes the component's memos recompute
// every render, which hides staleness bugs that only appear against stable data.
let mockComments: any[] = [];
const noComments: any[] = [];
jest.mock("../../hooks/document-comment-hooks", () => ({
  useDocumentComments: () => ({ isLoading: false, isError: false, data: mockComments, error: undefined }),
  useDocumentCommentsAtSimplifiedPath: () =>
    ({ isLoading: false, isError: false, data: noComments, error: undefined })
}));

// The real setter comes from useState, so it keeps the same identity across renders.
// A fresh jest.fn() each call would look like a changing dependency to the component.
const mockSetPlaybackTime = jest.fn();
jest.mock("../../hooks/use-nav-tab-panel-info", () => ({
  useNavTabPanelInfo: () => ({ setPlaybackTime: mockSetPlaybackTime })
}));

// The conversions the test bridge reports, standing in for a legacy tile whose old state can't
// be rebuilt. A test sets them before building its document.
let mockVirtualConversions: IVirtualConversion[] = [];
registerHistoryBridge({ findVirtualConversions: () => mockVirtualConversions });

// Entry N is created N minutes after this, so entries stay in a known time order.
const historyStart = new Date("2026-02-25T09:00:00").getTime();
const entryCreated = (index: number) => new Date(historyStart + index * 60 * 1000);

// backgroundIndexes are the entries produced by code rather than by a person.
function setupTreeManager(entryCount: number, backgroundIndexes: number[] = []) {
  const docModel = createDocumentModel({
    uid: "1",
    type: ProblemDocument,
    key: "test",
    content: DocumentContentModel.create({ tileMap: {} }) as any
  });
  const treeManager = docModel.treeManagerAPI as Instance<typeof TreeManager>;

  // Entries carry no patch records, so seeking between them moves the history
  // position without needing tile content to replay against.
  const history = Array.from({ length: entryCount }, (_, index) => ({
    id: `entry-${index}`,
    tree: "test",
    model: "TestTile",
    action: "/setText",
    undoable: true,
    state: "complete" as const,
    created: entryCreated(index),
    records: [],
    ...(backgroundIndexes.includes(index) ? { background: true } : {})
  }));
  treeManager.setChangeDocument(CDocument.create({ history }));
  treeManager.setNumHistoryEntriesApplied(entryCount);

  return treeManager;
}

const sliderValue = () => screen.getByRole("slider").getAttribute("aria-valuenow");
const sliderMax = () => screen.getByRole("slider").getAttribute("aria-valuemax");

describe("PlaybackControlComponent", () => {
  beforeEach(() => {
    mockComments = [];
    mockSetPlaybackTime.mockClear();
  });

  it("moves the thumb when a programmatic seek moves the document", async () => {
    const treeManager = setupTreeManager(5);
    render(<PlaybackControlComponent treeManager={treeManager} requestedHistoryId={undefined} />);

    // A deep link into history seeks the document without touching the slider.
    await act(async () => { await treeManager.goToHistoryEntryPosition(2); });

    expect(sliderValue()).toBe("2");
  });

  it("shows the document as it stood when a clicked comment was written", async () => {
    const treeManager = setupTreeManager(3);
    // Between entries 1 and 2, so the slider entries are [h0, h1, comment, h2].
    mockComments = [{
      id: "c1", uid: "2", name: "Teacher 1", content: "Nice work",
      createdAt: new Date(historyStart + 90 * 1000)
    }];
    render(<PlaybackControlComponent treeManager={treeManager} requestedHistoryId={undefined} />);

    const marker = screen.getByTestId("comment-markers").querySelector(".comment-marker");
    assertIsDefined(marker);
    await act(async () => { fireEvent.click(marker); });

    // Entries 0 and 1 were both applied before the comment was written, so both belong
    // in the document the commenter was looking at.
    expect(treeManager.numHistoryEventsApplied).toBe(2);
    // The thumb belongs on the comment the user clicked, which is the third stop.
    expect(sliderValue()).toBe("3");
  });

  // The document can be edited while its history is open — an undo in the primary document
  // records an entry — and the slider has to grow with it, or the reader cannot reach the
  // change that was just made and the play button stays disabled at what is no longer the end.
  it("grows the slider when the document records a new history entry", async () => {
    const treeManager = setupTreeManager(3);
    render(<PlaybackControlComponent treeManager={treeManager} requestedHistoryId={undefined} />);
    expect(sliderMax()).toBe("3");

    await act(async () => {
      treeManager.addHistoryEntryAfterApplying(HistoryEntry.create({
        id: "entry-3",
        tree: "test",
        model: "TestTile",
        action: "/setText",
        undoable: true,
        state: "complete",
        created: entryCreated(3),
        records: []
      }));
    });

    expect(sliderMax()).toBe("4");
  });

  // The chat panel filters itself to the moment on screen. A link into a document's history
  // moves the document without the slider being touched, and the panel has to follow.
  it("tells the chat panel which moment the document is showing", async () => {
    const treeManager = setupTreeManager(5);
    render(<PlaybackControlComponent treeManager={treeManager} requestedHistoryId={undefined} />);
    mockSetPlaybackTime.mockClear();

    await act(async () => { await treeManager.goToHistoryEntryPosition(2); });

    // Position 2 is entries 0 and 1 applied, so entry 1 is the change on screen.
    expect(mockSetPlaybackTime).toHaveBeenCalledWith(entryCreated(1));
  });

  // Otherwise the chat panel goes on hiding the comments written after whatever moment the
  // reader happened to leave the slider on.
  it("stops filtering the chat panel once playback closes", () => {
    const treeManager = setupTreeManager(5);
    const { unmount } = render(<PlaybackControlComponent treeManager={treeManager} requestedHistoryId={undefined} />);
    mockSetPlaybackTime.mockClear();

    unmount();

    expect(mockSetPlaybackTime).toHaveBeenCalledWith(undefined);
  });

  // The readout names the change the reader is looking at. Naming the entry that has not
  // been applied yet would describe the document they are about to see, not this one.
  it("labels the position with the entry that has been applied", async () => {
    const treeManager = setupTreeManager(3);
    render(<PlaybackControlComponent treeManager={treeManager} requestedHistoryId={undefined} />);

    await act(async () => { await treeManager.goToHistoryEntryPosition(2); });

    // Position 2 is entries 0 and 1 applied, so entry 1 is the change on screen.
    const timeInfo = screen.getByTestId("playback-time-info").textContent;
    expect(timeInfo).toContain("(1)");
    expect(timeInfo).toContain("9:01 am");
  });

  describe("link marker", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("marks the point a link asked for and goes back to it when clicked", async () => {
      const goToLink = jest.spyOn(PlaybackControlModel.prototype, "goToLink");
      // Entries 1 and 2 are background, so the link to entry 2 has a stop of its own.
      const treeManager = setupTreeManager(4, [1, 2]);
      render(<PlaybackControlComponent treeManager={treeManager} requestedHistoryId="entry-2" />);
      await act(async () => { await treeManager.goToHistoryEntryPosition(0); });

      const marker = screen.getByRole("button", { name: "Linked point in history" });
      await act(async () => { fireEvent.click(marker); });

      expect(goToLink).toHaveBeenCalledTimes(1);
      expect(treeManager.numHistoryEventsApplied).toBe(3);
      // The stops are [initial, entry 0, link, entry 3].
      expect(sliderValue()).toBe("2");
    });

    it("moves the link marker when a new link arrives for the open document", async () => {
      // Entries 1 to 4 are background. The link to entry 2 has its own stop, and the link to
      // entry 0 shares the stop of that change.
      const treeManager = setupTreeManager(6, [1, 2, 3, 4]);
      const { container, rerender } =
        render(<PlaybackControlComponent treeManager={treeManager} requestedHistoryId="entry-2" />);
      const markerLeft = () =>
        (container.querySelector(".link-marker") as HTMLElement | null)?.style.left;
      // The stops are [initial, entry 0, link, entry 5].
      expect(markerLeft()).toMatch(/^calc\(66\.66\d*% - 10px\)$/);

      rerender(<PlaybackControlComponent treeManager={treeManager} requestedHistoryId="entry-0" />);

      // The stops are [initial, entry 0, entry 5].
      expect(markerLeft()).toBe("calc(50% - 10px)");
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Linked point in history" }));
      });
      expect(treeManager.numHistoryEventsApplied).toBe(1);
    });

    it("has no link marker without a link", () => {
      const treeManager = setupTreeManager(3);
      render(<PlaybackControlComponent treeManager={treeManager} requestedHistoryId={undefined} />);

      expect(screen.queryByRole("button", { name: "Linked point in history" })).toBeNull();
    });
  });

  describe("unavailable range", () => {
    afterEach(() => {
      mockVirtualConversions = [];
    });

    it("shades the stops before the earliest available one", () => {
      mockVirtualConversions = [{ position: 3, oldJson: undefined, path: "/content/tileMap/t1" }];
      const treeManager = setupTreeManager(5, [1, 2]);
      render(<PlaybackControlComponent treeManager={treeManager} requestedHistoryId={undefined} />);

      // The stops are [initial, entry 0, earliest, entry 3, entry 4].
      expect(screen.getByTestId("playback-unavailable-range").style.width).toBe("50%");
    });

    it("shades nothing when all of the history is available", () => {
      const treeManager = setupTreeManager(5, [1, 2]);
      render(<PlaybackControlComponent treeManager={treeManager} requestedHistoryId={undefined} />);

      expect(screen.queryByTestId("playback-unavailable-range")).toBeNull();
    });
  });

  describe("progress for a slow move", () => {
    // Only setTimeout is faked: the component's delay is a timer, and the seek rides on
    // microtasks and nextTick that must keep running.
    beforeEach(() => {
      jest.useFakeTimers({
        doNotFake: [
          "Date", "hrtime", "nextTick", "performance", "queueMicrotask",
          "requestAnimationFrame", "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback",
          "setImmediate", "clearImmediate", "setInterval", "clearInterval"
        ]
      });
    });
    afterEach(() => {
      jest.useRealTimers();
    });

    it("shows the progress indicator only after a seek has run for 300 ms", async () => {
      expect(kSeekProgressDelayMs).toBe(300);
      const treeManager = setupTreeManager(5);
      let finishSeek: () => void = () => undefined;
      jest.spyOn(treeManager, "goToHistoryEntryPosition")
        .mockImplementation(() => new Promise<void>(resolve => { finishSeek = resolve; }));
      render(<PlaybackControlComponent treeManager={treeManager} requestedHistoryId={undefined} />);
      const status = screen.getByTestId("playback-seek-status");
      const sliderContainer = screen.getByTestId("playback-slider");
      expect(status.getAttribute("role")).toBe("status");
      expect(status.textContent).toBe("");

      // One arrow key press asks for the stop before the current one.
      act(() => { fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowLeft", keyCode: 37 }); });

      act(() => { jest.advanceTimersByTime(kSeekProgressDelayMs - 1); });
      expect(screen.queryByTestId("playback-seek-progress")).toBeNull();
      expect(sliderContainer.getAttribute("aria-busy")).not.toBe("true");
      expect(status.textContent).toBe("");

      act(() => { jest.advanceTimersByTime(1); });
      expect(screen.getByTestId("playback-seek-progress")).toBeInTheDocument();
      expect(sliderContainer.getAttribute("aria-busy")).toBe("true");
      expect(status.textContent).toBe("Loading this point in the history…");

      await act(async () => { finishSeek(); });
      expect(screen.queryByTestId("playback-seek-progress")).toBeNull();
      expect(sliderContainer.getAttribute("aria-busy")).not.toBe("true");
      expect(status.textContent).toBe("");
    });

    it("never shows the progress indicator for a seek that settles within the delay", async () => {
      const treeManager = setupTreeManager(5);
      let finishSeek: () => void = () => undefined;
      jest.spyOn(treeManager, "goToHistoryEntryPosition")
        .mockImplementation(() => new Promise<void>(resolve => { finishSeek = resolve; }));
      render(<PlaybackControlComponent treeManager={treeManager} requestedHistoryId={undefined} />);

      act(() => { fireEvent.keyDown(screen.getByRole("slider"), { key: "ArrowLeft", keyCode: 37 }); });
      await act(async () => { finishSeek(); });
      act(() => { jest.advanceTimersByTime(kSeekProgressDelayMs * 2); });

      expect(screen.queryByTestId("playback-seek-progress")).toBeNull();
    });
  });
});
