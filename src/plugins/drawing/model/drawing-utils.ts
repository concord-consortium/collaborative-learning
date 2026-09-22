import { AlignType, BoundingBox } from "./drawing-basic-types";
import { kClosedObjectListPanelWidth } from "./drawing-types";

// The pure geometry helpers live in shared/ so the AI summarizer, which runs in Firebase functions
// and cannot load React or MST, computes objects' boxes with the same code the models do.
// Re-exported here so existing importers of drawing-utils keep working.
export {
  boundingBoxSidesForPoints, computeObjectsBoundingBox, normalizeRotation,
  rotateBoundingBox, rotatePoint, rotationPoint
} from "../../../../shared/drawing/drawing-geometry";

/**
 * Recursively removes 'id' attributes from a drawing object snapshot and all nested objects in 'objects' arrays.
 * @param obj The snapshot object to process
 * @returns A new object with all 'id' attributes removed
 */
export function removeIdsFromSnapshot(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(removeIdsFromSnapshot);
  }
  if (obj && typeof obj === 'object') {
    // Remove 'id' from the current object
    const { id, ...rest } = obj;
    // If there is an 'objects' array, recurse into it
    if (Array.isArray(rest.objects)) {
      rest.objects = rest.objects.map(removeIdsFromSnapshot);
    }
    return rest;
  }
  // Primitive value, return as is
  return obj;
}

export function getRelevantCoordinateForAlignType(alignType: AlignType, bbox: BoundingBox): number {
  switch (alignType) {
    case AlignType.h_left:
      return bbox.nw.x;
    case AlignType.h_center:
      return bbox.nw.x + (bbox.se.x - bbox.nw.x) / 2;
    case AlignType.h_right:
      return bbox.se.x;
    case AlignType.v_top:
      return bbox.nw.y;
    case AlignType.v_center:
      return bbox.nw.y + (bbox.se.y - bbox.nw.y) / 2;
    case AlignType.v_bottom:
      return bbox.se.y;
  }
  return 0;
}

export const zoomStep = 0.1;
export const minZoom = 0.1;
export const maxZoom = 2;

export interface IFitContentOptions {
  canvasSize: { x: number; y: number };
  contentBoundingBox: BoundingBox;
  padding?: number;
  minZoom?: number;
  maxZoom?: number;
  readOnly?: boolean;
}

export interface IFitContentResult {
  offsetX: number;
  offsetY: number;
  zoom: number;
}

export const calculateFitContent = (options: IFitContentOptions): IFitContentResult => {
  const { canvasSize, contentBoundingBox, padding=10, minZoom: customMinZoom, maxZoom: customMaxZoom,
          readOnly } = options;
  const contentWidth = contentBoundingBox.se.x - contentBoundingBox.nw.x;
  const contentHeight = contentBoundingBox.se.y - contentBoundingBox.nw.y;
  const optimalZoom = Math.min(
    (canvasSize.x - padding) / contentWidth,
    (canvasSize.y - padding) / contentHeight
  );
  const effectiveMinZoom = customMinZoom ?? minZoom;
  const effectiveMaxZoom = customMaxZoom ?? maxZoom;
  const legalZoom = Math.max(effectiveMinZoom, Math.min(effectiveMaxZoom, optimalZoom));

  // Adjust the offset so the content is centered with the new zoom level.
  let newOffsetX = (canvasSize.x / 2 - (contentBoundingBox.nw.x + contentWidth / 2) * legalZoom);
  newOffsetX = readOnly
    ? newOffsetX - kClosedObjectListPanelWidth // The object list panel isn't present when read-only
    : newOffsetX;
  const newOffsetY = (canvasSize.y / 2 - (contentBoundingBox.nw.y + contentHeight / 2) * legalZoom);

  return {
    offsetX: newOffsetX,
    offsetY: newOffsetY,
    zoom: legalZoom
  };
};
