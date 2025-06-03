// This import needs to be first so the jest.mock calls in it
// are run before the next import statements
import { mockUniqueId, parsedExport, setupDocumentContent,
  getColumnWidths, parsedSections } from "./dc-test-utils";
import { DocumentContentModelType, DocumentContentSnapshotType } from "../document-content";
import { IDropRowInfo } from "../tile-row";

// TODO: this content has a few problems in it:
// - the table model errors when trying to load it
// - the image does not display
// you can see these errors using the document editor
// http://localhost:8080/editor/
import multipleTilesExamples from "./multiple-tiles-example.json";
/*
    This is the starting layout of the document before each test:
    {
        introductionRowHeader: [],
        introductionRow1: [ "textTool1" ],
        introductionRow2: [ "drawingTool1" ],
        initialChallengeRowHeader: [],
        initialChallengeRow1: [ "tableTool", "imageTool" ],
        initialChallengeRow2: [ "graphTool", "textTool2", "drawingTool2" ],
        whatIfRowHeader: [],
        whatIfRow1: [ "whatIfPlaceholder" ],
        nowWhatDoYouKnowRowHeader: [],
        nowWhatDoYouKnowRow1: [ "nowWhatDoYouKnowPlaceholder" ]
    }

 */

describe("DocumentContentModel -- move/copy tiles --", () => {

  let documentContent: DocumentContentModelType;
  let columnWidths: Record<string, number>;

  const srcContent: DocumentContentSnapshotType = multipleTilesExamples.content;
  /*
    NOTE: this is the starting layout of the document before each test:
    {
        introductionRowHeader: [],
        introductionRow1: [ "textTool1" ],
        introductionRow2: [ "drawingTool1" ],
        initialChallengeRowHeader: [],
        initialChallengeRow1: [ "tableTool", "imageTool" ],
        initialChallengeRow2: [ "graphTool", "textTool2", "drawingTool2" ],
        whatIfRowHeader: [],
        whatIfRow1: [ "whatIfPlaceholder" ],
        nowWhatDoYouKnowRowHeader: [],
        nowWhatDoYouKnowRow1: [ "nowWhatDoYouKnowPlaceholder" ]
    }
  */

  function getDocumentDragTileItems(tileIds: string[]) {
    return documentContent.getDragTileItems(tileIds);
  }

  let getRowLayout: () => any;
  beforeEach(() => {
    const result = setupDocumentContent(srcContent);
    documentContent = result.documentContent;
    getRowLayout = result.getRowLayout;
    const tableTileIds = documentContent.getTilesOfType("Table");
    columnWidths = getColumnWidths(documentContent, tableTileIds[0]);
  });

  it("getTilesInDocumentOrder handles rows with multiple tiles", () => {
    expect(documentContent.getTilesInDocumentOrder()).toEqual(
      ["textTool1", "drawingTool1", "tableTool", "imageTool","graphTool", "textTool2",
      "drawingTool2", "whatIfPlaceholder", "nowWhatDoYouKnowPlaceholder"]);
  });

  it("can query content", () => {
    expect(documentContent.isEmpty).toBe(false);
    expect(documentContent.contentId).toBeDefined();
    expect(documentContent.firstTile!.id).toBe("textTool1");
    expect(documentContent.getTileType("drawingTool1")).toBe("Drawing");
    expect(documentContent.getTileContent("drawingTool1")?.type).toBe("Drawing");
    expect(documentContent.getTileCountsPerSection(["introduction"])).toEqual({ introduction: 2 });
    expect(documentContent.getTileCountsPerSection(["initialChallenge"])).toEqual({ initialChallenge: 5 });
    expect(documentContent.getTilesOfType("Text")).toEqual(["textTool1", "textTool2"]);
    expect(documentContent.getTilesOfType("Drawing")).toEqual(["drawingTool1", "drawingTool2"]);
    // There are no titles in the test content being loaded so Coordinate Grid 1 is expected
    expect(documentContent.getUniqueTitleForType("Geometry")).toBe("Coordinate Grid 1");
  });

  it("can export more complicated content", () => {
    expect(parsedExport(documentContent)).toEqual({
      tiles: [
        {
          content: { type: "Text", format: "html", text: ["<p>Some text</p>"] },
          title: "Text 1"
        },
        // explicit row height exported since it differs from drawing tool default
        { content: { type: "Drawing", objects: [] }, layout: { height: 320 } },
        [
          {
            content: {
              type: "Table",
              columnWidths
            }
          },
          { content: { type: "Image", url: "image/url" } }
        ],
        [
          { content: {
            type: "Geometry",
            objects: {},
            linkedAttributeColors: {},
            pointMetadata: {},
            isNavigatorVisible: true,
            navigatorPosition: "bottom",
            zoom: 1,
            offsetX: 0,
            offsetY: 0
        } },
          { content: { type: "Text", format: "html", text: ["<p>More text</p>"] } },
          // explicit row height exported since it differs from drawing tool default
          { content: { type: "Drawing", objects: [] }, layout: { height: 320 } }
        ]
      ]
    });
  });

  it("can parse content into sections", () => {
    expect(parsedSections(documentContent)).toEqual({
      "introduction": { tiles: [
        {
          content: { type: "Text", format: "html", text: ["<p>Some text</p>"] },
          title: "Text 1"
        },
        // explicit row height exported since it differs from drawing tool default
        { content: { type: "Drawing", objects: [] }, layout: { height: 320 } }
      ]},
      "initialChallenge": { tiles: [
        [
          {
            content: {
              type: "Table",
              columnWidths
            }
          },
          { content: { type: "Image", url: "image/url" } }
        ],
        [
          { content: {
            type: "Geometry",
            objects: {},
            linkedAttributeColors: {},
            pointMetadata: {},
            isNavigatorVisible: true,
            navigatorPosition: "bottom",
            zoom: 1,
            offsetX: 0,
            offsetY: 0
        } },
          { content: { type: "Text", format: "html", text: ["<p>More text</p>"] } },
          // explicit row height exported since it differs from drawing tool default
          { content: { type: "Drawing", objects: [] }, layout: { height: 320 } }
        ]
      ]},
      "whatIf": { tiles: [] },
      "nowWhatDoYouKnow": { tiles: [] }
    });
  });

  describe("Title handling when copying", () => {
    it("copyTilesIntoNewRows generates a unique title when requested", () => {
      const newId = mockUniqueId();
      const dragTiles = getDocumentDragTileItems(["textTool1"]).map(tile => ({...tile, newTileId: newId}));
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 0,
        rowDropId: "introductionRow2"
      };
      documentContent.copyTilesIntoNewRows(dragTiles, dropRowInfo, true);
      expect(documentContent.getTile("textTool1")?.title).toBe("Text 1");
      expect(documentContent.getTile(newId)?.title).toBe("Text 2");
    });

    it("copyTilesIntoExistingRow generates a unique title when requested", () => {
      const newId = mockUniqueId();
      const dragTiles = getDocumentDragTileItems(["textTool1"]).map(tile => ({...tile, newTileId: newId}));
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 0,
        rowDropId: "introductionRow2"
      };
      documentContent.copyTilesIntoExistingRow(dragTiles, dropRowInfo, true);
      expect(documentContent.getTile("textTool1")?.title).toBe("Text 1");
      expect(documentContent.getTile(newId)?.title).toBe("Text 2");
    });

    it("copyTilesIntoNewRows keeps existing titles when not requested", () => {
      const newId = mockUniqueId();
      const dragTiles = getDocumentDragTileItems(["textTool1"]).map(tile => ({...tile, newTileId: newId}));
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 0,
        rowDropId: "introductionRow2"
      };
      documentContent.copyTilesIntoNewRows(dragTiles, dropRowInfo, false);
      expect(documentContent.getTile("textTool1")?.title).toBe("Text 1");
      expect(documentContent.getTile(newId)?.title).toBe("Text 1");
    });

    it("copyTilesIntoExistingRow keeps existing titles when not requested", () => {
      const newId = mockUniqueId();
      const dragTiles = getDocumentDragTileItems(["textTool1"]).map(tile => ({...tile, newTileId: newId}));
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 0,
        rowDropId: "introductionRow2"
      };
      documentContent.copyTilesIntoExistingRow(dragTiles, dropRowInfo, false);
      expect(documentContent.getTile("textTool1")?.title).toBe("Text 1");
      expect(documentContent.getTile(newId)?.title).toBe("Text 1");
    });
  });


  describe("single tile moves", () => {
    it("can move a tile with its own row before another tile in its own row", () => {
      // move textToo11 to the left of drawingTool1
      const dragTiles = getDocumentDragTileItems(["textTool1"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 0,
        rowDropId: documentContent.rowOrder[2],
        rowDropLocation: "left"
      };
      documentContent.moveTiles(dragTiles, dropRowInfo);
      expect(getRowLayout()).toEqual({
        introductionRowHeader: [],
        introductionRow2: [ "textTool1", "drawingTool1" ],
        initialChallengeRowHeader: [],
        initialChallengeRow1: [ "tableTool", "imageTool" ],
        initialChallengeRow2: [ "graphTool", "textTool2", "drawingTool2" ],
        whatIfRowHeader: [],
        whatIfRow1: [ "whatIfPlaceholder" ],
        nowWhatDoYouKnowRowHeader: [],
        nowWhatDoYouKnowRow1: [ "nowWhatDoYouKnowPlaceholder" ]
      });
    });

    it("can move a tile with its own row after another tile in its own row", () => {
      // move textToo11 to the right of drawingTool1
      const dragTiles = getDocumentDragTileItems(["textTool1"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 0,
        rowDropId: "introductionRow2",
        rowDropLocation: "right"
      };
      documentContent.moveTiles(dragTiles, dropRowInfo);
      expect(getRowLayout()).toEqual({
        introductionRowHeader: [],
        introductionRow2: [ "drawingTool1", "textTool1" ],
        initialChallengeRowHeader: [],
        initialChallengeRow1: [ "tableTool", "imageTool" ],
        initialChallengeRow2: [ "graphTool", "textTool2", "drawingTool2" ],
        whatIfRowHeader: [],
        whatIfRow1: [ "whatIfPlaceholder" ],
        nowWhatDoYouKnowRowHeader: [],
        nowWhatDoYouKnowRow1: [ "nowWhatDoYouKnowPlaceholder" ]
      });
    });

    it("can move a tile with its own row after another row", () => {
      // move textTool1 after the row with drawingTool1
      const dragTiles = getDocumentDragTileItems(["textTool1"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: documentContent.getRowIndex("introductionRow2") + 1,
        rowDropId: "introductionRow2"
      };
      documentContent.moveTiles(dragTiles, dropRowInfo);
      expect(getRowLayout()).toEqual({
        introductionRowHeader: [],
        introductionRow2: [ "drawingTool1" ],
        introductionRow1: [ "textTool1" ],
        initialChallengeRowHeader: [],
        initialChallengeRow1: [ "tableTool", "imageTool" ],
        initialChallengeRow2: [ "graphTool", "textTool2", "drawingTool2" ],
        whatIfRowHeader: [],
        whatIfRow1: [ "whatIfPlaceholder" ],
        nowWhatDoYouKnowRowHeader: [],
        nowWhatDoYouKnowRow1: [ "nowWhatDoYouKnowPlaceholder" ]
      });
    });

    it("can move a tile with its own row before another row", () => {
      // move drawingTool1 before the row with textTool1
      const dragTiles = getDocumentDragTileItems(["drawingTool1"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: documentContent.getRowIndex("introductionRow1"),
        rowDropId: "introductionRow1"
      };
      documentContent.moveTiles(dragTiles, dropRowInfo);
      expect(getRowLayout()).toEqual({
        introductionRowHeader: [],
        introductionRow2: [ "drawingTool1" ],
        introductionRow1: [ "textTool1" ],
        initialChallengeRowHeader: [],
        initialChallengeRow1: [ "tableTool", "imageTool" ],
        initialChallengeRow2: [ "graphTool", "textTool2", "drawingTool2" ],
        whatIfRowHeader: [],
        whatIfRow1: [ "whatIfPlaceholder" ],
        nowWhatDoYouKnowRowHeader: [],
        nowWhatDoYouKnowRow1: [ "nowWhatDoYouKnowPlaceholder" ]
      });
    });

    it("can copy a tile to an existing row, removing placeholder tiles", () => {
      // copy drawingTool1 to whatIfRow1
      const dragTiles = getDocumentDragTileItems(["drawingTool1"]).map(tile => ({...tile, newTileId: mockUniqueId()}));
      const whatIfRowIndex = documentContent.getRowIndex("whatIfRow1");
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: whatIfRowIndex,
        rowDropId: "whatIfRow1"
      };
      documentContent.copyTilesIntoExistingRow(dragTiles, dropRowInfo, true);
      expect(getRowLayout()).toEqual({
        introductionRowHeader: [],
        introductionRow2: [ "drawingTool1" ],
        introductionRow1: [ "textTool1" ],
        initialChallengeRowHeader: [],
        initialChallengeRow1: [ "tableTool", "imageTool" ],
        initialChallengeRow2: [ "graphTool", "textTool2", "drawingTool2" ],
        whatIfRowHeader: [],
        whatIfRow1: [ "NEW_DRAWING_TILE_1" ],
        nowWhatDoYouKnowRowHeader: [],
        nowWhatDoYouKnowRow1: [ "nowWhatDoYouKnowPlaceholder" ]
      });
    });
  });

  describe("multiple tile moves", () => {
    describe("two of three tiles in one row", () => {
      it("can move into another row to the left", () => {
        // move graphTool and textTool2 to the left of introductionRow1
        const dragTiles = getDocumentDragTileItems(["graphTool", "textTool2"]);
        const dropRowInfo: IDropRowInfo = {
          rowInsertIndex: 0,
          rowDropId: "introductionRow1",
          rowDropLocation: "left"
        };
        documentContent.moveTiles(dragTiles, dropRowInfo);
        expect(getRowLayout()).toEqual({
          introductionRowHeader: [],
          introductionRow1: [ "graphTool", "textTool2", "textTool1" ],
          introductionRow2: [ "drawingTool1" ],
          initialChallengeRowHeader: [],
          initialChallengeRow1: [ "tableTool", "imageTool" ],
          initialChallengeRow2: [ "drawingTool2" ],
          whatIfRowHeader: [],
          whatIfRow1: [ "whatIfPlaceholder" ],
          nowWhatDoYouKnowRowHeader: [],
          nowWhatDoYouKnowRow1: [ "nowWhatDoYouKnowPlaceholder" ]
        });
      });

      it("can move into another row to the right", () => {
        // move graphTool and textTool2 to the right of introductionRow1
        const dragTiles = getDocumentDragTileItems(["graphTool", "textTool2"]);
        const dropRowInfo: IDropRowInfo = {
          rowInsertIndex: 0,
          rowDropId: "introductionRow1",
          rowDropLocation: "right"
        };
        documentContent.moveTiles(dragTiles, dropRowInfo);
        expect(getRowLayout()).toEqual({
          introductionRowHeader: [],
          introductionRow1: [ "textTool1", "graphTool", "textTool2" ],
          introductionRow2: [ "drawingTool1" ],
          initialChallengeRowHeader: [],
          initialChallengeRow1: [ "tableTool", "imageTool" ],
          initialChallengeRow2: [ "drawingTool2" ],
          whatIfRowHeader: [],
          whatIfRow1: [ "whatIfPlaceholder" ],
          nowWhatDoYouKnowRowHeader: [],
          nowWhatDoYouKnowRow1: [ "nowWhatDoYouKnowPlaceholder" ]
        });
      });

      it("can move before another row", () => {
        // move graphTool and textTool2 to a new row before introductionRow1
        const dragTiles = getDocumentDragTileItems(["graphTool", "textTool2"]);
        const dropRowInfo: IDropRowInfo = {
          rowInsertIndex: documentContent.getRowIndex("introductionRow1"),
          rowDropId: "introductionRow1",
          rowDropLocation: "top"
        };
        documentContent.moveTiles(dragTiles, dropRowInfo);
        expect(getRowLayout()).toEqual({
          introductionRowHeader: [],
          NEW_ROW: [ "graphTool", "textTool2" ],
          introductionRow1: [ "textTool1" ],
          introductionRow2: [ "drawingTool1" ],
          initialChallengeRowHeader: [],
          initialChallengeRow1: [ "tableTool", "imageTool" ],
          initialChallengeRow2: [ "drawingTool2" ],
          whatIfRowHeader: [],
          whatIfRow1: [ "whatIfPlaceholder" ],
          nowWhatDoYouKnowRowHeader: [],
          nowWhatDoYouKnowRow1: [ "nowWhatDoYouKnowPlaceholder" ]
        });
      });

      it("can move after another row", () => {
        const dragTiles = getDocumentDragTileItems(["graphTool", "textTool2"]);
        const dropRowInfo: IDropRowInfo = {
          rowInsertIndex: documentContent.getRowIndex("introductionRow1") + 1,
          rowDropId: "introductionRow1",
          rowDropLocation: "bottom"
        };
        documentContent.moveTiles(dragTiles, dropRowInfo);
        expect(getRowLayout()).toEqual({
          introductionRowHeader: [],
          introductionRow1: [ "textTool1" ],
          NEW_ROW: [ "graphTool", "textTool2" ],
          introductionRow2: [ "drawingTool1" ],
          initialChallengeRowHeader: [],
          initialChallengeRow1: [ "tableTool", "imageTool" ],
          initialChallengeRow2: [ "drawingTool2" ],
          whatIfRowHeader: [],
          whatIfRow1: [ "whatIfPlaceholder" ],
          nowWhatDoYouKnowRowHeader: [],
          nowWhatDoYouKnowRow1: [ "nowWhatDoYouKnowPlaceholder" ]
        });
      });
    });

    describe("all tiles in one row", () => {
      it("can move into another row to the left", () => {
        // move tableTool and imageTool to the left of introductionRow1 and delete initialChallengeRow1
        const dragTiles = getDocumentDragTileItems(["tableTool", "imageTool"]);
        const dropRowInfo: IDropRowInfo = {
          rowInsertIndex: 0,
          rowDropId: "introductionRow1",
          rowDropLocation: "left"
        };
        documentContent.moveTiles(dragTiles, dropRowInfo);
        expect(getRowLayout()).toEqual({
          introductionRowHeader: [],
          introductionRow1: [ "tableTool", "imageTool", "textTool1" ],
          introductionRow2: [ "drawingTool1" ],
          initialChallengeRowHeader: [],
          initialChallengeRow2: [ "graphTool", "textTool2", "drawingTool2" ],
          whatIfRowHeader: [],
          whatIfRow1: [ "whatIfPlaceholder" ],
          nowWhatDoYouKnowRowHeader: [],
          nowWhatDoYouKnowRow1: [ "nowWhatDoYouKnowPlaceholder" ]
        });
      });

      it("can move into another row to the right", () => {
        // move tableTool and imageTool to the right of introductionRow1 and delete initialChallengeRow1
        const dragTiles = getDocumentDragTileItems(["tableTool", "imageTool"]);
        const dropRowInfo: IDropRowInfo = {
          rowInsertIndex: 0,
          rowDropId: "introductionRow1",
          rowDropLocation: "right"
        };
        documentContent.moveTiles(dragTiles, dropRowInfo);
        expect(getRowLayout()).toEqual({
          introductionRowHeader: [],
          introductionRow1: [ "textTool1", "tableTool", "imageTool" ],
          introductionRow2: [ "drawingTool1" ],
          initialChallengeRowHeader: [],
          initialChallengeRow2: [ "graphTool", "textTool2", "drawingTool2" ],
          whatIfRowHeader: [],
          whatIfRow1: [ "whatIfPlaceholder" ],
          nowWhatDoYouKnowRowHeader: [],
          nowWhatDoYouKnowRow1: [ "nowWhatDoYouKnowPlaceholder" ]
        });
      });

      it("can move before another row", () => {
        // move tableTool and imageTool to before introductionRow1
        const dragTiles = getDocumentDragTileItems(["tableTool", "imageTool"]);
        const dropRowInfo: IDropRowInfo = {
          rowInsertIndex: documentContent.getRowIndex("introductionRow1"),
          rowDropId: "introductionRow1"
        };
        documentContent.moveTiles(dragTiles, dropRowInfo);
        expect(getRowLayout()).toEqual({
          introductionRowHeader: [],
          initialChallengeRow1: [ "tableTool", "imageTool" ],
          introductionRow1: [ "textTool1" ],
          introductionRow2: [ "drawingTool1" ],
          initialChallengeRowHeader: [],
          initialChallengeRow2: [ "graphTool", "textTool2", "drawingTool2" ],
          whatIfRowHeader: [],
          whatIfRow1: [ "whatIfPlaceholder" ],
          nowWhatDoYouKnowRowHeader: [],
          nowWhatDoYouKnowRow1: [ "nowWhatDoYouKnowPlaceholder" ]
        });
      });

      it("can move after another row", () => {
        // move tableTool and imageTool to after introductionRow1
        const dragTiles = getDocumentDragTileItems(["tableTool", "imageTool"]);
        const dropRowInfo: IDropRowInfo = {
          rowInsertIndex: documentContent.getRowIndex("introductionRow1") + 1,
          rowDropId: "introductionRow1"
        };
        documentContent.moveTiles(dragTiles, dropRowInfo);
        expect(getRowLayout()).toEqual({
          introductionRowHeader: [],
          introductionRow1: [ "textTool1" ],
          initialChallengeRow1: [ "tableTool", "imageTool" ],
          introductionRow2: [ "drawingTool1" ],
          initialChallengeRowHeader: [],
          initialChallengeRow2: [ "graphTool", "textTool2", "drawingTool2" ],
          whatIfRowHeader: [],
          whatIfRow1: [ "whatIfPlaceholder" ],
          nowWhatDoYouKnowRowHeader: [],
          nowWhatDoYouKnowRow1: [ "nowWhatDoYouKnowPlaceholder" ]
        });
      });
    });
  });

  describe("single tile copies", () => {
    it("can copy a tile before another row", () => {
      // copy drawingTile1 to new row before introductionRow1
      const dragTiles = getDocumentDragTileItems(["drawingTool1"]).map(tile => ({...tile, newTileId: mockUniqueId()}));
      const rowInsertIndex = documentContent.getRowIndex("introductionRow1");
      documentContent.copyTilesIntoNewRows(dragTiles, { rowInsertIndex }, true);
      expect(getRowLayout()).toEqual({
        introductionRowHeader: [],
        NEW_ROW: [ "NEW_DRAWING_TILE_1" ],
        introductionRow1: [ "textTool1" ],
        introductionRow2: [ "drawingTool1" ],
        initialChallengeRowHeader: [],
        initialChallengeRow1: [ "tableTool", "imageTool" ],
        initialChallengeRow2: [ "graphTool", "textTool2", "drawingTool2" ],
        whatIfRowHeader: [],
        whatIfRow1: [ "whatIfPlaceholder" ],
        nowWhatDoYouKnowRowHeader: [],
        nowWhatDoYouKnowRow1: [ "nowWhatDoYouKnowPlaceholder" ]
      });
    });

    it("can copy a tile after another row", () => {
      // copy drawingTile1 to new row after introductionRow1
      const dragTiles = getDocumentDragTileItems(["drawingTool1"]).map(tile => ({...tile, newTileId: mockUniqueId()}));
      const rowInsertIndex = documentContent.getRowIndex("introductionRow1") + 1;
      documentContent.copyTilesIntoNewRows(dragTiles, { rowInsertIndex }, true);
      expect(getRowLayout()).toEqual({
        introductionRowHeader: [],
        introductionRow1: [ "textTool1" ],
        NEW_ROW: [ "NEW_DRAWING_TILE_1" ],
        introductionRow2: [ "drawingTool1" ],
        initialChallengeRowHeader: [],
        initialChallengeRow1: [ "tableTool", "imageTool" ],
        initialChallengeRow2: [ "graphTool", "textTool2", "drawingTool2" ],
        whatIfRowHeader: [],
        whatIfRow1: [ "whatIfPlaceholder" ],
        nowWhatDoYouKnowRowHeader: [],
        nowWhatDoYouKnowRow1: [ "nowWhatDoYouKnowPlaceholder" ]
      });
    });
  });

  describe("multiple tile copies", () => {
    describe("two of three tiles in one row", () => {
      it("can copy before another row", () => {
        // copy graphTool and textTool2 before introductionRow1
        const dragTiles = getDocumentDragTileItems(["graphTool", "textTool2"])
                            .map(tile => ({ ...tile, newTileId: mockUniqueId() }));
        const rowInsertIndex = documentContent.getRowIndex("introductionRow1");
        documentContent.copyTilesIntoNewRows(dragTiles, { rowInsertIndex }, true);
        expect(getRowLayout()).toEqual({
          introductionRowHeader: [],
          NEW_ROW: [ "NEW_GEOMETRY_TILE_1", "NEW_TEXT_TILE_2" ],
          introductionRow1: [ "textTool1" ],
          introductionRow2: [ "drawingTool1" ],
          initialChallengeRowHeader: [],
          initialChallengeRow1: [ "tableTool", "imageTool" ],
          initialChallengeRow2: [ "graphTool", "textTool2", "drawingTool2" ],
          whatIfRowHeader: [],
          whatIfRow1: [ "whatIfPlaceholder" ],
          nowWhatDoYouKnowRowHeader: [],
          nowWhatDoYouKnowRow1: [ "nowWhatDoYouKnowPlaceholder" ]
        });
      });

      it("can copy after another row", () => {
        // copy graphTool and textTool2 after introductionRow1
        const dragTiles = getDocumentDragTileItems(["graphTool", "textTool2"])
                            .map(tile => ({ ...tile, newTileId: mockUniqueId() }));
        const rowInsertIndex = documentContent.getRowIndex("introductionRow1") + 1;
        documentContent.copyTilesIntoNewRows(dragTiles, { rowInsertIndex }, true);
        expect(getRowLayout()).toEqual({
          introductionRowHeader: [],
          introductionRow1: [ "textTool1" ],
          NEW_ROW: [ "NEW_GEOMETRY_TILE_1", "NEW_TEXT_TILE_2" ],
          introductionRow2: [ "drawingTool1" ],
          initialChallengeRowHeader: [],
          initialChallengeRow1: [ "tableTool", "imageTool" ],
          initialChallengeRow2: [ "graphTool", "textTool2", "drawingTool2" ],
          whatIfRowHeader: [],
          whatIfRow1: [ "whatIfPlaceholder" ],
          nowWhatDoYouKnowRowHeader: [],
          nowWhatDoYouKnowRow1: [ "nowWhatDoYouKnowPlaceholder" ]
        });
      });
    });

    describe("all tiles in one row", () => {
      it("can copy before another row", () => {
        // copy tableTool and imageTool before introductionRow1
        const dragTiles = getDocumentDragTileItems(["tableTool", "imageTool"])
                            .map(tile => ({ ...tile, newTileId: mockUniqueId() }));
        const rowInsertIndex = documentContent.getRowIndex("introductionRow1");
        documentContent.copyTilesIntoNewRows(dragTiles, { rowInsertIndex }, true);
        expect(getRowLayout()).toEqual({
          introductionRowHeader: [],
          NEW_ROW: [ "NEW_TABLE_TILE_1", "NEW_IMAGE_TILE_2" ],
          introductionRow1: [ "textTool1" ],
          introductionRow2: [ "drawingTool1" ],
          initialChallengeRowHeader: [],
          initialChallengeRow1: [ "tableTool", "imageTool" ],
          initialChallengeRow2: [ "graphTool", "textTool2", "drawingTool2" ],
          whatIfRowHeader: [],
          whatIfRow1: [ "whatIfPlaceholder" ],
          nowWhatDoYouKnowRowHeader: [],
          nowWhatDoYouKnowRow1: [ "nowWhatDoYouKnowPlaceholder" ]
        });
      });

      it("can copy after another row", () => {
        // copy tableTool and imageTool after introductionRow1
        const dragTiles = getDocumentDragTileItems(["tableTool", "imageTool"])
                            .map(tile => ({ ...tile, newTileId: mockUniqueId() }));
        const rowInsertIndex = documentContent.getRowIndex("introductionRow1") + 1;
        documentContent.copyTilesIntoNewRows(dragTiles, { rowInsertIndex }, true);
        expect(getRowLayout()).toEqual({
          introductionRowHeader: [],
          introductionRow1: [ "textTool1" ],
          NEW_ROW: [ "NEW_TABLE_TILE_1", "NEW_IMAGE_TILE_2" ],
          introductionRow2: [ "drawingTool1" ],
          initialChallengeRowHeader: [],
          initialChallengeRow1: [ "tableTool", "imageTool" ],
          initialChallengeRow2: [ "graphTool", "textTool2", "drawingTool2" ],
          whatIfRowHeader: [],
          whatIfRow1: [ "whatIfPlaceholder" ],
          nowWhatDoYouKnowRowHeader: [],
          nowWhatDoYouKnowRow1: [ "nowWhatDoYouKnowPlaceholder" ]
        });
      });
    });
  });
});

