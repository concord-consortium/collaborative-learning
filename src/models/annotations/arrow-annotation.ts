import { Instance, SnapshotIn, types } from "mobx-state-tree";

import { boundDelta } from "./annotation-utils";
import { ClueObjectModel, ObjectBoundingBox, OffsetModel } from "./clue-object";
import { uniqueId } from "../../utilities/js-utils";

export const kArrowAnnotationType = "arrowAnnotation";

export function isArrowAnnotationSnapshot(snapshot: any): snapshot is IArrowAnnotationSnapshot {
  return "type" in snapshot && snapshot.type === kArrowAnnotationType;
}

export function updateArrowAnnotationTileIds(annotation: IArrowAnnotationSnapshot, tileIdMap: Record<string, string>) {
  if (annotation.sourceObject?.tileId && annotation.sourceObject.tileId in tileIdMap) {
    annotation.sourceObject.tileId = tileIdMap[annotation.sourceObject.tileId];
  }
  if (annotation.targetObject?.tileId && annotation.targetObject.tileId in tileIdMap) {
    annotation.targetObject.tileId = tileIdMap[annotation.targetObject.tileId];
  }
  return annotation;
}

export const kArrowAnnotationTextWidth = 150;
export const kArrowAnnotationTextHeight = 50;
const kArrowAnnotationTextMargin = 15;
export const kTextHorizontalMargin = kArrowAnnotationTextMargin + kArrowAnnotationTextWidth / 4;
export const kTextVerticalMargin = kArrowAnnotationTextMargin + kArrowAnnotationTextHeight / 2;

export interface IArrowAnnotationDragOffsets {
  sourceDragOffsetX: number;
  sourceDragOffsetY: number;
  targetDragOffsetX: number;
  targetDragOffsetY: number;
  textDragOffsetX: number;
  textDragOffsetY: number;
}

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
}))
.views(self => ({
  getPoints(
    documentLeft: number, documentRight: number, documentTop: number, documentBottom: number,
    dragOffsets: IArrowAnnotationDragOffsets, sourceBB?: ObjectBoundingBox|null, targetBB?: ObjectBoundingBox|null
  ) {
    if (!sourceBB || !targetBB) {
      return {
        sourceX: undefined, sourceY: undefined, targetX: undefined, targetY: undefined,
        textX: undefined, textY: undefined, textCenterX: undefined, textCenterY: undefined
      };
    }

    const {
      sourceDragOffsetX, sourceDragOffsetY, targetDragOffsetX, targetDragOffsetY, textDragOffsetX, textDragOffsetY
    } = dragOffsets;
  
    // Find positions for head and tail of arrow
    const [sDxOffset, sDyOffset] = self.sourceOffset ? [self.sourceOffset.dx, self.sourceOffset.dy] : [0, 0];
    const sourceX = sourceBB.left + sourceBB.width / 2 + boundDelta(sDxOffset + sourceDragOffsetX, sourceBB.width);
    const sourceY = sourceBB.top + sourceBB.height / 2 + boundDelta(sDyOffset + sourceDragOffsetY, sourceBB.height);
    const [tDxOffset, tDyOffset] = self.targetOffset ? [self.targetOffset.dx, self.targetOffset.dy] : [0, 0];
    const targetX = targetBB.left + targetBB.width / 2 + boundDelta(tDxOffset + targetDragOffsetX, targetBB.width);
    const targetY = targetBB.top + targetBB.height / 2 + boundDelta(tDyOffset + targetDragOffsetY, targetBB.height);
  
    // Set up text location
    const [textDxOffset, textDyOffset] = self.textOffset ? [self.textOffset.dx, self.textOffset.dy] : [0, 0];
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const textOriginX = targetX - dx / 2;
    const textOriginY = targetY - dy / 2;
    // Bound the text offset to the document
    const textMinXOffset = documentLeft + kTextHorizontalMargin - textOriginX;
    const textMaxXOffset = documentRight - kTextHorizontalMargin - textOriginX;
    const textMinYOffset = documentTop + kTextVerticalMargin - textOriginY;
    const textMaxYOffset = documentBottom - kTextVerticalMargin - textOriginY;
    const textCenterX = textOriginX
      + Math.max(textMinXOffset, Math.min(textMaxXOffset, textDxOffset + textDragOffsetX));
    const textCenterY = textOriginY
      + Math.max(textMinYOffset, Math.min(textMaxYOffset, textDyOffset + textDragOffsetY));
    const textX = textCenterX - kArrowAnnotationTextWidth / 2;
    const textY = textCenterY - kArrowAnnotationTextHeight / 2;

    return {
      sourceX, sourceY, targetX, targetY, textX, textY, textCenterX, textCenterY,
      textOriginX, textOriginY, textMinXOffset, textMaxXOffset, textMinYOffset, textMaxYOffset
    };
  }
}));
export interface IArrowAnnotation extends Instance<typeof ArrowAnnotation> {}
export interface IArrowAnnotationSnapshot extends SnapshotIn<typeof ArrowAnnotation> {}
