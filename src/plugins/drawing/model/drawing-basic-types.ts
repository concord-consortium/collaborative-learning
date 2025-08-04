
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

export function vectorTypeForEndShapes(headShape?: VectorEndShape, tailShape?: VectorEndShape) {
  if (headShape) {
    if (tailShape) {
      return VectorType.doubleArrow;
    } else {
      return VectorType.singleArrow;
    }
    return VectorType.line;
  }
}

export enum AlignType {
  h_left = "h_left",
  h_center = "h_center",
  h_right = "h_right",
  v_top = "v_top",
  v_center = "v_center",
  v_bottom = "v_bottom",
}

export function isHorizontalAlignType(alignType: AlignType) {
  return alignType === AlignType.h_left
    || alignType === AlignType.h_center
    || alignType === AlignType.h_right;
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
