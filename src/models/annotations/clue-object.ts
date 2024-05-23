import { Instance, SnapshotIn, types } from "mobx-state-tree";

/**
 * This model represents a generic object within a CLUE tile.
 */
export const ClueObjectModel = types
.model("ClueObjectModel", {
  tileId: types.string,
  objectId: types.string,
  objectType: types.maybe(types.string)
});
export interface IClueObject extends Instance<typeof ClueObjectModel> {}
export interface IClueObjectSnapshot extends SnapshotIn<typeof ClueObjectModel> {}

export type IClueTileObject = Pick<IClueObjectSnapshot, "objectId" | "objectType">;

/**
 * A simple model to represent a 2d offset
 */
export const OffsetModel = types
.model("OffsetModel", {
  dx: types.optional(types.number, 0),
  dy: types.optional(types.number, 0)
})
.actions(self => ({
  setDx(dx: number) {
    self.dx = dx;
  },
  setDy(dy: number) {
    self.dy = dy;
  }
}));
export interface IOffsetModel extends Instance<typeof OffsetModel> {}

export interface ObjectBoundingBox {
  left: number;
  top: number;
  height: number;
  width: number;
}
