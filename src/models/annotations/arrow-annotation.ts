import { Instance, types } from "mobx-state-tree";

import { ClueObjectModel, OffsetModel } from "./clue-object";
import { uniqueId } from "../../utilities/js-utils";

export const kArrowAnnotationType = "arrowAnnotation";

export const ArrowAnnotation = types
.model("ArrowAnnotation", {
  id: types.optional(types.identifier, () => uniqueId()),
  sourceObject: types.maybe(ClueObjectModel),
  sourceOffset: types.maybe(OffsetModel),
  targetObject: types.maybe(ClueObjectModel),
  targetOffset: types.maybe(OffsetModel),
  text: types.maybe(types.string),
  textOffset: types.maybe(OffsetModel),
  type: types.optional(types.literal(kArrowAnnotationType), kArrowAnnotationType)
})
.volatile(self => ({
  isNew: false
}))
.actions(self => ({
  setSourceObject(tileId: string, objectId: string, objectType?: string) {
    self.sourceObject = ClueObjectModel.create({ tileId, objectId, objectType });
  },
  setSourceOffset(dx: number, dy: number) {
    if (!self.sourceOffset) {
      self.sourceOffset = OffsetModel.create({ dx, dy });
    } else {
      self.sourceOffset.setDx(dx);
      self.sourceOffset.setDy(dy);
    }
  },
  setTargetObject(tileId: string, objectId: string, objectType?: string) {
    self.targetObject = ClueObjectModel.create({ tileId, objectId, objectType });
  },
  setTargetOffset(dx: number, dy: number) {
    if (!self.targetOffset) {
      self.targetOffset = OffsetModel.create({ dx, dy });
    } else {
      self.targetOffset.setDx(dx);
      self.targetOffset.setDy(dy);
    }
  },
  setText(text: string) {
    self.text = text;
  },
  setTextOffset(dx: number, dy: number) {
    if (!self.textOffset) {
      self.textOffset = OffsetModel.create({ dx, dy });
    } else {
      self.textOffset.setDx(dx);
      self.textOffset.setDy(dy);
    }
  },
  setIsNew(_new: boolean) {
    self.isNew = _new;
  }
}));
export interface IArrowAnnotation extends Instance<typeof ArrowAnnotation> {}
