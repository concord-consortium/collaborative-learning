import { types, Instance, SnapshotIn } from "mobx-state-tree";
import * as uuid from "uuid/v4";
import { ToolTileModelType } from "../tools/tool-tile";

export const TileLayoutModel = types
  .model("TileLayout", {
    tileId: types.string,
    widthPct: types.maybe(types.number)
  });

export const TileRowModel = types
  .model("TileRow", {
    id: types.optional(types.identifier, () => uuid()),
    height: types.maybe(types.number),
    tiles: types.array(TileLayoutModel)
  })
  .views(self => ({
    isUserResizable(tileMap: any) {
      return self.tiles.every(tileLayout => {
        const tile: ToolTileModelType = tileMap.get(tileLayout.tileId);
        return tile && tile.isUserResizable;
      });
    }
  }))
  .actions(self => ({
    // undefined height == default to content height
    setRowHeight(height?: number) {
      self.height = height;
    }
  }));

export type TileRowModelType = Instance<typeof TileRowModel>;
export type TileRowSnapshotType = SnapshotIn<typeof TileRowModel>;
