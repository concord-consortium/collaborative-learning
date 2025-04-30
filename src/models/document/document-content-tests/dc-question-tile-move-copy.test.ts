// This import needs to be first so the jest.mock calls in it
// are run before the next import statements
import { mockUniqueId, resetMockUniqueId } from "./dc-test-utils";

import { DocumentContentModel, DocumentContentModelType, DocumentContentSnapshotType } from "../document-content";
import { IDropRowInfo } from "../tile-row";
import { registerTileTypes } from "../../../register-tile-types";
import { IDragTilesData } from "../document-content-types";

// mock Logger calls
const mockLogTileCopyEvent = jest.fn();
jest.mock("../../tiles/log/log-tile-copy-event", () => ({
  logTileCopyEvent: (...args: any[]) => mockLogTileCopyEvent(...args)
}));

registerTileTypes(["Question", "Text", "Expression", "Table", "Drawing"]);

import questionTileExample from "./question-tile-example.json";

describe("Question tile operations", () => {
  let documentContent: DocumentContentModelType;

  const srcContent: DocumentContentSnapshotType = questionTileExample.content;

  function getDocumentDragTileItems(tileIds: string[]) {
    return documentContent.getDragTileItems(tileIds).map(tile => ({...tile, newTileId: mockUniqueId()}));
  }

  beforeEach(() => {
    resetMockUniqueId();
    documentContent = DocumentContentModel.create(srcContent);
  });

  describe("Question tile moves", () => {
    it("can restore content from JSON", () => {
      expect(documentContent.debugDescribeThis(documentContent.tileMap, ""))
        // NOTE: The layout below is the starting layout of the document before each subsequent test.
        .toEqual("testid-6: [Text: text-1]\n" +
                 "testid-7: [Table: table-1] [Expression: expression-1]\n" +
                 "testid-8: [Question: question-1]\n" +
                 "Contents of embedded row list:\n" +
                 "  testid-9: [Text: text-2]\n" +
                 "  testid-10: [Table: table-2] [Drawing: sketch-1]");
    });

    it("can move a question tile to new row", () => {
      const dragTiles = getDocumentDragTileItems(["question-1"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 0,
        rowDropId: "testid-6",
        rowDropLocation: "bottom"
      };
      documentContent.moveTiles(dragTiles, dropRowInfo);
      expect(documentContent.debugDescribeThis(documentContent.tileMap, ""))
        .toEqual("testid-6: [Text: text-1]\n" +
                 "testid-8: [Question: question-1]\n" +
                 "Contents of embedded row list:\n" +
                 "  testid-9: [Text: text-2]\n" +
                 "  testid-10: [Table: table-2] [Drawing: sketch-1]\n" +
                 "testid-7: [Table: table-1] [Expression: expression-1]");
    });

    it("can move a question tile to existing row", () => {
      const dragTiles = getDocumentDragTileItems(["question-1"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 0,
        rowDropId: "testid-6",
        rowDropLocation: "left"
      };
      documentContent.moveTiles(dragTiles, dropRowInfo);
      expect(documentContent.debugDescribeThis(documentContent.tileMap, ""))
        .toEqual("testid-6: [Question: question-1] [Text: text-1]\n" +
                 "Contents of embedded row list:\n" +
                 "  testid-9: [Text: text-2]\n" +
                 "  testid-10: [Table: table-2] [Drawing: sketch-1]\n" +
                 "testid-7: [Table: table-1] [Expression: expression-1]");
    });

    it("can move a tile into a question tile", () => {
      // move text-1 into the question tile
      const dragTiles = getDocumentDragTileItems(["text-1"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 0,
        rowDropId: "testid-9",
        rowDropLocation: "left"
      };
      documentContent.moveTiles(dragTiles, dropRowInfo);
      expect(documentContent.debugDescribeThis(documentContent.tileMap, ""))
        .toEqual("testid-7: [Table: table-1] [Expression: expression-1]\n" +
                 "testid-8: [Question: question-1]\n" +
                 "Contents of embedded row list:\n" +
                 "  testid-9: [Text: text-1] [Text: text-2]\n" +
                 "  testid-10: [Table: table-2] [Drawing: sketch-1]");
    });

    it("can move multiple tiles into a question tile", () => {
      // move text-1, table-1, expression-1 into the question tile
      const dragTiles = getDocumentDragTileItems(["text-1", "table-1", "expression-1"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 2,
        rowDropId: "testid-10",
        rowDropLocation: "top"
      };
      documentContent.moveTiles(dragTiles, dropRowInfo);
      expect(documentContent.debugDescribeThis(documentContent.tileMap, ""))
        .toEqual("testid-8: [Question: question-1]\n" +
                 "Contents of embedded row list:\n" +
                 "  testid-9: [Text: text-2]\n" +
                 "  testid-6: [Text: text-1]\n" +
                 "  testid-7: [Table: table-1] [Expression: expression-1]\n" +
                 "  testid-10: [Table: table-2] [Drawing: sketch-1]");
    });

    it("refuses to move a question tile into a question tile", () => {
      // move text-1, table-1, expression-1 into the question tile
      const dragTiles = getDocumentDragTileItems(["text-1","question-1"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 2,
        rowDropId: "testid-10",
        rowDropLocation: "top"
      };
      documentContent.moveTiles(dragTiles, dropRowInfo);
      expect(documentContent.debugDescribeThis(documentContent.tileMap, ""))
        .toEqual("testid-7: [Table: table-1] [Expression: expression-1]\n" +
                 "testid-8: [Question: question-1]\n" +
                 "Contents of embedded row list:\n" +
                 "  testid-9: [Text: text-2]\n" +
                 "  testid-6: [Text: text-1]\n" +
                 "  testid-10: [Table: table-2] [Drawing: sketch-1]");
      });

    it("can move a tile out of a question tile", () => {
      const dragTiles = getDocumentDragTileItems(["sketch-1"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 0,
        rowDropId: "testid-6",
        rowDropLocation: "right"
      };
      documentContent.moveTiles(dragTiles, dropRowInfo);
      expect(documentContent.debugDescribeThis(documentContent.tileMap, ""))
      .toEqual("testid-6: [Text: text-1] [Drawing: sketch-1]\n" +
        "testid-7: [Table: table-1] [Expression: expression-1]\n" +
        "testid-8: [Question: question-1]\n" +
        "Contents of embedded row list:\n" +
        "  testid-9: [Text: text-2]\n" +
        "  testid-10: [Table: table-2]");
    });

    it("can move a tile out of a question tile to below it", () => {
      const dragTiles = getDocumentDragTileItems(["sketch-1"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 0,
        rowDropId: "testid-8",
        rowDropLocation: "bottom"
      };
      documentContent.moveTiles(dragTiles, dropRowInfo);
      expect(documentContent.debugDescribeThis(documentContent.tileMap, ""))
      .toEqual("testid-6: [Text: text-1]\n" +
        "testid-7: [Table: table-1] [Expression: expression-1]\n" +
        "testid-8: [Question: question-1]\n" +
        "Contents of embedded row list:\n" +
        "  testid-9: [Text: text-2]\n" +
        "  testid-10: [Table: table-2]\n" +
        "testid-16: [Drawing: sketch-1]");
    });

    it("can move multiple tiles out of a question tile", () => {
      const dragTiles = getDocumentDragTileItems(["sketch-1", "text-2"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 0,
        rowDropId: "testid-6",
        rowDropLocation: "right"
      };
      // Note, text-2 should be inserted before sketch-1, since it's earlier in the document order,
      // despite the different order in the argument to getDocumentDragTileItems.
      documentContent.moveTiles(dragTiles, dropRowInfo);
      expect(documentContent.debugDescribeThis(documentContent.tileMap, ""))
      .toEqual("testid-6: [Text: text-1] [Text: text-2] [Drawing: sketch-1]\n" +
        "testid-7: [Table: table-1] [Expression: expression-1]\n" +
        "testid-8: [Question: question-1]\n" +
        "Contents of embedded row list:\n" +
        "  testid-10: [Table: table-2]");
    });

    it("Can move a row within the question tile", () => {
      const dragTiles = getDocumentDragTileItems(["table-2", "sketch-1"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 0,
        rowDropId: "testid-9",
        rowDropLocation: "top"
      };
      documentContent.moveTiles(dragTiles, dropRowInfo);
      expect(documentContent.debugDescribeThis(documentContent.tileMap, ""))
        .toEqual("testid-6: [Text: text-1]\n" +
                 "testid-7: [Table: table-1] [Expression: expression-1]\n" +
                 "testid-8: [Question: question-1]\n" +
                 "Contents of embedded row list:\n" +
                 "  testid-10: [Table: table-2] [Drawing: sketch-1]\n" +
                 "  testid-9: [Text: text-2]");
    });

    it("Can move a tile left within a question tile row", () => {
      const dragTiles = getDocumentDragTileItems(["sketch-1"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 1,
        rowDropId: "testid-10",
        rowDropLocation: "left"
      };
      documentContent.moveTiles(dragTiles, dropRowInfo);
      expect(documentContent.debugDescribeThis(documentContent.tileMap, ""))
        .toEqual("testid-6: [Text: text-1]\n" +
                 "testid-7: [Table: table-1] [Expression: expression-1]\n" +
                 "testid-8: [Question: question-1]\n" +
                 "Contents of embedded row list:\n" +
                 "  testid-9: [Text: text-2]\n" +
                 "  testid-10: [Drawing: sketch-1] [Table: table-2]");
    });

    it("Can move a tile right within a question tile row", () => {
      const dragTiles = getDocumentDragTileItems(["table-2"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 1,
        rowDropId: "testid-10",
        rowDropLocation: "right"
      };
      documentContent.moveTiles(dragTiles, dropRowInfo);
      expect(documentContent.debugDescribeThis(documentContent.tileMap, ""))
        .toEqual("testid-6: [Text: text-1]\n" +
                 "testid-7: [Table: table-1] [Expression: expression-1]\n" +
                 "testid-8: [Question: question-1]\n" +
                 "Contents of embedded row list:\n" +
                 "  testid-9: [Text: text-2]\n" +
                 "  testid-10: [Drawing: sketch-1] [Table: table-2]");
    });

  });

  describe("Question tile copying", () => {
    it("can copy a question tile", () => {
      const dragTiles: IDragTilesData = {
        sourceDocId: documentContent.contentId,
        tiles: getDocumentDragTileItems(["question-1", "sketch-1", "text-2", "table-2"]),
        sharedModels: [], // No shared models in this test
        annotations: []  // No annotations in this test
      };
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 1,
        rowDropId: "testid-6",
        rowDropLocation: "bottom"
      };
      documentContent.handleDragCopyTiles(dragTiles, dropRowInfo);
      expect(documentContent.debugDescribeThis(documentContent.tileMap, "")).
toMatchInlineSnapshot(`
"testid-6: [Text: text-1]
testid-29: [Question: testid-25]
Contents of embedded row list:
  testid-26: [Text: testid-22]
  testid-27: [Table: testid-23] [Drawing: testid-24]
testid-7: [Table: table-1] [Expression: expression-1]
testid-8: [Question: question-1]
Contents of embedded row list:
  testid-9: [Text: text-2]
  testid-10: [Table: table-2] [Drawing: sketch-1]"
`);
    });

    it("will not copy a question tile into itself", () => {
      const dragTiles: IDragTilesData = {
        sourceDocId: documentContent.contentId,
        tiles: getDocumentDragTileItems(["question-1", "sketch-1", "text-2", "table-2"]),
        sharedModels: [], // No shared models in this test
        annotations: []  // No annotations in this test
      };
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 1,
        rowDropId: "testid-9",
        rowDropLocation: "bottom"
      };
      documentContent.handleDragCopyTiles(dragTiles, dropRowInfo);
      expect(documentContent.debugDescribeThis(documentContent.tileMap, "")).
toMatchInlineSnapshot(`
"testid-6: [Text: text-1]
testid-7: [Table: table-1] [Expression: expression-1]
testid-8: [Question: question-1]
Contents of embedded row list:
  testid-9: [Text: text-2]
  testid-10: [Table: table-2] [Drawing: sketch-1]"
`);
    });

  });

});
