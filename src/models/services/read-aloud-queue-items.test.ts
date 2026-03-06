import { registerTileTypes } from "../../register-tile-types";
import { DocumentContentModel, DocumentContentSnapshotType } from "../document/document-content";
import { DocumentCommentsManager, CommentWithId } from "../document/document-comments-manager";
import {
  buildReadAloudQueue, buildTileSpeechText, buildThreadHeaderText,
  isTileItem, isCommentItem, isSectionHeaderItem,
  TileReadAloudItem, CommentReadAloudItem
} from "./read-aloud-queue-items";
import { ChatCommentThread } from "../../components/chat/chat-comment-thread";
import { kDrawingTileType, kDrawingStateVersion } from "../../plugins/drawing/model/drawing-types";

// Helper to create document content with multiple tiles
function createDocumentContent(
  tiles: Array<{ id: string; type: string; title?: string; text?: string; content?: any }>
) {
  const rowMap: Record<string, any> = {};
  const tileMap: Record<string, any> = {};
  const rowOrder: string[] = [];

  tiles.forEach((tile, index) => {
    const rowId = `row-${index}`;
    rowOrder.push(rowId);
    rowMap[rowId] = { id: rowId, tiles: [{ tileId: tile.id }] };

    const content: any = tile.content || { type: tile.type };
    if (!tile.content && tile.type === "Text" && tile.text != null) {
      content.text = tile.text;
    }

    tileMap[tile.id] = {
      id: tile.id,
      title: tile.title,
      content
    };
  });

  const snapshot: DocumentContentSnapshotType = { rowMap, rowOrder, tileMap };
  return DocumentContentModel.create(snapshot);
}

// Drawing content helpers
function createDrawingContent(objects: any[]) {
  return {
    type: kDrawingTileType,
    version: kDrawingStateVersion,
    stamps: [],
    objects
  };
}

let nextObjectId = 1;
function makeTextObject(text: string, id?: string) {
  return {
    type: "text",
    id: id || `text-${nextObjectId++}`,
    x: 0, y: 0, width: 100, height: 100,
    stroke: "#000000",
    text
  };
}

function makeGroupObject(children: any[], id?: string) {
  return {
    type: "group",
    id: id || `group-${nextObjectId++}`,
    x: 0, y: 0, width: 100, height: 100,
    objects: children
  };
}

function makeRectObject(id?: string) {
  return {
    type: "rectangle",
    id: id || `rect-${nextObjectId++}`,
    x: 0, y: 0, width: 100, height: 100,
    stroke: "#000000",
    strokeDashArray: "",
    strokeWidth: 1,
    fill: "none"
  };
}

// Table document content helper
function createTableDocumentContent(
  tileId: string,
  title: string | undefined,
  columns: Array<{ name: string }>,
  rows: Array<string[]>
) {
  const attributes = columns.map((col, i) => ({
    id: `attr-${i}`,
    name: col.name,
    values: rows.map(row => row[i] ?? "")
  }));
  const cases = rows.map((_, i) => ({ __id__: `case-${i}` }));

  const content: any = {
    type: "Table",
    isImported: true,
    columnWidths: {},
    importedDataSet: {
      attributes,
      cases
    }
  };

  const rowMap = { "row-0": { id: "row-0", tiles: [{ tileId }] } };
  const rowOrder = ["row-0"];
  const tileMap: any = {
    [tileId]: { id: tileId, title, content }
  };
  return DocumentContentModel.create({ rowMap, rowOrder, tileMap });
}

// Helper to create a comment with required fields
function makeComment(overrides: Partial<CommentWithId> & { id: string; name: string }): CommentWithId {
  return {
    uid: "user1",
    content: "",
    createdAt: new Date(),
    tileId: undefined,
    ...overrides
  } as CommentWithId;
}

describe("read-aloud-queue-items", () => {
  beforeAll(async () => {
    await registerTileTypes(["Drawing", "Geometry", "Table", "Text"]);
  });

  describe("buildTileSpeechText", () => {
    it("does not speak the title for text tiles (hiddenTitle)", () => {
      const content = createDocumentContent([
        { id: "t1", type: "Text", title: "My Title", text: "My content" }
      ]);
      const tile = content.getTile("t1")!;
      // Text tiles have hiddenTitle, so the title is excluded from spoken text
      expect(buildTileSpeechText(tile)).toBe("My content");
    });

    it("announces tile type and title for non-text tiles", () => {
      const content = createDocumentContent([
        { id: "t1", type: "Geometry", title: "My Shape" }
      ]);
      const tile = content.getTile("t1")!;
      expect(buildTileSpeechText(tile)).toBe("Coordinate Grid tile: My Shape");
    });

    it("announces just tile type for tiles with no title or content", () => {
      const content = createDocumentContent([
        { id: "t1", type: "Geometry" }
      ]);
      const tile = content.getTile("t1")!;
      expect(buildTileSpeechText(tile)).toBe("Coordinate Grid tile");
    });
  });

  describe("buildTileSpeechText - sketch tiles", () => {
    it("reads multiple text objects in array structure order with periods between", () => { // regression anchor
      const content = createDocumentContent([{
        id: "t1", type: "Drawing", title: "My Drawing",
        content: createDrawingContent([
          makeTextObject("first annotation"),
          makeTextObject("second annotation")
        ])
      }]);
      const tile = content.getTile("t1")!;
      expect(buildTileSpeechText(tile)).toBe("My Drawing. first annotation. second annotation");
    });

    it("reads text objects inside groups recursively (depth-first)", () => { // regression anchor
      const content = createDocumentContent([{
        id: "t1", type: "Drawing",
        content: createDrawingContent([
          makeGroupObject([makeTextObject("inside")]),
          makeTextObject("outside")
        ])
      }]);
      const tile = content.getTile("t1")!;
      expect(buildTileSpeechText(tile)).toBe("inside. outside");
    });

    it("skips non-text drawing objects", () => {
      const content = createDocumentContent([{
        id: "t1", type: "Drawing",
        content: createDrawingContent([
          makeRectObject(),
          makeTextObject("annotation"),
          makeRectObject()
        ])
      }]);
      const tile = content.getTile("t1")!;
      expect(buildTileSpeechText(tile)).toBe("annotation");
    });

    it("falls back to tile type + title when drawing has no objects at all", () => {
      const content = createDocumentContent([{
        id: "t1", type: "Drawing", title: "Empty Canvas",
        content: createDrawingContent([])
      }]);
      const tile = content.getTile("t1")!;
      expect(buildTileSpeechText(tile)).toBe("Sketch tile: Empty Canvas");
    });

    it("falls back to tile type + title when no text objects", () => {
      const content = createDocumentContent([{
        id: "t1", type: "Drawing", title: "My Shape",
        content: createDrawingContent([makeRectObject()])
      }]);
      const tile = content.getTile("t1")!;
      expect(buildTileSpeechText(tile)).toBe("Sketch tile: My Shape");
    });

    it("falls back to tile type + title when all text objects are empty/whitespace", () => {
      const content = createDocumentContent([{
        id: "t1", type: "Drawing", title: "My Shape",
        content: createDrawingContent([
          makeTextObject(""),
          makeTextObject("   ")
        ])
      }]);
      const tile = content.getTile("t1")!;
      expect(buildTileSpeechText(tile)).toBe("Sketch tile: My Shape");
    });

    it("composes title + text objects with period separator", () => {
      const content = createDocumentContent([{
        id: "t1", type: "Drawing", title: "My Shape",
        content: createDrawingContent([
          makeTextObject("45 degrees"),
          makeTextObject("right angle")
        ])
      }]);
      const tile = content.getTile("t1")!;
      expect(buildTileSpeechText(tile)).toBe("My Shape. 45 degrees. right angle");
    });

    it("does not double punctuation when text ends with period", () => {
      const content = createDocumentContent([{
        id: "t1", type: "Drawing",
        content: createDrawingContent([
          makeTextObject("First sentence."),
          makeTextObject("Second")
        ])
      }]);
      const tile = content.getTile("t1")!;
      expect(buildTileSpeechText(tile)).toBe("First sentence. Second");
    });

    it("does not double punctuation when text ends with ! or ?", () => {
      const content = createDocumentContent([{
        id: "t1", type: "Drawing",
        content: createDrawingContent([
          makeTextObject("Hello!"),
          makeTextObject("Are you there?"),
          makeTextObject("Goodbye")
        ])
      }]);
      const tile = content.getTile("t1")!;
      expect(buildTileSpeechText(tile)).toBe("Hello! Are you there? Goodbye");
    });

    it("does not double punctuation when text ends with ellipsis", () => {
      const content = createDocumentContent([{
        id: "t1", type: "Drawing",
        content: createDrawingContent([
          makeTextObject("more to come…"),
          makeTextObject("next")
        ])
      }]);
      const tile = content.getTile("t1")!;
      expect(buildTileSpeechText(tile)).toBe("more to come… next");
    });

    it("does not double punctuation when text ends with three dots", () => {
      const content = createDocumentContent([{
        id: "t1", type: "Drawing",
        content: createDrawingContent([
          makeTextObject("more to come..."),
          makeTextObject("next")
        ])
      }]);
      const tile = content.getTile("t1")!;
      expect(buildTileSpeechText(tile)).toBe("more to come... next");
    });

    it("does not double punctuation when sentence punctuation is inside closing quote", () => {
      const content = createDocumentContent([{
        id: "t1", type: "Drawing",
        content: createDrawingContent([
          makeTextObject('She said "hello!"'),
          makeTextObject("next")
        ])
      }]);
      const tile = content.getTile("t1")!;
      expect(buildTileSpeechText(tile)).toBe('She said "hello!" next');
    });

    it("adds period after closing quote with no sentence punctuation inside", () => {
      const content = createDocumentContent([{
        id: "t1", type: "Drawing",
        content: createDrawingContent([
          makeTextObject('He said "hi"'),
          makeTextObject("next")
        ])
      }]);
      const tile = content.getTile("t1")!;
      expect(buildTileSpeechText(tile)).toBe('He said "hi". next');
    });
  });

  describe("buildTileSpeechText - table tiles", () => {
    it("reads column headers and rows", () => { // regression anchor
      const doc = createTableDocumentContent("t1", "My Data",
        [{ name: "Name" }, { name: "Age" }],
        [["Alice", "12"]]
      );
      const tile = doc.getTile("t1")!;
      expect(buildTileSpeechText(tile)).toBe("My Data. Columns: Name, Age. Alice, 12.");
    });

    it("reads multiple rows with period separators", () => {
      const doc = createTableDocumentContent("t1", undefined,
        [{ name: "Name" }, { name: "Age" }],
        [["Alice", "12"], ["Bob", "14"]]
      );
      const tile = doc.getTile("t1")!;
      expect(buildTileSpeechText(tile)).toBe("Columns: Name, Age. Alice, 12. Bob, 14.");
    });

    it("uses singular Column: for one column", () => {
      const doc = createTableDocumentContent("t1", undefined,
        [{ name: "X" }],
        [["1"]]
      );
      const tile = doc.getTile("t1")!;
      expect(buildTileSpeechText(tile)).toBe("Column: X. 1.");
    });

    it("reads blank for empty cells", () => { // regression anchor
      const doc = createTableDocumentContent("t1", undefined,
        [{ name: "X" }],
        [["  "]]  // whitespace-only
      );
      const tile = doc.getTile("t1")!;
      expect(buildTileSpeechText(tile)).toBe("Column: X. blank.");
    });

    it("reads 0 as '0', not blank", () => {
      const doc = createTableDocumentContent("t1", undefined,
        [{ name: "X" }],
        [["0"]]
      );
      const tile = doc.getTile("t1")!;
      expect(buildTileSpeechText(tile)).toBe("Column: X. 0.");
    });

    it("reads all-blank row", () => {
      const doc = createTableDocumentContent("t1", undefined,
        [{ name: "A" }, { name: "B" }],
        [["", ""]]
      );
      const tile = doc.getTile("t1")!;
      expect(buildTileSpeechText(tile)).toBe("Columns: A, B. blank, blank.");
    });

    it("reads only column headers when no cases", () => {
      const doc = createTableDocumentContent("t1", undefined,
        [{ name: "Name" }, { name: "Age" }],
        []
      );
      const tile = doc.getTile("t1")!;
      expect(buildTileSpeechText(tile)).toBe("Columns: Name, Age.");
    });

    it("falls back to tile type + title when no columns", () => {
      const doc = createTableDocumentContent("t1", "My Data", [], []);
      const tile = doc.getTile("t1")!;
      expect(buildTileSpeechText(tile)).toBe("Table tile: My Data");
    });

    it("falls back to just tile type when no columns and no title", () => { // regression anchor
      const doc = createTableDocumentContent("t1", undefined, [], []);
      const tile = doc.getTile("t1")!;
      expect(buildTileSpeechText(tile)).toBe("Table tile");
    });

    it("reads unnamed for empty column headers", () => {
      const doc = createTableDocumentContent("t1", undefined,
        [{ name: "" }, { name: "Age" }],
        [["Alice", "12"]]
      );
      const tile = doc.getTile("t1")!;
      expect(buildTileSpeechText(tile)).toBe("Columns: unnamed, Age. Alice, 12.");
    });

    it("trims padded header names", () => {
      const doc = createTableDocumentContent("t1", undefined,
        [{ name: "  Age  " }],
        [["12"]]
      );
      const tile = doc.getTile("t1")!;
      expect(buildTileSpeechText(tile)).toBe("Column: Age. 12.");
    });

    it("trims padded cell values", () => {
      const doc = createTableDocumentContent("t1", undefined,
        [{ name: "X" }],
        [["  12  "]]
      );
      const tile = doc.getTile("t1")!;
      expect(buildTileSpeechText(tile)).toBe("Column: X. 12.");
    });

    it("title is composed with content when both exist", () => {
      const doc = createTableDocumentContent("t1", "Results",
        [{ name: "Score" }],
        [["95"]]
      );
      const tile = doc.getTile("t1")!;
      expect(buildTileSpeechText(tile)).toBe("Results. Column: Score. 95.");
    });
  });

  describe("buildThreadHeaderText", () => {
    it("builds header for tile-level thread", () => {
      const thread: ChatCommentThread = {
        title: "Graph 1",
        tileId: "t1",
        tileType: "Geometry",
        isDeletedTile: false,
        comments: []
      };
      expect(buildThreadHeaderText(thread)).toBe("Coordinate Grid tile: Graph 1");
    });

    it("builds header for tile without title", () => {
      const thread: ChatCommentThread = {
        title: null,
        tileId: "t1",
        tileType: "Geometry",
        isDeletedTile: false,
        comments: []
      };
      expect(buildThreadHeaderText(thread)).toBe("Coordinate Grid tile");
    });

    it("builds header for document-level thread", () => {
      const thread: ChatCommentThread = {
        title: "My Document",
        tileId: null,
        tileType: null,
        isDeletedTile: false,
        comments: []
      };
      expect(buildThreadHeaderText(thread)).toBe("My Document");
    });

    it("builds header for deleted tile thread", () => {
      const thread: ChatCommentThread = {
        title: "Deleted Tile",
        tileId: "deleted-t1",
        tileType: null,
        isDeletedTile: true,
        comments: []
      };
      expect(buildThreadHeaderText(thread)).toBe("Deleted Tile");
    });

    it("returns empty string when no header info", () => {
      const thread: ChatCommentThread = {
        title: null,
        tileId: null,
        tileType: null,
        isDeletedTile: false,
        comments: []
      };
      expect(buildThreadHeaderText(thread)).toBe("");
    });
  });

  describe("type guards", () => {
    it("identifies tile items", () => {
      const item = { kind: "tile", speechText: "test", associatedTileId: "t1" };
      expect(isTileItem(item)).toBe(true);
      expect(isCommentItem(item)).toBe(false);
      expect(isSectionHeaderItem(item)).toBe(false);
    });

    it("identifies comment items", () => {
      const item = {
        kind: "comment", speechText: "test", commentId: "c1",
        originTileId: null, threadIndex: 0, commentIndex: 0
      };
      expect(isCommentItem(item)).toBe(true);
      expect(isTileItem(item)).toBe(false);
    });

    it("identifies section header items", () => {
      const item = { kind: "section-header", speechText: "Comments" };
      expect(isSectionHeaderItem(item)).toBe(true);
      expect(isTileItem(item)).toBe(false);
    });
  });

  describe("buildReadAloudQueue", () => {
    it("includes all tiles when no selection", () => {
      const content = createDocumentContent([
        { id: "t1", type: "Text", text: "Hello" },
        { id: "t2", type: "Geometry", title: "Shape" }
      ]);
      const { items, allPaneTileIds, commentMode } = buildReadAloudQueue(content, []);
      expect(items).toHaveLength(2);
      expect(items[0].kind).toBe("tile");
      expect((items[0] as TileReadAloudItem).associatedTileId).toBe("t1");
      expect((items[1] as TileReadAloudItem).associatedTileId).toBe("t2");
      expect(allPaneTileIds).toEqual(new Set(["t1", "t2"]));
      expect(commentMode).toBeUndefined();
    });

    it("filters to selected tiles", () => {
      const content = createDocumentContent([
        { id: "t1", type: "Text", text: "a" },
        { id: "t2", type: "Text", text: "b" },
        { id: "t3", type: "Text", text: "c" }
      ]);
      const { items } = buildReadAloudQueue(content, ["t2"]);
      expect(items).toHaveLength(1);
      expect((items[0] as TileReadAloudItem).associatedTileId).toBe("t2");
    });

    it("falls back to all tiles if selection doesn't match content", () => {
      const content = createDocumentContent([
        { id: "t1", type: "Text", text: "a" }
      ]);
      const { items } = buildReadAloudQueue(content, ["nonexistent"]);
      expect(items).toHaveLength(1);
      expect((items[0] as TileReadAloudItem).associatedTileId).toBe("t1");
    });

    it("excludes comments when panel is closed", () => {
      const content = createDocumentContent([
        { id: "t1", type: "Text", text: "Hello" }
      ]);
      const manager = new DocumentCommentsManager();
      manager.setComments([
        makeComment({ id: "c1", name: "Alice", content: "Hi", tileId: "t1" })
      ]);
      const { items } = buildReadAloudQueue(content, [], {
        commentsManager: manager, showChatPanel: false, pane: "left"
      });
      expect(items).toHaveLength(1);
      expect(items[0].kind).toBe("tile");
    });

    it("excludes comments on right pane", () => {
      const content = createDocumentContent([
        { id: "t1", type: "Text", text: "Hello" }
      ]);
      const manager = new DocumentCommentsManager();
      manager.setComments([
        makeComment({ id: "c1", name: "Alice", content: "Hi", tileId: "t1" })
      ]);
      const { items } = buildReadAloudQueue(content, [], {
        commentsManager: manager, showChatPanel: true, pane: "right"
      });
      expect(items).toHaveLength(1);
      expect(items[0].kind).toBe("tile");
    });

    it("excludes comments when in Documents View", () => {
      const content = createDocumentContent([
        { id: "t1", type: "Text", text: "Hello" }
      ]);
      const manager = new DocumentCommentsManager();
      manager.setComments([
        makeComment({ id: "c1", name: "Alice", content: "Hi", tileId: "t1" })
      ]);
      const { items } = buildReadAloudQueue(content, [], {
        commentsManager: manager, showChatPanel: true, isDocumentsView: true, pane: "left"
      });
      expect(items).toHaveLength(1);
      expect(items[0].kind).toBe("tile");
    });

    it("includes comments in sequential mode (per-comment items)", () => {
      const content = createDocumentContent([
        { id: "t1", type: "Text", text: "Hello" }
      ]);
      const manager = new DocumentCommentsManager();
      manager.setComments([
        makeComment({ id: "c1", name: "Alice", content: "Great work!", tileId: "t1" })
      ]);
      const { items, commentMode } = buildReadAloudQueue(content, [], {
        commentsManager: manager, showChatPanel: true, pane: "left", docTitle: "My Doc"
      });
      // tile + section-header + 1 comment item
      expect(items).toHaveLength(3);
      expect(items[0].kind).toBe("tile");
      expect(items[1].kind).toBe("section-header");
      expect(items[1].speechText).toBe("Comments");
      expect(items[2].kind).toBe("comment");
      const commentItem = items[2] as CommentReadAloudItem;
      expect(commentItem.commentId).toBe("c1");
      expect(commentItem.originTileId).toBe("t1");
      expect(commentItem.speechText).toContain("Alice said: Great work!");
      expect(commentMode).toBe("sequential");
    });

    it("includes comments in targeted mode", () => {
      const content = createDocumentContent([
        { id: "t1", type: "Text", text: "Hello" },
        { id: "t2", type: "Geometry", title: "Shape" }
      ]);
      const manager = new DocumentCommentsManager();
      manager.setComments([
        makeComment({ id: "c1", name: "Alice", content: "Nice tile!", tileId: "t1" }),
        makeComment({ id: "c2", name: "Bob", content: "Other tile", tileId: "t2" })
      ]);
      const { items, commentMode } = buildReadAloudQueue(content, ["t1"], {
        commentsManager: manager, showChatPanel: true, pane: "left", docTitle: "My Doc"
      });
      // tile + 1 comment item (no section header in targeted mode)
      expect(items).toHaveLength(2);
      expect(items[0].kind).toBe("tile");
      expect((items[0] as TileReadAloudItem).associatedTileId).toBe("t1");
      expect(items[1].kind).toBe("comment");
      const commentItem = items[1] as CommentReadAloudItem;
      expect(commentItem.originTileId).toBe("t1");
      expect(commentItem.commentId).toBe("c1");
      expect(commentMode).toBe("targeted");
    });

    it("targeted mode: no thread for selected tile → no comment items", () => {
      const content = createDocumentContent([
        { id: "t1", type: "Text", text: "Hello" },
        { id: "t2", type: "Geometry", title: "Shape" }
      ]);
      const manager = new DocumentCommentsManager();
      manager.setComments([
        makeComment({ id: "c1", name: "Alice", content: "Nice tile!", tileId: "t2" })
      ]);
      const { items, commentMode } = buildReadAloudQueue(content, ["t1"], {
        commentsManager: manager, showChatPanel: true, pane: "left"
      });
      expect(items).toHaveLength(1);
      expect(items[0].kind).toBe("tile");
      expect(commentMode).toBeUndefined();
    });

    it("section header present only in sequential mode with threads", () => {
      const content = createDocumentContent([
        { id: "t1", type: "Text", text: "Hello" }
      ]);
      // No comments → no section header
      const { items: noComments } = buildReadAloudQueue(content, [], {
        commentsManager: new DocumentCommentsManager(), showChatPanel: true, pane: "left"
      });
      expect(noComments.find(i => i.kind === "section-header")).toBeUndefined();
    });

    it("document-level comments have associatedTileId undefined and originTileId null", () => {
      const content = createDocumentContent([
        { id: "t1", type: "Text", text: "Hello" }
      ]);
      const manager = new DocumentCommentsManager();
      manager.setComments([
        makeComment({ id: "c1", name: "Alice", content: "Doc comment", tileId: undefined })
      ]);
      const { items } = buildReadAloudQueue(content, [], {
        commentsManager: manager, showChatPanel: true, pane: "left", docTitle: "My Doc"
      });
      const commentItem = items.find(i => i.kind === "comment") as CommentReadAloudItem;
      expect(commentItem).toBeDefined();
      expect(commentItem.associatedTileId).toBeUndefined();
      expect(commentItem.originTileId).toBeNull();
      expect(commentItem.commentId).toBe("c1");
    });

    it("deleted tile comments have associatedTileId undefined, originTileId set", () => {
      const content = createDocumentContent([
        { id: "t1", type: "Text", text: "Hello" }
        // Note: "deleted-tile" is NOT in the content — simulates deleted tile
      ]);
      const manager = new DocumentCommentsManager();
      manager.setComments([
        makeComment({ id: "c1", name: "Alice", content: "Old tile", tileId: "deleted-tile" })
      ]);
      const { items } = buildReadAloudQueue(content, [], {
        commentsManager: manager, showChatPanel: true, pane: "left", docTitle: "My Doc"
      });
      const commentItem = items.find(i => i.kind === "comment") as CommentReadAloudItem;
      expect(commentItem).toBeDefined();
      expect(commentItem.associatedTileId).toBeUndefined();
      expect(commentItem.originTileId).toBe("deleted-tile");
      expect(commentItem.speechText).toContain("Deleted Tile");
    });

    it("emits per-comment items, skipping empty comments", () => {
      const content = createDocumentContent([
        { id: "t1", type: "Text", text: "Hello" }
      ]);
      const manager = new DocumentCommentsManager();
      manager.setComments([
        makeComment({ id: "c1", name: "Alice", content: "Good", tileId: "t1" }),
        makeComment({ id: "c2", name: "Bob", content: "", tileId: "t1" }),
        makeComment({ id: "c3", name: "Charlie", content: "Also good", tileId: "t1" })
      ]);
      const { items } = buildReadAloudQueue(content, [], {
        commentsManager: manager, showChatPanel: true, pane: "left"
      });
      const commentItems = items.filter(i => i.kind === "comment") as CommentReadAloudItem[];
      // 2 non-empty comments → 2 items (Bob's empty comment skipped)
      expect(commentItems).toHaveLength(2);
      expect(commentItems[0].commentId).toBe("c1");
      expect(commentItems[0].commentIndex).toBe(0);
      expect(commentItems[1].commentId).toBe("c3");
      expect(commentItems[1].commentIndex).toBe(1);
    });

    it("first comment in thread has header prepended, subsequent do not", () => {
      const content = createDocumentContent([
        { id: "t1", type: "Geometry", title: "My Shape" }
      ]);
      const manager = new DocumentCommentsManager();
      manager.setComments([
        makeComment({ id: "c1", name: "Alice", content: "First", tileId: "t1" }),
        makeComment({ id: "c2", name: "Bob", content: "Second", tileId: "t1" })
      ]);
      const { items } = buildReadAloudQueue(content, [], {
        commentsManager: manager, showChatPanel: true, pane: "left"
      });
      const commentItems = items.filter(i => i.kind === "comment") as CommentReadAloudItem[];
      expect(commentItems).toHaveLength(2);
      // First comment has thread header prepended
      expect(commentItems[0].speechText).toBe("Coordinate Grid tile: My Shape. Alice said: First");
      // Second comment has just the attribution
      expect(commentItems[1].speechText).toBe("Bob said: Second");
    });

    it("allPaneTileIds includes all tiles regardless of selection", () => {
      const content = createDocumentContent([
        { id: "t1", type: "Text", text: "a" },
        { id: "t2", type: "Text", text: "b" },
        { id: "t3", type: "Text", text: "c" }
      ]);
      const { allPaneTileIds } = buildReadAloudQueue(content, ["t1"]);
      expect(allPaneTileIds).toEqual(new Set(["t1", "t2", "t3"]));
    });

    it("commentsOnly mode skips tiles and reads only comments", () => {
      const content = createDocumentContent([
        { id: "t1", type: "Text", text: "Hello" },
        { id: "t2", type: "Geometry", title: "Shape" }
      ]);
      const manager = new DocumentCommentsManager();
      manager.setComments([
        makeComment({ id: "c1", name: "Alice", content: "Nice doc!", tileId: undefined }),
        makeComment({ id: "c2", name: "Bob", content: "Good tile", tileId: "t1" })
      ]);
      const { items, commentMode } = buildReadAloudQueue(content, [], {
        commentsManager: manager, showChatPanel: true, pane: "left", docTitle: "My Doc",
        commentsOnly: true
      });
      // No tile items — only section-header + comment items
      expect(items.filter(i => i.kind === "tile")).toHaveLength(0);
      expect(items[0].kind).toBe("section-header");
      expect(items[0].speechText).toBe("Comments");
      const commentItems = items.filter(i => i.kind === "comment") as CommentReadAloudItem[];
      expect(commentItems).toHaveLength(2);
      expect(commentItems[0].originTileId).toBeNull(); // document-level
      expect(commentItems[1].originTileId).toBe("t1");
      expect(commentMode).toBe("sequential");
    });

    it("commentsOnly mode with no comments returns empty queue", () => {
      const content = createDocumentContent([
        { id: "t1", type: "Text", text: "Hello" }
      ]);
      const { items, commentMode } = buildReadAloudQueue(content, [], {
        commentsManager: new DocumentCommentsManager(), showChatPanel: true, pane: "left",
        commentsOnly: true
      });
      expect(items).toHaveLength(0);
      expect(commentMode).toBeUndefined();
    });

    it("comments sorting matches document order", () => {
      const content = createDocumentContent([
        { id: "t1", type: "Text", text: "first" },
        { id: "t2", type: "Text", text: "second" }
      ]);
      const manager = new DocumentCommentsManager();
      // Comments arrive in reverse order of tile position
      manager.setComments([
        makeComment({ id: "c2", name: "Bob", content: "On t2", tileId: "t2" }),
        makeComment({ id: "c1", name: "Alice", content: "On t1", tileId: "t1" })
      ]);
      const { items } = buildReadAloudQueue(content, [], {
        commentsManager: manager, showChatPanel: true, pane: "left"
      });
      const commentItems = items.filter(i => i.kind === "comment") as CommentReadAloudItem[];
      expect(commentItems).toHaveLength(2);
      // t1 should come before t2 in document order
      expect(commentItems[0].originTileId).toBe("t1");
      expect(commentItems[1].originTileId).toBe("t2");
    });

    it("builds targeted queue for sketch tile with comments", () => {
      const content = createDocumentContent([
        { id: "t1", type: "Drawing", title: "My Sketch",
          content: createDrawingContent([makeTextObject("annotation")]) },
        { id: "t2", type: "Text", text: "other tile" }
      ]);
      const manager = new DocumentCommentsManager();
      manager.setComments([
        makeComment({ id: "c1", name: "Alice", content: "Nice drawing!", tileId: "t1" })
      ]);
      const { items, commentMode } = buildReadAloudQueue(content, ["t1"], {
        commentsManager: manager, showChatPanel: true, pane: "left", docTitle: "My Doc"
      });
      expect(commentMode).toBe("targeted");
      // Tile content comes first, then comment thread
      expect(items[0].kind).toBe("tile");
      expect((items[0] as TileReadAloudItem).speechText).toBe("My Sketch. annotation");
      const commentItem = items.find(i => i.kind === "comment") as CommentReadAloudItem;
      expect(commentItem.speechText).toContain("Nice drawing!");
      expect(items.indexOf(commentItem)).toBeGreaterThan(0);
      // No section header in targeted mode
      expect(items.find(i => i.kind === "section-header")).toBeUndefined();
    });

    it("builds sequential queue for table tile with comments", () => {
      const doc = createTableDocumentContent("t1", "Results",
        [{ name: "Score" }], [["95"]]
      );
      const manager = new DocumentCommentsManager();
      manager.setComments([
        makeComment({ id: "c1", name: "Bob", content: "Good scores", tileId: "t1" })
      ]);
      const { items, commentMode } = buildReadAloudQueue(doc, [], {
        commentsManager: manager, showChatPanel: true, pane: "left", docTitle: "My Doc"
      });
      expect(commentMode).toBe("sequential");
      // Tile content comes before comments in sequential mode too
      const tileIndex = items.findIndex(i => i.kind === "tile");
      const sectionHeaderIndex = items.findIndex(i => i.kind === "section-header");
      const commentIndex = items.findIndex(i => i.kind === "comment");
      expect(tileIndex).toBeLessThan(sectionHeaderIndex);
      expect(sectionHeaderIndex).toBeLessThan(commentIndex);
      expect((items[tileIndex] as TileReadAloudItem).speechText).toBe("Results. Column: Score. 95.");
      expect((items[commentIndex] as CommentReadAloudItem).speechText).toContain("Good scores");
    });
  });
});
