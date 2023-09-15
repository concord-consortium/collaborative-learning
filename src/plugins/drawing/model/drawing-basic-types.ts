import LineToolIcon from "../assets/line-icon.svg";
import SingleArrowIcon from "../assets/line-single-arrow-icon.svg";
import DoubleArrowIcon from "../assets/line-double-arrow-icon.svg";
import { FunctionComponent, SVGProps } from "react";

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

const vectorTypeIcons: Map<VectorType, FunctionComponent<SVGProps<SVGSVGElement>>> = new Map();
vectorTypeIcons.set(VectorType.line, LineToolIcon);
vectorTypeIcons.set(VectorType.singleArrow, SingleArrowIcon);
vectorTypeIcons.set(VectorType.doubleArrow, DoubleArrowIcon);
export function getVectorTypeIcon(vectorType?: VectorType) {
  return (vectorType && vectorTypeIcons.get(vectorType)) || LineToolIcon;
}

const vectorTypeTooltips: Map<VectorType, string> = new Map();
vectorTypeTooltips.set(VectorType.line, "Line");
vectorTypeTooltips.set(VectorType.singleArrow, "Arrow");
vectorTypeTooltips.set(VectorType.doubleArrow, "Double arrow");
export function getVectorTypeTooltip(vectorType?: VectorType) {
  return (vectorType && vectorTypeTooltips.get(vectorType)) || "Unknown";
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
