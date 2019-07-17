import { DocumentContentModel, DocumentContentModelType } from "./document-content";

describe("document-content model", () => {
  let documentContent: DocumentContentModelType;

  beforeEach(() => {
    documentContent = DocumentContentModel.create({});
  });

  it("allows the tool tiles to be added", () => {
    expect(documentContent.tileMap.size).toBe(0);
    documentContent.addTile("text");
    expect(documentContent.tileMap.size).toBe(1);
    // adding geometry tool adds sidecar text tool
    documentContent.addTile("geometry", true);
    expect(documentContent.tileMap.size).toBe(3);
  });

  it("allows the tool tiles to be added as new rows at specified locations", () => {
    documentContent.addTile("text");
    const textTile2 = documentContent.addTile("text");

    let textTile2RowId = documentContent.findRowContainingTile(textTile2!.tileId);
    let textTile2RowIndex1 = documentContent.rowOrder.findIndex((id: string) => id === textTile2RowId);

    expect(textTile2RowIndex1).toBe(1);

    // insert image between text tiles
    const imageTile1 = documentContent.addTile("image", false, {
      rowInsertIndex: 1,
      rowDropIndex: 1,
      rowDropLocation: "bottom"
    });

    const imageTile1rowId = documentContent.findRowContainingTile(imageTile1!.tileId);
    const imageTile1rowIndex1 = documentContent.rowOrder.findIndex((id: string) => id === imageTile1rowId);

    expect(imageTile1rowIndex1).toBe(1);

    // text tile should have shifted down
    textTile2RowId = documentContent.findRowContainingTile(textTile2!.tileId);
    textTile2RowIndex1 = documentContent.rowOrder.findIndex((id: string) => id === textTile2RowId);

    expect(textTile2RowIndex1).toBe(2);

    // insert image at bottom
    const imageTile2 = documentContent.addTile("image", false, {
      rowInsertIndex: 3,
      rowDropIndex: 3,
      rowDropLocation: "bottom"
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

    const imageTile1 = documentContent.addTile("image", false, {
      rowInsertIndex: 1,
      rowDropIndex: 1,
      rowDropLocation: "left"
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

    const graphTileInfo = documentContent.addTile("geometry", true, {
      rowInsertIndex: 1,
      rowDropIndex: 1,
      rowDropLocation: "bottom"
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

    const graphTileInfo = documentContent.addTile("geometry", true, {
      rowInsertIndex: 1,
      rowDropIndex: 1,
      rowDropLocation: "left"
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
