import { values } from "lodash";

export const kGeometryDefaultWidth = 480;
export const kGeometryDefaultHeight = 320;
export const kGeometryDefaultPixelsPerUnit = 18.3;  // matches S&S curriculum images
export const kGeometryDefaultXAxisMin = -2;
export const kGeometryDefaultYAxisMin = -1;

export const kGeometryHighlightColor = "#0081ff";


// utility for creating an object from a property/value pair
export const toObj = (p: string, v: any) => v != null ? { [p]: v } : undefined;

export const isBoard = (v: any): v is JXG.Board => v instanceof JXG.Board;
export const isAxis = (v: any): v is JXG.Line => (v instanceof JXG.Line) && (v.elType === "axis");
export const isAxisArray = (v: any): v is JXG.Line[] => Array.isArray(v) && v.every(isAxis);
export const isAxisLabel = (v: any): v is JXG.Text => {
  return v instanceof JXG.Text && values(v.ancestors).some(isAxis);
};

export const isGeometryElement = (v: any): v is JXG.GeometryElement => v instanceof JXG.GeometryElement;

export const isPoint = (v: any): v is JXG.Point => v instanceof JXG.Point;
export const isPointArray = (v: any): v is JXG.Point[] => Array.isArray(v) && v.every(isPoint);
export const isVisiblePoint = (v: any): v is JXG.Point => isPoint(v) && !!v.visProp.visible;
export const isRealVisiblePoint = (v: any): v is JXG.Point => isPoint(v) && !!v.visProp.visible
  && !v.getAttribute("isPhantom");

export const isLinkedPoint = (v: any): v is JXG.Point => {
  return isPoint(v) && (v.getAttribute("clientType") === "linkedPoint");
};

export const isCommentType = (v: any) => v && v.getAttribute("clientType") === "comment";
export const isComment = (v: any): v is JXG.Text => {
  return v instanceof JXG.Text && isCommentType(v) && (v.elType === "text");
};

export const isFreePoint = (v: any): v is JXG.Point => {
  if (isVisiblePoint(v)) {
    const point = v;
    return values(point.childElements).filter(el => !isCommentType(el)).length <= 1 &&
           values(point.descendants).filter(el => !isCommentType(el)).length <= 1;
  }
  return false;
};

export const isImage = (v: any): v is JXG.Image => v instanceof JXG.Image;

export const isLine = (v: any): v is JXG.Line => v instanceof JXG.Line;

export const kInfiniteLineType = "infiniteLine";
export const isInfiniteLine = (v: any): v is JXG.Line => {
  return v && (v.elType === "line") && (v.getAttribute("clientType") === kInfiniteLineType);
};
export const isVisibleInfiniteLine = (v: any): v is JXG.Line => isInfiniteLine(v) && !!v.visProp.visible;

export const isPolygon = (v: any): v is JXG.Polygon => v instanceof JXG.Polygon;
export const isVisibleEdge = (v: any): v is JXG.Line => {
  return v instanceof JXG.Line && (v.elType === "segment") && !!v.visProp.visible;
};

export const isCircle = (v: any): v is JXG.Circle => v instanceof JXG.Circle;

export const isText = (v: any): v is JXG.Text => v instanceof JXG.Text;

export const isVertexAngle = (v: any): v is JXG.Angle => {
  return (v instanceof JXG.Curve) && (v.elType === "angle") && (v.getAttribute("clientType") === "vertexAngle");
};

export const kMovableLineType = "movableLine";
export const isMovableLine = (v: any): v is JXG.Line => {
  return v && (v.elType === "line") && (v.getAttribute("clientType") === kMovableLineType);
};
export const isVisibleMovableLine = (v: any): v is JXG.Line => isMovableLine(v) && !!v.visProp.visible;
export const isMovableLineControlPoint = (v: any): v is JXG.Point => {
  return isPoint(v) && v.getAttribute("clientType") === kMovableLineType;
};
export const isMovableLineLabel = (v: any): v is JXG.Text => {
  return v instanceof JXG.Text && v.getAttribute("clientType") === kMovableLineType;
};
export const getMovableLinePointIds = (lineId: string) => {
  return [`${lineId}-point1`, `${lineId}-point2`] as [string, string];
};
