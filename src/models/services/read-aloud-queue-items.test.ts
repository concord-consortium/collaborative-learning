import { registerTileTypes } from "../../register-tile-types";
import { DocumentContentModel, DocumentContentSnapshotType } from "../document/document-content";
import { DocumentCommentsManager, CommentWithId } from "../document/document-comments-manager";
import {
  buildReadAloudQueue, buildTileSpeechText, buildThreadHeaderText,
  isTileItem, isCommentItem, isSectionHeaderItem,
  TileReadAloudItem, CommentReadAloudItem
} from "./read-aloud-queue-items";
import { ChatCommentThread } from "../../components/chat/chat-comment-thread";

// Helper to create document content with multiple tiles
function createDocumentContent(tiles: Array<{ id: string; type: string; title?: string; text?: string }>) {
  const rowMap: Record<string, any> = {};
  const tileMap: Record<string, any> = {};
  const rowOrder: string[] = [];

  tiles.forEach((tile, index) => {
    const rowId = `row-${index}`;
    rowOrder.push(rowId);
    rowMap[rowId] = { id: rowId, tiles: [{ tileId: tile.id }] };

    const content: any = { type: tile.type };
    if (tile.type === "Text" && tile.text != null) {
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
    await registerTileTypes(["Geometry", "Text"]);
  });

  describe("buildTileSpeechText", () => {
    it("reads title + text content for text tiles with title", () => {
      const content = createDocumentContent([
        { id: "t1", type: "Text", title: "My Title", text: "My content" }
      ]);
      const tile = content.getTile("t1")!;
      // Text tiles have hiddenTitle, so title is not spoken — only text content
      expect(buildTileSpeechText(tile)).toBe("My content");
    });

    it("reads only text content for text tiles (hidden title)", () => {
      const content = createDocumentContent([
        { id: "t1", type: "Text", text: "Hello world" }
      ]);
      const tile = content.getTile("t1")!;
      expect(buildTileSpeechText(tile)).toBe("Hello world");
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
  });
});
