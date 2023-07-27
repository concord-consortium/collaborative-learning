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
