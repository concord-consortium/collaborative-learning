import { Instance, SnapshotIn, types } from "mobx-state-tree";
import { boundDelta, boundingBoxCenter } from "./annotation-utils";
import { ClueObjectModel, ObjectBoundingBox, OffsetModel } from "./clue-object";
import { uniqueId } from "../../utilities/js-utils";
import { LogEventName } from "../../../src/lib/logger-types";
import { logSparrowTitleChange } from "../tiles/log/log-sparrow-event";
import { constrainToLine } from "../../components/annotations/annotation-utilities";

export const kArrowAnnotationType = "arrowAnnotation";

export enum ArrowShape {
  straight = "straight",
  curved = "curved"
}

export function isArrowShape(value: string|undefined): value is ArrowShape {
  return value ? value in ArrowShape : false;
}

export function isArrowAnnotationSnapshot(snapshot: any): snapshot is IArrowAnnotationSnapshot {
  return "type" in snapshot && snapshot.type === kArrowAnnotationType;
}

export function updateArrowAnnotationTileIds(annotation: IArrowAnnotationSnapshot, tileIdMap: Record<string, string>) {
  if (annotation.sourceObject?.tileId && annotation.sourceObject.tileId in tileIdMap) {
    annotation.sourceObject.tileId = tileIdMap[annotation.sourceObject.tileId] ?? "";
  }
  if (annotation.targetObject?.tileId && annotation.targetObject.tileId in tileIdMap) {
    annotation.targetObject.tileId = tileIdMap[annotation.targetObject.tileId] ?? "";
  }
  return annotation;
}

function applyViewTransform(x: number, y: number, transform?: { offsetX: number; offsetY: number; scale: number }) {
  if (!transform) return { x, y };
  return {
    x: (x + transform.offsetX) * transform.scale,
    y: (y + transform.offsetY) * transform.scale
  };
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
  shape: types.optional(types.enumeration(Object.values(ArrowShape)), ArrowShape.curved),
  type: types.optional(types.literal(kArrowAnnotationType), kArrowAnnotationType)
})
.volatile(self => ({
  isNew: false,
  isSelected: false
}))
.actions(self => ({
  setSelected(selected: boolean) {
    self.isSelected = selected;
  },
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
    if ((self.text !== text) && text){
      logSparrowTitleChange(LogEventName.SPARROW_TITLE_CHANGE, self.id, text);
    }
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
    dragOffsets: IArrowAnnotationDragOffsets,
    sourceBB?: ObjectBoundingBox|null, sourceViewTransform?: { offsetX: number; offsetY: number; scale: number },
    targetBB?: ObjectBoundingBox|null, targetViewTransform?: { offsetX: number; offsetY: number; scale: number }
  ) {
    const defaultObj = {
      sourceX: undefined, sourceY: undefined, targetX: undefined, targetY: undefined,
      textX: undefined, textY: undefined, textCenterX: undefined, textCenterY: undefined,
      textOriginX: undefined, textOriginY: undefined,
      textMinXOffset: undefined, textMaxXOffset: undefined, textMinYOffset: undefined, textMaxYOffset: undefined
    };

    // Either a source or target object is required.
    if (!sourceBB && !targetBB) return defaultObj;

    const {
      sourceDragOffsetX, sourceDragOffsetY, targetDragOffsetX, targetDragOffsetY, textDragOffsetX, textDragOffsetY
    } = dragOffsets;

    // Find positions for head and tail of arrow
    const sBBcenter = sourceBB ? boundingBoxCenter(sourceBB) : undefined;
    const tBBcenter = targetBB ? boundingBoxCenter(targetBB) : undefined;
    const [sDxOffset, sDyOffset] = self.sourceOffset ? [self.sourceOffset.dx, self.sourceOffset.dy] : [0, 0];
    const [tDxOffset, tDyOffset] = self.targetOffset ? [self.targetOffset.dx, self.targetOffset.dy] : [0, 0];

    let sourceX, sourceY, preDragSourceX, preDragSourceY;
    if (sourceBB && sBBcenter) {
      // Relative to source object
      sourceX = sBBcenter[0] + boundDelta(sDxOffset + sourceDragOffsetX, sourceBB.width);
      sourceY = sBBcenter[1] + boundDelta(sDyOffset + sourceDragOffsetY, sourceBB.height);
      preDragSourceX = sBBcenter[0] + boundDelta(sDxOffset, sourceBB.width);
      preDragSourceY = sBBcenter[1] + boundDelta(sDyOffset, sourceBB.height);
    } else if (tBBcenter) {
      // No source object, so interpret source offsets relative to target object.
      sourceX = tBBcenter[0] + sDxOffset + sourceDragOffsetX;
      sourceY = tBBcenter[1] + sDyOffset + sourceDragOffsetY;
      preDragSourceX = tBBcenter[0] + sDxOffset;
      preDragSourceY = tBBcenter[1] + sDyOffset;
    }

    let targetX, targetY, preDragTargetX, preDragTargetY;
    if (targetBB && tBBcenter) {
      targetX = tBBcenter[0] + boundDelta(tDxOffset + targetDragOffsetX, targetBB.width);
      targetY = tBBcenter[1] + boundDelta(tDyOffset + targetDragOffsetY, targetBB.height);
      preDragTargetX = tBBcenter[0] + boundDelta(tDxOffset, targetBB.width);
      preDragTargetY = tBBcenter[1] + boundDelta(tDyOffset, targetBB.height);
    } else if (sBBcenter) {
      // No target object, so interpret target offsets relative to source object.
      targetX = sBBcenter[0] + tDxOffset + targetDragOffsetX;
      targetY = sBBcenter[1] + tDyOffset + targetDragOffsetY;
      preDragTargetX = sBBcenter[0] + tDxOffset;
      preDragTargetY = sBBcenter[1] + tDyOffset;
    }
    if (sourceX === undefined || sourceY === undefined || targetX === undefined || targetY === undefined
        || preDragSourceX === undefined || preDragSourceY === undefined || preDragTargetX === undefined
        || preDragTargetY === undefined) {
      return defaultObj;
    }

    // Apply view transformations, if provided, for read-only panels where content is centered
    // and re-scaled to fit the viewable tile content area.
    if (sourceViewTransform) {
      ({ x: sourceX, y: sourceY } = applyViewTransform(sourceX, sourceY, sourceViewTransform));
      ({ x: preDragSourceX, y: preDragSourceY } =
        applyViewTransform(preDragSourceX, preDragSourceY, sourceViewTransform));
    }

    if (targetViewTransform) {
      ({ x: targetX, y: targetY } = applyViewTransform(targetX, targetY, targetViewTransform));
      ({ x: preDragTargetX, y: preDragTargetY } =
        applyViewTransform(preDragTargetX, preDragTargetY, targetViewTransform));
    }

    // Set up text location
    const [textDxOffset, textDyOffset] = self.textOffset ? [self.textOffset.dx, self.textOffset.dy] : [0, 0];
    const textOriginX = (sourceX + targetX) / 2;
    const textOriginY = (sourceY + targetY) / 2;

    let textCenterX, textCenterY;
    if (textDragOffsetX || textDragOffsetY) {
      // If text is being dragged, we just apply the drag offsets.
      textCenterX = textOriginX + textDxOffset + textDragOffsetX;
      textCenterY = textOriginY + textDyOffset + textDragOffsetY;

    } else {
      // If source or target is dragged, text should be dragged with it by a proportional amount.
      // Calculate the ratio by which the offsets should be adjusted to maintain the same relative position.
      const pdx = preDragTargetX - preDragSourceX;
      const xRatio = (pdx !== 0) ? (targetX - sourceX) / pdx : 1;
      textCenterX = textOriginX + textDxOffset * xRatio;

      const pdy = preDragTargetY - preDragSourceY;
      const yRatio = (pdy !== 0) ? (targetY - sourceY) / pdy : 1;
      textCenterY = textOriginY + textDyOffset * yRatio;
    }

    // Finally, it is constrained to be within the document bounding box
    const textMinXOffset = documentLeft + kTextHorizontalMargin - textOriginX;
    const textMaxXOffset = documentRight - kTextHorizontalMargin - textOriginX;
    const textMinYOffset = documentTop + kTextVerticalMargin - textOriginY;
    const textMaxYOffset = documentBottom - kTextVerticalMargin - textOriginY;

    textCenterX = Math.max(documentLeft + kTextHorizontalMargin,
      Math.min(documentRight - kTextHorizontalMargin, textCenterX));
    textCenterY = Math.max(documentTop + kTextVerticalMargin,
      Math.min(documentBottom - kTextVerticalMargin, textCenterY));

    // If this is a straight arrow, text is constrained to be on the line.
    if (self.shape === ArrowShape.straight) {
      [textCenterX, textCenterY] = constrainToLine([sourceX, sourceY], [targetX, targetY], [textCenterX, textCenterY]);
    }

    // Adjust for size of text label
    const textX = textCenterX - kArrowAnnotationTextWidth / 2;
    const textY = textCenterY - kArrowAnnotationTextHeight / 2;

    return {
      sourceX, sourceY, targetX, targetY,
      textX, textY, textCenterX, textCenterY, textOriginX, textOriginY,
      textMinXOffset, textMaxXOffset, textMinYOffset, textMaxYOffset
    };
  }
}));
export interface IArrowAnnotation extends Instance<typeof ArrowAnnotation> {}
export interface IArrowAnnotationSnapshot extends SnapshotIn<typeof ArrowAnnotation> {}
