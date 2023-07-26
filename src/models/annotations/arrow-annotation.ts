import { Instance, types } from "mobx-state-tree";

import { ClueObjectModel } from "./clue-object";

export const ArrowAnnotation = types
.model("ArrowAnnotation", {
  sourceObject: types.maybe(ClueObjectModel),
  targetObject: types.maybe(ClueObjectModel)
})
.actions(self => ({
  setSourceObject(tileId: string, objectId: string, objectType?: string) {
    self.sourceObject = ClueObjectModel.create({ tileId, objectId, objectType });
  },
  setTargetObject(tileId: string, objectId: string, objectType?: string) {
    self.targetObject = ClueObjectModel.create({ tileId, objectId, objectType });
  }
}));
export type ArrowAnnotationType = Instance<typeof ArrowAnnotation>;
