import {
  BoundingBox, ellipseBoundingBox, kVariableChipDefaultHeight, kVariableChipDefaultWidth,
  lineBoundingBox, sizedBoundingBox, vectorBoundingBox
} from "./drawing-geometry";

// The stored shape of a drawing object, as a snapshot-only reader sees it. Declared structurally
// rather than derived from the MST models in src/plugins/drawing/objects/, because those import
// React and cannot be loaded in Firebase functions. Keep the optional fields in step with them.
export interface DrawingObjectSnapshot {
  id: string;
  type: string;
  x: number;
  y: number;
  visible?: boolean;
  rotation?: number;
  hFlip?: boolean;
  vFlip?: boolean;
  width?: number;                              // rectangle, text, image, group
  height?: number;
  rx?: number;                                 // ellipse
  ry?: number;
  dx?: number;                                 // vector
  dy?: number;
  deltaPoints?: { dx: number, dy: number }[];  // line
  objects?: DrawingObjectSnapshot[];           // group
  text?: string;
  url?: string;
  filename?: string;
  variableId?: string;
  stroke?: string;
  fill?: string;
  strokeWidth?: number;
  strokeDashArray?: string;
}

/**
 * The object's box in the coordinate system it is stored in — which for a group's member is the
 * group's normalized space, not the document's. See absoluteChildBoundingBox for that conversion.
 */
export function boundingBoxForSnapshot(o: DrawingObjectSnapshot): BoundingBox {
  switch (o.type) {
    case "rectangle":
    case "text":
    case "image":
    case "group":
      return sizedBoundingBox({ x: o.x, y: o.y, width: o.width ?? 0, height: o.height ?? 0 });
    case "ellipse":
      return ellipseBoundingBox({ x: o.x, y: o.y, rx: o.rx ?? 0, ry: o.ry ?? 0 });
    case "vector":
      return vectorBoundingBox({ x: o.x, y: o.y, dx: o.dx ?? 0, dy: o.dy ?? 0 });
    case "line":
      return lineBoundingBox({ x: o.x, y: o.y, deltaPoints: o.deltaPoints ?? [] });
    case "variable":
      return sizedBoundingBox({
        x: o.x, y: o.y, width: kVariableChipDefaultWidth, height: kVariableChipDefaultHeight
      });
    default:
      // Drawing object types are plugin-registered, so this will eventually meet one it does not
      // know. A point at the object's origin keeps it addressable — it still gets a row and an id —
      // without inventing an extent.
      return sizedBoundingBox({ x: o.x, y: o.y, width: 0, height: 0 });
  }
}
