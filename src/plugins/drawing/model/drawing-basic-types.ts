import { VectorType } from "../components/vector-palette";

export interface Point { x: number; y: number; }

export interface BoundingBox {
  nw: Point;
  se: Point;
  start?: Point;
  end?: Point;
}

export interface ToolbarSettings {
  stroke: string;
  fill: string;
  strokeDashArray: string;
  strokeWidth: number;
  vectorType?: VectorType;
}

export const DefaultToolbarSettings: ToolbarSettings = {
  stroke: "#000000",
  fill: "none",
  strokeDashArray: "",
  strokeWidth: 2,
  vectorType: VectorType.line
}

// Possible decorations for the start and end of the vector.  Default is no decoration.
export enum VectorEndShape {
  triangle = "triangle"
}
