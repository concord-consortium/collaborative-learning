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

// One bounding-box function per shape, taking plain values rather than model instances so a caller
// can pass either stored or drag-adjusted inputs. The drawing object classes call these from both
// their unrotatedBoundingBox and undraggedUnrotatedBoundingBox views, and the AI summarizer calls
// them against raw snapshots — one implementation, so the two cannot drift.

/** Rectangles, text, images and groups: x,y is the north-west corner. */
export function sizedBoundingBox(o: { x: number, y: number, width: number, height: number }): BoundingBox {
  return { nw: { x: o.x, y: o.y }, se: { x: o.x + o.width, y: o.y + o.height } };
}

/** Ellipses: x,y is the centre, so the radii extend both ways. */
export function ellipseBoundingBox(o: { x: number, y: number, rx: number, ry: number }): BoundingBox {
  return {
    nw: { x: o.x - o.rx, y: o.y - o.ry },
    se: { x: o.x + o.rx, y: o.y + o.ry }
  };
}

/** Vectors: x,y is the start point and dx,dy may be negative. */
export function vectorBoundingBox(o: { x: number, y: number, dx: number, dy: number }): BoundingBox {
  return {
    nw: { x: Math.min(o.x, o.x + o.dx), y: Math.min(o.y, o.y + o.dy) },
    se: { x: Math.max(o.x, o.x + o.dx), y: Math.max(o.y, o.y + o.dy) }
  };
}

/** Polylines: x,y is the first point; the rest are cumulative deltas from it. */
export function lineBoundingBox(
  o: { x: number, y: number, deltaPoints: { dx: number, dy: number }[] },
  scale: Point = { x: 1, y: 1 }
): BoundingBox {
  const nw: Point = { x: o.x, y: o.y };
  const se: Point = { x: o.x, y: o.y };
  let currentX = o.x;
  let currentY = o.y;
  for (const { dx, dy } of o.deltaPoints) {
    currentX += dx * scale.x;
    currentY += dy * scale.y;
    nw.x = Math.min(nw.x, currentX);
    nw.y = Math.min(nw.y, currentY);
    se.x = Math.max(se.x, currentX);
    se.y = Math.max(se.y, currentY);
  }
  return { nw, se };
}

// The variable chip measures itself at render and never persists the result, so a snapshot-only
// reader has nothing but these defaults to go on. Shared so the model's volatile defaults and the
// summarizer's assumption are the same number.
export const kVariableChipDefaultWidth = 75;
export const kVariableChipDefaultHeight = 24;

/**
 * Externalize the bounding box of an object that is inside a group.
 *
 * A group's members are stored as fractions of the group's box rather than as coordinates: creating
 * a group runs GroupObject.assimilateObjects, which divides each member's box by the group's size
 * and persists the result. So a grouped child holds `x: 0.25, width: 0.5` where a top-level object
 * holds pixels, and reading the two the same way describes the child as a sub-pixel speck at the
 * origin.
 *
 * @param childBB The bounding box of the object inside the group; sides are normally in [0,1].
 * @returns The bounding box relative to the coordinate system the group itself lives in.
 */
export interface GroupTransform {
  boundingBox: BoundingBox;
  rotation?: number;
  hFlip?: boolean;
  vFlip?: boolean;
}

/** The four corners of a box, clockwise from nw. */
export function boundingBoxCorners(bb: BoundingBox): Point[] {
  return [
    { x: bb.nw.x, y: bb.nw.y },
    { x: bb.se.x, y: bb.nw.y },
    { x: bb.se.x, y: bb.se.y },
    { x: bb.nw.x, y: bb.se.y }
  ];
}

/** The smallest axis-aligned box containing every given point. */
export function boundingBoxForPoints(points: Point[]): BoundingBox {
  const sides = boundingBoxSidesForPoints(points);
  return { nw: { x: sides.left, y: sides.top }, se: { x: sides.right, y: sides.bottom } };
}

/**
 * Map one point out of a group's normalized space into the space the group itself lives in.
 *
 * Points rather than boxes, because a caller walking nested groups has to compose these. Reducing
 * to an axis-aligned box between levels discards the rotation of every level above, which puts a
 * child of a group inside a rotated group in the wrong quadrant.
 */
export function absoluteChildPoint(point: Point, group: GroupTransform): Point {
  const groupBB = group.boundingBox;
  let x = groupBB.nw.x + point.x * (groupBB.se.x - groupBB.nw.x);
  let y = groupBB.nw.y + point.y * (groupBB.se.y - groupBB.nw.y);
  if (group.vFlip) y = groupBB.nw.y + (groupBB.se.y - y);
  if (group.hFlip) x = groupBB.nw.x + (groupBB.se.x - x);
  return rotatePoint({ x, y }, groupBB.se, group.rotation ?? 0);
}

export function absoluteChildBoundingBox(childBB: BoundingBox, group: GroupTransform): BoundingBox {
  // Every corner is mapped, not just two. Two opposite corners bound the rotated rectangle only
  // when the rotation is a multiple of 90; at any other angle their images do not span it. At 45
  // degrees it collapses outright, because the pivot is the se corner and so maps to itself.
  return boundingBoxForPoints(boundingBoxCorners(childBB).map(p => absoluteChildPoint(p, group)));
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
