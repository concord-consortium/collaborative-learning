import { BoundingBox, BoundingBoxSides, Point } from "./drawing-basic-types";

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

export function boundingBoxForPoints(points: {x: number, y: number}[]): BoundingBoxSides {
  const minX = Math.min(...points.map(p => p.x));
  const maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y));
  const maxY = Math.max(...points.map(p => p.y));
  return {left: minX, top: minY, right: maxX, bottom: maxY};
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
  const boundingSides = boundingBoxForPoints([rotatedNW, rotatedNE, rotatedSE, rotatedSW]);
  return {
    nw: { x: boundingSides.left, y: boundingSides.top },
    se: { x: boundingSides.right, y: boundingSides.bottom }
  };
}

