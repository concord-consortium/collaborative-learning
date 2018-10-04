import { types, Instance, SnapshotIn } from "mobx-state-tree";
import * as uuid from "uuid/v4";

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
  });

export type TileRowModelType = Instance<typeof TileRowModel>;
export type TileRowSnapshotType = SnapshotIn<typeof TileRowModel>;
