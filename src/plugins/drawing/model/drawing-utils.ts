import { AlignType, BoundingBox, BoundingBoxSides, Point } from "./drawing-basic-types";
import { kClosedObjectListPanelWidth } from "./drawing-types";

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

/**
 * Rotates a point around a center by a given angle in degrees (clockwise).
 * @param point The point to rotate {x, y}
 * @param center The center of rotation {x, y}
 * @param angleDegrees The angle in degrees (clockwise)
 * @returns The rotated point {x, y}
 */
export function rotatePoint(point: {x: number, y: number}, center: {x: number, y: number}, angleDegrees: number) {
  const angleRad = angleDegrees * Math.PI / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos
  };
}

export function boundingBoxSidesForPoints(points: {x: number, y: number}[]): BoundingBoxSides {
  const minX = Math.min(...points.map(p => p.x));
  const maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y));
  const maxY = Math.max(...points.map(p => p.y));
  return {left: minX, top: minY, right: maxX, bottom: maxY};
}

/**
 * Computes the bounding box that encompasses all the given objects.
 * @param objects Array of objects that have a boundingBox property
 * @returns A BoundingBox that contains all the objects
 */
export function computeObjectsBoundingBox(objects: Array<{ boundingBox: BoundingBox }>): BoundingBox {
  if (objects.length === 0) {
    return { nw: { x: 0, y: 0 }, se: { x: 0, y: 0 } };
  }

  return objects.reduce((cur, obj) => {
    if (obj) {
      const objBB = obj.boundingBox;
      if (objBB.nw.x < cur.nw.x) cur.nw.x = objBB.nw.x;
      if (objBB.nw.y < cur.nw.y) cur.nw.y = objBB.nw.y;
      if (objBB.se.x > cur.se.x) cur.se.x = objBB.se.x;
      if (objBB.se.y > cur.se.y) cur.se.y = objBB.se.y;
    }
    return cur;
  }, {
    nw: { x: Number.MAX_VALUE, y: Number.MAX_VALUE },
    se: { x: -Number.MAX_VALUE, y: -Number.MAX_VALUE }
  });
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

/** Find the nearest multiple of 90 degrees to the given rotation.
 * Currently we only support 0, 90, 180, and 270 degree rotation of drawing objects,
 * but the value stored in the model is not constrained to these values.
*/
export function normalizeRotation(rotation: number): number {
  return ((Math.round(rotation / 90) * 90) % 360 + 360) % 360;
}

export function rotationPoint(boundingBox: BoundingBox, rotation: number): Point {
  const normalized = normalizeRotation(rotation);
  switch (normalized) {
    case 0:
      // Rotation is defined to be around the se corner of unrotated object.
      return boundingBox.se;
    case 90:
      // SW
      return { x: boundingBox.nw.x, y: boundingBox.se.y };
    case 180:
      // NW
      return boundingBox.nw;
    case 270:
      // NE
      return { x: boundingBox.se.x, y: boundingBox.nw.y };
    default:
      throw new Error(`Invalid rotation: ${rotation}`);
  }
}

export function rotateBoundingBox(boundingBox: BoundingBox, rotation: number): BoundingBox {
  // Get the four corners of the bounding box
  const nw = boundingBox.nw;
  const se = boundingBox.se;
  const ne = { x: se.x, y: nw.y };
  const sw = { x: nw.x, y: se.y };
  // Rotate each corner around the se (our center of rotation)
  const rotatedNW = rotatePoint(nw, se, rotation);
  const rotatedNE = rotatePoint(ne, se, rotation);
  const rotatedSE = se; //rotatePoint(se, se, rotation);
  const rotatedSW = rotatePoint(sw, se, rotation);
  // Find min/max x and y
  const boundingSides = boundingBoxSidesForPoints([rotatedNW, rotatedNE, rotatedSE, rotatedSW]);
  return {
    nw: { x: boundingSides.left, y: boundingSides.top },
    se: { x: boundingSides.right, y: boundingSides.bottom }
  };
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
