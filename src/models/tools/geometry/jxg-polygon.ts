import { JXGChange, JXGChangeAgent } from "./jxg-changes";
import { objectChangeAgent } from "./jxg-object";
import { isPoint } from "./jxg-point";
import { isVertexAngle } from "./jxg-vertex-angle";
import { wn_PnPoly } from "./soft-surfer-sunday";
import { assign, each, filter, find, values } from "lodash";
import * as uuid from "uuid/v4";

export const isPolygon = (v: any) => v instanceof JXG.Polygon;

export const isVisibleEdge = (v: any) => v instanceof JXG.Line && (v.elType === "segment") && v.visProp.visible;

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

export function getAssociatedPolygon(elt: JXG.GeometryElement) {
  if (isPolygon(elt)) return elt;
  if (isPoint(elt)) {
    return find(elt.childElements, child => isPolygon(child));
  }
  if (elt.elType === "segment") {
    const vertices = filter(elt.ancestors, ancestor => isPoint(ancestor)) as JXG.Point[];
    for (const vertex of vertices) {
      const polygon = find(vertex.childElements, child => isPolygon(child));
      if (polygon) return polygon;
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
    const elt = board.objects[id];
    if (isPoint(elt)) {
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
    else if (isVertexAngle(elt)) {
      anglesToDelete[id] = elt;
    }
  });

  // Consider each polygon with vertices to be deleted
  each(polygonVertexMap, (vertexIds, polygonId) => {
    const polygon = board.objects[polygonId] as JXG.Polygon;
    const vertexCount = polygon.vertices.length - 1;
    const deleteCount = vertexIds.length;
    // remove points from polygons if possible
    if (vertexCount - deleteCount >= 2) {
      vertexIds.forEach(id => {
        const pt = board.objects[id] as JXG.Point;
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

export const polygonChangeAgent: JXGChangeAgent = {
  create: (board: JXG.Board, change: JXGChange) => {
    const parents = (change.parents || [])
                      .map(id => board.objects[id as string])
                      .filter(pt => pt != null);
    const props = assign({
      id: uuid(),
      hasInnerPoints: true,
      clientFillColor: "#00FF00",
      clientSelectedFillColor: "#00FF00"
    }, change.properties);
    const poly = parents.length ? board.create("polygon", parents, props) : undefined;
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

  // update can be handled generically
  update: objectChangeAgent.update,

  // delete can be handled generically
  delete: objectChangeAgent.delete
};
