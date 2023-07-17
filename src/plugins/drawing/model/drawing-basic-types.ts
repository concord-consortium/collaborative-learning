
export interface Point { x: number; y: number; }

export interface BoundingBox {
  nw: Point;
  se: Point;
  start?: Point;
  end?: Point;
}

export interface BoundingBoxDelta {
  top: number, 
  right: number, 
  bottom: number, 
  left: number
}

export interface ToolbarSettings {
  stroke: string;
  fill: string;
  strokeDashArray: string;
  strokeWidth: number;
}

export const DefaultToolbarSettings: ToolbarSettings = {
  stroke: "#000000",
  fill: "none",
  strokeDashArray: "",
  strokeWidth: 2
};
