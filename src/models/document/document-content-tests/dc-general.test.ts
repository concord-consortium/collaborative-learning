import {
  cloneContentWithUniqueIds, DocumentContentModel, DocumentContentModelType
} from "../document-content";
import { createDefaultSectionedContent } from "../sectioned-content";
import { SectionModel, SectionModelType } from "../../curriculum/section";
import { TextContentModel } from "../../tiles/text/text-content";
import { IDocumentExportOptions } from "../../tiles/tile-content-info";
import { parsedExport, getColumnWidths, getAllRows } from "./dc-test-utils";
import { PLACEHOLDER_IMAGE_PATH } from "../../../utilities/image-constants";
import { LogEventName } from "../../../lib/logger-types";

jest.mock("../../../utilities/mst-utils", () => {
  return {
    ...jest.requireActual("../../../utilities/mst-utils"),
    getParentWithTypeName: () => null,
  };
});

// mock Logger calls
const mockLogTileDocumentEvent = jest.fn();
jest.mock("../../tiles/log/log-tile-document-event", () => ({
  logTileDocumentEvent: (event: LogEventName, _params: any, runBeforeContainerLogging?: () => void) => {
    mockLogTileDocumentEvent(event, _params, runBeforeContainerLogging);
    if (runBeforeContainerLogging) {
      runBeforeContainerLogging();
    }
  }
}));

describe("DocumentContentModel", () => {
  let documentContent: DocumentContentModelType;

  beforeEach(() => {
    documentContent = DocumentContentModel.create({});
  });

  function parsedContentExport(options?: IDocumentExportOptions) {
    return parsedExport(documentContent, options);
  }

  it("behaves like empty content when empty", () => {
    expect(documentContent.isEmpty).toBe(true);
    expect(documentContent.firstTile).toBeUndefined();
    expect(documentContent.rowCount).toBe(0);
    expect(documentContent.getIndexOfLastVisibleRow(documentContent.visibleRows)).toBe(-1);
    expect(documentContent.defaultInsertRowIndex).toBe(0);
    expect(parsedContentExport()).toEqual({ tiles: [] });
    expect(documentContent.getTilesInDocumentOrder()).toEqual([]);
  });

  it("allows the tool tiles to be added", () => {
    expect(documentContent.tileMap.size).toBe(0);
    documentContent.addTile("text", { title: "Text 1" });
    expect(documentContent.tileMap.size).toBe(1);
    documentContent.addTile("geometry", { title: "Coordinate Grid 1" });
    expect(documentContent.tileMap.size).toBe(2);
    expect(documentContent.defaultInsertRowIndex).toBe(2);
    const newRowTile = documentContent.addTile("table", { title: "Table 1" });
    const columnWidths = getColumnWidths(documentContent, newRowTile?.tileId);
    expect(documentContent.tileMap.size).toBe(3);
    documentContent.addTile("drawing", { title: "Sketch 1" });
    expect(documentContent.tileMap.size).toBe(4);
    expect(parsedContentExport()).toEqual({
      tiles: [
        { title: "Text 1", content: { type: "Text", format: "html", text: ["<p></p>"] } },
        { title: "Coordinate Grid 1",
          content: {
            type: "Geometry",
            objects: {},
            linkedAttributeColors: {},
            pointMetadata: {},
            offsetX: 0,
            offsetY: 0,
            isNavigatorVisible: true,
            navigatorPosition: "bottom",
            zoom: 1
          } },
        { title: "Table 1", content: { type: "Table", columnWidths } },
        { title: "Sketch 1", content: { type: "Drawing", objects: [] } }
      ]
    });
  });

  it("allows the tool tiles to be added as new rows at specified locations", () => {
    documentContent.addTile("text", { title: "Text 1"});
    const textTile2 = documentContent.addTile("text", { title: "Text 2" });

    let textTile2RowId = documentContent.findRowIdContainingTile(textTile2!.tileId);
    let textTile2RowIndex1 = documentContent.rowOrder.findIndex((id: string) => id === textTile2RowId);

    expect(textTile2RowIndex1).toBe(1);

    // insert image between text tiles
    const imageTile1 = documentContent.addTile("image", {
      title: "Image 1",
      insertRowInfo: {
        rowInsertIndex: 1,
        rowDropId: textTile2RowId,
        rowDropLocation: "top"
      }
    });

    const imageTile1rowId = documentContent.findRowIdContainingTile(imageTile1!.tileId);
    const imageTile1rowIndex1 = documentContent.rowOrder.findIndex((id: string) => id === imageTile1rowId);

    expect(imageTile1rowIndex1).toBe(1);

    // text tile should have shifted down
    textTile2RowId = documentContent.findRowIdContainingTile(textTile2!.tileId);
    textTile2RowIndex1 = documentContent.rowOrder.findIndex((id: string) => id === textTile2RowId);

    expect(textTile2RowIndex1).toBe(2);

    // insert image at bottom
    const imageTile2 = documentContent.addTile("image", {
      title: "Image 2",
      insertRowInfo: {
        rowInsertIndex: 3,
        rowDropId: textTile2RowId,
        rowDropLocation: "bottom"
      }
    });

    const rowId2 = documentContent.findRowIdContainingTile(imageTile2!.tileId);
    const rowIndex2 = documentContent.rowOrder.findIndex((id: string) => id === rowId2);

    expect(rowIndex2).toBe(3);

    expect(parsedContentExport()).toEqual({
      tiles: [
        { title: "Text 1", content: { type: "Text", format: "html", text: ["<p></p>"] } },
        { title: "Image 1", content: { type: "Image", url: PLACEHOLDER_IMAGE_PATH } },
        { title: "Text 2", content: { type: "Text", format: "html", text: ["<p></p>"] } },
        { title: "Image 2", content: { type: "Image", url: PLACEHOLDER_IMAGE_PATH } }
      ]
    });
  });

  it("allows the tool tiles to be added at side of existing rows", () => {
    documentContent.addTile("text", { title: "Text 1"} );
    const textTile2 = documentContent.addTile("text", { title: "Text 2" });

    let textTile2RowId = documentContent.findRowIdContainingTile(textTile2!.tileId);
    let textTile2RowIndex1 = documentContent.rowOrder.findIndex((id: string) => id === textTile2RowId);

    expect(textTile2RowIndex1).toBe(1);

    const imageTile1 = documentContent.addTile("image", {
      title: "Image 1",
      insertRowInfo: {
        rowInsertIndex: 1,
        rowDropId: textTile2RowId,
        rowDropLocation: "left"
      }
    });

    const imageTile1rowId = documentContent.findRowIdContainingTile(imageTile1!.tileId);
    const imageTile1rowIndex1 = documentContent.rowOrder.findIndex((id: string) => id === imageTile1rowId);

    expect(imageTile1rowIndex1).toBe(1);

    // text tile should still be on 1 as well
    textTile2RowId = documentContent.findRowIdContainingTile(textTile2!.tileId);
    textTile2RowIndex1 = documentContent.rowOrder.findIndex((id: string) => id === textTile2RowId);

    expect(textTile2RowIndex1).toBe(1);

    expect(parsedContentExport()).toEqual({
      tiles: [
        { title: "Text 1", content: { type: "Text", format: "html", text: ["<p></p>"] } },
        [
          { title: "Image 1", content: { type: "Image", url: PLACEHOLDER_IMAGE_PATH } },
          { title: "Text 2", content: { type: "Text", format: "html", text: ["<p></p>"] } }
        ]
      ]
    });
  });
});

const sectionedContent = {
    "[Header:A, Placeholder": [
      { content: { isSectionHeader: true, sectionId: "A" } },
      { content: { type: "Placeholder", sectionId: "A" }}
    ],
    "[Header:A, Placeholder, Header:B, Placeholder]": [
      { content: { isSectionHeader: true, sectionId: "A" } },
      { content: { type: "Placeholder", sectionId: "A" }},
      { content: { isSectionHeader: true, sectionId: "B" } },
      { content: { type: "Placeholder", sectionId: "B" }}
    ],
    "[Header:A, Placeholder, Header:B, Text]": [
      { content: { isSectionHeader: true, sectionId: "A" } },
      { content: { type: "Placeholder", sectionId: "A" }},
      { content: { isSectionHeader: true, sectionId: "B" } },
      { title: "Text 1", content: { type: "Text", format: "html", text: ["<p></p>"] } }
    ],
    "[Header:A, Text, Header:B, Text]": [
      { content: { isSectionHeader: true, sectionId: "A" } },
      { title: "Text 2", content: { type: "Text", format: "html", text: ["<p>foo</p>"] } },
      { content: { isSectionHeader: true, sectionId: "B" } },
      { title: "Text 1", content: { type: "Text", format: "html", text: ["<p></p>"] } }
    ],
    "[Header:A, Text, Header:B, Placeholder]": [
      { content: { isSectionHeader: true, sectionId: "A" } },
      { title: "Text 1", content: { type: "Text", format: "html", text: ["<p></p>"] } },
      { content: { isSectionHeader: true, sectionId: "B" } },
      { content: { type: "Placeholder", sectionId: "B" }}
    ],
    "[Header:A, [Geometry, Text], Header:B, Text]": [
      { content: { isSectionHeader: true, sectionId: "A" } },
      [
        { title: "Coordinate Grid 1", content: { type: "Geometry" } },
        { content: { type: "Text", format: "html", text: ["<p></p>"] } }
      ],
      { content: { isSectionHeader: true, sectionId: "B" } },
      { title: "Text 1", content: { type: "Text", format: "html", text: ["<p></p>"] } }
    ],
    "[Header:A, [Text, Geometry], Header:B, Text]": [
      { content: { isSectionHeader: true, sectionId: "A" } },
      [
        { content: { type: "Text", format: "html", text: ["<p></p>"] } },
        { title: "Coordinate Grid 1", content: { type: "Geometry" } }
      ],
      { content: { isSectionHeader: true, sectionId: "B" } },
      { title: "Text 1", content: { type: "Text", format: "html", text: ["<p></p>"] } }
    ]
} as const;

function createDocumentContent(description: keyof typeof sectionedContent) {
  return DocumentContentModel.create({tiles: sectionedContent[description]} as any);
}

describe("DocumentContentModel -- sectioned documents --", () => {

  it("can create sectioned documents", () => {
    const content1 = createDocumentContent(
      "[Header:A, Placeholder"
    );

    expect(getAllRows(content1)).toEqual([
      { Header: "A"},
      { Placeholder: "A" }
    ]);
    expect(content1.defaultInsertRowIndex).toBe(1);

    const content2 = createDocumentContent(
      "[Header:A, Placeholder, Header:B, Placeholder]"
    );
    expect(getAllRows(content2)).toEqual([
      { Header: "A"},
      { Placeholder: "A" },
      { Header: "B"},
      { Placeholder: "B" }
    ]);
    expect(content2.defaultInsertRowIndex).toBe(1);
    expect(parsedExport(content2)).toEqual({ tiles: [] });
  });

  it("will remove placeholder tiles when adding a new tile in the last section", () => {
    const content = createDocumentContent(
      "[Header:A, Placeholder, Header:B, Placeholder]"
    );
    content.addTile("text", { title: "Text 1" });

    expect(getAllRows(content)).toEqual([
      { Header: "A"},
      { Placeholder: "A" },
      { Header: "B"},
      { title: "Text 1", content: { type: "Text", format: "html", text: ["<p></p>"] }}
    ]);
    expect(content.defaultInsertRowIndex).toBe(4);
  });

  it("will remove placeholder tiles when adding a new tile in an interior section", () => {
    const content = createDocumentContent(
      "[Header:A, Placeholder, Header:B, Text]"
    );
    content.addTileContentInNewRow(TextContentModel.create({ text: "foo" }), { title: "Text 2", rowIndex: 1 });

    expect(getAllRows(content)).toEqual([
      { Header: "A"},
      { title: "Text 2", content: { type: "Text", format: "html", text: ["<p>foo</p>"] } },
      { Header: "B"},
      { title: "Text 1", content: { type: "Text", format: "html", text: ["<p></p>"] }}
    ]);
    expect(content.defaultInsertRowIndex).toBe(4);
  });

  it("will restore placeholder tiles when deleting the last row in an interior section", () => {
    const content = createDocumentContent(
      "[Header:A, Text, Header:B, Text]"
    );
    const rowId = content.rowOrder[1];
    content.deleteRowAddingPlaceholderRowIfAppropriate(rowId);

    expect(getAllRows(content)).toEqual([
      { Header: "A"},
      { Placeholder: "A" },
      { Header: "B"},
      { title: "Text 1", content: { type: "Text", format: "html", text: ["<p></p>"] }}
    ]);
    expect(content.defaultInsertRowIndex).toBe(4);
  });

  it("will restore placeholder tiles when deleting the last row in the last section", () => {
    const content = createDocumentContent(
      "[Header:A, Placeholder, Header:B, Text]"
    );
    const rowId = content.rowOrder[3];
    content.deleteRowAddingPlaceholderRowIfAppropriate(rowId);

    expect(getAllRows(content)).toEqual([
      { Header: "A"},
      { Placeholder: "A" },
      { Header: "B"},
      { Placeholder: "B" }
    ]);
    expect(content.defaultInsertRowIndex).toBe(1);
  });

  it("will add/remove placeholder rows when moving entire rows (3 => 1)", () => {
    const content = createDocumentContent(
      "[Header:A, Placeholder, Header:B, Placeholder]"
    );
    content.addTile("text", { title: "Text 1" });
    // [Header:A, Placeholder, Header:B, Text]
    content.moveRow(content.rowOrder[3], content.rowOrder[1], "bottom");
    // [Header:A, Text, Header:B, Placeholder]
    // moving to row 0 when row 0 is a section header is a no-op
    content.moveRow(content.rowOrder[1], content.rowOrder[0], "top");

    expect(getAllRows(content)).toEqual([
      { Header: "A"},
      { title: "Text 1", content: { type: "Text", format: "html", text: ["<p></p>"] } },
      { Header: "B"},
      { Placeholder: "B" }
    ]);
    expect(content.defaultInsertRowIndex).toBe(2);
  });

  it("will add/remove placeholder rows when moving entire rows (1 => 3)", () => {
    const content = createDocumentContent(
      "[Header:A, Text, Header:B, Placeholder]"
    );
    content.moveRow(content.rowOrder[1], content.rowOrder[3], "bottom");

    expect(getAllRows(content)).toEqual([
      { Header: "A"},
      { Placeholder: "A" },
      { Header: "B"},
      { title: "Text 1", content: { type: "Text", format: "html", text: ["<p></p>"] } },
    ]);
    expect(content.defaultInsertRowIndex).toBe(4);
  });

  it("will add/remove placeholder rows when moving a tile back to a new row", () => {
    const content = createDocumentContent(
      "[Header:A, Placeholder, Header:B, Text]"
    );
    const tileId = content.getRowByIndex(3)!.tiles[0].tileId;
    const rowInfo = { rowInsertIndex: 2, rowDropId: content.getRowByIndex(2)!.id, rowDropLocation: "top" };
    content.moveTileToNewRow(tileId, rowInfo);

    expect(getAllRows(content)).toEqual([
      { Header: "A"},
      { title: "Text 1", content: { type: "Text", format: "html", text: ["<p></p>"] } },
      { Header: "B"},
      { Placeholder: "B" }
    ]);
    expect(content.defaultInsertRowIndex).toBe(2);
  });

  it("will add/remove placeholder rows when moving a tile forward to a new row", () => {
    const content = createDocumentContent(
      "[Header:A, Text, Header:B, Placeholder]"
    );
    const tileId = content.getRowByIndex(1)!.tiles[0].tileId;
    const rowInfo = { rowInsertIndex: 4, rowDropId: content.getRowByIndex(3)!.id, rowDropLocation: "bottom" };
    content.moveTileToNewRow(tileId, rowInfo);

    expect(getAllRows(content)).toEqual([
      { Header: "A"},
      { Placeholder: "A" },
      { Header: "B"},
      { title: "Text 1", content: { type: "Text", format: "html", text: ["<p></p>"] } },
    ]);
    expect(content.defaultInsertRowIndex).toBe(4);
  });

  it("will add/remove placeholder rows when moving a tile back to an existing row", () => {
    const content = createDocumentContent(
      "[Header:A, Placeholder, Header:B, Text]"
    );
    const tileId = content.getRowByIndex(3)!.tiles[0].tileId;
    content.moveTileToRow(tileId, content.getRowByIndex(1)!.id);

    expect(getAllRows(content)).toEqual([
      { Header: "A"},
      { title: "Text 1", content: { type: "Text", format: "html", text: ["<p></p>"] } },
      { Header: "B"},
      { Placeholder: "B" }
    ]);
    expect(content.defaultInsertRowIndex).toBe(2);
  });

  it("will add/remove placeholder rows when moving a tile forward to an existing row", () => {
    const content = createDocumentContent(
      "[Header:A, Text, Header:B, Placeholder]"
    );
    const tileId = content.getRowByIndex(1)!.tiles[0].tileId;
    content.moveTileToRow(tileId, content.getRowByIndex(3)!.id, 0);

    expect(getAllRows(content)).toEqual([
      { Header: "A"},
      { Placeholder: "A" },
      { Header: "B"},
      { title: "Text 1", content: { type: "Text", format: "html", text: ["<p></p>"] } },
    ]);
  });

  it("deleteTile() will add/remove placeholder rows", () => {
    const content = createDocumentContent(
      "[Header:A, Placeholder, Header:B, Text]"
    );
    const tileId = content.getRowByIndex(3)!.tiles[0].tileId;
    content.deleteTile(tileId);

    expect(getAllRows(content)).toEqual([
      { Header: "A"},
      { Placeholder: "A" },
      { Header: "B"},
      { Placeholder: "B" },
    ]);
  });

  it("addTile() will add/remove placeholder rows", () => {
    const content = createDocumentContent(
      "[Header:A, Placeholder, Header:B, Placeholder]"
    );
    content.addTile("text", { title: "Text 1" });

    expect(getAllRows(content)).toEqual([
      { Header: "A"},
      { Placeholder: "A" },
      { Header: "B"},
      { title: "Text 1", content: { type: "Text", format: "html", text: ["<p></p>"] } },
    ]);
  });

  it("moveTile() will add/remove placeholder rows", () => {
    const content = createDocumentContent(
      "[Header:A, Placeholder, Header:B, Text]"
    );
    const tileId = content.getRowByIndex(3)!.tiles[0].tileId;
    content.moveTile(tileId, { rowDropId: content.getRowByIndex(1)!.id, rowDropLocation: "right", rowInsertIndex: 1 });
    expect(getAllRows(content)).toEqual([
      { Header: "A"},
      { title: "Text 1", content: { type: "Text", format: "html", text: ["<p></p>"] } },
      { Header: "B"},
      { Placeholder: "B" }
    ]);

    content.moveTile(tileId, { rowDropId: content.getRowByIndex(3)!.id, rowDropLocation: "left", rowInsertIndex: 3 });
    expect(getAllRows(content)).toEqual([
      { Header: "A"},
      { Placeholder: "A" },
      { Header: "B"},
      { title: "Text 1", content: { type: "Text", format: "html", text: ["<p></p>"] } },
    ]);

    content.moveTile(tileId, { rowDropId: content.getRowByIndex(1)!.id, rowDropLocation: "top", rowInsertIndex: 1 });
    expect(getAllRows(content)).toEqual([
      { Header: "A"},
      { title: "Text 1", content: { type: "Text", format: "html", text: ["<p></p>"] } },
      { Header: "B"},
      { Placeholder: "B" }
    ]);

    content.moveTile(tileId, { rowDropId: content.getRowByIndex(3)!.id, rowDropLocation: "bottom", rowInsertIndex: 3 });
    expect(getAllRows(content)).toEqual([
      { Header: "A"},
      { Placeholder: "A" },
      { Header: "B"},
      { title: "Text 1", content: { type: "Text", format: "html", text: ["<p></p>"] } },
    ]);

    content.addTile("geometry", { title: "Coordinate Grid 1",
      insertRowInfo: { rowDropId: content.getRowByIndex(1)!.id, rowDropLocation: "bottom", rowInsertIndex: 2 } });
    expect(getAllRows(content)).toEqual([
      { Header: "A"},
      { title: "Coordinate Grid 1",
          content: {
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
      { Header: "B"},
      { title: "Text 1", content: { type: "Text", format: "html", text: ["<p></p>"] } },
    ]);

    const geometryId = content.getRowByIndex(1)!.tiles[0].tileId;
    content.moveTile(geometryId,
      { rowDropId: content.getRowByIndex(3)!.id, rowDropLocation: "left", rowInsertIndex: 3 });
    expect(getAllRows(content)).toEqual([
      { Header: "A"},
      { Placeholder: "A" },
      { Header: "B"},
      [
        { title: "Coordinate Grid 1", content: {
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
        { title: "Text 1", content: { type: "Text", format: "html", text: ["<p></p>"] } }
      ],
    ]);

    content.moveTile(geometryId,
      { rowDropId: content.getRowByIndex(1)!.id, rowDropLocation: "left", rowInsertIndex: 1 });
    expect(getAllRows(content)).toEqual([
      { Header: "A"},
        { title: "Coordinate Grid 1", content: {
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
      { Header: "B"},
      { title: "Text 1", content: { type: "Text", format: "html", text: ["<p></p>"] } },
    ]);
  });

  it("moveTileToRow() will move tiles within a row", () => {
    const content = createDocumentContent(
      "[Header:A, [Geometry, Text], Header:B, Text]"
    );
    const tileId = content.getRowByIndex(1)!.tiles[1].tileId;
    content.moveTileToRow(tileId, content.getRowByIndex(1)!.id, 0);

    expect(getAllRows(content)).toEqual([
      { Header: "A"},
      [
        { content: { type: "Text", format: "html", text: ["<p></p>"] } },
        { title: "Coordinate Grid 1", content: {
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
      ],
      { Header: "B"},
      { title: "Text 1", content: { type: "Text", format: "html", text: ["<p></p>"] } },
    ]);
  });

  it("deleteTile() will remove individual tiles from rows", () => {
    const content = createDocumentContent(
      "[Header:A, [Text, Geometry], Header:B, Text]"
    );
    const tileId = content.getRowByIndex(1)!.tiles[0].tileId;
    content.deleteTile(tileId);
    expect(getAllRows(content)).toEqual([
      { Header: "A"},
      { title: "Coordinate Grid 1", content: {
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
      { Header: "B"},
      { title: "Text 1", content: { type: "Text", format: "html", text: ["<p></p>"] } },
    ]);
  });
});

describe("DocumentContentModel", () => {

  it("can cloneWithUniqueIds()", () => {
    const content = DocumentContentModel.create({});
    content.addTile("text");
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
              { content: { type: "Text", text: "foo" } },
              [
                { content: { type: "Text", text: "bar" } },
                { content: { type: "Text", text: "baz" } }
              ]
            ]
          };
    const content = DocumentContentModel.create(srcContent);
    expect(content.rowCount).toBe(3);
    const row = content.getRowByIndex(1);
    expect(row!.tileCount).toBe(1);
    const tileId = row!.getTileIdAtIndex(0);
    expect(tileId).toBe("Foo_Text_1");
    const tile = tileId ? content.tileMap.get(tileId) : undefined;
    const tileContent = tile!.content;
    expect(tileContent.type).toBe("Text");
    expect(parsedExport(content)).toEqual({
      tiles: [
        { content: { type: "Text", format: "html", text: ["<p>foo</p>"] } },
        [
          { content: { type: "Text", format: "html", text: ["<p>bar</p>"] } },
          { content: { type: "Text", format: "html", text: ["<p>baz</p>"] } }
        ]
      ]
    });
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

describe("DocumentContentModel -- user-logging actions", () => {
  const documentContent = DocumentContentModel.create({});
  mockLogTileDocumentEvent.mockReset();

  it("logs user adding/removing tiles", () => {
    const newTile = documentContent.userAddTile("text");
    const newTileId = newTile?.tileId;
    expect(newTileId).toBeDefined();
    expect(mockLogTileDocumentEvent).toHaveBeenCalledTimes(1);

    documentContent.userDeleteTile(newTileId!);
    expect(mockLogTileDocumentEvent).toHaveBeenCalledTimes(2);

    // deleting it again has no effect
    documentContent.userDeleteTile(newTileId!);
    expect(mockLogTileDocumentEvent).toHaveBeenCalledTimes(2);
  });
});

describe("DocumentContentModel -- createDefaultSectionedContent", () => {
  it("creates sectioned content", () => {
    const sections: SectionModelType[] = [
            SectionModel.create({ type: "foo" }),
            SectionModel.create({ type: "bar" })
          ];
    const content = createDefaultSectionedContent({ sections });
    expect(content.rowCount).toBe(4);
  });
});
