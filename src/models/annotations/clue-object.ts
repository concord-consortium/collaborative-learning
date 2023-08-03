import { Instance, types } from "mobx-state-tree";

/**
 * This model represents a generic object within a CLUE tile.
 */
export const ClueObjectModel = types
.model("ClueObjectModel", {
  tileId: types.string,
  objectId: types.string,
  objectType: types.maybe(types.string)
});
export type ClueObjectType = Instance<typeof ClueObjectModel>;

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

export interface ObjectBoundingBox {
  height: number;
  left: number;
  top: number;
  width: number;
}
