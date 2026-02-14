import { LineAttributes, PolygonAttributes } from "jsxgraph";
import { each, filter, find, merge, remove, uniqueId, values } from "lodash";
import { notEmpty } from "../../../utilities/js-utils";
import { fillPropsForColorScheme, getPoint, getPolygon, strokePropsForColorScheme } from "./geometry-utils";
import { getObjectById } from "./jxg-board";
import { ELabelOption, JXGChange, JXGChangeAgent, JXGParentType } from "./jxg-changes";
import { objectChangeAgent } from "./jxg-object";
import { isLine, isPoint, isPolygon, isVertexAngle, isVisibleEdge } from "./jxg-types";
import { wn_PnPoly } from "./soft-surfer-sunday";

const defaultPolygonProps = Object.freeze({
  hasInnerPoints: true,
  fillOpacity: .2,       highlightFillOpacity: .25
});

const selectedPolygonProps = Object.freeze({
  fillOpacity: .3,       highlightFillOpacity: .3
});

// Hack alert: JSXGraph for some reason doesn't allow us to specify a CSS class to be applied.
// In order to be able to use CSS for adding a drop shadow to hovered & selected lines,
// using a CSS rule that is targeted on stroke-opacity="0.99".
const defaultPolygonEdgeProps = Object.freeze({
  strokeWidth: 2.5,      highlightStrokeWidth: 2.5,
  strokeOpacity: 1,      highlightStrokeOpacity: 0.99, // 0.99 triggers shadow
  transitionDuration: 0
});

const selectedPolygonEdgeProps = Object.freeze({
  strokeWidth: 2.5,       highlightStrokeWidth: 2.5,
  strokeOpacity: 0.99,     highlightStrokeOpacity: 0.99, // 0.99 triggers shadow
});

const phantomPolygonEdgeProps = Object.freeze({
  strokeOpacity: 0,
  highlightStrokeOpacity: 0
});

export function getPolygonVisualProps(selected: boolean, colorScheme: number) {
  const props: PolygonAttributes = { ...defaultPolygonProps };
  if (selected) {
    merge(props, selectedPolygonProps);
  }
  merge(props, fillPropsForColorScheme(colorScheme));
  return props;
}

export function getEdgeVisualProps(selected: boolean, colorScheme: number, phantom: boolean) {
  if (phantom) {
    // Invisible, so don't apply any other styles
    return phantomPolygonEdgeProps;
  }
  const props: LineAttributes = {
    ...defaultPolygonEdgeProps,
    ...strokePropsForColorScheme(colorScheme),
    ...(selected ? selectedPolygonEdgeProps : {})
  };
  return props;
}

export function isPointInPolygon(x: number, y: number, polygon: JXG.Polygon) {
  const v = polygon.vertices.map(vertex => {
              const [, vx, vy] = vertex.coords.scrCoords;
              return { x: vx, y: vy };
            });
  return !!wn_PnPoly({ x, y }, v);
}

export function getPolygonEdges(polygon: JXG.Polygon) {
  return polygon.borders;
}

export function getPolygonEdge(board: JXG.Board, polygonId: string, pointIds: string[]) {
  const point1 = getObjectById(board, pointIds[0]);
  const segment = find(point1?.childElements, child => {
                    const seg = isVisibleEdge(child) ? child : undefined;
                    if (!seg) return false;
                    const isEdgeOfPolygon = seg.parentPolygon?.id === polygonId;
                    const hasPoint1 = pointIds.findIndex(id => id === seg.point1.id) >= 0;
                    const hasPoint2 = pointIds.findIndex(id => id === seg.point2.id) >= 0;
                    return isEdgeOfPolygon && hasPoint1 && hasPoint2;
                  });
  return isLine(segment) ? segment : undefined;
}

export function getAssociatedPolygon(elt: JXG.GeometryElement): JXG.Polygon | undefined{
  if (isPolygon(elt)) return elt;
  if (isPoint(elt)) {
    return find(elt.childElements, isPolygon);
  }
  if (isLine(elt)) {
    // Find a polygon that contains both ends of this segment.
    // It can still be ambiguous if polygons overlap at more than one point,
    // in which case we just return the first one found.
    const p1polygons = filter(elt.point1.childElements, isPolygon);
    const p2polygons = filter(elt.point2.childElements, isPolygon);
    return p1polygons.find(p => p2polygons.includes(p));
  }
}

/**
 * Set appropriate colors for the edges of a polygon.
 * An edge between a phantom point and the first vertex is considered as incompleted,
 * and is not drawn in.
 * @param polygon
 */
export function setPolygonEdgeColors(polygon: JXG.Polygon) {
  const segments = getPolygonEdges(polygon);
  const firstVertex = polygon.vertices[0];
  segments.forEach(seg => {
    // the "uncompleted side" of an in-progress polygon is considered phantom
    const phantom = segments.length > 2 &&
      ((seg.point1.getAttribute("isPhantom") && seg.point2 === firstVertex)
        ||(seg.point2.getAttribute("isPhantom") && seg.point1 === firstVertex));
    const props = getEdgeVisualProps(false, polygon.getAttribute("colorScheme")||0, phantom);
    seg.setAttribute(props);
  });
}

export function getPointsForVertexAngle(vertex: JXG.Point) {
  const children = values(vertex.childElements);
  const polygons = children.filter(isPolygon);
  const polygon = polygons.length === 1 ? polygons[0] : undefined;
  const vertexCount = polygon?.vertices.length || 0;
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

export function prepareToDeleteObjects(board: JXG.Board, ids: string[]): string[] {
  const selectedPoints: string[] = [];
  const polygonsToDelete: { [id: string]: JXG.Polygon } = {};
  const anglesToDelete: { [id: string]: JXG.GeometryElement } = {};
  const othersToDelete: string[] = []; // lines, circles, comments, images, etc.

  // Identify polygons and angles scheduled for deletion and points that are vertices of polygons
  const polygonVertexMap: { [id: string]: string[] } = {}; // maps polygon ids to vertex ids
  const vertexPolygonMap: { [id: string]: string[] } = {}; // maps vertex ids to polygon ids
  ids.forEach(id => {
    const elt = getObjectById(board, id);
    if (isPoint(elt)) {
      selectedPoints.push(elt.id);
      vertexPolygonMap[elt.id] = [];
      each(elt.childElements, child => {
        if (isPolygon(child)) {
          vertexPolygonMap[elt.id].push(child.id);
          if (!polygonVertexMap[child.id]) {
            polygonVertexMap[child.id] = [];
          }
          polygonVertexMap[child.id].push(elt.id);
        }
      });
    }
    else if (isPolygon(elt)) {
      polygonsToDelete[id] = elt;
    }
    else if (elt && isVertexAngle(elt)) {
      anglesToDelete[id] = elt;
    }
    else if (elt) {
      // Other object types (lines, circles, etc.) are passed through for deletion
      othersToDelete.push(id);
    }
  });

  // "Fully selected" polygons means polygons where all of their vertices are selected
  const fullySelectedPolygons = Object.entries(polygonVertexMap)
    .filter(([polyId, vertexIds]) => {
      const poly = getPolygon(board, polyId)!;
      return vertexIds.length === poly.vertices.length - 1; })
    .map(([polyId, poly]) => polyId);

  // Implement intuitive behavior for deleting a polygon that may be connected to other polygons.
  // Polygons that are fully selected are deleted, but any of their points that are shared
  // with a polygon that is NOT fully selected, are NOT deleted.
  const pointsToDelete = selectedPoints;
  each(fullySelectedPolygons, polyId => {
    each(polygonVertexMap[polyId], vertexId => {
      const externalPolygon = vertexPolygonMap[vertexId].find(pId => !fullySelectedPolygons.includes(pId));
      if (externalPolygon) {
        // Do not actually delete this point, it connects to a polygon that should not be altered.
        remove(pointsToDelete, v => v===vertexId);
      }
    });
  });

  // Remove vertices that are going to be deleted from polygons,
  // and find polygons that need to be deleted since they lost most or all of their points.
  each(polygonVertexMap, (vertexIds, polygonId) => {
    const polygon = getObjectById(board, polygonId) as JXG.Polygon;
    const vertexCount = polygon.vertices.length - 1;
    const deleteCount = vertexIds.filter(id=>pointsToDelete.includes(id)).length;

    // Remove polygons that will have 0 or 1 points left.
    if (fullySelectedPolygons.includes(polygonId) || vertexCount - deleteCount <= 1) {
      if (!polygonsToDelete[polygonId]) {
        polygonsToDelete[polygonId] = polygon;
      }
    } else {
      // Leave this polygon, but remove points that will be deleted from it.
      const deletePoints = polygon.vertices.filter(v => pointsToDelete.includes(v.id));
      if (deletePoints.length) {
        each(deletePoints, v => polygon.removePoints(v));
        setPolygonEdgeColors(polygon);
      }
    }
  });

  // identify angle labels to delete
  each(pointsToDelete, pointId => {
    const vertex = getPoint(board, pointId)!;
    each(vertex.childElements, child => {
      if (isVertexAngle(child)) {
        if (!anglesToDelete[child.id]) {
          anglesToDelete[child.id] = child;
        }
      }
    });
  });

  // return adjusted list of ids to delete
  return [...pointsToDelete, ...Object.keys(polygonsToDelete), ...Object.keys(anglesToDelete), ...othersToDelete];
}

function setPropertiesForPolygonLabelOption(polygon: JXG.Polygon) {
  const labelOption = polygon.getAttribute("clientLabelOption") || ELabelOption.kNone;
  switch (labelOption) {
    case ELabelOption.kLength:
      polygon.setAttribute({
        withLabel: true,
        name() { return polygon.Area().toFixed(2); }
      });
      break;
    case ELabelOption.kLabel:
      polygon.setAttribute({
        withLabel: true,
        name: polygon.getAttribute("clientName")
      });
      break;
    default:
      polygon.setAttribute({
        withLabel: false
      });
  }
}

function segmentNameLabelFn(line: JXG.Line) {
  let p1Name = line.point1.getName();
  if (typeof p1Name === "function") {
    p1Name = line.point1.getAttribute("clientName");
  }
  let p2Name = line.point2.getName();
  if (typeof p2Name === "function") {
    p2Name = line.point2.getAttribute("clientName");
  }
  return `${p1Name}${p2Name}`;
}

function segmentNameLengthFn(this: JXG.Line) {
  return JXG.toFixed(this.L(), 1);
}

function updateSegmentLabelOption(board: JXG.Board, change: JXGChange) {
  const segment = getPolygonEdge(board, change.targetID as string, change.parents as string[]);
  if (segment) {
    const labelOption = (!Array.isArray(change.properties) && change.properties?.labelOption)
      || ELabelOption.kNone;

    const nameOption = (!Array.isArray(change.properties) && change.properties?.name)
      || segmentNameLabelFn(segment);

    segment._set("clientLabelOption", labelOption);
    segment._set("clientName", nameOption);

    const name = labelOption === "label"
      ? nameOption
      : labelOption === "length"
        ? segmentNameLengthFn
        : "";

    segment.setAttribute({ name, withLabel: labelOption !== ELabelOption.kNone });
  }
}

function updatePolygonVertices(board: JXG.Board, polygonId: string, vertexIds: JXGParentType[]) {
  // Remove the old polygon and create a new one.
  const oldPolygon = getPolygon(board, polygonId);
  const colorScheme = oldPolygon?.getAttribute("colorScheme");
  if (!oldPolygon) return;
  board.removeObject(oldPolygon);
  const vertices: JXG.Point[]
    = vertexIds.map(v => typeof(v)==='string' ? getPoint(board, v) : undefined)
    .filter(notEmpty);
  const props = {
    id: polygonId, // re-use the same ID
    colorScheme,
    ...getPolygonVisualProps(false, colorScheme)
  };
  const polygon = board.create("polygon", vertices, props) as JXG.Polygon;


  // Without deleting/rebuilding, would look something like this (but this fails due to apparent bugs in JSXGraph 1.4.x)
  // const polygon = getPolygon(board, polygonId);
  // if (!polygon) return;

  // const existingVertices = polygon.vertices;
  // const newVertices: JXG.Point[]
  //   = vertexIds.map(v => typeof(v)==='string' ? getPoint(board, v) : undefined)
  //     .filter(notEmpty);

  // const addedVertices = newVertices.filter(v => !existingVertices.includes(v));
  // const removedVertices = existingVertices.filter(v => !newVertices.includes(v));

  // console.log('current:', existingVertices.map(v=>`${v.id}${v.getAttribute('isPhantom')?'*':''}`));
  // console.log('adding:', addedVertices.map(v=>`${v.id}${v.getAttribute('isPhantom')?'*':''}`),
  //   'removing:', removedVertices.map(v=>`${v.id}${v.getAttribute('isPhantom')?'*':''}`));

  // for (const v of removedVertices) {
  //   polygon.removePoints(v);
  // }
  // for (const v of addedVertices) {
  //   polygon.addPoints(v);
  // }
  // console.log('final:', polygon.vertices.map(v=>`${v.id}${v.getAttribute('isPhantom')?'*':''}`));

  setPolygonEdgeColors(polygon);
  return polygon;
}

export const polygonChangeAgent: JXGChangeAgent = {
  create: (board, change) => {
    const _board = board as JXG.Board;
    const parents = (change.parents || [])
      .map(id => getObjectById(_board, id as string))
      .filter(notEmpty);
    if (change.parents?.length !== parents.length) {
      console.warn("Some points were missing when creating polygon");
    }
    const colorScheme = !Array.isArray(change.properties) && change.properties?.colorScheme;
    const props = {
      id: uniqueId(),
      ...getPolygonVisualProps(false, colorScheme||0),
      ...change.properties
    };
    const poly = parents.length ? _board.create("polygon", parents, props) as JXG.Polygon : undefined;
    if (poly) {
      setPropertiesForPolygonLabelOption(poly);
      setPolygonEdgeColors(poly);
    }
    return poly;
  },

  update: (board, change) => {
    // Parents and a labelOption means we're updating a segment label
    if ((change.target === "polygon") && change.parents &&
        !Array.isArray(change.properties) && change.properties?.labelOption) {
      updateSegmentLabelOption(board, change);
      return;
    }
    // labelOption without parents is updating the polygon's label
    if (change.target === "polygon" &&
        change.targetID && !Array.isArray(change.targetID) &&
        !Array.isArray(change.properties) && change.properties?.labelOption) {
      const polygon = getPolygon(board, change.targetID);
      if (isPolygon(polygon)) {
        polygon._set("clientLabelOption", change.properties.labelOption);
        polygon._set("clientName", change.properties.clientName);
        setPropertiesForPolygonLabelOption(polygon);
      }
      return;
    }
    // An update with an array of parents is considered to be a request to update the list of vertices.
    if ((change.target === "polygon")
      && change.targetID && !Array.isArray(change.targetID)
      && change.parents && Array.isArray(change.parents)) {
      return updatePolygonVertices(board, change.targetID, change.parents);
    }
    // other updates can be handled generically
    return objectChangeAgent.update(board, change);
  },

  // delete can be handled generically
  delete: objectChangeAgent.delete
};
