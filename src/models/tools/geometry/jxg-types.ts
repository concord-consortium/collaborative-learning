import { values } from "lodash";

export const isBoard = (v: any) => v instanceof JXG.Board;
export const isAxis = (v: any) => (v instanceof JXG.Line) && (v.elType === "axis");
export const isAxisLabel = (v: any) => v instanceof JXG.Text && !!values(v.ancestors).find(el => isAxis(el));

export const isPoint = (v: any) => v instanceof JXG.Point;
export const isVisiblePoint = (v: any) => isPoint(v) && v.visProp.visible;

export const isLinkedPoint = (v: any) => isPoint(v) && (v.getAttribute("clientType") === "linkedPoint");

export const isCommentType = (v: any) => v && v.getAttribute("clientType") === "comment";
export const isComment = (v: any) => isCommentType(v) && (v instanceof JXG.Text) && (v.elType === "text");

export const isFreePoint = (v: any) => {
  if (isVisiblePoint(v)) {
    const point = v as JXG.Point;
    return values(point.childElements).filter(el => !isCommentType(el)).length <= 1 &&
           values(point.descendants).filter(el => !isCommentType(el)).length <= 1;
  }
};

export const isPolygon = (v: any) => v instanceof JXG.Polygon;
export const isVisibleEdge = (v: any) => v instanceof JXG.Line && (v.elType === "segment") && v.visProp.visible;

export const isVertexAngle = (v: any) =>
                (v instanceof JXG.Curve) && (v.elType === "angle") &&
                (v.getAttribute("clientType") === "vertexAngle");
