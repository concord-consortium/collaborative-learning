// This import needs to be first so the jest.mock calls in it
// are run before the next import statements
import { mockUniqueId, resetMockUniqueId } from "./dc-test-utils";

import { DocumentContentModelType, DocumentContentSnapshotType } from "../document-content";
import { IDropRowInfo } from "../tile-row";
import { registerTileTypes } from "../../../register-tile-types";
import { IDragTilesData } from "../document-content-types";
import { LogEventName } from "../../../lib/logger-types";
import { Logger } from "../../../lib/logger";
import { DocumentModel, DocumentModelType } from "../document";

registerTileTypes(["Question", "Text", "Expression", "Table", "Drawing"]);

import questionTileExample from "./question-tile-example.json";

describe("Question tile operations", () => {
  let documentContent: DocumentContentModelType;
  let document: DocumentModelType;
  let logSpy: jest.SpyInstance;

  const srcContent: DocumentContentSnapshotType = questionTileExample.content;

  function getDocumentDragTileItems(tileIds: string[]) {
    return documentContent.getDragTileItems(tileIds).map(tile => ({...tile, newTileId: mockUniqueId()}));
  }

  beforeEach(() => {
    logSpy = jest.spyOn(Logger, "log");
    resetMockUniqueId();
    document = DocumentModel.create({
      uid: "testid-1",
      type: "problem",
      key: "testid-1",
      remoteContext: "",
      createdAt: 0,
      properties: {},
      content: srcContent,
      comments: {},
      groupUserConnections: {},
    });
    documentContent = document.content!;

    // Create a minimal mock stores object for Logger
    const mockStores = {
      documents: {
        findDocumentOfTile: jest.fn(() => document)
      },
      user: { isResearcher: false, portal: "", setIsLoggingConnected: jest.fn() },
      appMode: "authed",
      appConfig: { appName: "TestApp", setConfigs: jest.fn() },
      persistentUI: {
        activeNavTab: undefined,
        navTabContentShown: false,
        problemWorkspace: { mode: "1-up" },
        teacherPanelKey: undefined
      },
      portal: { offeringId: "" }
    };
    Logger.initializeLogger(mockStores as any);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  describe("Question tile moves", () => {
    it("can restore content from JSON", () => {
      expect(documentContent.debugDescribeThis(documentContent.tileMap, ""))
        // NOTE: The layout below is the starting layout of the document before each subsequent test.
        .toEqual("testid-11: [Text: text-1]\n" +
                 "testid-12: [Table: table-1] [Expression: expression-1]\n" +
                 "testid-13: [Question: question-1]\n" +
                 "Contents of embedded row list:\n" +
                 "  testid-14: [Text: text-2]\n" +
                 "  testid-15: [Table: table-2] [Drawing: sketch-1]");
    });

    it("can move a question tile to new row", () => {
      const dragTiles = getDocumentDragTileItems(["question-1"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 0,
        rowDropId: "testid-11",
        rowDropLocation: "bottom"
      };
      documentContent.userMoveTiles(dragTiles, dropRowInfo);
      expect(documentContent.debugDescribeThis(documentContent.tileMap, ""))
        .toEqual("testid-11: [Text: text-1]\n" +
                 "testid-13: [Question: question-1]\n" +
                 "Contents of embedded row list:\n" +
                 "  testid-14: [Text: text-2]\n" +
                 "  testid-15: [Table: table-2] [Drawing: sketch-1]\n" +
                 "testid-12: [Table: table-1] [Expression: expression-1]");
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy.mock.calls[0][0]).toBe(LogEventName.MOVE_TILE);
      expect(logSpy.mock.calls[0][1].params);
      expect(logSpy.mock.calls[0][1].tileId).toBe("question-1");
      expect(logSpy.mock.calls[0][1].containerId).toBeUndefined();
    });

    it("can move a question tile to existing row", () => {
      const dragTiles = getDocumentDragTileItems(["question-1"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 0,
        rowDropId: "testid-11",
        rowDropLocation: "left"
      };
      documentContent.userMoveTiles(dragTiles, dropRowInfo);
      expect(documentContent.debugDescribeThis(documentContent.tileMap, ""))
        .toEqual("testid-11: [Question: question-1] [Text: text-1]\n" +
                 "Contents of embedded row list:\n" +
                 "  testid-14: [Text: text-2]\n" +
                 "  testid-15: [Table: table-2] [Drawing: sketch-1]\n" +
                 "testid-12: [Table: table-1] [Expression: expression-1]");
    });

    it("can move a tile into a question tile", () => {
      // move text-1 into the question tile
      const dragTiles = getDocumentDragTileItems(["text-1"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 0,
        rowDropId: "testid-14",
        rowDropLocation: "left"
      };
      documentContent.userMoveTiles(dragTiles, dropRowInfo);
      expect(documentContent.debugDescribeThis(documentContent.tileMap, ""))
        .toEqual("testid-12: [Table: table-1] [Expression: expression-1]\n" +
                 "testid-13: [Question: question-1]\n" +
                 "Contents of embedded row list:\n" +
                 "  testid-14: [Text: text-1] [Text: text-2]\n" +
                 "  testid-15: [Table: table-2] [Drawing: sketch-1]");
      expect(logSpy).toHaveBeenCalledTimes(2);
      expect(logSpy.mock.calls[0][0]).toBe(LogEventName.MOVE_TILE);
      expect(logSpy.mock.calls[0][1].tileId).toBe("text-1");
      expect(logSpy.mock.calls[0][1].containerId).toBeUndefined();

      // Question answers has changed so an event should be logged.
      expect(logSpy.mock.calls[1][0]).toBe(LogEventName.QUESTION_ANSWERS_CHANGE);
      expect(logSpy.mock.calls[1][1].answers).toEqual([
        {
          tileId: "question-1",
          answerTiles: [
            { plainText: "Outside text tile", tileId: "text-1", type: "Text" },
            { plainText: "Inside text tile", tileId: "text-2", type: "Text" },
            { tileId: "table-2", type: "Table" },
            { tileId: "sketch-1", type: "Drawing" }
          ]
        }
      ]);
    });

    it("can move multiple tiles into a question tile", () => {
      // move text-1, table-1, expression-1 into the question tile
      const dragTiles = getDocumentDragTileItems(["text-1", "table-1", "expression-1"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 2,
        rowDropId: "testid-15",
        rowDropLocation: "top"
      };
      documentContent.userMoveTiles(dragTiles, dropRowInfo);
      expect(documentContent.debugDescribeThis(documentContent.tileMap, ""))
        .toEqual("testid-13: [Question: question-1]\n" +
                 "Contents of embedded row list:\n" +
                 "  testid-14: [Text: text-2]\n" +
                 "  testid-11: [Text: text-1]\n" +
                 "  testid-12: [Table: table-1] [Expression: expression-1]\n" +
                 "  testid-15: [Table: table-2] [Drawing: sketch-1]");

      // Log assertions
      expect(logSpy).toHaveBeenCalledTimes(6);
      expect(logSpy.mock.calls[0][0]).toBe(LogEventName.MOVE_TILE);
      expect(logSpy.mock.calls[1][0]).toBe(LogEventName.QUESTION_ANSWERS_CHANGE);
      expect(logSpy.mock.calls[2][0]).toBe(LogEventName.MOVE_TILE);
      expect(logSpy.mock.calls[3][0]).toBe(LogEventName.QUESTION_ANSWERS_CHANGE);
      expect(logSpy.mock.calls[4][0]).toBe(LogEventName.MOVE_TILE);
      expect(logSpy.mock.calls[5][0]).toBe(LogEventName.QUESTION_ANSWERS_CHANGE);
      expect(logSpy.mock.calls[5][1].answers).toEqual([
        {
          tileId: "question-1",
          answerTiles: [
            { plainText: "Inside text tile", tileId: "text-2", type: "Text" },
            { tileId: "text-1", type: "Text", plainText: "Outside text tile" },
            { tileId: "table-1", type: "Table" },
            { tileId: "expression-1", type: "Expression" },
            { tileId: "table-2", type: "Table" },
            { tileId: "sketch-1", type: "Drawing" }
          ]
        }
      ]);
    });

    it("refuses to move a question tile into a question tile", () => {
      // move text-1 into the question tile; question-1 should be ignored.
      const dragTiles = getDocumentDragTileItems(["text-1","question-1"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 2,
        rowDropId: "testid-15",
        rowDropLocation: "top"
      };
      documentContent.userMoveTiles(dragTiles, dropRowInfo);
      expect(documentContent.debugDescribeThis(documentContent.tileMap, ""))
        .toEqual("testid-12: [Table: table-1] [Expression: expression-1]\n" +
                 "testid-13: [Question: question-1]\n" +
                 "Contents of embedded row list:\n" +
                 "  testid-14: [Text: text-2]\n" +
                 "  testid-11: [Text: text-1]\n" +
                 "  testid-15: [Table: table-2] [Drawing: sketch-1]");
      expect(logSpy).toHaveBeenCalledTimes(3);
      expect(logSpy.mock.calls[0][0]).toBe(LogEventName.MOVE_TILE);
      expect(logSpy.mock.calls[0][1].tileId).toBe("text-1");
      expect(logSpy.mock.calls[1][0]).toBe(LogEventName.QUESTION_ANSWERS_CHANGE);
      expect(logSpy.mock.calls[1][1].answers).toEqual([
        {
          tileId: "question-1",
          answerTiles: [
            { plainText: "Inside text tile", tileId: "text-2", type: "Text" },
            { plainText: "Outside text tile", tileId: "text-1", type: "Text" },
            { tileId: "table-2", type: "Table" },
            { tileId: "sketch-1", type: "Drawing" }
          ]
        }
      ]);
      // Note this requested move event is logged, but not actually performed.
      expect(logSpy.mock.calls[2][0]).toBe(LogEventName.MOVE_TILE);
      expect(logSpy.mock.calls[2][1].tileId).toBe("question-1");
    });

    it("can move a tile out of a question tile", () => {
      const dragTiles = getDocumentDragTileItems(["sketch-1"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 0,
        rowDropId: "testid-11",
        rowDropLocation: "right"
      };
      documentContent.userMoveTiles(dragTiles, dropRowInfo);
      expect(documentContent.debugDescribeThis(documentContent.tileMap, ""))
      .toEqual("testid-11: [Text: text-1] [Drawing: sketch-1]\n" +
        "testid-12: [Table: table-1] [Expression: expression-1]\n" +
        "testid-13: [Question: question-1]\n" +
        "Contents of embedded row list:\n" +
        "  testid-14: [Text: text-2]\n" +
        "  testid-15: [Table: table-2]");
      expect(logSpy).toHaveBeenCalledTimes(2);
      expect(logSpy.mock.calls[0][0]).toBe(LogEventName.MOVE_TILE);
      expect(logSpy.mock.calls[0][1].tileId).toBe("sketch-1");
      expect(logSpy.mock.calls[1][0]).toBe(LogEventName.QUESTION_ANSWERS_CHANGE);
      expect(logSpy.mock.calls[1][1].answers).toEqual([
        {
          tileId: "question-1",
          answerTiles: [
            { plainText: "Inside text tile", tileId: "text-2", type: "Text" },
            { tileId: "table-2", type: "Table" }
          ]
        }
      ]);
    });

    it("can move a tile out of a question tile to below it", () => {
      const dragTiles = getDocumentDragTileItems(["sketch-1"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 0,
        rowDropId: "testid-13",
        rowDropLocation: "bottom"
      };
      documentContent.userMoveTiles(dragTiles, dropRowInfo);
      expect(documentContent.debugDescribeThis(documentContent.tileMap, ""))
      .toEqual("testid-11: [Text: text-1]\n" +
        "testid-12: [Table: table-1] [Expression: expression-1]\n" +
        "testid-13: [Question: question-1]\n" +
        "Contents of embedded row list:\n" +
        "  testid-14: [Text: text-2]\n" +
        "  testid-15: [Table: table-2]\n" +
        "testid-22: [Drawing: sketch-1]");
    });

    it("can move multiple tiles out of a question tile", () => {
      const dragTiles = getDocumentDragTileItems(["sketch-1", "text-2"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 0,
        rowDropId: "testid-11",
        rowDropLocation: "right"
      };
      // Note, text-2 should be inserted before sketch-1, since it's earlier in the document order,
      // despite the different order in the argument to getDocumentDragTileItems.
      documentContent.userMoveTiles(dragTiles, dropRowInfo);
      expect(documentContent.debugDescribeThis(documentContent.tileMap, ""))
      .toEqual("testid-11: [Text: text-1] [Text: text-2] [Drawing: sketch-1]\n" +
        "testid-12: [Table: table-1] [Expression: expression-1]\n" +
        "testid-13: [Question: question-1]\n" +
        "Contents of embedded row list:\n" +
        "  testid-15: [Table: table-2]");
    });

    it("Can move a row within the question tile", () => {
      const dragTiles = getDocumentDragTileItems(["table-2", "sketch-1"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 0,
        rowDropId: "testid-14",
        rowDropLocation: "top"
      };
      documentContent.userMoveTiles(dragTiles, dropRowInfo);
      expect(documentContent.debugDescribeThis(documentContent.tileMap, ""))
        .toEqual("testid-11: [Text: text-1]\n" +
                 "testid-12: [Table: table-1] [Expression: expression-1]\n" +
                 "testid-13: [Question: question-1]\n" +
                 "Contents of embedded row list:\n" +
                 "  testid-15: [Table: table-2] [Drawing: sketch-1]\n" +
                 "  testid-14: [Text: text-2]");
      expect(logSpy).toHaveBeenCalledTimes(4);
      expect(logSpy.mock.calls[0][0]).toBe(LogEventName.MOVE_TILE);
      expect(logSpy.mock.calls[0][1].tileId).toBe("table-2");
      expect(logSpy.mock.calls[1][0]).toBe(LogEventName.QUESTION_ANSWERS_CHANGE);
      expect(logSpy.mock.calls[2][0]).toBe(LogEventName.MOVE_TILE);
      expect(logSpy.mock.calls[2][1].tileId).toBe("sketch-1");
      expect(logSpy.mock.calls[3][0]).toBe(LogEventName.QUESTION_ANSWERS_CHANGE);
    });

    it("Can move a tile left within a question tile row", () => {
      const dragTiles = getDocumentDragTileItems(["sketch-1"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 1,
        rowDropId: "testid-15",
        rowDropLocation: "left"
      };
      documentContent.userMoveTiles(dragTiles, dropRowInfo);
      expect(documentContent.debugDescribeThis(documentContent.tileMap, ""))
        .toEqual("testid-11: [Text: text-1]\n" +
                 "testid-12: [Table: table-1] [Expression: expression-1]\n" +
                 "testid-13: [Question: question-1]\n" +
                 "Contents of embedded row list:\n" +
                 "  testid-14: [Text: text-2]\n" +
                 "  testid-15: [Drawing: sketch-1] [Table: table-2]");
    });

    it("Can move a tile right within a question tile row", () => {
      const dragTiles = getDocumentDragTileItems(["table-2"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 1,
        rowDropId: "testid-15",
        rowDropLocation: "right"
      };
      documentContent.moveTiles(dragTiles, dropRowInfo);
      expect(documentContent.debugDescribeThis(documentContent.tileMap, ""))
        .toEqual("testid-11: [Text: text-1]\n" +
                 "testid-12: [Table: table-1] [Expression: expression-1]\n" +
                 "testid-13: [Question: question-1]\n" +
                 "Contents of embedded row list:\n" +
                 "  testid-14: [Text: text-2]\n" +
                 "  testid-15: [Drawing: sketch-1] [Table: table-2]");
    });

    it("Can move a tile from one question tile to another", () => {
      // Add a second question tile
      documentContent.addTile("Question", {});
      expect(documentContent.debugDescribeThis(documentContent.tileMap, ""))
        .toEqual("testid-11: [Text: text-1]\n" +
                "testid-12: [Table: table-1] [Expression: expression-1]\n" +
                "testid-13: [Question: question-1]\n" +
                "Contents of embedded row list:\n" +
                "  testid-14: [Text: text-2]\n" +
                "  testid-15: [Table: table-2] [Drawing: sketch-1]\n" +
                "testid-25: [Question: testid-26]\n" +
                "Contents of embedded row list:\n" +
                "  testid-23: [Text: testid-20]\n" +
                "  testid-24: [Placeholder: testid-21]");

      // Move the sketch-1 tile from question-1 to question-2
      const dragTiles = getDocumentDragTileItems(["text-2"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 0,
        rowDropId: "testid-24",
        rowDropLocation: "bottom"
      };
      documentContent.userMoveTiles(dragTiles, dropRowInfo);
      expect(documentContent.debugDescribeThis(documentContent.tileMap, ""))
        .toEqual("testid-11: [Text: text-1]\n" +
                "testid-12: [Table: table-1] [Expression: expression-1]\n" +
                "testid-13: [Question: question-1]\n" +
                "Contents of embedded row list:\n" +
                "  testid-15: [Table: table-2] [Drawing: sketch-1]\n" +
                "testid-25: [Question: testid-26]\n" +
                "Contents of embedded row list:\n" +
                "  testid-23: [Text: testid-20]\n" +
                "  testid-14: [Text: text-2]");
      expect(logSpy).toHaveBeenCalledTimes(3);
      expect(logSpy.mock.calls[0][0]).toBe(LogEventName.MOVE_TILE);
      expect(logSpy.mock.calls[0][1].tileId).toBe("text-2");
      // Updated answer for first question tile
      expect(logSpy.mock.calls[1][0]).toBe(LogEventName.QUESTION_ANSWERS_CHANGE);
      expect(logSpy.mock.calls[1][1].answers).toEqual([
        {
          tileId: "question-1",
          answerTiles: [
            { tileId: "table-2", type: "Table" },
            { tileId: "sketch-1", type: "Drawing" }
          ]
        }
      ]);
      // Updated answer for second question tile
      expect(logSpy.mock.calls[2][0]).toBe(LogEventName.QUESTION_ANSWERS_CHANGE);
      expect(logSpy.mock.calls[2][1].answers).toEqual([
        {
          tileId: "testid-26",
          answerTiles: [
            { tileId: "text-2", type: "Text", plainText: "Inside text tile" }
          ]
        }
      ]);
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
        rowDropId: "testid-11",
        rowDropLocation: "bottom"
      };
      documentContent.handleDragCopyTiles(dragTiles, dropRowInfo);

      expect(logSpy).toHaveBeenCalledTimes(7);
      // Tiles are copied in document order, depth first
      expect(logSpy.mock.calls[0][0]).toBe(LogEventName.COPY_TILE);
      expect(logSpy.mock.calls[0][1].sourceObjectId).toBe("text-2");
      expect(logSpy.mock.calls[1][0]).toBe(LogEventName.QUESTION_ANSWERS_CHANGE);
      expect(logSpy.mock.calls[2][0]).toBe(LogEventName.COPY_TILE);
      expect(logSpy.mock.calls[2][1].sourceObjectId).toBe("table-2");
      expect(logSpy.mock.calls[3][0]).toBe(LogEventName.QUESTION_ANSWERS_CHANGE);
      expect(logSpy.mock.calls[4][0]).toBe(LogEventName.COPY_TILE);
      expect(logSpy.mock.calls[4][1].sourceObjectId).toBe("sketch-1");
      expect(logSpy.mock.calls[5][0]).toBe(LogEventName.QUESTION_ANSWERS_CHANGE);
      expect(logSpy.mock.calls[6][0]).toBe(LogEventName.COPY_TILE);
      expect(logSpy.mock.calls[6][1].sourceObjectId).toBe("question-1");
      expect(documentContent.debugDescribeThis(documentContent.tileMap, "")).toMatchInlineSnapshot(`
"testid-11: [Text: text-1]
testid-35: [Question: testid-31]
Contents of embedded row list:
  testid-32: [Text: testid-28]
  testid-33: [Table: testid-29] [Drawing: testid-30]
testid-12: [Table: table-1] [Expression: expression-1]
testid-13: [Question: question-1]
Contents of embedded row list:
  testid-14: [Text: text-2]
  testid-15: [Table: table-2] [Drawing: sketch-1]"
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
        rowDropId: "testid-14",
        rowDropLocation: "bottom"
      };
      documentContent.handleDragCopyTiles(dragTiles, dropRowInfo);
      // No copy events should be logged
      expect(logSpy).toHaveBeenCalledTimes(0);
      expect(documentContent.debugDescribeThis(documentContent.tileMap, "")).
toMatchInlineSnapshot(`
"testid-11: [Text: text-1]
testid-12: [Table: table-1] [Expression: expression-1]
testid-13: [Question: question-1]
Contents of embedded row list:
  testid-14: [Text: text-2]
  testid-15: [Table: table-2] [Drawing: sketch-1]"
`);
    });

  });

});
