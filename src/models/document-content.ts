import { types, Instance, SnapshotIn, getSnapshot } from "mobx-state-tree";
import { DataSet } from "./data/data-set";
import { defaultGeometryContent, kGeometryDefaultHeight } from "./tools/geometry/geometry-content";
import { defaultImageContent } from "./tools/image/image-content";
import { defaultTextContent } from "./tools/text/text-content";
import { ToolContentUnionType } from "./tools/tool-types";
import { ToolTileModel } from "./tools/tool-tile";
import { TileRowModel, TileRowModelType, TileRowSnapshotType } from "./document/tile-row";
import { cloneDeep } from "lodash";

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
    return {
      get isEmpty() {
        return self.tileMap.size === 0;
      }
    };
  })
  .actions(self => ({
    addTileInNewRow(content: ToolContentUnionType, rowHeight?: number) {
      const tile = ToolTileModel.create({ content });
      const rowSpec: TileRowSnapshotType = { tiles: [{ tileId: tile.id }] };
      if (rowHeight) {
        rowSpec.height = rowHeight;
      }
      const row = TileRowModel.create(rowSpec);
      self.tileMap.put(tile);
      self.rowMap.put(row);
      self.rowOrder.push(row.id);
      return tile.id;
    }
  }))
  .actions((self) => ({
    addGeometryTile() {
      return self.addTileInNewRow(defaultGeometryContent(), kGeometryDefaultHeight);
    },
    addTextTile(initialText?: string) {
      return self.addTileInNewRow(defaultTextContent(initialText));
    },
    addImageTile() {
      return self.addTileInNewRow(defaultImageContent());
    },
    deleteTile(tileId: string) {
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
    docContent.addTileInNewRow(newTile.content, tileHeight);
  });
  return getSnapshot(docContent);
}

export type DocumentContentModelType = Instance<typeof DocumentContentModel>;
export type DocumentContentSnapshotType = SnapshotIn<typeof DocumentContentModel>;
