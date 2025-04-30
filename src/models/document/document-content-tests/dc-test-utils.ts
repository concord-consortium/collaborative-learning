import { IDocumentExportOptions } from "../../tiles/tile-content-info";
import { safeJsonParse } from "../../../utilities/js-utils";
import { DocumentContentModel, DocumentContentModelType, DocumentContentSnapshotType } from "../document-content";
import { TableContentModelType } from "../../tiles/table/table-content";
import { kDefaultColumnWidth } from "../../../components/tiles/table/table-types";
import { isPlaceholderContent } from "../../../models/tiles/placeholder/placeholder-content";

import placeholderImage from "../../assets/image_placeholder.png";


// mock uniqueId so we can recognize auto-generated IDs
declare global {
  // eslint-disable-next-line no-var
  var __mockUniqueIdCount: number;
}
globalThis.__mockUniqueIdCount = 0;
function mockUniqueId() {
  return `testid-${++globalThis.__mockUniqueIdCount}`;
}
jest.mock("../../../utilities/js-utils", () => {
  const { uniqueId, ...others } = jest.requireActual("../../../utilities/js-utils");
  return {
    uniqueId: () => mockUniqueId(),
    ...others
  };
});

export function resetMockUniqueId(count = 0) {
  globalThis.__mockUniqueIdCount = count;
}
export { mockUniqueId };


// This is needed so MST can deserialize snapshots referring to tools
import { registerTileTypes } from "../../../register-tile-types";
registerTileTypes(["Drawing", "Geometry", "Image", "Table", "Text"]);
import { registerPlugins } from "@concord-consortium/slate-editor";
registerPlugins();

export function prepareTileForMatch(tile: any) {
  if (tile?.content?.type === "Geometry") {
    // eliminate board properties to make matching more robust for tests
    delete tile.content.board;
  }
  if (tile?.content?.type === "Image") {
    if (tile.content.url !== placeholderImage) {
      tile.content.url = "image/url";
    }
  }
  return tile;
}

export function parseJson(json: string) {
  const parsed = safeJsonParse(json);
  if (parsed) {
    // console.log("Parsed Content\n--------------\n", json);
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

/**
 * Export all rows of the document in a format that is easy to read.
 * This includes header rows and placeholder tiles
 */
export function getAllRows(doc: DocumentContentModelType) {
  const rows = doc.rowOrder.map(rowId => doc.getRow(rowId) );

  return rows.map((row, rowIndex) => {
    const tileExports = row?.tiles.map((tileInfo, tileIndex) => {
      const rowHeight = doc.rowHeightToExport(row, tileInfo.tileId, doc.tileMap);
      const rowHeightOption = rowHeight ? { rowHeight } : undefined;
      const tile = doc.getTile(tileInfo.tileId);
      const content = tile?.content;
      if (isPlaceholderContent(content)) {
        return { Placeholder: content.sectionId };
      } else {
        const tileExport = doc.exportTileAsJson(tileInfo, doc.tileMap, { ...rowHeightOption });
        return tileExport && prepareTileForMatch(JSON.parse(tileExport));
      }
    });
    if (row?.isSectionHeader) {
      if (tileExports?.length) {
        throw new Error("Header row should not have any tiles");
      }
      return { Header: row.sectionId };
    } else if (tileExports?.length) {
      if (tileExports.length > 1) {
        // multiple tiles in a row are exported in an array
        return tileExports;
      } else if (tileExports[0]) {
        // single tile rows are exported directly
        return tileExports[0];
      }
    } else {
      return "Empty Row that isn't a section header";
    }
  });

}

