export interface Point {x: number; y: number; }
export interface DeltaPoint {dx: number; dy: number; }

export interface BoundingBox {
  nw: Point;
  se: Point;
  start?: Point;
  end?: Point;
}

export interface LineDrawingObjectData {
  [key: string]: any;
  type: "line";
  key?: string;
  x: number;
  y: number;
  deltaPoints: DeltaPoint[];
  stroke: string;
  strokeDashArray: string;
  strokeWidth: number;
}

export interface VectorDrawingObjectData {
  [key: string]: any;
  type: "vector";
  key?: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  stroke: string;
  strokeDashArray: string;
  strokeWidth: number;
}

export interface RectangleDrawingObjectData {
  [key: string]: any;
  type: "rectangle";
  key?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: string;
  strokeDashArray: string;
  strokeWidth: number;
}

export interface EllipseDrawingObjectData {
  [key: string]: any;
  type: "ellipse";
  key?: string;
  x: number;
  y: number;
  rx: number;
  ry: number;
  stroke: string;
  strokeDashArray: string;
  strokeWidth: number;
  fill: string;
}

export type DrawingObjectDataType = LineDrawingObjectData | VectorDrawingObjectData
  | RectangleDrawingObjectData | EllipseDrawingObjectData;
