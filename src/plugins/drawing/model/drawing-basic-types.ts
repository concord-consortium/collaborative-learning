import { FunctionComponent, SVGProps } from "react";

import LineToolIcon from "../assets/line-icon.svg";
import SingleArrowIcon from "../assets/line-single-arrow-icon.svg";
import DoubleArrowIcon from "../assets/line-double-arrow-icon.svg";
import AlignLeftIcon from "../assets/align-left-icon.svg";
import AlignCenterIcon from "../assets/align-center-icon.svg";
import AlignRightIcon from "../assets/align-right-icon.svg";
import AlignTopIcon from "../assets/align-top-icon.svg";
import AlignMiddleIcon from "../assets/align-middle-icon.svg";
import AlignBottomIcon from "../assets/align-bottom-icon.svg";

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

export enum AlignType {
  h_left = "h_left",
  h_center = "h_center",
  h_right = "h_right",
  v_top = "v_top",
  v_center = "v_center",
  v_bottom = "v_bottom",
}

const alignTypeIcons: Map<AlignType, FunctionComponent<SVGProps<SVGSVGElement>>> = new Map();
alignTypeIcons.set(AlignType.h_left, AlignLeftIcon);
alignTypeIcons.set(AlignType.h_center, AlignCenterIcon);
alignTypeIcons.set(AlignType.h_right, AlignRightIcon);
alignTypeIcons.set(AlignType.v_top, AlignTopIcon);
alignTypeIcons.set(AlignType.v_center, AlignMiddleIcon);
alignTypeIcons.set(AlignType.v_bottom, AlignBottomIcon);

const alignTypeTooltips: Map<AlignType, string> = new Map();
alignTypeTooltips.set(AlignType.h_left, "Align left");
alignTypeTooltips.set(AlignType.h_center, "Align center");
alignTypeTooltips.set(AlignType.h_right, "Align right");
alignTypeTooltips.set(AlignType.v_top, "Align top");
alignTypeTooltips.set(AlignType.v_center, "Align middle");
alignTypeTooltips.set(AlignType.v_bottom, "Align bottom");

export function isHorizontalAlignType(alignType: AlignType) {
  return alignType === AlignType.h_left
    || alignType === AlignType.h_center
    || alignType === AlignType.h_right;
}

export function getAlignTypeIcon(alignType?: AlignType) {
  return (alignType && alignTypeIcons.get(alignType)) || AlignCenterIcon;
}

export function getAlignTypeTooltip(alignType?: AlignType) {
  return (alignType && alignTypeTooltips.get(alignType)) || "Unknown";
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
