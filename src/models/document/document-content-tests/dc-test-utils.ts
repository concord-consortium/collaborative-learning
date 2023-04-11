import { IDocumentExportOptions } from "../../tiles/tile-content-info";
import { safeJsonParse } from "../../../utilities/js-utils";
import { DocumentContentModel, DocumentContentModelType, DocumentContentSnapshotType } from "../document-content";
import { IDragTileItem, cloneTileSnapshotWithoutId } from "../../tiles/tile-model";
import { TableContentModelType } from "../../tiles/table/table-content";
import { kDefaultColumnWidth } from "../../../components/tiles/table/table-types";

import placeholderImage from "../../assets/image_placeholder.png";

// This is needed so MST can deserialize snapshots referring to tools
import { registerTileTypes } from "../../../register-tile-types";
registerTileTypes(["Drawing", "Geometry", "Image", "Table", "Text"]);

// This is needed so MST can deserialize snapshots referring to slate-based text tiles
import { registerPlugins } from "@concord-consortium/slate-editor";
registerPlugins();

// mock uniqueId so we can recognize auto-generated IDs
let idCount = 0;
export const mockUniqueId = jest.fn(() => `testid-${++idCount}`);
jest.mock("../../../utilities/js-utils", () => {
  const { uniqueId, ...others } = jest.requireActual("../../../utilities/js-utils");
  return {
    uniqueId: () => mockUniqueId(),
    ...others
  };
});

export function parseJson(json: string) {
  const parsed = safeJsonParse(json);
  if (parsed) {
    // console.log("Parsed Content\n--------------\n", json);
    const prepareTileForMatch = (tile: any) => {
      if (tile?.content?.type === "Geometry") {
        // eliminate board properties to make matching more robust for tests
        delete tile.content.board;
      }
      if (tile?.content?.type === "Image") {
        if (tile.content.url !== placeholderImage) {
          tile.content.url = "image/url";
        }
      }
    };
    parsed.tiles.forEach((tileOrRow: any) => {
      if (Array.isArray(tileOrRow)) {
        tileOrRow.forEach(tile => {
          prepareTileForMatch(tile);
        });
      }
      else {
        prepareTileForMatch(tileOrRow);
      }
    });
  }
  else {
    console.warn("PARSE ERROR\n-----------\n", json);
  }
  return parsed;
}

export function parsedExport(content: DocumentContentModelType, options?: IDocumentExportOptions) {
  const json = content.exportAsJson(options);
  return parseJson(json);
}

export function parsedSections(content: DocumentContentModelType, options?: IDocumentExportOptions) {
  const jsonSections = content.exportSectionsAsJson(options);
  const sections: Record<string, any> = {};
  for (const [section, json] of Object.entries(jsonSections)) {
    sections[section] = parseJson(json);
  }
  return sections;
}

// Returns the columnWidths of the tile with the given id.
// Creating a table automatically creates a dataset with two attributes (columns).
// Exporting the table will include widths for the attributes, keyed by the attribute ids.
// This function returns the table's columnWidths so it can be used to evaluate the tile's exported json.
export function getColumnWidths(documentContent: DocumentContentModelType, tileId?: string) {
  const _tileId = tileId ?? "no-tile-id";
  const tableTile = documentContent.getTile(_tileId);
  const dataSet = (tableTile?.content as TableContentModelType)?.dataSet;
  const attrIds = dataSet?.attributes.map(attribute => attribute.id) ?? [];
  const columnWidths: Record<string, number> = {};
  attrIds.forEach(attrId => columnWidths[attrId] = kDefaultColumnWidth);
  return columnWidths;
}

export function getRowLayout(documentContent: DocumentContentModelType) {
  const rowLayout: any = {};
  documentContent.rowOrder.forEach(rowId => {
    const row = documentContent.getRow(rowId);
    const key = rowId.indexOf("testid-") !== -1 ? "NEW_ROW" : rowId;
    rowLayout[key] = [];
    row?.tiles.forEach((rowTile, index) => {
      const tileType = documentContent.getTile(rowTile.tileId)!.content.type.toUpperCase();
      const tileId = rowTile.tileId.indexOf("-") !== -1 ? `NEW_${tileType}_TILE_${index + 1}` : rowTile.tileId;
      rowLayout[key].push(tileId);
    });
  });
  return rowLayout;
}

export function setupDocumentContent(srcContent: DocumentContentSnapshotType) {
  const documentContent = DocumentContentModel.create(srcContent);

  return {
    documentContent,
    getRowLayout() {
      return getRowLayout(documentContent);
    }
  };
}

