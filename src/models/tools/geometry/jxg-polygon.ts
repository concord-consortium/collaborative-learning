import { JXGChange, JXGChangeAgent } from "./jxg-changes";
import { objectChangeAgent } from "./jxg-object";
import { isPoint } from "./jxg-point";
import { wn_PnPoly } from "./soft-surfer-sunday";
import { assign, each, filter, find, values } from "lodash";
import * as uuid from "uuid/v4";

export const isPolygon = (v: any) => v instanceof JXG.Polygon;

export const isVisibleEdge = (v: any) => (v.elType === "segment") && v.visProp.visible;

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

export const polygonChangeAgent: JXGChangeAgent = {
  create: (board: JXG.Board, change: JXGChange) => {
    const parents = (change.parents || [])
                      .map(id => board.objects[id as string])
                      .filter(pt => pt != null);
    const props = assign({ id: uuid(), hasInnerPoints: true }, change.properties);
    return parents.length ? board.create("polygon", parents, props) : undefined;
  },

  // update can be handled generically
  update: objectChangeAgent.update,

  // delete can be handled generically
  delete: objectChangeAgent.delete
};
