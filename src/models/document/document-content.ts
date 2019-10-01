import { types, getSnapshot, Instance, SnapshotIn, SnapshotOut } from "mobx-state-tree";
import { defaultDrawingContent, kDrawingDefaultHeight, StampModelType } from "../tools/drawing/drawing-content";
import { defaultGeometryContent, kGeometryDefaultHeight, GeometryContentModelType, mapTileIdsInGeometrySnapshot
        } from "../tools/geometry/geometry-content";
import { defaultImageContent } from "../tools/image/image-content";
import { defaultTableContent, kTableDefaultHeight, TableContentModelType, mapTileIdsInTableSnapshot
        } from "../tools/table/table-content";
import { defaultTextContent } from "../tools/text/text-content";
import { ToolContentUnionType } from "../tools/tool-types";
import { createToolTileModelFromContent, ToolTileModel, ToolTileSnapshotOutType } from "../tools/tool-tile";
import { TileRowModel, TileRowModelType, TileRowSnapshotType, TileRowSnapshotOutType } from "../document/tile-row";
import { cloneDeep, each } from "lodash";
import * as uuid from "uuid/v4";
import { Logger, LogEventName } from "../../lib/logger";
import { DocumentsModelType } from "../stores/documents";
import { getParentWithTypeName } from "../../utilities/mst-utils";
import { IDropRowInfo } from "../../components/document/document-content";
import { DocumentTool, IDocumentAddTileOptions } from "./document";

export interface NewRowOptions {
  rowHeight?: number;
  rowIndex?: number;
  action?: LogEventName;
  loggingMeta?: {};
}

export interface INewRowTile {
  rowId: string;
  tileId: string;
  additionalTileIds?: string[];
}

export interface IDocumentContentAddTileOptions extends IDocumentAddTileOptions {
  insertRowInfo?: IDropRowInfo;
}

export const DocumentContentModel = types
  .model("DocumentContent", {
    rowMap: types.map(TileRowModel),
    rowOrder: types.array(types.string),
    tileMap: types.map(ToolTileModel),
  })
  .preProcessSnapshot(snapshot => {
    return snapshot && (snapshot as any).tiles
            ? migrateSnapshot(snapshot)
            : snapshot;
  })
  .volatile(self => ({
    visibleRows: [] as string[],
    highlightPendingDropLocation: -1
  }))
  .views(self => {
    // used for drag/drop self-drop detection, for instance
    const contentId = uuid();

    function rowContainsTile(rowId: string, tileId: string) {
      const row = self.rowMap.get(rowId);
      return row
              ? row.tiles.findIndex(tile => tile.tileId === tileId) >= 0
              : false;
    }

    return {
      get isEmpty() {
        return self.tileMap.size === 0;
      },
      get contentId() {
        return contentId;
      },
      getTile(tileId: string) {
        return tileId ? self.tileMap.get(tileId) : undefined;
      },
      getTileContent(tileId: string): ToolContentUnionType | undefined {
        const tile = self.tileMap.get(tileId);
        return tile && tile.content;
      },
      getRow(rowId: string) {
        return self.rowMap.get(rowId);
      },
      getRowByIndex(index: number) {
        return self.rowMap.get(self.rowOrder[index]);
      },
      getRowIndex(rowId: string) {
        return self.rowOrder.findIndex(_rowId => _rowId === rowId);
      },
      findRowContainingTile(tileId: string) {
        return self.rowOrder.find(rowId => rowContainsTile(rowId, tileId));
      },
      numTilesInRow(rowId: string) {
        const row = self.rowMap.get(rowId);
        return row ? row.tiles.length : 0;
      },
      getLastVisibleRow() {
        // returns last visible row or last row
        const lastVisibleRowId = self.visibleRows.length
          ? self.visibleRows[self.visibleRows.length - 1]
          : self.rowOrder[self.rowOrder.length - 1];
        return  self.rowOrder.indexOf(lastVisibleRowId);
      },
      snapshotWithUniqueIds() {
        const snapshot = cloneDeep(getSnapshot(self));
        const idMap: { [id: string]: string } = {};

        snapshot.tileMap = (tileMap => {
          const _tileMap: { [id: string]: ToolTileSnapshotOutType } = {};
          each(tileMap, (tile, id) => {
            idMap[id] = tile.id = uuid();
            _tileMap[tile.id] = tile;
          });
          return _tileMap;
        })(snapshot.tileMap);

        each(snapshot.tileMap, (tile, id) => {
          const tileContent = tile.content;
          switch (tileContent.type) {
            case "Geometry":
              const geometryContentSnapshot: SnapshotOut<GeometryContentModelType> = tileContent;
              mapTileIdsInGeometrySnapshot(geometryContentSnapshot, idMap);
              break;
            case "Table":
              const tableContentSnapshot: SnapshotOut<TableContentModelType> = tileContent;
              mapTileIdsInTableSnapshot(tableContentSnapshot, idMap);
              break;
          }
        });

        snapshot.rowMap = (rowMap => {
          const _rowMap: { [id: string]: TileRowSnapshotOutType } = {};
          each(rowMap, (row, id) => {
            idMap[id] = row.id = uuid();
            row.tiles = row.tiles.map(tileLayout => {
              tileLayout.tileId = idMap[tileLayout.tileId];
              return tileLayout;
            });
            _rowMap[row.id] = row;
          });
          return _rowMap;
        })(snapshot.rowMap);

        snapshot.rowOrder = snapshot.rowOrder.map(rowId => idMap[rowId]);

        return snapshot;
      }
    };
  })
  .views(self => ({
    publish() {
      return JSON.stringify(self.snapshotWithUniqueIds());
    }
  }))
  .actions(self => ({
    afterCreate() {
      self.rowMap.forEach(row => {
        row.updateLayout(self.tileMap);
      });
    },
    insertRow(row: TileRowModelType, index?: number) {
      self.rowMap.put(row);
      if ((index != null) && (index < self.rowOrder.length)) {
        self.rowOrder.splice(index, 0, row.id);
      }
      else {
        self.rowOrder.push(row.id);
      }
    },
    deleteRow(rowId: string) {
      self.rowOrder.remove(rowId);
      self.rowMap.delete(rowId);
    },
    setVisibleRows(rows: string[]) {
      self.visibleRows = rows;
    }
  }))
  .actions(self => ({
    addTileInNewRow(content: ToolContentUnionType, options?: NewRowOptions): INewRowTile {
      const tile = createToolTileModelFromContent(content);
      const o = options || {};
      if (o.rowIndex === undefined) {
        // by default, insert new tiles after last visible on screen
        o.rowIndex = self.getLastVisibleRow() + 1;
      }
      const row = TileRowModel.create();
      row.insertTileInRow(tile);
      if (o.rowHeight) {
        row.setRowHeight(o.rowHeight);
      }
      self.tileMap.put(tile);
      self.insertRow(row, o.rowIndex);

      const action = o.action || LogEventName.CREATE_TILE;
      Logger.logTileEvent(action, tile, o.loggingMeta);

      return { rowId: row.id, tileId: tile.id };
    },
    highlightLastVisibleRow(show: boolean) {
      if (!show) {
        self.highlightPendingDropLocation = -1;
      } else {
        self.highlightPendingDropLocation = self.getLastVisibleRow();
      }
    }
  }))
  .actions((self) => ({
    addGeometryTile(addSidecarNotes?: boolean) {
      const result = self.addTileInNewRow(defaultGeometryContent(),
                                          { rowHeight: kGeometryDefaultHeight });
      if (addSidecarNotes) {
        const { rowId } = result;
        const row = self.rowMap.get(rowId);
        const tile = createToolTileModelFromContent(defaultTextContent());
        self.tileMap.put(tile);
        row!.insertTileInRow(tile, 1);
        result.additionalTileIds = [ tile.id ];
      }
      return result;
    },
    addTableTile() {
      return self.addTileInNewRow(defaultTableContent(),
                                    { rowHeight: kTableDefaultHeight });
    },
    addTextTile(initialText?: string) {
      return self.addTileInNewRow(defaultTextContent(initialText));
    },
    addImageTile(url?: string) {
      return self.addTileInNewRow(defaultImageContent(url));
    },
    addDrawingTile() {
      let defaultStamps: StampModelType[];
      const documents = getParentWithTypeName(self, "Documents") as DocumentsModelType;
      if (documents && documents.unit) {
        defaultStamps = getSnapshot(documents.unit.defaultStamps);
      } else {
        defaultStamps = [];
      }
      return self.addTileInNewRow(defaultDrawingContent({stamps: defaultStamps}),
                                  { rowHeight: kDrawingDefaultHeight });
    },
    copyTileIntoRow(serializedTile: string, originalTileId: string, rowIndex: number, originalRowHeight?: number) {
      let snapshot;
      try {
        snapshot = JSON.parse(serializedTile);
      }
      catch (e) {
        snapshot = null;
      }
      if (snapshot) {
        const newRowOptions: NewRowOptions = {
          rowIndex,
          action: LogEventName.COPY_TILE,
          loggingMeta: {
            originalTileId
          }
        };
        if (originalRowHeight) {
          newRowOptions.rowHeight = originalRowHeight;
        }
        self.addTileInNewRow(snapshot.content, newRowOptions);
      }
    },
    deleteTile(tileId: string) {
      Logger.logTileEvent(LogEventName.DELETE_TILE, self.tileMap.get(tileId));

      const rowsToDelete: TileRowModelType[] = [];
      self.rowMap.forEach(row => {
        // remove from row
        if (row.hasTile(tileId)) {
          const tile = self.getTile(tileId);
          tile && tile.willRemoveFromDocument();
          row.removeTileFromRow(tileId);
        }
        // track empty rows
        if (row.tiles.length === 0) {
          rowsToDelete.push(row);
        }
      });
      // remove empty rows
      rowsToDelete.forEach(row => {
        self.deleteRow(row.id);
      });
      // delete tile
      self.tileMap.delete(tileId);
    },
    moveRowToIndex(rowIndex: number, newRowIndex: number) {
      const rowId = self.rowOrder[rowIndex];
      self.rowOrder.splice(rowIndex, 1);
      self.rowOrder.splice(newRowIndex <= rowIndex ? newRowIndex : newRowIndex - 1, 0, rowId);
    },
    moveTileToRow(tileId: string, rowIndex: number, tileIndex?: number) {
      const srcRowId = self.findRowContainingTile(tileId);
      const srcRow = srcRowId && self.rowMap.get(srcRowId);
      const dstRowId = self.rowOrder[rowIndex];
      const dstRow = dstRowId && self.rowMap.get(dstRowId);
      const tile = self.getTile(tileId);
      if (srcRow && dstRow && tile) {
        if (srcRow === dstRow) {
          // move a tile within a row
          const srcIndex = srcRow.indexOfTile(tileId);
          const dstIndex = tileIndex != null ? tileIndex : dstRow.tiles.length;
          dstRow.moveTileInRow(tileId, srcIndex, dstIndex);
        }
        else {
          // move a tile from one row to another
          dstRow.insertTileInRow(tile, tileIndex);
          if (srcRow.height && tile.isUserResizable &&
              (!dstRow.height || (srcRow.height > dstRow.height))) {
            dstRow.height = srcRow.height;
          }
          srcRow.removeTileFromRow(tileId);
          if (!srcRow.tiles.length) {
            self.deleteRow(srcRow.id);
          }
        }
      }
    },
    moveTileToNewRow(tileId: string, rowIndex: number) {
      const srcRowId = self.findRowContainingTile(tileId);
      const srcRow = srcRowId && self.rowMap.get(srcRowId);
      const tile = self.getTile(tileId);
      if (!srcRowId || !srcRow || !tile) return;

      // create tile, insert tile, insert row
      const rowSpec: TileRowSnapshotType = {};
      if (tile.isUserResizable) {
        rowSpec.height = srcRow.height;
      }
      const dstRow = TileRowModel.create(rowSpec);
      dstRow.insertTileInRow(tile);
      self.insertRow(dstRow, rowIndex);

      // remove tile from source row
      srcRow.removeTileFromRow(tileId);
      if (!srcRow.tiles.length) {
        self.deleteRow(srcRowId);
      }
      else {
        if (!srcRow.isUserResizable) {
          srcRow.height = undefined;
        }
      }
    }
  }))
  .actions((self) => ({
    moveTile(tileId: string, rowInfo: IDropRowInfo) {
      const srcRowId = self.findRowContainingTile(tileId);
      if (!srcRowId) return;
      const srcRowIndex = self.getRowIndex(srcRowId);
      const { rowInsertIndex, rowDropIndex, rowDropLocation } = rowInfo;
      if ((rowDropIndex != null) && (rowDropLocation === "left")) {
        self.moveTileToRow(tileId, rowDropIndex, 0);
        return;
      }
      if ((rowDropIndex != null) && (rowDropLocation === "right")) {
        self.moveTileToRow(tileId, rowDropIndex);
        return;
      }
      if ((srcRowIndex >= 0)) {
        // if only one tile in source row, move the entire row
        if (self.numTilesInRow(srcRowId) === 1) {
          if (rowInsertIndex !== srcRowIndex) {
            self.moveRowToIndex(srcRowIndex, rowInsertIndex);
          }
        }
        else {
          self.moveTileToNewRow(tileId, rowInsertIndex);
        }
      }
    }
  }))
  .actions((self) => ({
    addTile(tool: DocumentTool, options?: IDocumentContentAddTileOptions) {
      const {addSidecarNotes, insertRowInfo} = options || {};
      let tileInfo;
      switch (tool) {
        case "text":
          tileInfo = self.addTextTile();
          break;
        case "table":
          tileInfo = self.addTableTile();
          break;
        case "geometry":
          tileInfo = self.addGeometryTile(addSidecarNotes);
          break;
        case "image":
          tileInfo = self.addImageTile(options && options.imageTileUrl);
          break;
        case "drawing":
          tileInfo = self.addDrawingTile();
          break;
      }

      if (tileInfo && insertRowInfo) {
        // Move newly-create tile(s) into requested row. If we have created more than one tile, e.g. the sidecar text
        // for the graph tool, we need to insert the tiles one after the other. If we are inserting on the left, we
        // have to reverse the order of insertion. If we are inserting into a new row, the first tile is inserted into a
        // new row and then the sidecar tiles into that same row. This makes the logic rather verbose...
        const { rowDropLocation } = insertRowInfo;

        let tilesIdsToMove;
        if (tileInfo.additionalTileIds) {
          tilesIdsToMove = [tileInfo.tileId, ...tileInfo.additionalTileIds];
          if (rowDropLocation && rowDropLocation === "left") {
            tilesIdsToMove = tilesIdsToMove.reverse();
          }
        } else {
          tilesIdsToMove = [tileInfo.tileId];
        }

        const moveSubsequentTilesRight = !rowDropLocation || rowDropLocation === "bottom" || rowDropLocation === "top";

        tilesIdsToMove.forEach((id, i) => {
          if (i > 0) {
            if (moveSubsequentTilesRight) {
              insertRowInfo.rowDropLocation = "right";
              if (rowDropLocation === undefined) {
                insertRowInfo.rowDropIndex = 0;
              } else if (rowDropLocation === "bottom") {
                insertRowInfo.rowDropIndex = (insertRowInfo.rowDropIndex || 0) + 1;
              }
            }
          }
          self.moveTile(id, insertRowInfo);
        });
      }

      return tileInfo;
    }
  }));

function migrateSnapshot(snapshot: any): any {
  interface OriginalTileLayoutModel {
    height?: number;
  }

  interface OriginalToolTileModel {
    id: string;
    layout?: OriginalTileLayoutModel;
    content: any;
  }

  const docContent = DocumentContentModel.create();
  const tiles: OriginalToolTileModel[] = snapshot.tiles;
  tiles.forEach(tile => {
    const newTile = cloneDeep(tile);
    const tileHeight = newTile.layout && newTile.layout.height;
    docContent.addTileInNewRow(newTile.content, { rowHeight: tileHeight });
  });
  return getSnapshot(docContent);
}

export type DocumentContentModelType = Instance<typeof DocumentContentModel>;
export type DocumentContentSnapshotType = SnapshotIn<typeof DocumentContentModel>;

export function cloneContentWithUniqueIds(content?: DocumentContentModelType) {
  return content && DocumentContentModel.create(content.snapshotWithUniqueIds());
}
