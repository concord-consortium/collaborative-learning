import { each, filter, find, uniqueId, values } from "lodash";
import { getObjectById } from "./jxg-board";
import { ESegmentLabelOption, JXGChange, JXGChangeAgent } from "./jxg-changes";
import { getElementName, objectChangeAgent } from "./jxg-object";
import { isPoint, isPolygon, isVertexAngle, isVisibleEdge } from "./jxg-types";
import { wn_PnPoly } from "./soft-surfer-sunday";

export function isPointInPolygon(x: number, y: number, polygon: JXG.Polygon) {
  const v = polygon.vertices.map(vertex => {
              const [, vx, vy] = vertex.coords.scrCoords;
              return { x: vx, y: vy };
            });
  return !!wn_PnPoly({ x, y }, v);
}

export function getPolygonEdges(polygon: JXG.Polygon) {
  const edges: { [id: string]: JXG.Line } = {};
  polygon.vertices.forEach(vertex => {
    each(vertex.childElements, child => {
      if (child.elType === "segment") {
        edges[child.id] = child as JXG.Line;
      }
    });
  });
  return values(edges);
}

export function getPolygonEdge(board: JXG.Board, polygonId: string, pointIds: string[]) {
  const point1 = getObjectById(board, pointIds[0]);
  const segment = find(point1?.childElements, child => {
                    const seg = isVisibleEdge(child) ? child as JXG.Line : undefined;
                    if (!seg) return false;
                    const isEdgeOfPolygon = seg.parentPolygon?.id === polygonId;
                    const hasPoint1 = pointIds.findIndex(id => id === seg.point1.id) >= 0;
                    const hasPoint2 = pointIds.findIndex(id => id === seg.point2.id) >= 0;
                    return isEdgeOfPolygon && hasPoint1 && hasPoint2;
                  });
  return segment ? segment as JXG.Line : undefined;
}

export function getAssociatedPolygon(elt: JXG.GeometryElement): JXG.Polygon | undefined{
  if (isPolygon(elt)) return elt as JXG.Polygon;
  if (isPoint(elt)) {
    return find(elt.childElements, child => isPolygon(child)) as JXG.Polygon | undefined;
  }
  if (elt.elType === "segment") {
    const vertices = filter(elt.ancestors, ancestor => isPoint(ancestor)) as JXG.Point[];
    for (const vertex of vertices) {
      const polygon = find(vertex.childElements, child => isPolygon(child));
      if (polygon) return polygon as JXG.Polygon;
    }
  }
}

export function getPointsForVertexAngle(vertex: JXG.Point) {
  const children = values(vertex.childElements);
  const polygons = children.filter(child => child.elType === "polygon");
  const polygon = polygons.length === 1 ? polygons[0] as JXG.Polygon : undefined;
  const vertexCount = polygon ? polygon.vertices.length : 0;
  if (!polygon || (vertexCount <= 3)) return;
  const vertexIndex = polygon.findPoint(vertex);
  if (vertexIndex < 0) return;

  const p0 = polygon.vertices[vertexIndex === 0 ? vertexCount - 2 : vertexIndex - 1];
  const p1 = polygon.vertices[vertexIndex];
  const p2 = polygon.vertices[vertexIndex + 1];
  const [ , p0x, p0y] = p0.coords.scrCoords;
  const [ , p1x, p1y] = p1.coords.scrCoords;
  const [ , p2x, p2y] = p2.coords.scrCoords;
  const midX = (p0x + p2x) / 2;
  const midY = (p0y + p2y) / 2;
  const midDiffX = midX - p1x;
  const midDiffY = midY - p1y;
  const midLen = Math.sqrt(midDiffX * midDiffX + midDiffY * midDiffY);
  const testPct = 2 / midLen;
  const testX = p1x + midDiffX * testPct;
  const testY = p1y + midDiffY * testPct;
  const hasTestPt = polygon && isPointInPolygon(testX, testY, polygon);
  const radAngle = JXG.Math.Geometry.rad(p0, p1, p2);
  // return the vertices in the appropriate order
  return hasTestPt === (radAngle <= Math.PI)
          ? [p0, p1, p2]
          : [p2, p1, p0];
}

export function prepareToDeleteObjects(board: JXG.Board, ids: string[]) {
  const polygonsToDelete: { [id: string]: JXG.Polygon } = {};
  const anglesToDelete: { [id: string]: JXG.GeometryElement } = {};
  const moreIdsToDelete: string[] = [];

  // Identify polygons and angles scheduled for deletion and points that are vertices of polygons
  const polygonVertexMap: { [id: string]: string[] } = {};
  ids.forEach(id => {
    const elt = getObjectById(board, id);
    if (elt && isPoint(elt)) {
      each(elt.childElements, child => {
        if (isPolygon(child)) {
          if (!polygonVertexMap[child.id]) {
            polygonVertexMap[child.id] = [];
          }
          polygonVertexMap[child.id].push(elt.id);
        }
      });
    }
    else if (isPolygon(elt)) {
      polygonsToDelete[id] = elt as JXG.Polygon;
    }
    else if (elt && isVertexAngle(elt)) {
      anglesToDelete[id] = elt;
    }
  });

  // Consider each polygon with vertices to be deleted
  each(polygonVertexMap, (vertexIds, polygonId) => {
    const polygon = getObjectById(board, polygonId) as JXG.Polygon;
    const vertexCount = polygon.vertices.length - 1;
    const deleteCount = vertexIds.length;
    // remove points from polygons if possible
    if (vertexCount - deleteCount >= 2) {
      vertexIds.forEach(id => {
        const pt = getObjectById(board, id) as JXG.Point;
        // removing multiple points at one time sometimes gives unexpected results
        polygon.removePoints(pt);
      });
    }
    // otherwise, the polygon should be deleted as well
    else {
      if (!polygonsToDelete[polygon.id]) {
        polygonsToDelete[polygon.id] = polygon;
        moreIdsToDelete.push(polygon.id);
      }
    }
  });

  // identify angle labels to delete
  each(polygonsToDelete, polygon => {
    polygon.vertices.forEach(vertex => {
      each(vertex.childElements, child => {
        if (isVertexAngle(child)) {
          if (!anglesToDelete[child.id]) {
            anglesToDelete[child.id] = child;
            moreIdsToDelete.push(child.id);
          }
        }
      });
    });
  });

  // return ids of additional objects to delete
  return moreIdsToDelete;
}

function segmentNameLabelFn(this: JXG.Line) {
  const p1Name = getElementName(this.point1);
  const p2Name = getElementName(this.point2);
  return `${p1Name}${p2Name}`;
}

function segmentNameLengthFn(this: JXG.Line) {
  return JXG.toFixed(this.L(), 1);
}

function updateSegmentLabelOption(board: JXG.Board, change: JXGChange) {
  const segment = getPolygonEdge(board, change.targetID as string, change.parents as string[]);
  if (segment) {
    const labelOption = !Array.isArray(change.properties) && change.properties?.labelOption;
    const clientLabelOption = (labelOption === ESegmentLabelOption.kLabel) ||
                              (labelOption === ESegmentLabelOption.kLength)
                                ? labelOption
                                : null;
    const clientOriginalName = segment.getAttribute("clientOriginalName");
    if (!clientOriginalName && (typeof segment.name === "string")) {
      // store the original generated name so we can restore it if necessary
      segment._set("clientOriginalName", segment.name);
    }
    segment._set("clientLabelOption", clientLabelOption);
    const name = clientLabelOption
                  ? clientLabelOption === "label"
                      ? segmentNameLabelFn
                      : segmentNameLengthFn
                  // if we're removing our label, restore the original one
                  : clientOriginalName || board.generateName(segment);
    segment.setAttribute({ name, withLabel: !!clientLabelOption });
    segment.label?.setAttribute({ visible: !!clientLabelOption });
  }
}

export const polygonChangeAgent: JXGChangeAgent = {
  create: (board, change) => {
    const _board = board as JXG.Board;
    const parents = (change.parents || [])
                      .map(id => getObjectById(_board, id as string))
                      .filter(pt => pt != null);
    const props = {
      id: uniqueId(),
      hasInnerPoints: true,
      clientFillColor: "#00FF00",
      clientSelectedFillColor: "#00FF00",
      ...change.properties
    };
    const poly = parents.length ? _board.create("polygon", parents, props) : undefined;
    if (poly) {
      const segments = getPolygonEdges(poly);
      segments.forEach(seg => {
        seg.setAttribute({strokeColor: "#0000FF"});
        seg._set("clientStrokeColor", "#0000FF");
        seg._set("clientSelectedStrokeColor", "#0000FF");
      });
    }
    return poly;
  },

  update: (board, change) => {
    if ((change.target === "polygon") && change.parents &&
        !Array.isArray(change.properties) && change.properties?.labelOption) {
      updateSegmentLabelOption(board, change);
      return;
    }
    // other updates can be handled generically
    return objectChangeAgent.update(board, change);
  },

  // delete can be handled generically
  delete: objectChangeAgent.delete
};
