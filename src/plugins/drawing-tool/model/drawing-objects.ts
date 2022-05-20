export interface Point {x: number; y: number; }
export interface DeltaPoint {dx: number; dy: number; }

export interface BoundingBox {
  nw: Point;
  se: Point;
  start?: Point;
  end?: Point;
}

// "line" == polyline
export interface LineDrawingObjectData {
  type: "line";
  id?: string;
  x: number;
  y: number;
  deltaPoints: DeltaPoint[];
  stroke: string;
  strokeDashArray: string;
  strokeWidth: number;
}

// "vector" == simple line
export interface VectorDrawingObjectData {
  type: "vector";
  id?: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  stroke: string;
  strokeDashArray: string;
  strokeWidth: number;
}

export interface RectangleDrawingObjectData {
  type: "rectangle";
  id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: string;
  strokeDashArray: string;
  strokeWidth: number;
  fill: string;
}

export interface EllipseDrawingObjectData {
  type: "ellipse";
  id?: string;
  x: number;
  y: number;
  rx: number;
  ry: number;
  stroke: string;
  strokeDashArray: string;
  strokeWidth: number;
  fill: string;
}

export interface ImageDrawingObjectData {
  type: "image";
  id?: string;
  url: string;
  originalUrl?: string;
  filename?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VariableDrawingObjectData {
  type: "variable";
  id?: string;
  x: number;
  y: number;
  variableId: string;
}

export type DrawingObjectDataType = LineDrawingObjectData | VectorDrawingObjectData
  | RectangleDrawingObjectData | EllipseDrawingObjectData | ImageDrawingObjectData | VariableDrawingObjectData;
