import { DocumentContentModel, DocumentContentModelType, cloneContentWithUniqueIds, DocumentContentSnapshotType } from "./document-content";
import { defaultTextContent, TextContentModelType } from "../tools/text/text-content";
import { IDragTiles, IDragTileItem } from "../../components/tools/tool-tile";
import { getSnapshot } from "mobx-state-tree";
import { IDropRowInfo } from "../../components/document/document-content";
import { TileRowModelType } from "./tile-row";
import { cloneDeep } from "lodash";

describe("DocumentContentModel", () => {
  let documentContent: DocumentContentModelType;

  beforeEach(() => {
    documentContent = DocumentContentModel.create({});
  });

  it("behaves like empty content when empty", () => {
    expect(documentContent.rowCount).toBe(0);
    expect(documentContent.indexOfLastVisibleRow).toBe(-1);
    expect(documentContent.defaultInsertRow).toBe(0);
  });

  it("allows the tool tiles to be added", () => {
    expect(documentContent.tileMap.size).toBe(0);
    documentContent.addTile("text");
    expect(documentContent.tileMap.size).toBe(1);
    // adding geometry tool adds sidecar text tool
    documentContent.addTile("geometry", {
      addSidecarNotes: true
    });
    expect(documentContent.tileMap.size).toBe(3);
    expect(documentContent.defaultInsertRow).toBe(2);
  });

  it("allows the tool tiles to be added as new rows at specified locations", () => {
    documentContent.addTile("text");
    const textTile2 = documentContent.addTile("text");

    let textTile2RowId = documentContent.findRowContainingTile(textTile2!.tileId);
    let textTile2RowIndex1 = documentContent.rowOrder.findIndex((id: string) => id === textTile2RowId);

    expect(textTile2RowIndex1).toBe(1);

    // insert image between text tiles
    const imageTile1 = documentContent.addTile("image", {
      addSidecarNotes: false,
      insertRowInfo: {
        rowInsertIndex: 1,
        rowDropIndex: 1,
        rowDropLocation: "bottom"
      }
    });

    const imageTile1rowId = documentContent.findRowContainingTile(imageTile1!.tileId);
    const imageTile1rowIndex1 = documentContent.rowOrder.findIndex((id: string) => id === imageTile1rowId);

    expect(imageTile1rowIndex1).toBe(1);

    // text tile should have shifted down
    textTile2RowId = documentContent.findRowContainingTile(textTile2!.tileId);
    textTile2RowIndex1 = documentContent.rowOrder.findIndex((id: string) => id === textTile2RowId);

    expect(textTile2RowIndex1).toBe(2);

    // insert image at bottom
    const imageTile2 = documentContent.addTile("image", {
      addSidecarNotes: false,
      insertRowInfo: {
        rowInsertIndex: 3,
        rowDropIndex: 3,
        rowDropLocation: "bottom"
      }
    });

    const rowId2 = documentContent.findRowContainingTile(imageTile2!.tileId);
    const rowIndex2 = documentContent.rowOrder.findIndex((id: string) => id === rowId2);

    expect(rowIndex2).toBe(3);
  });

  it("allows the tool tiles to be added at side of existing rows", () => {
    documentContent.addTile("text");
    const textTile2 = documentContent.addTile("text");

    let textTile2RowId = documentContent.findRowContainingTile(textTile2!.tileId);
    let textTile2RowIndex1 = documentContent.rowOrder.findIndex((id: string) => id === textTile2RowId);

    expect(textTile2RowIndex1).toBe(1);

    const imageTile1 = documentContent.addTile("image", {
      addSidecarNotes: false,
      insertRowInfo: {
        rowInsertIndex: 1,
        rowDropIndex: 1,
        rowDropLocation: "left"
      }
    });

    const imageTile1rowId = documentContent.findRowContainingTile(imageTile1!.tileId);
    const imageTile1rowIndex1 = documentContent.rowOrder.findIndex((id: string) => id === imageTile1rowId);

    expect(imageTile1rowIndex1).toBe(1);

    // text tile should still be on 1 as well
    textTile2RowId = documentContent.findRowContainingTile(textTile2!.tileId);
    textTile2RowIndex1 = documentContent.rowOrder.findIndex((id: string) => id === textTile2RowId);

    expect(textTile2RowIndex1).toBe(1);
  });

  it("allows the geometry tiles to be added with sidecar text as new row", () => {
    documentContent.addTile("text");
    const textTile2 = documentContent.addTile("text");

    const graphTileInfo = documentContent.addTile("geometry", {
      addSidecarNotes: true,
      insertRowInfo: {
        rowInsertIndex: 1,
        rowDropIndex: 1,
        rowDropLocation: "bottom"
      }
    });

    const geometryRowId = documentContent.findRowContainingTile(graphTileInfo!.tileId);
    const geometryRowIndex = documentContent.rowOrder.findIndex((id: string) => id === geometryRowId);

    expect(geometryRowIndex).toBe(1);

    // sidecar text tile should be on same row
    expect(graphTileInfo!.additionalTileIds).toBeDefined();

    const sidecarRowId = documentContent.findRowContainingTile(graphTileInfo!.tileId);
    const sidecarRowIndex = documentContent.rowOrder.findIndex((id: string) => id === sidecarRowId);

    expect(sidecarRowIndex).toBe(1);

    // text tile should be on 2
    const textTile2RowId = documentContent.findRowContainingTile(textTile2!.tileId);
    const textTile2RowIndex1 = documentContent.rowOrder.findIndex((id: string) => id === textTile2RowId);

    expect(textTile2RowIndex1).toBe(2);
  });

  it("allows the geometry tiles to be added with sidecar text at side of existing rows", () => {
    documentContent.addTile("text");
    const textTile2 = documentContent.addTile("text");

    const graphTileInfo = documentContent.addTile("geometry", {
      addSidecarNotes: true,
      insertRowInfo: {
        rowInsertIndex: 1,
        rowDropIndex: 1,
        rowDropLocation: "left"
      }
    });

    const geometryRowId = documentContent.findRowContainingTile(graphTileInfo!.tileId);
    const geometryRowIndex = documentContent.rowOrder.findIndex((id: string) => id === geometryRowId);

    expect(geometryRowIndex).toBe(1);

    // sidecar text tile should be on same row
    expect(graphTileInfo!.additionalTileIds).toBeDefined();

    const sidecarRowId = documentContent.findRowContainingTile(graphTileInfo!.tileId);
    const sidecarRowIndex = documentContent.rowOrder.findIndex((id: string) => id === sidecarRowId);

    expect(sidecarRowIndex).toBe(1);

    // original text tile should be on 1 as well
    const textTile2RowId = documentContent.findRowContainingTile(textTile2!.tileId);
    const textTile2RowIndex1 = documentContent.rowOrder.findIndex((id: string) => id === textTile2RowId);

    expect(textTile2RowIndex1).toBe(1);
  });

});

describe("DocumentContentModel -- sectioned documents --", () => {

  const content = DocumentContentModel.create({});

  function isPlaceholderSection(sectionId: string) {
    const rows = content.getRowsInSection(sectionId);
    if (rows.length !== 1) return false;
    if (!content.isPlaceholderRow(rows[0])) return false;
    if (rows[0].tileCount !== 1) return false;
    if (content.getTilesInSection(sectionId).length !== 0) return false;
    return true;
  }

  function isContentSection(sectionId: string, tileCount: number = 1) {
    const rows = content.getRowsInSection(sectionId);
    if (rows.length !== 1) return false;
    if (content.isPlaceholderRow(rows[0])) return false;
    if (rows[0].tileCount !== tileCount) return false;
    if (content.getTilesInSection(sectionId).length !== tileCount) return false;
    return true;
  }

  // function logRows(label: string, c: DocumentContentModelType) {
  //   console.log("***", label, "[begin] ***");
  //   c.rowOrder.forEach((rowId, rowIndex) => {
  //     const row = c.rowMap.get(rowId);
  //     console.log(`Row ${rowIndex + 1}:`, "id:", row!.id, "isSectionHeader:",
  //                 row!.isSectionHeader, "# tiles:", row!.tiles.length);
  //     row && row.tiles.forEach((layout, tileIndex) => {
  //       const tile = c.tileMap.get(layout.tileId);
  //       console.log(`..Tile ${tileIndex + 1}:`, "type:", tile!.content.type);
  //     });
  //   });
  //   console.log("***", label, "[end] ***");
  // }

  it("can create sectioned documents", () => {
    // []
    content.addSectionHeaderRow("A");
    // [Header:A]
    content.addPlaceholderTile("A");
    // [Header:A, Placeholder]
    expect(content.rowCount).toBe(2);
    expect(content.getRowByIndex(0)!.isSectionHeader).toBe(true);
    expect(content.isPlaceholderRow(content.getRowByIndex(1)!)).toBe(true);
    expect(isPlaceholderSection("A")).toBe(true);
    expect(content.defaultInsertRow).toBe(1);

    content.addSectionHeaderRow("B");
    // [Header:A, Placeholder, Header:B]
    content.addPlaceholderTile("B");
    // [Header:A, Placeholder, Header:B, Placeholder]
    expect(content.rowCount).toBe(4);
    expect(content.getRowByIndex(2)!.isSectionHeader).toBe(true);
    expect(content.isPlaceholderRow(content.getRowByIndex(3)!)).toBe(true);
    expect(isPlaceholderSection("B")).toBe(true);
    expect(content.defaultInsertRow).toBe(1);
  });

  it("will remove placeholder tiles when adding a new tile in the last section", () => {
    // [Header:A, Placeholder, Header:B, Placeholder]
    content.addTextTile({ text: "foo", rowIndex: content.rowCount });
    // [Header:A, Placeholder, Header:B, Text]
    expect(content.rowCount).toBe(4);
    expect(isPlaceholderSection("A")).toBe(true);
    expect(isContentSection("B")).toBe(true);
    expect(content.defaultInsertRow).toBe(4);
});

  it("will remove placeholder tiles when adding a new tile in an interior section", () => {
    // [Header:A, Placeholder, Header:B, Text]
    content.addTileInNewRow(defaultTextContent("foo"), { rowIndex: 1 });
    // [Header:A, Text, Header:B, Text]
    expect(content.rowCount).toBe(4);
    expect(isContentSection("A")).toBe(true);
    expect(isContentSection("B")).toBe(true);
    expect(content.defaultInsertRow).toBe(4);
  });

  it("will restore placeholder tiles when deleting the last row in an interior section", () => {
    // [Header:A, Text, Header:B, Text]
    const rowId = content.rowOrder[1];
    content.deleteRowAddingPlaceholderRowIfAppropriate(rowId);
    // [Header:A, Placeholder, Header:B, Text]
    expect(content.rowCount).toBe(4);
    expect(isPlaceholderSection("A")).toBe(true);
    expect(isContentSection("B")).toBe(true);
    expect(content.defaultInsertRow).toBe(4);
});

  it("will restore placeholder tiles when deleting the last row in the last section", () => {
    // [Header:A, Placeholder, Header:B, Text]
    const rowId = content.rowOrder[3];
    content.deleteRowAddingPlaceholderRowIfAppropriate(rowId);
    // [Header:A, Placeholder, Header:B, Placeholder]
    expect(content.rowCount).toBe(4);
    expect(isPlaceholderSection("A")).toBe(true);
    expect(isPlaceholderSection("B")).toBe(true);
    expect(content.defaultInsertRow).toBe(1);
  });

  it("will add/remove placeholder rows when moving entire rows (3 => 1)", () => {
    // [Header:A, Placeholder, Header:B, Placeholder]
    content.addTextTile({ text: "foo", rowIndex: content.rowCount });
    // [Header:A, Placeholder, Header:B, Text]
    content.moveRowToIndex(3, 1);
    // [Header:A, Text, Header:B, Placeholder]
    expect(content.rowCount).toBe(4);
    expect(isContentSection("A")).toBe(true);
    expect(isPlaceholderSection("B")).toBe(true);
    expect(content.defaultInsertRow).toBe(2);
  });

  it("will add/remove placeholder rows when moving entire rows (1 => 3)", () => {
    // [Header:A, Text, Header:B, Placeholder]
    content.moveRowToIndex(1, 3);
    // [Header:A, Placeholder, Header:B, Text]
    expect(content.rowCount).toBe(4);
    expect(isPlaceholderSection("A")).toBe(true);
    expect(isContentSection("B")).toBe(true);
    expect(content.defaultInsertRow).toBe(4);
  });

  it("will add/remove placeholder rows when moving a tile back to a new row", () => {
    // [Header:A, Placeholder, Header:B, Text]
    const tileId = content.getRowByIndex(3)!.tiles[0].tileId;
    content.moveTileToNewRow(tileId, 2);
    // [Header:A, Text, Header:B, Placeholder]
    expect(content.rowCount).toBe(4);
    expect(isContentSection("A")).toBe(true);
    expect(isPlaceholderSection("B")).toBe(true);
    expect(content.defaultInsertRow).toBe(2);
  });

  it("will add/remove placeholder rows when moving a tile forward to a new row", () => {
    // [Header:A, Text, Header:B, Placeholder]
    const tileId = content.getRowByIndex(1)!.tiles[0].tileId;
    content.moveTileToNewRow(tileId, 4);
    // [Header:A, Placeholder, Header:B, Text]
    expect(content.rowCount).toBe(4);
    expect(isPlaceholderSection("A")).toBe(true);
    expect(isContentSection("B")).toBe(true);
    expect(content.defaultInsertRow).toBe(4);
  });

  it("will add/remove placeholder rows when moving a tile back to an existing row", () => {
    // [Header:A, Placeholder, Header:B, Text]
    const tileId = content.getRowByIndex(3)!.tiles[0].tileId;
    content.moveTileToRow(tileId, 1);
    // [Header:A, Text, Header:B, Placeholder]
    expect(content.rowCount).toBe(4);
    expect(isContentSection("A")).toBe(true);
    expect(isPlaceholderSection("B")).toBe(true);
    expect(content.defaultInsertRow).toBe(2);
  });

  it("will add/remove placeholder rows when moving a tile forward to an existing row", () => {
    // [Header:A, Text, Header:B, Placeholder]
    const tileId = content.getRowByIndex(1)!.tiles[0].tileId;
    content.moveTileToRow(tileId, 3, 0);
    // [Header:A, Placeholder, Header:B, Text]
    expect(content.rowCount).toBe(4);
    expect(isPlaceholderSection("A")).toBe(true);
    expect(isContentSection("B")).toBe(true);
  });

  it("deleteTile() will add/remove placeholder rows", () => {
    // [Header:A, Placeholder, Header:B, Text]
    const tileId = content.getRowByIndex(3)!.tiles[0].tileId;
    content.deleteTile(tileId);
    // [Header:A, Placeholder, Header:B, Placeholder]
    expect(content.rowCount).toBe(4);
    expect(isPlaceholderSection("A")).toBe(true);
    expect(isPlaceholderSection("B")).toBe(true);
  });

  it("addTile() will add/remove placeholder rows", () => {
    // [Header:A, Placeholder, Header:B, Placeholder]
    content.addTile("text");
    // [Header:A, Placeholder, Header:B, Text]
    expect(content.rowCount).toBe(4);
    expect(isPlaceholderSection("A")).toBe(true);
    expect(isContentSection("B")).toBe(true);
  });

  it("moveTile() will add/remove placeholder rows", () => {
    // [Header:A, Placeholder, Header:B, Text]
    const tileId = content.getRowByIndex(3)!.tiles[0].tileId;
    content.moveTile(tileId, { rowDropIndex: 1, rowDropLocation: "right", rowInsertIndex: 1 });
    // [Header:A, Text, Header:B, Placeholder]
    expect(content.rowCount).toBe(4);
    expect(isContentSection("A")).toBe(true);
    expect(isPlaceholderSection("B")).toBe(true);

    content.moveTile(tileId, { rowDropIndex: 3, rowDropLocation: "left", rowInsertIndex: 3 });
    // [Header:A, Placeholder, Header:B, Text]
    expect(content.rowCount).toBe(4);
    expect(isPlaceholderSection("A")).toBe(true);
    expect(isContentSection("B")).toBe(true);

    content.moveTile(tileId, { rowInsertIndex: 1 });
    // [Header:A, Text, Header:B, Placeholder]
    expect(content.rowCount).toBe(4);
    expect(isContentSection("A")).toBe(true);
    expect(isPlaceholderSection("B")).toBe(true);

    content.moveTile(tileId, { rowInsertIndex: 3 });
    // [Header:A, Placeholder, Header:B, Text]
    expect(content.rowCount).toBe(4);
    expect(isPlaceholderSection("A")).toBe(true);
    expect(isContentSection("B")).toBe(true);

    content.addTile("geometry", { addSidecarNotes: true, insertRowInfo: { rowInsertIndex: 2 } });
    // [Header:A, [Geometry, Text], Header:B, Text]
    expect(content.rowCount).toBe(4);
    expect(isContentSection("A", 2)).toBe(true);
    expect(isContentSection("B")).toBe(true);

    const geometryId = content.getRowByIndex(1)!.tiles[0].tileId;
    content.moveTile(geometryId, { rowDropIndex: 3, rowDropLocation: "left", rowInsertIndex: 3 });
    // [Header:A, Text, Header:B, [Geometry, Text]]
    expect(content.rowCount).toBe(4);
    expect(isContentSection("A")).toBe(true);
    expect(isContentSection("B", 2)).toBe(true);

    content.moveTile(geometryId, { rowDropIndex: 1, rowDropLocation: "left", rowInsertIndex: 1 });
    // [Header:A, [Geometry, Text], Header:B, Text]
    expect(content.rowCount).toBe(4);
    expect(isContentSection("A", 2)).toBe(true);
    expect(isContentSection("B")).toBe(true);
  });

  it("deleteTile() will remove individual tiles from rows", () => {
    // [Header:A, [Geometry, Text], Header:B, Text]
    const tileId = content.getRowByIndex(1)!.tiles[1].tileId;
    content.deleteTile(tileId);
    // [Header:A, Geometry, Header:B, Text]
    expect(content.rowCount).toBe(4);
    expect(isContentSection("A")).toBe(true);
    expect(isContentSection("B")).toBe(true);
  });

});

describe("DocumentContentModel", () => {

  it("can cloneWithUniqueIds()", () => {
    const content = DocumentContentModel.create({});
    content.addTextTile({ text: "foo" });
    const srcTileId = content.getRowByIndex(0)!.getTileIdAtIndex(0);

    const copy = cloneContentWithUniqueIds(content);
    const copyTileId = copy!.getRowByIndex(0)!.getTileIdAtIndex(0);
    expect(copy!.rowCount).toBe(1);
    expect(copyTileId).not.toBe(srcTileId);
  });

  it("can import authored content", () => {
    const srcContent: any = {
            tiles: [
              { content: { isSectionHeader: true, sectionId: "Foo" } },
              { content: { type: "Text", text: "foo" } }
            ]
          };
    const content = DocumentContentModel.create(srcContent);
    expect(content.rowCount).toBe(2);
    const row = content.getRowByIndex(1);
    expect(row!.tileCount).toBe(1);
    const tileId = row!.getTileIdAtIndex(0);
    const tile = content.tileMap.get(tileId);
    const tileContent = tile!.content;
    expect(tileContent.type).toBe("Text");
  });

  it("can import authored content with sections and placeholders", () => {
    const srcContent: any = {
            tiles: [
              { content: { isSectionHeader: true, sectionId: "foo" } },
              { content: { type: "Placeholder", sectionId: "foo" } },
              { content: { isSectionHeader: true, sectionId: "bar" } },
              { content: { type: "Placeholder", sectionId: "bar" } }
            ]
          };
    const content = DocumentContentModel.create(srcContent);
    expect(content.rowCount).toBe(4);
    expect(content.getRowByIndex(0)!.isSectionHeader).toBe(true);
    expect(content.isPlaceholderRow(content.getRowByIndex(1)!)).toBe(true);
    expect(content.getRowByIndex(2)!.isSectionHeader).toBe(true);
    expect(content.isPlaceholderRow(content.getRowByIndex(3)!)).toBe(true);
    expect(content.getSectionTypeForPlaceholderRow(content.getRowByIndex(1)!))
      .toBe(content.getRowByIndex(0)!.sectionId);
    expect(content.getSectionTypeForPlaceholderRow(content.getRowByIndex(3)!))
      .toBe(content.getRowByIndex(2)!.sectionId);
  });
});

describe("DocumentContentModel -- move/copy tiles --", () => {

  let documentContent: DocumentContentModelType;

  /*

    Layout (| denotes a tile on the same row)

    introductionRowHeader
    introductionRow1
      textTool1
    introductionRow2
      drawingTool1
    initialChallengeRowHeader
    initialChallengeRow1
      tableTool | imageTool
    initialChallengeRow2
      graphTool | textTool2 | drawingTool2
    whatIfRowHeader
    whatIfRow1
      whatIfPlaceholder
    nowWhatDoYouKnowRowHeader
    nowWhatDoYouKnowRow1
      nowWhatDoYouKnowPlaceholder

  */
  const srcContent: DocumentContentSnapshotType = {
    rowMap: {
      introductionRowHeader: {
        id: "introductionRowHeader",
        isSectionHeader: true,
        sectionId: "introduction",
        tiles: []
      },
      initialChallengeRowHeader: {
        id: "initialChallengeRowHeader",
        isSectionHeader: true,
        sectionId: "initialChallenge",
        tiles: []
      },
      initialChallengeRow1: {
        id: "initialChallengeRow1",
        height: 128,
        isSectionHeader: false,
        tiles: [
          {
            tileId: "tableTool"
          },
          {
            tileId: "imageTool"
          }
        ]
      },
      whatIfRowHeader: {
        id: "whatIfRowHeader",
        isSectionHeader: true,
        sectionId: "whatIf",
        tiles: []
      },
      whatIfRow1: {
        id: "whatIfRow1",
        isSectionHeader: false,
        tiles: [
          {
            tileId: "whatIfPlaceholder"
          }
        ]
      },
      nowWhatDoYouKnowRowHeader: {
        id: "nowWhatDoYouKnowRowHeader",
        isSectionHeader: true,
        sectionId: "nowWhatDoYouKnow",
        tiles: []
      },
      introductionRow1: {
        id: "introductionRow1",
        isSectionHeader: false,
        tiles: [
          {
            tileId: "textTool1"
          }
        ]
      },
      introductionRow2: {
        id: "introductionRow2",
        height: 320,
        isSectionHeader: false,
        tiles: [
          {
            tileId: "drawingTool1"
          }
        ]
      },
      initialChallengeRow2: {
        id: "initialChallengeRow2",
        height: 320,
        isSectionHeader: false,
        tiles: [
          {
            tileId: "graphTool"
          },
          {
            tileId: "textTool2"
          },
          {
            tileId: "drawingTool2"
          }
        ]
      },
      nowWhatDoYouKnowRow1: {
        id: "nowWhatDoYouKnowRow1",
        isSectionHeader: false,
        tiles: [
          {
            tileId: "nowWhatDoYouKnowPlaceholder"
          }
        ]
      }
    },
    rowOrder: [
      "introductionRowHeader",
      "introductionRow1",
      "introductionRow2",
      "initialChallengeRowHeader",
      "initialChallengeRow1",
      "initialChallengeRow2",
      "whatIfRowHeader",
      "whatIfRow1",
      "nowWhatDoYouKnowRowHeader",
      "nowWhatDoYouKnowRow1"
    ],
    tileMap: {
      whatIfPlaceholder: {
        id: "whatIfPlaceholder",
        content: {
          type: "Placeholder",
          sectionId: "whatIf"
        }
      },
      textTool1: {
        id: "textTool1",
        content: {
          type: "Text",
          text: "{\"object\":\"value\",\"document\":{\"object\":\"document\",\"data\":{},\"nodes\":[{\"object\":\"block\",\"type\":\"line\",\"data\":{},\"nodes\":[{\"object\":\"text\",\"text\":\"\",\"marks\":[]}]}]}}",
          format: "slate"
        }
      },
      tableTool: {
        id: "tableTool",
        content: {
          type: "Table",
          isImported: true,
          changes: [
            "{\"action\":\"create\",\"target\":\"columns\",\"props\":{\"columns\":[{\"id\":\"u1nps1vXuDjQbGfY\",\"name\":\"x\"},{\"id\":\"kcRU7zz2Bc2cAYJz\",\"name\":\"y\"}]}}"
          ]
        }
      },
      imageTool: {
        id: "imageTool",
        content: {
          type: "Image",
          changes: [
            "{\"operation\":\"update\",\"url\":\"data:image\/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAIAAABMXPacAAABG2lUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4KPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNS41LjAiPgogPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIi8+CiA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgo8P3hwYWNrZXQgZW5kPSJyIj8+Gkqr6gAAAYJpQ0NQc1JHQiBJRUM2MTk2Ni0yLjEAACiRdZHPK0RRFMc\/ZojGaISFhcVLWA0xamKjjISSNEb5tZl55s2o+fF6702abJWtosTGrwV\/AVtlrRSRkoWVNbFhes4zaiaZczv3fO733nO691xwRVJq2qzuhXTGMsJjIWVufkGpfcZDPU0o9EdVUx+enp6kon3cUeXEm26nVuVz\/1r9ctxUoapOeEjVDUt4XHhy1dId3hZuUZPRZeFTYb8hFxS+dfRYkV8cThT5y2EjEh4BV6OwkijjWBmrSSMtLC+nI53Kqb\/3cV7ijWdmZyS2i7dhEmaMkPRiglFGCNLHoMxBugnQIysq5Pf+5E+RlVxVZp08BiskSGLhFzUn1eMSNdHjMlLknf7\/7aup9QeK1b0hqHmy7bdOqN2CwqZtfx7aduEI3I9wkSnlZw9g4F30zZLWsQ++dTi7LGmxHTjfgNYHPWpEfyS3uEvT4PUEGuah+Ro8i8We\/e5zfA+RNfmqK9jdgy4571v6BnsuZ++xtGAlAAAACXBIWXMAAAsTAAALEwEAmpwYAAAGgElEQVR4nO2d31PaQBCAQWkptTNYrTrMOC0ztfalD+3\/\/y90KgpFIIEIAkKCKYjXEAhJH5jpMKKQH7e3SdjvyXFylzUfuYS9vTPpOE6CwGMHO4BthwQgQwKQIQHIkABkSAAyJAAZEoAMCUCGBCBDApAhAciQAGRIADIp94cWCgXGGFwoseHs7Ozk5MTlwR4EWJZlWZavkLYLT1MsNAQhQwKQIQHIkABkSAAyHt6CnuXw8PD169dcQokiuq6bphmkh6ACTk9P9\/f3A3YSXUqlUkABNAQhQwKQIQHIkABkSAAyJAAZEoAMCUAm6BcxT8xmM03TBoOBYRjT6XR3dzedTmez2aOjo2w2KzKS8CBIgG3b7Xa71WrN5\/PlX85ms8fHx06nk81mz87O3r17Jyae8CBiCLIs6+rqSlGU5av\/hNFo9OvXr7u7OwHxhArwO8CyrIuLi79\/\/2480nGcWq2WSCRyuRx0VOEB\/A6oVqturv5\/JEl6eHiAiydswApQVXUwGHhq8v8+2BIABTiO02w2fTRkjGmaxj2ecAIo4OHhwdPgs0yv1+MbTGgBFKDruu+2w+HQtm2OwYQWQAGPj4++29q2vSVVeIACptMpYvOoAChgzdcuAc2jAqCAV69eBWm+JcUWgALS6TRi86gAKOD9+\/e+26bT6UwmwzGY0AIo4ODgIJlM+mt7eHjIN5jQAjsEHR0d+WiYTCZPT0+5xxNOYHNB+Xx+Z8fzKXK5HND4c319PZlMIHr2DayATCZzfn7uqcne3t7nz58hgmm326qqNhoNiM59A56OPjk5+fTpk8uDM5nMt2\/ffNw0GxmPx4tLr2na\/f099\/59I2JGLJ\/Pn5+f7+7urj9sf3\/\/x48fb9684R6AZVnlcvn\/0i1ZlsPzLU\/QnHAulzs4OLi5uVFVdTXLtre39\/Hjx+PjY6CzS5K0PPRPJpPb29t8Pg90Ok+Iq4pIp9Nfv3798uWLruuGYZimmUqlFlURb9++hTtvp9NRVfXJL1ut1vHxMeh5XSK0LCWRSOzs7Hz48EHY6Rhjzz51F\/Nu379\/FxbJS8S5MGs+n5fL5ZfmFUaj0eqdIZ44C6jVauun5Or1OvrS89gKuLu72\/gBn06niqKIiecl4imAMSbLspsju90ubhVMDAWsH\/pXkWUZcQPtGAqQJMlTNcZ4PO52u3DxrCduAnq9Xr\/f99pKUZSAq019EysBjDFJknw0nM\/nWEm6+AiwbbtSqfiuJlJVNUghk2\/iI0CSpCCVSIlEQpZl8dVgMRGgqmrwakbDMG5vb7nE4544CDAMg1dBdavV8l3P6o\/IC7Btu1wu88rv27bt8hscLyIvQJblgEP\/E\/78+SOyOD7aAjRNg1hWJsuysCRdhAUYhlGtViF6nk6nNzc3ED2vElUBfIf+VbrdLt+R7SWiKqBer4NeIGFL1SIpQNM0AekzMUk6NAGGYfz8+XM8HnttaJqmsGWUiqJArxPBETCbzYrFImPs8vLSUwbGcZxyuSzsFcWyLOgkHYKA+Xx+dXVlGMbi51Kp5D6L0Gg0BE9g9fv94XAI179oAYuP8PLz03GcarXq5rXv\/v6+3W4DBvcCtVoNLkknWkC1Wn12zGk2m+tzAKZpAr31b8QwDDjxQgU0Go0101WdTuf379\/PftYcx7m+vp7NZpDRraPZbALVtYsT0O12NyZ7B4NBsVhcfcYqijIajcBC24xt2\/7m2jYiSICmaS7\/gOFwWCgUlmdodV0Xn6ZfRdd1rxuPuEGEgOFwWKlU3B\/PGCsUCou8vGmantqCAlHXDi6AMfbSyL6GyWRycXGxMIc49D\/BNE1\/+7+sAVaAaZrPjulusCzr8vIS9B3cB+12m+8mFoACLMsqFotY9TZAOI7D92kMJcC27VKpFMsdT0ajEcftjKAEVCoV3BdHUOr1Oq8nE4gAWZbjvecYxyQdfwHNZrPT6XDvNmz0ej0uLwicBfT7fWGzqehwqaTjuUhP13WsfBkKjLHgVVzc7oDxeLy8GHpLCP738hFgGEapVArP8vMIwUHAYn5xS\/bY405QAYs5xcX8IuGDoA9hSZJilmwQTNA7gK5+QCJZmBUnSAAyJAAZEoAMCUCGBCBDApAhAciQAGRIADIkABkSgAwJQMZDOjqVSqVSojd6jSKe\/m1FcttmccMGDUHIkABkSAAyJAAZEoAMCUCGBCBDApAhAciQAGRIADIkABkSgAwJQOYfk\/yBm1BlbLIAAAAASUVORK5CYII=\"}"
          ]
        }
      },
      drawingTool1: {
        id: "drawingTool1",
        content: {
          type: "Drawing",
          changes: [],
          stroke: "#000000",
          fill: "none",
          strokeDashArray: "",
          strokeWidth: 2,
          stamps: []
        }
      },
      graphTool: {
        id: "graphTool",
        content: {
          type: "Geometry",
          changes: [
            "{\"operation\":\"create\",\"target\":\"board\",\"properties\":{\"axis\":true,\"boundingBox\":[-1.0928961748633879,18.579234972677593,27.3224043715847,-1.0928961748633879],\"unitX\":18.3,\"unitY\":18.3}}"
          ]
        }
      },
      textTool2: {
        id: "textTool2",
        content: {
          type: "Text",
          text: "{\"object\":\"value\",\"document\":{\"object\":\"document\",\"data\":{},\"nodes\":[{\"object\":\"block\",\"type\":\"line\",\"data\":{},\"nodes\":[{\"object\":\"text\",\"text\":\"\",\"marks\":[]}]}]}}",
          format: "slate"
        }
      },
      drawingTool2: {
        id: "drawingTool2",
        content: {
          type: "Drawing",
          changes: [],
          stroke: "#000000",
          fill: "none",
          strokeDashArray: "",
          strokeWidth: 2,
          stamps: []
        }
      },
      nowWhatDoYouKnowPlaceholder: {
        id: "nowWhatDoYouKnowPlaceholder",
        content: {
          type: "Placeholder",
          sectionId: "nowWhatDoYouKnow"
        }
      }
    }
  };
  beforeEach(() => {
      documentContent = DocumentContentModel.create(srcContent);
  });

  const getDragTiles = (tileIds: string[]) => {
    return tileIds.map(tileId => {
      const tile = documentContent.getTile(tileId)!;
      const tileRowId = documentContent.findRowContainingTile(tileId)!;
      const tileRow = documentContent.getRow(tileRowId)!;
      const tileRowIndex = documentContent.getRowIndex(tileRowId)!;
      const tileIndex = tileRow.tiles.findIndex(_tile => _tile.tileId === tileId);
      const tileSnapshotWithoutId = cloneDeep(getSnapshot(tile));
      delete tileSnapshotWithoutId.id;
      const item: IDragTileItem = {
        rowIndex: tileRowIndex,
        rowHeight: tileRow.height || 0,
        tileIndex,
        tileId,
        tileContent: JSON.stringify(tileSnapshotWithoutId),
        tileType: tile.content.type
      };
      return item;
    });
  };

  const getNewRowInfo = () => {
    const info: Array<{id: string, index: number, row: TileRowModelType}> = [];
    const knownIds = srcContent.rowOrder!;
    documentContent.rowOrder.forEach((id, index) => {
      if (knownIds.indexOf(id) === -1) {
        info.push({id, index, row: documentContent.getRowByIndex(index)!});
      }
    });
    return info;
  };

  describe("single tile moves", () => {
    it("can move a tile with its own row before another tile in its own row", () => {
      const dragTiles = getDragTiles(["textTool1"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 0,
        rowDropIndex: documentContent.getRowIndex("introductionRow2"),
        rowDropLocation: "left"
      };
      const initialRowCount = documentContent.rowCount;
      expect(documentContent.getRow("introductionRow1")).toBeDefined();
      expect(documentContent.getRow("introductionRow2")!.tiles.length).toBe(1);
      expect(documentContent.getRow("introductionRow1")!.tiles[0].tileId).toBe("textTool1");
      expect(documentContent.getRow("introductionRow2")!.tiles[0].tileId).toBe("drawingTool1");
      documentContent.moveTiles(dragTiles, dropRowInfo);
      expect(documentContent.rowCount).toBe(initialRowCount - 1);
      expect(documentContent.getRow("introductionRow1")).toBeUndefined();
      expect(documentContent.getRow("introductionRow2")!.tiles.length).toBe(2);
      expect(documentContent.getRow("introductionRow2")!.tiles[0].tileId).toBe("textTool1");
      expect(documentContent.getRow("introductionRow2")!.tiles[1].tileId).toBe("drawingTool1");
    });

    it("can move a tile with its own row after another tile in its own row", () => {
      const dragTiles = getDragTiles(["textTool1"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: 0,
        rowDropIndex: documentContent.getRowIndex("introductionRow2"),
        rowDropLocation: "right"
      };
      const initialRowCount = documentContent.rowCount;
      expect(documentContent.getRow("introductionRow1")).toBeDefined();
      expect(documentContent.getRow("introductionRow2")!.tiles.length).toBe(1);
      expect(documentContent.getRow("introductionRow1")!.tiles[0].tileId).toBe("textTool1");
      expect(documentContent.getRow("introductionRow2")!.tiles[0].tileId).toBe("drawingTool1");
      documentContent.moveTiles(dragTiles, dropRowInfo);
      expect(documentContent.rowCount).toBe(initialRowCount - 1);
      expect(documentContent.getRow("introductionRow1")).toBeUndefined();
      expect(documentContent.getRow("introductionRow2")!.tiles.length).toBe(2);
      expect(documentContent.getRow("introductionRow2")!.tiles[0].tileId).toBe("drawingTool1");
      expect(documentContent.getRow("introductionRow2")!.tiles[1].tileId).toBe("textTool1");
    });

    it("can move a tile with its own row after another row", () => {
      const introductionRow2Index = documentContent.getRowIndex("introductionRow2");
      const dragTiles = getDragTiles(["textTool1"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: introductionRow2Index + 1
      };
      const initialRowCount = documentContent.rowCount;
      const initialRowIndex = documentContent.getRowIndex("introductionRow1");
      expect(documentContent.getRow("introductionRow1")).toBeDefined();
      documentContent.moveTiles(dragTiles, dropRowInfo);
      expect(documentContent.rowCount).toBe(initialRowCount);
      expect(documentContent.getRow("introductionRow1")).toBeDefined();
      expect(documentContent.getRowIndex("introductionRow1")).toBe(initialRowIndex + 1);
    });

    it("can move a tile with its own row before another row", () => {
      const introductionRow1Index = documentContent.getRowIndex("introductionRow1");
      const dragTiles = getDragTiles(["drawingTool1"]);
      const dropRowInfo: IDropRowInfo = {
        rowInsertIndex: introductionRow1Index
      };
      const initialRowCount = documentContent.rowCount;
      const initialRowIndex = documentContent.getRowIndex("introductionRow2");
      expect(documentContent.getRow("introductionRow2")).toBeDefined();
      documentContent.moveTiles(dragTiles, dropRowInfo);
      expect(documentContent.rowCount).toBe(initialRowCount);
      expect(documentContent.getRow("introductionRow2")).toBeDefined();
      expect(documentContent.getRowIndex("introductionRow2")).toBe(initialRowIndex - 1);
    });
  });

  describe("mutiple tile moves", () => {
    describe("two of three tiles in one row", () => {
      it("can move into another row to the left", () => {
        const initialRowCount = documentContent.rowCount;
        const introductionRow1 = documentContent.getRow("introductionRow1")!;
        const initialChallengeRow2 = documentContent.getRow("initialChallengeRow2")!;
        const dragTiles = getDragTiles(["graphTool", "textTool2"]);
        const dropRowInfo: IDropRowInfo = {
          rowInsertIndex: 0,
          rowDropIndex: documentContent.getRowIndex("introductionRow1"),
          rowDropLocation: "left"
        };

        expect(introductionRow1.tiles.length).toBe(1);
        expect(initialChallengeRow2.tiles.length).toBe(3);

        documentContent.moveTiles(dragTiles, dropRowInfo);

        expect(documentContent.rowCount).toBe(initialRowCount);
        expect(introductionRow1!.tiles.length).toBe(3);
        expect(introductionRow1!.tiles[0].tileId).toBe("graphTool");
        expect(introductionRow1!.tiles[1].tileId).toBe("textTool2");
        expect(introductionRow1!.tiles[2].tileId).toBe("textTool1");
        expect(initialChallengeRow2.tiles.length).toBe(1);
        expect(initialChallengeRow2.tiles[0].tileId).toBe("drawingTool2");
      });

      it("can move into another row to the right", () => {
        const initialRowCount = documentContent.rowCount;
        const introductionRow1 = documentContent.getRow("introductionRow1")!;
        const initialChallengeRow2 = documentContent.getRow("initialChallengeRow2")!;
        const dragTiles = getDragTiles(["graphTool", "textTool2"]);
        const dropRowInfo: IDropRowInfo = {
          rowInsertIndex: 0,
          rowDropIndex: documentContent.getRowIndex("introductionRow1"),
          rowDropLocation: "right"
        };

        expect(introductionRow1.tiles.length).toBe(1);
        expect(initialChallengeRow2.tiles.length).toBe(3);

        documentContent.moveTiles(dragTiles, dropRowInfo);

        expect(documentContent.rowCount).toBe(initialRowCount);
        expect(introductionRow1!.tiles.length).toBe(3);
        expect(introductionRow1!.tiles[0].tileId).toBe("textTool1");
        expect(introductionRow1!.tiles[1].tileId).toBe("graphTool");
        expect(introductionRow1!.tiles[2].tileId).toBe("textTool2");
        expect(initialChallengeRow2.tiles.length).toBe(1);
        expect(initialChallengeRow2.tiles[0].tileId).toBe("drawingTool2");
      });

      it("can move before another row", () => {
        const initialChallengeRow1 = documentContent.getRow("initialChallengeRow1")!;
        const introductionRow2Index = documentContent.getRowIndex("introductionRow2");
        const dragTiles = getDragTiles(["graphTool", "textTool2"]);
        const dropRowInfo: IDropRowInfo = {
          rowInsertIndex: introductionRow2Index - 1
        };
        const initialRowIndex = dragTiles[0].rowIndex;
        const initialRowCount = Object.keys(documentContent.rowMap).length;

        expect(initialChallengeRow1.tiles.length).toBe(2);

        documentContent.moveTiles(dragTiles, dropRowInfo);

        const newRowIndex = documentContent.getRowIndex(documentContent.findRowContainingTile(dragTiles[0].tileId)!);
        // console.log(documentContent.rowOrder.toJSON());
        // console.log("tiles", initialChallengeRow1.tiles.length);
        expect(newRowIndex).toBeLessThan(initialRowIndex);
        expect(newRowIndex).toBe(introductionRow2Index - 1);
        expect(initialChallengeRow1.tiles.length).toBe(2);
        expect(Object.keys(documentContent.rowMap).length).toBe(initialRowCount);
      });

      it("can move after another row", () => {
        const initialChallengeRow1 = documentContent.getRow("initialChallengeRow1")!;
        const introductionRow2Index = documentContent.getRowIndex("introductionRow2");
        const dragTiles = getDragTiles(["graphTool", "textTool2"]);
        const dropRowInfo: IDropRowInfo = {
          rowInsertIndex: introductionRow2Index + 1
        };
        const initialRowIndex = dragTiles[0].rowIndex;
        const initialRowCount = Object.keys(documentContent.rowMap).length;

        expect(initialChallengeRow1.tiles.length).toBe(2);
        documentContent.moveTiles(dragTiles, dropRowInfo);
        const newRowIndex = documentContent.getRowIndex(documentContent.findRowContainingTile(dragTiles[0].tileId)!);
        console.log(documentContent.rowOrder.toJSON());
        console.log("tiles", initialChallengeRow1.tiles.length);
        expect(newRowIndex).toBeLessThan(initialRowIndex);
        expect(newRowIndex).toBe(introductionRow2Index + 1);
        expect(initialChallengeRow1.tiles.length).toBe(2);
        expect(Object.keys(documentContent.rowMap).length).toBe(initialRowCount);
      });
    });

    describe("all tiles in one row", () => {
      it("can move into another row to the left", () => {
        const dragTiles = getDragTiles(["tableTool", "imageTool"]);
        const dropRowInfo: IDropRowInfo = {
          rowInsertIndex: 0,
          rowDropIndex: documentContent.getRowIndex("introductionRow1"),
          rowDropLocation: "left"
        };
        const initialRowCount = documentContent.rowCount;
        const introductionRow1 = documentContent.getRow("introductionRow1")!;
        expect(introductionRow1.tiles.length).toBe(1);
        documentContent.moveTiles(dragTiles, dropRowInfo);
        expect(documentContent.rowCount).toBe(initialRowCount - 1);
        expect(introductionRow1!.tiles.length).toBe(3);
        expect(introductionRow1!.tiles[0].tileId).toBe("tableTool");
        expect(introductionRow1!.tiles[1].tileId).toBe("imageTool");
        expect(introductionRow1!.tiles[2].tileId).toBe("textTool1");
      });

      it("can move into another row to the right", () => {
        const dragTiles = getDragTiles(["tableTool", "imageTool"]);
        const dropRowInfo: IDropRowInfo = {
          rowInsertIndex: 0,
          rowDropIndex: documentContent.getRowIndex("introductionRow1"),
          rowDropLocation: "right"
        };
        const initialRowCount = documentContent.rowCount;
        const introductionRow1 = documentContent.getRow("introductionRow1")!;
        expect(introductionRow1.tiles.length).toBe(1);
        documentContent.moveTiles(dragTiles, dropRowInfo);
        expect(documentContent.rowCount).toBe(initialRowCount - 1);
        expect(introductionRow1!.tiles.length).toBe(3);
        expect(introductionRow1!.tiles[0].tileId).toBe("textTool1");
        expect(introductionRow1!.tiles[1].tileId).toBe("tableTool");
        expect(introductionRow1!.tiles[2].tileId).toBe("imageTool");
      });

      it("can move before another row", () => {
        const initialChallengeRow1 = documentContent.getRow("initialChallengeRow1")!;
        const introductionRow2Index = documentContent.getRowIndex("introductionRow2");
        const dragTiles = getDragTiles(["tableTool", "imageTool"]);
        const dropRowInfo: IDropRowInfo = {
          rowInsertIndex: introductionRow2Index - 1
        };
        const initialRowIndex = dragTiles[0].rowIndex;
        const initialRowCount = Object.keys(documentContent.rowMap).length;

        expect(initialChallengeRow1.tiles.length).toBe(2);
        documentContent.moveTiles(dragTiles, dropRowInfo);
        const newRowIndex = documentContent.getRowIndex(documentContent.findRowContainingTile(dragTiles[0].tileId)!);
        console.log(documentContent.rowOrder.toJSON());
        console.log("tiles", initialChallengeRow1.tiles.length);
        expect(newRowIndex).toBeLessThan(initialRowIndex);
        expect(newRowIndex).toBe(introductionRow2Index - 1);
        expect(initialChallengeRow1.tiles.length).toBe(2);
        expect(Object.keys(documentContent.rowMap).length).toBe(initialRowCount);
      });

      it("can move after another row", () => {
        const initialChallengeRow1 = documentContent.getRow("initialChallengeRow1")!;
        const introductionRow2Index = documentContent.getRowIndex("introductionRow2");
        const dragTiles = getDragTiles(["tableTool", "imageTool"]);
        const dropRowInfo: IDropRowInfo = {
          rowInsertIndex: introductionRow2Index + 1
        };
        const initialRowIndex = dragTiles[0].rowIndex;
        const initialRowCount = Object.keys(documentContent.rowMap).length;

        expect(initialChallengeRow1.tiles.length).toBe(2);
        documentContent.moveTiles(dragTiles, dropRowInfo);
        const newRowIndex = documentContent.getRowIndex(documentContent.findRowContainingTile(dragTiles[0].tileId)!);
        console.log(documentContent.rowOrder.toJSON());
        console.log("tiles", initialChallengeRow1.tiles.length);
        expect(newRowIndex).toBeLessThan(initialRowIndex);
        expect(newRowIndex).toBe(introductionRow2Index + 1);
        expect(initialChallengeRow1.tiles.length).toBe(2);
        expect(Object.keys(documentContent.rowMap).length).toBe(initialRowCount);
      });
    });
  });

  describe("single tile copies", () => {
    it("can copy a tile before another row", () => {
      const dragTiles = getDragTiles(["drawingTool1"]);
      const introductionRow2Index = documentContent.getRowIndex("introductionRow2");
      const introductionRow2 = documentContent.getRowByIndex(introductionRow2Index)!;
      const rowInsertIndex = introductionRow2Index - 1;
      const initialRowCount = documentContent.rowOrder.length;

      expect(introductionRow2.tiles.length).toBe(1);
      documentContent.copyTilesIntoNewRows(dragTiles, rowInsertIndex);
      expect(introductionRow2.tiles.length).toBe(1);

      const newRowInfo = getNewRowInfo();
      expect(newRowInfo.length).toBe(1);
      expect(newRowInfo[0].index).toBe(introductionRow2Index - 1);
      expect(newRowInfo[0].row.tiles.length).toBe(1);
      expect(documentContent.rowOrder.length).toBe(initialRowCount + 1);
    });

    it("can copy a tile after another row", () => {
      const dragTiles = getDragTiles(["drawingTool1"]);
      const introductionRow2Index = documentContent.getRowIndex("introductionRow2");
      const introductionRow2 = documentContent.getRowByIndex(introductionRow2Index)!;
      const rowInsertIndex = introductionRow2Index + 1;
      const initialRowCount = documentContent.rowOrder.length;

      expect(introductionRow2.tiles.length).toBe(1);
      documentContent.copyTilesIntoNewRows(dragTiles, rowInsertIndex);
      expect(introductionRow2.tiles.length).toBe(1);

      const newRowInfo = getNewRowInfo();
      expect(newRowInfo.length).toBe(1);
      expect(newRowInfo[0].index).toBe(introductionRow2Index + 1);
      expect(newRowInfo[0].row.tiles.length).toBe(1);
      expect(documentContent.rowOrder.length).toBe(initialRowCount + 1);
    });
  });

  describe("mutiple tile copies", () => {
    describe("two of three tiles in one row", () => {
      it("can copy before another row", () => {
        const dragTiles = getDragTiles(["graphTool", "textTool2"]);
        const initialChallengeRow2Index = documentContent.getRowIndex("initialChallengeRow2");
        const introductionRow2Index = documentContent.getRowIndex("introductionRow2");
        const initialChallengeRow2 = documentContent.getRowByIndex(initialChallengeRow2Index)!;
        const rowInsertIndex = introductionRow2Index - 1;
        const initialRowCount = documentContent.rowOrder.length;

        expect(initialChallengeRow2.tiles.length).toBe(3);
        documentContent.copyTilesIntoNewRows(dragTiles, rowInsertIndex);
        expect(initialChallengeRow2.tiles.length).toBe(3);

        const newRowInfo = getNewRowInfo();
        expect(newRowInfo.length).toBe(1);
        expect(newRowInfo[0].index).toBe(introductionRow2Index - 1);
        expect(newRowInfo[0].row.tiles.length).toBe(2);
        expect(documentContent.rowOrder.length).toBe(initialRowCount + 1);
      });

      it("can copy after another row", () => {
        const dragTiles = getDragTiles(["graphTool", "textTool2"]);
        const initialChallengeRow2Index = documentContent.getRowIndex("initialChallengeRow2");
        const introductionRow2Index = documentContent.getRowIndex("introductionRow2");
        const initialChallengeRow2 = documentContent.getRowByIndex(initialChallengeRow2Index)!;
        const rowInsertIndex = introductionRow2Index + 1;
        const initialRowCount = documentContent.rowOrder.length;

        expect(initialChallengeRow2.tiles.length).toBe(3);
        documentContent.copyTilesIntoNewRows(dragTiles, rowInsertIndex);
        expect(initialChallengeRow2.tiles.length).toBe(3);

        const newRowInfo = getNewRowInfo();
        expect(newRowInfo.length).toBe(1);
        expect(newRowInfo[0].index).toBe(introductionRow2Index + 1);
        expect(newRowInfo[0].row.tiles.length).toBe(2);
        expect(documentContent.rowOrder.length).toBe(initialRowCount + 1);
      });
    });

    describe("all tiles in one row", () => {
      it("can copy before another row", () => {
        const dragTiles = getDragTiles(["tableTool", "imageTool"]);
        const initialChallengeRow1Index = documentContent.getRowIndex("initialChallengeRow1");
        const introductionRow2Index = documentContent.getRowIndex("introductionRow2");
        const initialChallengeRow1 = documentContent.getRowByIndex(initialChallengeRow1Index)!;
        const rowInsertIndex = introductionRow2Index - 1;
        const initialRowCount = documentContent.rowOrder.length;

        expect(initialChallengeRow1.tiles.length).toBe(2);
        documentContent.copyTilesIntoNewRows(dragTiles, rowInsertIndex);
        expect(initialChallengeRow1.tiles.length).toBe(2);

        const newRowInfo = getNewRowInfo();
        expect(newRowInfo.length).toBe(1);
        expect(newRowInfo[0].index).toBe(introductionRow2Index - 1);
        expect(newRowInfo[0].row.tiles.length).toBe(2);
        expect(documentContent.rowOrder.length).toBe(initialRowCount + 1);
      });

      it("can copy after another row", () => {
        const dragTiles = getDragTiles(["tableTool", "imageTool"]);
        const initialChallengeRow1Index = documentContent.getRowIndex("initialChallengeRow1");
        const introductionRow2Index = documentContent.getRowIndex("introductionRow2");
        const initialChallengeRow1 = documentContent.getRowByIndex(initialChallengeRow1Index)!;
        const rowInsertIndex = introductionRow2Index + 1;
        const initialRowCount = documentContent.rowOrder.length;

        expect(initialChallengeRow1.tiles.length).toBe(2);
        documentContent.copyTilesIntoNewRows(dragTiles, rowInsertIndex);
        expect(initialChallengeRow1.tiles.length).toBe(2);

        const newRowInfo = getNewRowInfo();
        expect(newRowInfo.length).toBe(1);
        expect(newRowInfo[0].index).toBe(introductionRow2Index + 1);
        expect(newRowInfo[0].row.tiles.length).toBe(2);
        expect(documentContent.rowOrder.length).toBe(initialRowCount + 1);
      });
    });
  });
});
