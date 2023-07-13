
export interface Point { x: number; y: number; }

export interface BoundingBox {
  nw: Point;
  se: Point;
  start?: Point;
  end?: Point;
}

export enum VectorType {
  line = "line",
  singleArrow = "arrow",
  doubleArrow = "doublearrow"
}

// Possible decorations for the start and end of the vector.  Default is no decoration.
export enum VectorEndShape {
  triangle = "triangle"
}

// Return a two-element list of [head shape, tail shape] for the given VectorType constant.
export function endShapesForVectorType(vectorType?: VectorType) {
  if (!vectorType) {
    return [undefined, undefined];
  }
  switch (vectorType) {
    case VectorType.line:
      return [undefined, undefined];
    case VectorType.singleArrow:
      return [VectorEndShape.triangle, undefined];
    case VectorType.doubleArrow:
      return [VectorEndShape.triangle, VectorEndShape.triangle];
  }
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
};
