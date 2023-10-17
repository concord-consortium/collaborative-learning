import { getSnapshot, Instance } from "mobx-state-tree";
import { createDocumentModel, DocumentModelType } from "./document";
import { PersonalDocument, ProblemDocument } from "./document-types";
import { createSingleTileContent } from "../../utilities/test-utils";
import { TextContentModelType } from "../tiles/text/text-content";
import { expectEntryToBeComplete } from "../history/undo-store-test-utils";
import { TreeManager } from "../history/tree-manager";
import { LogEventName } from "../../lib/logger-types";

// This is needed so MST can deserialize snapshots referring to tools
import { registerTileTypes } from "../../register-tile-types";
registerTileTypes(["Geometry", "Text"]);

// mock Logger calls
const mockLogTileDocumentEvent = jest.fn();
jest.mock("../tiles/log/log-tile-document-event", () => ({
  logTileDocumentEvent: (...args: any[]) => mockLogTileDocumentEvent(...args)
}));
const mockLogDocumentEvent = jest.fn();
jest.mock("./log-document-event", () => ({
  logDocumentEvent: (...args: any[]) => mockLogDocumentEvent(...args)
}));

const mockUserContext = { appMode: "authed", classHash: "class-1" };
const mockQueryData = { content: {}, metadata: { createdAt: 10 } };

const mockGetNetworkDocument = jest.fn(() => {
  return Promise.resolve({ data: { version: "1.0", ...mockQueryData } });
});
const mockHttpsCallable = jest.fn((fn: string) => {
  switch(fn) {
    case "getNetworkDocument_v1":
      return mockGetNetworkDocument;
  }
});
jest.mock("firebase/app", () => ({
  functions: () => ({
    httpsCallable: (fn: string) => mockHttpsCallable(fn)
  })
}));

const mockFetchQuery = jest.fn((queryKey: any, queryFn: () => Promise<any>) => {
  queryFn();
  return Promise.resolve({ isLoading: false, isError: false, data: mockQueryData });
});
const mockInvalidateQueries = jest.fn();
const mockQueryClient = {
  fetchQuery: mockFetchQuery,
  invalidateQueries: mockInvalidateQueries
} as any;

describe("document model", () => {
  let document: DocumentModelType;
  let documentWithoutContent: DocumentModelType;

  beforeEach(() => {
    document = createDocumentModel({
      type: ProblemDocument,
      uid: "1",
      key: "test",
      createdAt: 1,
      content: {},
      visibility: "public"
    });
    documentWithoutContent = createDocumentModel({
      type: ProblemDocument,
      uid: "1",
      key: "test",
      createdAt: 1,
      visibility: "public"
    });
  });

  it("should handle accessors for local documents", () => {
    expect(document.isProblem).toBe(true);
    expect(document.isPlanning).toBe(false);
    expect(document.isPersonal).toBe(false);
    expect(document.isLearningLog).toBe(false);
    expect(document.isSupport).toBe(false);
    expect(document.isPublished).toBe(false);
    expect(document.isRemote).toBe(false);
    expect(document.remoteSpec).toBeUndefined();
    expect(document.hasContent).toBe(true);
  });

  it("should handle accessors for remote documents", () => {
    document = createDocumentModel({
                type: PersonalDocument, remoteContext: "remote-class", uid: "user-1", key: "doc-1" });
    expect(document.isProblem).toBe(false);
    expect(document.isPlanning).toBe(false);
    expect(document.isPersonal).toBe(true);
    expect(document.isLearningLog).toBe(false);
    expect(document.isSupport).toBe(false);
    expect(document.isPublished).toBe(false);
    expect(document.isRemote).toBe(true);
    expect(document.remoteSpec).toEqual(["remote-class", "user-1", "doc-1"]);
    expect(document.hasContent).toBe(false);
  });

  it("uses override values", () => {
    expect(getSnapshot(document)).toEqual({
      type: ProblemDocument,
      uid: "1",
      key: "test",
      remoteContext: "",
      createdAt: 1,
      groupId: undefined,
      title: undefined,
      properties: {},
      visibility: "public",
      groupUserConnections: {},
      comments: {},
      stars: [],
      content: {
        annotations: {},
        rowMap: {},
        rowOrder: [],
        sharedModelMap: {},
        tileMap: {}
      },
      changeCount: 0
    });
  });

  it("can create documents without content and set the content later", () => {
    expect(documentWithoutContent.content).toBeUndefined();
    documentWithoutContent.setContent({});
    expect(documentWithoutContent.content).toBeDefined();
  });

  it("can set creation date/time", () => {
    expect(document.createdAt).toBe(1);
    document.setCreatedAt(10);
    expect(document.createdAt).toBe(10);
  });

  it("can set title", () => {
    expect(document.title).toBeUndefined();
    document.setTitle("FooTitle");
    expect(document.title).toBe("FooTitle");
  });

  it("can set content", () => {
    document.setContent(createSingleTileContent({ type: "Text", text: "test" }));
    expect(document.content!.tileMap.size).toBe(1);
    document.content!.tileMap.forEach(tile => {
      const textContent = tile.content as TextContentModelType;
      expect(textContent.type).toBe("Text");
      expect(textContent.text).toBe("test");
    });
  });

  it("can set group id", () => {
    expect(document.groupId).toBeUndefined();
    document.setGroupId("group-1");
    expect(document.groupId).toBe("group-1");
  });

  it("can set visibility", () => {
    expect(document.visibility).toBe("public");
    document.setVisibility("private");
    expect(document.visibility).toBe("private");
  });

  it("can increment change count", () => {
    expect(document.changeCount).toBe(0);
    document.incChangeCount();
    expect(document.changeCount).toBe(1);
  });

  it("allows the tools to be added", () => {
    expect(document.content!.tileMap.size).toBe(0);
    document.addTile("text");
    expect(document.content!.tileMap.size).toBe(1);
    // adding geometry tool adds sidecar text tool
    document.addTile("geometry", {addSidecarNotes: true});
    expect(document.content!.tileMap.size).toBe(3);
  });

  it("allows tiles to be deleted", () => {
    const result = document.addTile("text");
    const tileId = result && result.tileId;
    expect(document.content!.tileMap.size).toBe(1);
    document.deleteTile(tileId!);
    expect(document.content!.tileMap.size).toBe(0);
  });

  it("allows undo and redo", async () => {
    document.treeMonitor!.enabled = true;
    const manager = document.treeManagerAPI as Instance<typeof TreeManager>;

    document.addTile("text");
    await expectEntryToBeComplete(manager, 1);
    expect(document.content!.tileMap.size).toBe(1);

    document.undoLastAction();
    await expectEntryToBeComplete(manager, 2);
    expect(document.content!.tileMap.size).toBe(0);

    document.redoLastAction();
    await expectEntryToBeComplete(manager, 3);
    expect(document.content!.tileMap.size).toBe(1);

    expect(mockLogDocumentEvent).toHaveBeenCalledTimes(2);
    expect(mockLogDocumentEvent).toHaveBeenNthCalledWith(1,
      LogEventName.TILE_UNDO,
      expect.objectContaining({ targetAction: "/addTile" }),
      'undo'
    );
    expect(mockLogDocumentEvent).toHaveBeenNthCalledWith(2,
      LogEventName.TILE_REDO,
      expect.objectContaining({ targetAction: "/addTile" }),
      'redo'
    );
  });

  it("allows the visibility to be toggled", () => {
    document.toggleVisibility();
    expect(document.visibility).toBe("private");
    document.toggleVisibility();
    expect(document.visibility).toBe("public");
  });

  it("allows the visibility to be explicitly set", () => {
    document.toggleVisibility("public");
    expect(document.visibility).toBe("public");
    document.toggleVisibility("private");
    expect(document.visibility).toBe("private");
  });

  it("can set/get document properties", () => {
    expect(document.getProperty("foo")).toBeUndefined();
    document.setProperty("foo", "bar");
    expect(document.getProperty("foo")).toBe("bar");
    document.setProperties({ foo: undefined, bar: "baz" });
    expect(document.getProperty("foo")).toBeUndefined();
    expect(document.getProperty("bar")).toBe("baz");
  });

  it("can get document metadata", () => {
    expect(document.metadata).toEqual({
      // FIXME: the contextId was added here temporarily. See document.ts
      contextId: "ignored",
      type: ProblemDocument,
      uid: "1",
      key: "test",
      createdAt: 1,
      properties: {}
    });
  });

  it("can fetch and refresh remote content for remote documents", async () => {
    document = createDocumentModel({
                type: PersonalDocument, remoteContext: "remote-class", uid: "user-1", key: "doc-1" });
    const result = await document.fetchRemoteContent(mockQueryClient, mockUserContext);
    expect(result?.data).toEqual(mockQueryData);
    expect(mockFetchQuery).toHaveBeenCalled();
    expect(mockGetNetworkDocument).toHaveBeenCalled();

    document.fetchRemoteContent(mockQueryClient, mockUserContext);
    expect(mockInvalidateQueries).toHaveBeenCalled();
  });

  it("can add a tile after another one", () => {
    const newRowTile = document.addTile("text");
    assertIsDefined(newRowTile);
    const firstTile = document.content?.getTile(newRowTile.tileId);
    assertIsDefined(firstTile);
    expect(document.content!.tileMap.size).toBe(1);
    expect(document.content?.rowCount).toBe(1);
    document.content?.addTileAfter("text", firstTile, []);
    expect(document.content!.tileMap.size).toBe(2);
    expect(document.content?.rowCount).toBe(2);
  });
});
