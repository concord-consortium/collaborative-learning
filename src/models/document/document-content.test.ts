import { DocumentContentModel, DocumentContentModelType, cloneContentWithUniqueIds } from "./document-content";
import { defaultTextContent } from "../tools/text/text-content";

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
});
