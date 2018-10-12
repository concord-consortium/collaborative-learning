import { types, Instance, SnapshotIn, getSnapshot } from "mobx-state-tree";
import { DataSet } from "./data/data-set";
import { defaultGeometryContent, kGeometryDefaultHeight } from "./tools/geometry/geometry-content";
import { defaultImageContent } from "./tools/image/image-content";
import { defaultTextContent } from "./tools/text/text-content";
import { ToolContentUnionType } from "./tools/tool-types";
import { ToolTileModel } from "./tools/tool-tile";
import { TileRowModel, TileRowModelType, TileRowSnapshotType } from "./document/tile-row";
import { cloneDeep } from "lodash";
import * as uuid from "uuid/v4";
import { Logger, LogEventName } from "../lib/logger";

export interface NewRowOptions {
  rowHeight?: number;
  rowIndex?: number;
  action?: LogEventName;
  loggingMeta?: {};
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
      findRowContainingTile(tileId: string) {
        return self.rowOrder.find(rowId => rowContainsTile(rowId, tileId));
      }
    };
  })
  .actions(self => ({
    addTileInNewRow(content: ToolContentUnionType, options?: NewRowOptions) {
      const tile = ToolTileModel.create({ content });
      const o = options || {};
      const rowSpec: TileRowSnapshotType = { tiles: [{ tileId: tile.id }] };
      if (o.rowHeight) {
        rowSpec.height = o.rowHeight;
      }
      const row = TileRowModel.create(rowSpec);
      self.tileMap.put(tile);
      self.rowMap.put(row);
      if ((o.rowIndex != null) && (o.rowIndex < self.rowOrder.length)) {
        self.rowOrder.splice(o.rowIndex, 0, row.id);
      }
      else {
        self.rowOrder.push(row.id);
      }

      const action = o.action || LogEventName.CREATE_TILE;
      Logger.logTileEvent(action, tile, o.loggingMeta);

      return tile.id;
    },
    moveRowToIndex(rowIndex: number, newRowIndex: number) {
      const rowId = self.rowOrder[rowIndex];
      self.rowOrder.splice(rowIndex, 1);
      self.rowOrder.splice(newRowIndex <= rowIndex ? newRowIndex : newRowIndex - 1, 0, rowId);
    }
  }))
  .actions((self) => ({
    addGeometryTile() {
      return self.addTileInNewRow(defaultGeometryContent(),
                                  { rowHeight: kGeometryDefaultHeight });
    },
    addTextTile(initialText?: string) {
      return self.addTileInNewRow(defaultTextContent(initialText));
    },
    addImageTile() {
      return self.addTileInNewRow(defaultImageContent());
    },
    deleteTile(tileId: string) {
      Logger.logTileEvent(LogEventName.DELETE_TILE, self.tileMap.get(tileId));

      const rowsToDelete: TileRowModelType[] = [];
      self.rowMap.forEach(row => {
        // remove from row
        if (row.tiles.findIndex(tile => tile.tileId === tileId) >= 0) {
          row.tiles.replace(row.tiles.filter(tile => tile.tileId !== tileId));
        }
        // remove empty rows
        if (row.tiles.length === 0) {
          rowsToDelete.push(row);
        }
      });
      // remove empty rows
      rowsToDelete.forEach(row => {
        self.rowOrder.remove(row.id);
        self.rowMap.delete(row.id);
      });
      // delete tile
      self.tileMap.delete(tileId);
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
