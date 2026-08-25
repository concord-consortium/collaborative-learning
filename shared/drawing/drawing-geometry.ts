// Pure drawing geometry, shared between the drawing plugin's MST models and the AI summarizer.
//
// This module must import neither React, nor MST, nor SVG assets: the summarizer runs in Firebase
// functions, which cannot load any of them. That constraint is the only reason these types live here
// rather than in src/plugins/drawing/model/drawing-basic-types.ts, which imports React and nine icon
// assets. Keep it free of them.
//
// Both sides calling these functions is the point. The alternative — the summarizer reimplementing
// each shape's bounding box against the snapshot — is a copy nothing in the type system would keep
// in step with the originals.

export interface Point { x: number; y: number; }

export interface BoundingBox {
  nw: Point;
  se: Point;
  start?: Point;
  end?: Point;
}

export interface BoundingBoxSides {
  top: number,
  right: number,
  bottom: number,
  left: number
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
