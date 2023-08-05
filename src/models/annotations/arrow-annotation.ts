import { Instance, types } from "mobx-state-tree";

import { ClueObjectModel } from "./clue-object";
import { uniqueId } from "../../utilities/js-utils";

export const kArrowAnnotationType = "arrowAnnotation";

export const ArrowAnnotation = types
.model("ArrowAnnotation", {
  id: types.optional(types.identifier, () => uniqueId()),
  sourceObject: types.maybe(ClueObjectModel),
  targetObject: types.maybe(ClueObjectModel),
  text: types.maybe(types.string),
  type: types.union(types.literal(kArrowAnnotationType))
})
.actions(self => ({
  setSourceObject(tileId: string, objectId: string, objectType?: string) {
    self.sourceObject = ClueObjectModel.create({ tileId, objectId, objectType });
  },
  setTargetObject(tileId: string, objectId: string, objectType?: string) {
    self.targetObject = ClueObjectModel.create({ tileId, objectId, objectType });
  },
  setText(text: string) {
    self.text = text;
  }
}));
export interface IArrowAnnotation extends Instance<typeof ArrowAnnotation> {}
