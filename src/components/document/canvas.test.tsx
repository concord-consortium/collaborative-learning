import { render, screen } from "@testing-library/react";
import React from "react";
import { Provider } from "mobx-react";
import { ModalProvider } from "react-modal-hook";
import { CanvasComponent } from "./canvas";
import { createDocumentModel, DocumentModelType } from "../../models/document/document";
import { ProblemDocument } from "../../models/document/document-types";
import { specStores } from "../../models/stores/spec-stores";
import { createSingleTileContent } from "../../utilities/test-utils";
import { FirestoreHistoryManager } from "../../models/history/firestore-history-manager";
import { HistoryEntry, HistoryOperation } from "../../models/history/history";
import { applyJsonPatches } from "../../models/history/json-patch";
import {
  kVersionedTestTileType, VersionedTestTileType
} from "../../models/history/schema-conversion-test-types";
import { TreeManagerType } from "../../models/history/tree-manager";
import { registerTileComponentInfo } from "../../models/tiles/tile-component-info";

// This is needed so MST can deserialize snapshots referring to tools
import { registerTileTypes } from "../../register-tile-types";
registerTileTypes(["Text"]);

const mockGetQueryState = jest.fn();
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
    const moveSpy = jest.spyOn(FirestoreHistoryManager.prototype, "moveToHistoryEntryAfterLoad")
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
    expect(moveSpy).toHaveBeenCalledWith("entry-abc");

    rerender(
      <Provider stores={stores}>
        <ModalProvider>
          <CanvasComponent context="test" document={second} readOnly={true} showPlayback={true} />
        </ModalProvider>
      </Provider>
    );

    expect(moveSpy).toHaveBeenCalledTimes(1);
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

});
