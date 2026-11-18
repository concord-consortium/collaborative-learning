import { act, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { getSnapshot } from "mobx-state-tree";
import { Provider } from "mobx-react";
import { ModalProvider } from "react-modal-hook";
import { CanvasComponent } from "./canvas";
import { kPlaybackComponentClass } from "../playback/playback";
import * as tileDom from "../tiles/tile-dom";
import { LogEventName } from "../../lib/logger-types";
import { createDocumentModel, DocumentModelType } from "../../models/document/document";
import { ProblemDocument } from "../../models/document/document-types";
import { specStores } from "../../models/stores/spec-stores";
import { createSingleTileContent } from "../../utilities/test-utils";
import { FirestoreHistoryManager } from "../../models/history/firestore-history-manager";
import { HistoryEntry, HistoryOperation } from "../../models/history/history";
import { CDocument, TreeManagerType } from "../../models/history/tree-manager";
import { expectEntryToBeComplete } from "../../models/history/undo-store-test-utils";
import { TextContentModelType } from "../../models/tiles/text/text-content";
import { applyJsonPatches } from "../../models/history/json-patch";
import {
  kVersionedTestTileType, VersionedTestTileType
} from "../../models/history/schema-conversion-test-types";
import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";

// This is needed so MST can deserialize snapshots referring to tools
import { registerTileTypes } from "../../register-tile-types";
registerTileTypes(["Text"]);

const mockGetQueryState = jest.fn();
// The real control needs a NavTabPanelInfoProvider, which these tests don't set up.
jest.mock("../playback/playback-control", () => ({
  PlaybackControlComponent: () => null
}));

const mockLogDocumentOrCurriculumEvent = jest.fn();
jest.mock("../../models/document/log-document-event", () => ({
  ...jest.requireActual("../../models/document/log-document-event"),
  logDocumentOrCurriculumEvent: (...args: any[]) => mockLogDocumentOrCurriculumEvent(...args)
}));

jest.mock("react-query", () => ({
  useQueryClient: () => ({
    getQueryState: mockGetQueryState
  })
}));

describe("Canvas Component", () => {

  beforeEach(() => {
    // mock getSelection for text tool
    (window as any).getSelection = () => {
      return {
      };
    };
  });

  afterEach(() => jest.restoreAllMocks());

  it("can render without a document or content", () => {
    const stores = specStores();
    render(
      <Provider stores={stores}>
        <CanvasComponent context="test" readOnly={false} />
      </Provider>
    );
    expect(screen.queryByTestId("document-content")).toBeNull();
  });

  it("can render with a document", () => {
    const document = createDocumentModel({
      type: ProblemDocument,
      title: "test",
      uid: "1",
      key: "test",
      createdAt: 1,
      visibility: "public",
      content: createSingleTileContent({
        type: "Text",
        text: "test"
      })
    });
    const stores = specStores();
    render(
      <Provider stores={stores}>
        <ModalProvider>
          <CanvasComponent context="test" document={document} readOnly={true} />
        </ModalProvider>
      </Provider>
    );
    expect(screen.getByTestId("document-content")).toBeInTheDocument();
    expect(screen.getByTestId("text-tool-wrapper")).toBeInTheDocument();
  });

  it("renders spinner while loading remote document content", () => {
    mockGetQueryState.mockImplementation(() => ({ status: "loading" }));
    const document = createDocumentModel({
      type: ProblemDocument,
      title: "test",
      uid: "1",
      key: "test",
      remoteContext: "remote-context",
      createdAt: 1,
      visibility: "public"
    });
    const stores = specStores();
    render(
      <Provider stores={stores}>
        <CanvasComponent context="test" document={document} readOnly={true} />
      </Provider>
    );
    expect(screen.getByTestId("document-loading-spinner")).toBeInTheDocument();
  });

  it("can render with content", () => {
    const content = createSingleTileContent({
      type: "Text",
      text: "test"
    });
    const document = createDocumentModel({
      type: ProblemDocument,
      uid: "1",
      key: "test",
      createdAt: 1,
      content,
      visibility: "public"
    });
    const stores = specStores();
    render(
      <Provider stores={stores}>
        <ModalProvider>
          <CanvasComponent context="test" content={document.content} readOnly={true} />
        </ModalProvider>
      </Provider>
    );
    expect(screen.getByTestId("document-content")).toBeInTheDocument();
    expect(screen.getByTestId("text-tool-wrapper")).toBeInTheDocument();
  });


  // The store hands out a history-view request once and then forgets it, so the id the canvas
  // is holding belongs to the document it was read for. Switching documents in the sort-work
  // view reuses this component, and a request left behind is applied to the wrong document.
  it("does not carry a history request over to the next document", () => {
    jest.spyOn(FirestoreHistoryManager.prototype as any, "subscribeToFirestoreHistory")
      .mockImplementation(() => undefined);
    jest.spyOn(FirestoreHistoryManager.prototype as any, "waitUntilEnvironmentAndMetadataDocReady")
      .mockResolvedValue(undefined);
    const checkSpy = jest.spyOn(FirestoreHistoryManager.prototype, "checkHistoryEntryAfterLoad")
      .mockResolvedValue(undefined);

    const makeDoc = (key: string) => createDocumentModel({
      type: ProblemDocument, title: key, uid: "1", key, createdAt: 1, visibility: "public",
      content: createSingleTileContent({ type: "Text", text: "test" })
    });
    const first = makeDoc("first");
    const second = makeDoc("second");
    second.setShowPlaybackControls(true);

    const stores = specStores();
    stores.sortedDocuments.setDocumentHistoryViewRequest("first", "entry-abc");

    const { rerender } = render(
      <Provider stores={stores}>
        <ModalProvider>
          <CanvasComponent context="test" document={first} readOnly={true} showPlayback={true} />
        </ModalProvider>
      </Provider>
    );
    expect(checkSpy).toHaveBeenCalledWith("entry-abc");

    rerender(
      <Provider stores={stores}>
        <ModalProvider>
          <CanvasComponent context="test" document={second} readOnly={true} showPlayback={true} />
        </ModalProvider>
      </Provider>
    );

    expect(checkSpy).toHaveBeenCalledTimes(1);
  });

  // The live document's content can be replaced after it loads, which converts its old tiles
  // again with new ids. The playback copy is made from the live content, so the entry it is
  // handed must give those ids.
  it("hands the playback copy the load entry rebuilt for replaced content", () => {
    registerTileComponentInfo({
      type: kVersionedTestTileType, Component: () => null, tileEltClass: "versioned-test-tile"
    });
    let copyTreeManager: TreeManagerType | undefined;
    jest.spyOn(FirestoreHistoryManager.prototype as any, "subscribeToFirestoreHistory")
      .mockImplementation(function(this: FirestoreHistoryManager) {
        copyTreeManager = this.treeManager;
      });
    jest.spyOn(FirestoreHistoryManager.prototype as any, "waitUntilEnvironmentAndMetadataDocReady")
      .mockResolvedValue(undefined);

    const oldContent = () => ({
      tileMap: { t1: { id: "t1", content: { type: kVersionedTestTileType, text: "c", items: [{ value: "a" }] } } }
    });
    const document = createDocumentModel({
      type: ProblemDocument, title: "old", uid: "1", key: "old", createdAt: 1, visibility: "public",
      content: oldContent() as any
    });
    document.setContent(oldContent() as any);
    document.setShowPlaybackControls(true);

    const stores = specStores();
    render(
      <Provider stores={stores}>
        <ModalProvider>
          <CanvasComponent context="test" document={document} readOnly={true} showPlayback={true} />
        </ModalProvider>
      </Provider>
    );

    const localEntry = copyTreeManager?.localLoadEntry;
    expect(localEntry).toBeDefined();
    const docJson: any = { content: oldContent() };
    applyJsonPatches(docJson, HistoryEntry.create(localEntry!).records[0].getPatches(HistoryOperation.Redo));
    const copyDocument = copyTreeManager!.mainDocument as unknown as DocumentModelType;
    const copyTile = copyDocument.content!.tileMap.get("t1")!.content as VersionedTestTileType;
    expect(docJson.content.tileMap.t1.content.items.map((item: any) => item.id))
      .toEqual(copyTile.items.map(item => item.id));
  });

  it("tells the playback copy's history manager which entry the live content holds", () => {
    let copyContentEntryId: string | undefined;
    jest.spyOn(FirestoreHistoryManager.prototype as any, "subscribeToFirestoreHistory")
      .mockImplementation(function(this: FirestoreHistoryManager) {
        copyContentEntryId = this.contentEntryId;
      });
    jest.spyOn(FirestoreHistoryManager.prototype as any, "waitUntilEnvironmentAndMetadataDocReady")
      .mockResolvedValue(undefined);
    const document = createDocumentModel({
      type: ProblemDocument, title: "test", uid: "1", key: "test", createdAt: 1, visibility: "public",
      content: createSingleTileContent({ type: "Text", text: "test" })
    });
    document.setSavedEnvelope({ lastHistoryEntryId: "e4", exactThrough: { index: 4, since: "first" } });
    document.setShowPlaybackControls(true);

    render(
      <Provider stores={specStores()}>
        <ModalProvider>
          <CanvasComponent context="test" document={document} readOnly={true} showPlayback={true} />
        </ModalProvider>
      </Provider>
    );

    expect(copyContentEntryId).toBe("e4");
  });

  it("leaves room below the last tile for the playback bar only while playback shows", () => {
    jest.spyOn(FirestoreHistoryManager.prototype as any, "subscribeToFirestoreHistory")
      .mockImplementation(() => undefined);
    jest.spyOn(FirestoreHistoryManager.prototype as any, "waitUntilEnvironmentAndMetadataDocReady")
      .mockResolvedValue(undefined);
    const document = createDocumentModel({
      type: ProblemDocument, title: "test", uid: "1", key: "test", createdAt: 1, visibility: "public",
      content: createSingleTileContent({ type: "Text", text: "test" })
    });
    const renderCanvas = () => render(
      <Provider stores={specStores()}>
        <ModalProvider>
          <CanvasComponent context="test" document={document} readOnly={true} showPlayback={true} />
        </ModalProvider>
      </Provider>
    );

    const { unmount } = renderCanvas();
    expect(screen.getByTestId("document-content").querySelector(".playback-spacer")).toBeNull();
    unmount();

    document.setShowPlaybackControls(true);
    renderCanvas();
    expect(screen.getByTestId("document-content").querySelector(".playback-spacer")).not.toBeNull();
  });

  describe("revealing the tile a playback move changed", () => {
    let scrollIntoView: jest.Mock;
    beforeEach(() => {
      scrollIntoView = jest.fn();
      (Element.prototype as any).scrollIntoView = scrollIntoView;
    });
    afterEach(() => {
      delete (Element.prototype as any).scrollIntoView;
    });

    const rect = (top: number, bottom: number) => ({
      top, bottom, height: bottom - top, left: 0, right: 100, width: 100, x: 0, y: top, toJSON: () => ({})
    }) as DOMRect;

    // A canvas showing the history of a document whose entries are: add Text A, add Text B, set B's
    // text, and with `editA`, set A's text. The pane shows 0 to 300 with the playback bar from 251,
    // A is in view and B below it.
    async function setupReveal({ editA = false } = {}) {
      let copyTreeManager: TreeManagerType | undefined;
      jest.spyOn(FirestoreHistoryManager.prototype as any, "subscribeToFirestoreHistory")
        .mockImplementation(function(this: FirestoreHistoryManager) {
          copyTreeManager = this.treeManager;
        });
      jest.spyOn(FirestoreHistoryManager.prototype as any, "waitUntilEnvironmentAndMetadataDocReady")
        .mockResolvedValue(undefined);

      const document = createDocumentModel({
        type: ProblemDocument, title: "test", uid: "1", key: "test", createdAt: 1, visibility: "public",
        content: {} as any
      });
      const liveManager = document.treeManagerAPI as TreeManagerType;
      document.treeMonitor!.enableMonitoring();
      const tileA = document.content!.addTile("Text")!.tileId;
      await expectEntryToBeComplete(liveManager, 1);
      const tileB = document.content!.addTile("Text")!.tileId;
      await expectEntryToBeComplete(liveManager, 2);
      (document.content!.getTile(tileB)!.content as TextContentModelType).setText("changed");
      await expectEntryToBeComplete(liveManager, 3);
      if (editA) {
        (document.content!.getTile(tileA)!.content as TextContentModelType).setText("changed");
        await expectEntryToBeComplete(liveManager, 4);
      }
      const entryCount = liveManager.document.history.length;
      document.treeMonitor!.disableMonitoring();
      document.setShowPlaybackControls(true);

      render(
        <Provider stores={specStores()}>
          <ModalProvider>
            <CanvasComponent context="test" document={document} readOnly={true} showPlayback={true}
              logTileVisibility={true} />
          </ModalProvider>
        </Provider>
      );
      copyTreeManager!.setChangeDocument(CDocument.create({ history: getSnapshot(liveManager.document.history) }));
      copyTreeManager!.setNumHistoryEntriesApplied(entryCount);

      const pane = screen.getByTestId("document-content");
      const scrollTo = jest.fn();
      pane.scrollTo = scrollTo;
      Object.defineProperty(pane, "clientHeight", { configurable: true, value: 300 });
      pane.getBoundingClientRect = () => rect(0, 300);
      const bar = pane.parentElement!.querySelector(`.${kPlaybackComponentClass}`)!;
      bar.getBoundingClientRect = () => rect(251, 300);
      // Set by tile id on the prototype, so a tile node rendered again after a move gets it too.
      const tileRects: Record<string, DOMRect> = { [tileA]: rect(10, 100), [tileB]: rect(1000, 1100) };
      const getRect = Element.prototype.getBoundingClientRect;
      jest.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function(this: Element) {
        return tileRects[this.getAttribute(tileDom.kTileIdAttr) ?? ""] ?? getRect.call(this);
      });
      const goTo = (position: number, options?: { revealChange?: boolean }) =>
        act(() => copyTreeManager!.goToHistoryEntryPosition(position, options));
      return { goTo, scrollTo, tileRects, tileA, tileB };
    }

    const afterFrames = () => act(() => new Promise(resolve => setTimeout(resolve, 200)));

    it("scrolls the history view to the tile a playback move changed", async () => {
      const { goTo, scrollTo, tileRects, tileB } = await setupReveal();
      const focused = window.document.activeElement;
      // Let the visibility event logged when the canvas mounted settle.
      await act(() => new Promise(resolve => setTimeout(resolve, 600)));
      mockLogDocumentOrCurriculumEvent.mockClear();

      await goTo(2, { revealChange: true });
      await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ top: 857, behavior: "instant" }));
      await waitFor(() => expect(mockLogDocumentOrCurriculumEvent).toHaveBeenCalledWith(
        LogEventName.TILE_VISIBILITY_CHANGE, expect.objectContaining({ cause: "historyPlayback" })
      ), { timeout: 1500 });

      scrollTo.mockClear();
      tileRects[tileB] = rect(150, 240);
      await goTo(3, { revealChange: true });
      await afterFrames();
      expect(scrollTo).not.toHaveBeenCalled();

      tileRects[tileB] = rect(1000, 1100);
      await goTo(2);
      await afterFrames();
      expect(scrollTo).not.toHaveBeenCalled();

      await goTo(1, { revealChange: true });
      await afterFrames();
      expect(scrollTo).not.toHaveBeenCalled();

      // Redoing B's creation reveals B once its new node renders.
      await goTo(2, { revealChange: true });
      await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ top: 857, behavior: "instant" }));

      expect(window.document.activeElement).toBe(focused);
      expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it("waits a few frames for a tile that has not rendered yet", async () => {
      const { goTo, scrollTo, tileB } = await setupReveal();
      const getTileNode = tileDom.getTileNode;
      let misses = 2;
      jest.spyOn(tileDom, "getTileNode").mockImplementation((root, tileId) =>
        tileId === tileB && misses-- > 0 ? undefined : getTileNode(root, tileId));

      await goTo(2, { revealChange: true });

      await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ top: 857, behavior: "instant" }));
    });

    it("lets a newer request take over from one still waiting for its tile", async () => {
      const { goTo, scrollTo, tileRects, tileA } = await setupReveal({ editA: true });
      tileRects[tileA] = rect(2000, 2100);
      const getTileNode = tileDom.getTileNode;
      let misses = 2;
      jest.spyOn(tileDom, "getTileNode").mockImplementation((root, tileId) =>
        tileId === tileA && misses-- > 0 ? undefined : getTileNode(root, tileId));

      // Undoing A's text asks for A, which is slow to appear; undoing B's text then asks for B.
      await goTo(3, { revealChange: true });
      await goTo(2, { revealChange: true });
      await afterFrames();

      // The pane also goes to the top when its content is replaced, which isn't a reveal.
      const reveals = scrollTo.mock.calls.filter(([options]) => options.behavior);
      expect(reveals).toEqual([[{ top: 857, behavior: "instant" }]]);
    });

    it("stops an earlier smooth reveal when the next reveal's tile is already in view", async () => {
      const { goTo, scrollTo, tileRects, tileB } = await setupReveal({ editA: true });
      tileRects[tileB] = rect(260, 320);

      // Undoing B's text scrolls a short way, smoothly; the pane's scrollTop stays at 0 under jsdom,
      // as if that scroll were still under way when redoing A's text asks for A, which is in view.
      await goTo(2, { revealChange: true });
      await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ top: 77, behavior: "smooth" }));
      await goTo(4, { revealChange: true });
      await waitFor(() => expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: "instant" }));
    });

    it("drops a request still waiting for its tile when a newer move has nothing to reveal", async () => {
      const { goTo, scrollTo, tileRects, tileA } = await setupReveal({ editA: true });
      tileRects[tileA] = rect(2000, 2100);
      const getTileNode = tileDom.getTileNode;
      let misses = 2;
      jest.spyOn(tileDom, "getTileNode").mockImplementation((root, tileId) =>
        tileId === tileA && misses-- > 0 ? undefined : getTileNode(root, tileId));

      // Undoing A's text asks for A, which is slow to appear; undoing B's text and B's creation
      // together leaves no tile to reveal.
      await goTo(3, { revealChange: true });
      await goTo(1, { revealChange: true });
      await afterFrames();

      const reveals = scrollTo.mock.calls.filter(([options]) => options.behavior);
      expect(reveals).toEqual([]);
    });
  });

});
