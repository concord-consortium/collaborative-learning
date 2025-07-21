import { values } from "lodash";
import { Instance, SnapshotOut } from "mobx-state-tree";
import { GeometryElement } from "jsxgraph";
import { getAssociatedPolygon } from "./jxg-polygon";
import { isCircle, isGeometryElement, isPoint, isPolygon } from "./jxg-types";
import { JXGObjectType } from "./jxg-changes";
import { logTileChangeEvent } from "../log/log-tile-change-event";
import { LogEventName } from "../../../lib/logger-types";
import { GeometryBaseContentModel } from "./geometry-model";
import { getTileIdFromContent } from "../tile-model";
import { isFiniteNumber } from "../../../utilities/math-utils";
import { clueBasicDataColorInfo } from "../../../utilities/color-utils";
import { GeometryContentModel } from "./geometry-content";
import { SharedModelEntrySnapshotType } from "../../document/shared-model-entry";
import { replaceJsonStringsWithUpdatedIds, UpdatedSharedDataSetIds } from "../../shared/shared-data-set";
import { IClueObjectSnapshot } from "../../annotations/clue-object";
import { linkedPointId, splitLinkedPointId } from "../table-link-types";
import { BoundingBox } from "../navigatable-tile-model";

export function copyCoords(coords: JXG.Coords) {
  const usrCoords = coords.usrCoords;
  if (usrCoords.length >=3 ) {
    const shortCoords: [number,number] = [usrCoords[1],usrCoords[2]];
    return new JXG.Coords(JXG.COORDS_BY_USER, shortCoords, coords.board);
  } else {
    // This should not happen, but return a default value to keep this method type-safe.
    return new JXG.Coords(JXG.COORDS_BY_USER, [0, 0], coords.board);
  }
}

// Define some helper functions to work around the typing of board.objectsList as unknown[].

export function getBoardObjectIds(board: JXG.Board): string[] {
  return Object.keys(board.objects);
}

export function getBoardObject(board: JXG.Board|undefined, id: string): JXG.GeometryElement|undefined {
  const obj = board && board.objects[id];
  return isGeometryElement(obj) ? obj : undefined;
}

export function forEachBoardObject(board: JXG.Board, callback: (elt: JXG.GeometryElement, index: number) => void) {
  board.objectsList.forEach((obj, index) => {
    if (isGeometryElement(obj)) { callback(obj, index); }
  });
}

export function findBoardObject(board: JXG.Board, callback: (elt: JXG.GeometryElement) => any):
    JXG.GeometryElement | undefined {
  const found = board.objectsList.find(obj => { return isGeometryElement(obj) && callback(obj); } );
  return isGeometryElement(found) ? found : undefined;
}

export function filterBoardObjects(board: JXG.Board,
    callback: (elt: JXG.GeometryElement) => any): JXG.GeometryElement[] {
  return board.objectsList.filter((obj) => isGeometryElement(obj) && callback(obj)) as JXG.GeometryElement[];
}

export function getPoint(board: JXG.Board, id: string): JXG.Point|undefined {
  const obj = board.objects[id];
  return isPoint(obj) ? obj : undefined;
}

export function getPolygon(board: JXG.Board, id: string): JXG.Polygon|undefined {
  const obj = board.objects[id];
  return isPolygon(obj) ? obj : undefined;
}

export function getCircle(board: JXG.Board, id: string): JXG.Circle|undefined {
  const obj = board.objects[id];
  return isCircle(obj) ? obj : undefined;
}

export function getBoardObjectsExtents(board: JXG.Board) {
  let xMax = 1;
  let yMax = 1;
  let xMin = -1;
  let yMin = -1;

  forEachBoardObject(board, (obj: GeometryElement) => {
    // Don't need to consider polygons since the extent of their points will be enough.
    if (isPoint(obj) || isCircle(obj)) {
      const [left, top, right, bottom] = obj.bounds();
      if (left < xMin) xMin = left - 1;
      if (right > xMax) xMax = right + 1;
      if (top > yMax) yMax = top + 1;
      if (bottom < yMin) yMin = bottom - 1;
    }
  });
  return { xMax, yMax, xMin, yMin };
}

/**
 * Convert a JSXGraph-style BoundingBox to a CLUE-style BoundingBox.
 */
export function formatAsBoundingBox(coordinates: [number, number, number, number]): BoundingBox {
  const [x1, y1, x2, y2] = coordinates;
  return { nw: { x: x1, y: y1 }, se: { x: x2, y: y2 } };
}

/**
 * Return a bounding box that includes the areas of both input bounding boxes.
 */
export function combineBoundingBoxes(b1: BoundingBox, b2: BoundingBox|undefined): BoundingBox {
  return {
    nw: { x: Math.min(b1.nw.x, b2?.nw.x ?? b1.nw.x), y: Math.min(b1.nw.y, b2?.nw.y ?? b1.nw.y) },
    se: { x: Math.max(b1.se.x, b2?.se.x ?? b1.se.x), y: Math.max(b1.se.y, b2?.se.y ?? b1.se.y) }
  };
}

/**
 * Remove the final item of the array if it is equal to the first item. JSXGraph
 * polygons' list of vertices includes the first vertex again at the end of the
 * list to show that it is closed. This method removes it for convenience in
 * manipulating the list.
 * @param ids
 * @returns the array, which has been modified in-place.
 */
export function removeClosingVertexId(ids: string[]) {
  if (ids.length >= 2 && ids[0] === ids[ids.length-1]) {
    ids.pop();
  }
  return ids;
}

/**
 * Adds a vertex ID to the list of existing IDs.
 * JSX Graph will append the first ID to the end of its list of vertices to close the shape.
 * So, this method removes the last ID before appending if it is the same as the first one.
 * @param existingIds
 * @param newId
 * @returns the extended list
 */
export function appendVertexId(existingIds: string[], newId: string): string[] {
  const result: string[] = [...existingIds];
  removeClosingVertexId(result);
  result.push(newId);
  return result;
}

// cf. https://jsxgraph.uni-bayreuth.de/wiki/index.php/Browser_event_and_coordinates
export function getEventCoords(board: JXG.Board, evt: any, scale?: number, index?: number) {
  const _index = index != null
                  ? index
                  : (evt[JXG.touchProperty] ? 0 : undefined);
  const cPos = board.getCoordsTopLeftCorner();
  const absPos = JXG.getPosition(evt, _index);
  const dx = (absPos[0] - cPos[0]) / (scale || 1);
  const dy = (absPos[1] - cPos[1]) / (scale || 1);

  return new JXG.Coords(JXG.COORDS_BY_SCREEN, [dx, dy], board);
}

export function isDragTargetOrAncestor(elt: JXG.GeometryElement, dragTarget?: JXG.GeometryElement) {
  if (!dragTarget) return false;
  return (elt.id === dragTarget.id) ||
          (values(dragTarget.ancestors)
            .findIndex(ancestor => ancestor.id === elt.id) >= 0);

}

function isPreferredClickableObject(current: JXG.GeometryElement | undefined, proposed: JXG.GeometryElement) {
  if (!current) return true;
  // treat polygons as independent layers
  const currentPolygon = getAssociatedPolygon(current);
  const proposedPolygon = getAssociatedPolygon(proposed);
  if (currentPolygon !== proposedPolygon) return true;
  if (!isFiniteNumber(current.visProp.layer)) return true;
  return (isFiniteNumber(proposed.visProp.layer) && proposed.visProp.layer >= current.visProp.layer);
}

// TODO: this may no longer be necessary, since JSXGraph now supports customizing the layering of objects.
// There is a global seting for what layers different types of objects go into, and also a "layer" property
// on all geometry objects, and JSXGraph's click and drag handlers should respect these.
//
// Here is the original comment for this function, which I believe is outdated as of 2024:
//   Note: Our layering logic is different from JSXGraph's. When clicks occur on overlapping objects,
//   we may select one object, but JSXGraph may drag another. For now this is preferable to adopting
//   the JSXGraph layering model in which all points are above all segments which are above all
//   polygons. Fixing the drag behavior would require internal changes to JSXGraph.
export function getClickableObjectUnderMouse(board: JXG.Board, evt: any, draggable: boolean, scale?: number):
    JXG.GeometryElement|undefined {
  const coords = getEventCoords(board, evt, scale);
  const [ , x, y] = coords.scrCoords;
  let dragEl: JXG.GeometryElement|undefined = undefined;
  forEachBoardObject(board, pEl => {
    const hasPoint = pEl && pEl.hasPoint && pEl.hasPoint(x, y);
    const isFixed = pEl && !!pEl.getAttribute("fixed"); // !Type.evaluate(pEl.visProp.fixed)
    const isDraggable = pEl.isDraggable && !isFixed;
    if (hasPoint && !!pEl.visPropCalc.visible && (!draggable || isDraggable)) {
      if (isPreferredClickableObject(dragEl, pEl)) {
        dragEl = pEl;
      }
    }
  });
  return dragEl;
}

// Replacement for Board.getAllObjectsUnderMouse() which doesn't handle scaled coordinates
export function getAllObjectsUnderMouse(board: JXG.Board, evt: any, scale?: number) {
  const coords = getEventCoords(board, evt, scale);
  return filterBoardObjects(board, obj => {
    return obj.visPropCalc.visible && obj.hasPoint &&
            obj.hasPoint(coords.scrCoords[1], coords.scrCoords[2]);
  });
}

export function rotateCoords(coords: JXG.Coords, center: JXG.Coords, angle: number) {
  // express x, y relative to center of rotation
  const dx = coords.usrCoords[1] - center.usrCoords[1];
  const dy = coords.usrCoords[2] - center.usrCoords[2];
  // rotate
  const sinAngle = Math.sin(angle);
  const cosAngle = Math.cos(angle);
  let x = dx * cosAngle - dy * sinAngle;
  let y = dx * sinAngle + dy * cosAngle;
  // offset back to original location
  x += center.usrCoords[1];
  y += center.usrCoords[2];
  return new JXG.Coords(JXG.COORDS_BY_USER, [x, y], coords.board);
}

export function logGeometryEvent(model: Instance<typeof GeometryBaseContentModel>,
    operation: string, target: JXGObjectType, targetId?: string|string[],
    more?: { text?: string, labelOption?: string, filename?: string, userAction?: string }) {
  const tileId = getTileIdFromContent(model) || "";
  const change = {
    target,
    targetId,
    ...more
  };
  logTileChangeEvent(LogEventName.GEOMETRY_TOOL_CHANGE, {
    tileId,
    operation,
    change
  });
}

export function fillPropsForColorScheme(colorScheme: number) {
  const spec = clueBasicDataColorInfo[colorScheme % clueBasicDataColorInfo.length];
  return {
    fillColor: spec.color,
    highlightFillColor: spec.color
  };
}

export function strokePropsForColorScheme(colorScheme: number) {
  const spec = clueBasicDataColorInfo[(colorScheme||0) % clueBasicDataColorInfo.length];
  return {
    strokeColor: spec.color,
    highlightStrokeColor: spec.color
  };
}

// The geometry model uses IDs of the Attributes and Cases in the shared dataset
// when listing the vertices of polygons formed with these points.  These need
// to be updated to the new values when a tile is copied.
export function updateGeometryContentWithNewSharedModelIds(
  content: SnapshotOut<typeof GeometryContentModel>,
  sharedDataSetEntries: SharedModelEntrySnapshotType[],
  updatedSharedModelMap: Record<string, UpdatedSharedDataSetIds>
) {
  return replaceJsonStringsWithUpdatedIds(content, '[":]', ...Object.values(updatedSharedModelMap));
}

// Update an annotated object with new IDs after copy.
// Geometry object types are: point, linkedPoint, segment, polygon
// Of these, only linkedPoint needs to be modified
export function updateGeometryObjectWithNewSharedModelIds(
    object: IClueObjectSnapshot,
    sharedDataSetEntries: SharedModelEntrySnapshotType[],
    updatedSharedModelMap: Record<string, UpdatedSharedDataSetIds>) {
  if (object.objectType === "linkedPoint") {
    const [caseId, attrId] = splitLinkedPointId(object.objectId);
    // The ID values don't distinguish which shared model they came from, so we loop through the options.
    for (const updates of Object.values(updatedSharedModelMap)) {
      if (caseId in updates.caseIdMap && attrId in updates.attributeIdMap) {
        object.objectId = linkedPointId(updates.caseIdMap[caseId], updates.attributeIdMap[attrId]);
        return object;
      }
    }
    console.warn("Could not find new IDs for object:", object);
  }
  return object;
}
