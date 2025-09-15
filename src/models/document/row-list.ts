import { Instance, types, detach, SnapshotIn, SnapshotOut } from "mobx-state-tree";
import { StringBuilder, comma } from "../../utilities/string-builder";
import { getTileContentInfo, IDocumentExportOptions } from "../tiles/tile-content-info";
import { ITileModel } from "../tiles/tile-model";
import { TileLayoutModelType, TileRowModel, TileRowModelType } from "./tile-row";

/**
 * Base model for managing a list of rows.
 * This is extracted from BaseDocumentContentModel to provide reusable row management functionality.
 */
export const RowList = types
  .model("RowList", {
    rowMap: types.map(TileRowModel),
    rowOrder: types.array(types.string),
  })
  .views(self => ({
    get rowCount() {
      return self.rowOrder.length;
    },
    getRow(rowId: string): TileRowModelType | undefined {
      return self.rowMap.get(rowId);
    },
    getRowByIndex(index: number): TileRowModelType | undefined {
      return self.rowOrder.length > index ? self.rowMap.get(self.rowOrder[index]) : undefined;
    },
    getRowIndex(rowId: string) {
      return self.rowOrder.findIndex(_rowId => _rowId === rowId);
    },
    /**
     * Returns the index of the last visible row in this RowList.
     * If no visible rows are found, returns the index of the last row.
     */
    getIndexOfLastVisibleRow(visibleRows: string[]) {
      if (!self.rowOrder.length) return -1;
      // Iterate over the visible rows in reverse order to find the last one
      for (let i = visibleRows.length - 1; i >= 0; i--) {
        const rowId = visibleRows[i];
        if (self.rowOrder.includes(rowId)) {
          return self.rowOrder.indexOf(rowId);
        }
      }
      // If no visible rows are found, return the last row in the rowOrder
      return self.rowOrder.length - 1;
    },
    /**
     * Returns all tile ids directly in this RowList container.
     * Does not include tile ids from nested RowList containers.
     */
    get tileIds() {
      return self.rowOrder.flatMap(rowId => this.getRow(rowId)?.tileIds ?? []);
    },
    /**
     * Returns the tile ids in each row as map of row ids to an array of tile ids.
     */
    get orderedTileIds() {
      return self.rowOrder.reduce<Record<string, string[]>>((acc, rowId) => {
        acc[rowId] = this.getRow(rowId)?.tileIds ?? [];
        return acc;
      }, {});
    },
    rowHeightToExport(row: TileRowModelType, tileId: string, tileMap: Map<string|number, ITileModel>) {
      if (!row?.height) return;
      // we only export heights for specific tiles configured to do so
      const tileType = tileMap.get(tileId)?.content.type;
      const tileContentInfo = getTileContentInfo(tileType);
      if (!tileContentInfo?.exportNonDefaultHeight) return;
      // we only export heights when they differ from the default height for the tile
      const defaultHeight = tileContentInfo.defaultHeight;
      return defaultHeight && (row.height !== defaultHeight) ? row.height : undefined;
    },
    exportTileAsJson(tileInfo: TileLayoutModelType, tileMap: Map<string|number, ITileModel>,
        options?: IDocumentExportOptions) {
      const { includeTileIds, ...otherOptions } = options || {};
      const tileOptions = { includeId: includeTileIds, ...otherOptions};
      const tile = tileMap.get(tileInfo.tileId);
      const json = tile?.exportJson(tileOptions, tileMap);
      if (json) {
        return json;
      }
    },
    exportableRows(tileMap: Map<string|number, ITileModel>) {
      // identify rows with exportable tiles
      return self.rowOrder.map(rowId => {
        const row = this.getRow(rowId);
        return row && !row.isSectionHeader && !row.isEmpty && !row.isPlaceholderRow(tileMap) ? row : undefined;
      }).filter(row => !!row);
    },
    exportRowsAsJson(rows: (TileRowModelType | undefined)[], tileMap: Map<string|number, ITileModel>,
        options?: IDocumentExportOptions) {
      const builder = new StringBuilder();
      builder.pushLine(`"tiles": [`);

      const exportRowCount = rows.length;
      rows.forEach((row, rowIndex) => {
        const isLastRow = rowIndex === exportRowCount - 1;
        // export each exportable tile
        const tileExports = row?.tiles.map((tileInfo, tileIndex) => {
          const isLastTile = tileIndex === row.tiles.length - 1;
          const showComma = row.tiles.length > 1 ? !isLastTile : !isLastRow;
          const rowHeight = this.rowHeightToExport(row, tileInfo.tileId, tileMap);
          const rowHeightOption = rowHeight ? { rowHeight } : undefined;
          return this.exportTileAsJson(tileInfo, tileMap, { ...options, appendComma: showComma, ...rowHeightOption });
        }).filter(json => !!json);
        if (tileExports?.length) {
          // multiple tiles in a row are exported in an array
          if (tileExports.length > 1) {
            builder.pushLine("[", 2);
            tileExports.forEach(tileExport => {
              tileExport && builder.pushBlock(tileExport, 4);
            });
            builder.pushLine(`]${comma(!isLastRow)}`, 2);
          }
          // single tile rows are exported directly
          else if (tileExports[0]) {
            builder.pushBlock(tileExports[0], 2);
          }
        }
      });
      builder.pushLine(`]${comma(options?.appendComma ?? false)}`, 0);
      return builder.build();
    },
    // Returns a string that describes the row list and its contents.
    // For testing/debugging purposes only, but may be useful to keep.
    debugDescribeThis(tileMap: Map<string|number, ITileModel>, indent: string): string {
      return self.rowOrder.map(rowId => {
        const row = self.rowMap.get(rowId);
        const embedded: RowListType[] = [];
        if (row) {
          return indent + row.id + ": " +
            row?.tiles.map(tileLayout => {
              const tile = tileMap.get(tileLayout.tileId);
              if (tile?.content && isRowListContainer(tile.content)) {
                embedded.push(tile.content);
              }
              return "[" + (tile?.content.type || "No type") + ": " + tile?.id + "]";
            }).join(" ") +
            embedded.map(rowList => {
              return "\n" + indent + "Contents of embedded row list:\n"
              + rowList.debugDescribeThis(tileMap, indent + "  ");
            }).join("\n");
        } else {
          return indent + "[" + rowId + " (nonexistent)]";
        }
      }).join("\n");
    },
  }))
  .actions(self => ({
    insertRow(row: TileRowModelType, index?: number) {
      self.rowMap.put(row);
      if ((index != null) && (index < self.rowOrder.length)) {
        self.rowOrder.splice(index, 0, row.id);
      }
      else {
        self.rowOrder.push(row.id);
      }
    },
    // Deletes the row, and returns its content as a detached object.
    deleteRow(rowId: string) {
      const existingRow = self.rowMap.get(rowId);
      if (existingRow) {
        const row = detach(existingRow);
        self.rowOrder.remove(rowId);
        self.rowMap.delete(rowId);
        return row;
      }
    },
  }))
  .actions(self => ({
    addRowWithTiles(tiles: ITileModel[]) {
      const row = TileRowModel.create({});
      tiles.forEach(tile => row.insertTileInRow(tile));
      self.insertRow(row);
    },
    addNewTileInNewRowAtIndex(tile: ITileModel, rowIndex: number) {
      const row = TileRowModel.create({});
      self.insertRow(row, rowIndex);
      row.insertTileInRow(tile);
      return row;
    }
  }));

export type RowListType = Instance<typeof RowList>;
export type RowListSnapshotIn = SnapshotIn<typeof RowList>
export type RowListSnapshotOut = SnapshotOut<typeof RowList>

export function isRowListContainer(model: any): model is RowListType {
  if (!model) return false;
  // Check if the model has the required RowList properties
  return typeof model.rowMap !== 'undefined' &&
         typeof model.rowOrder !== 'undefined' &&
         Array.isArray(model.rowOrder);
}

export function isRowListSnapshotIn(model: any): model is RowListSnapshotIn {
  return typeof model.rowMap !== 'undefined' &&
         typeof model.rowOrder !== 'undefined' &&
         Array.isArray(model.rowOrder);
}

export function isRowListSnapshotOut(model: any): model is RowListSnapshotOut {
  return typeof model.rowMap !== 'undefined' &&
         typeof model.rowOrder !== 'undefined' &&
         Array.isArray(model.rowOrder);
}
