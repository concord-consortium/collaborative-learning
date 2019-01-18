import { types, Instance, SnapshotIn, getSnapshot } from "mobx-state-tree";
import { DataSet } from "../data/data-set";
import { defaultDrawingContent, kDrawingDefaultHeight, StampModelType } from "../tools/drawing/drawing-content";
import { defaultGeometryContent, kGeometryDefaultHeight } from "../tools/geometry/geometry-content";
import { defaultImageContent } from "../tools/image/image-content";
import { defaultTextContent } from "../tools/text/text-content";
import { ToolContentUnionType } from "../tools/tool-types";
import { ToolTileModel, ToolTileSnapshotOutType } from "../tools/tool-tile";
import { TileRowModel, TileRowModelType, TileRowSnapshotType, TileRowSnapshotOutType } from "../document/tile-row";
import { cloneDeep, each } from "lodash";
import * as uuid from "uuid/v4";
import { Logger, LogEventName } from "../../lib/logger";
import { DocumentsModelType } from "../stores/documents";
import { getParentWithTypeName } from "../../utilities/mst-utils";
import { IDropRowInfo } from "../../components/document/document-content";

export interface NewRowOptions {
  rowHeight?: number;
  rowIndex?: number;
  action?: LogEventName;
  loggingMeta?: {};
}

export interface INewRowTile {
  rowId: string;
  tileId: string;
}

export const DocumentContentModel = types
  .model("DocumentContent", {
    rowMap: types.map(TileRowModel),
    rowOrder: types.array(types.string),
    tileMap: types.map(ToolTileModel),
    // data shared between tools
    shared: types.maybe(DataSet)
  })
  .preProcessSnapshot(snapshot => {
    return snapshot && (snapshot as any).tiles
            ? migrateSnapshot(snapshot)
            : snapshot;
  })
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
        return self.tileMap.get(tileId);
      },
      getRow(rowId: string) {
        return self.rowMap.get(rowId);
      },
      getRowByIndex(index: number) {
        return self.rowMap.get(self.rowOrder[index]);
      },
      findRowContainingTile(tileId: string) {
        return self.rowOrder.find(rowId => rowContainsTile(rowId, tileId));
      },
      numTilesInRow(rowId: string) {
        const row = self.rowMap.get(rowId);
        return row ? row.tiles.length : 0;
      },
      publish() {
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

        return JSON.stringify(snapshot);
      }
    };
  })
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
    }
  }))
  .actions(self => ({
    addTileInNewRow(content: ToolContentUnionType, options?: NewRowOptions): INewRowTile {
      const tile = ToolTileModel.create({ content });
      const o = options || {};
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
  }))
  .actions((self) => ({
    addGeometryTile(addSidecarNotes?: boolean) {
      const result = self.addTileInNewRow(defaultGeometryContent(),
                                          { rowHeight: kGeometryDefaultHeight });
      const { rowId } = result;
      const row = self.rowMap.get(rowId);
      const tile = ToolTileModel.create({ content: defaultTextContent() });
      self.tileMap.put(tile);
      row!.insertTileInRow(tile, 1);
      return result;
    },
    addTextTile(initialText?: string) {
      return self.addTileInNewRow(defaultTextContent(initialText));
    },
    addImageTile() {
      return self.addTileInNewRow(defaultImageContent());
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
      const srcRowIndex = self.rowOrder.findIndex(rowId => rowId === srcRowId);
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
