import { values } from "lodash";
import { Instance } from "mobx-state-tree";
import { getAssociatedPolygon } from "./jxg-polygon";
import { isPoint, isPolygon } from "./jxg-types";
import { JXGObjectType } from "./jxg-changes";
import { logTileChangeEvent } from "../log/log-tile-change-event";
import { LogEventName } from "../../../lib/logger-types";
import { GeometryBaseContentModel } from "./geometry-model";
import { getTileIdFromContent } from "../tile-model";

export function copyCoords(coords: JXG.Coords) {
  return new JXG.Coords(JXG.COORDS_BY_USER, coords.usrCoords.slice(1), coords.board);
}

export function getPoint(board: JXG.Board, id: string): JXG.Point|undefined {
  const obj = board.objects[id];
  return isPoint(obj) ? obj : undefined;
}

export function getPolygon(board: JXG.Board, id: string): JXG.Polygon|undefined {
  const obj = board.objects[id];
  return isPolygon(obj) ? obj : undefined;
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
  if (existingIds.length >= 2 && existingIds[0] === existingIds[existingIds.length-1]) {
    result.pop();
  }
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
  return (proposed.visProp.layer >= current.visProp.layer);
}

// Note: Our layering logic is different from JSXGraph's. When clicks occur on overlapping objects,
// we may select one object, but JSXGraph may drag another. For now this is preferable to adopting
// the JSXGraph layering model in which all points are above all segments which are above all
// polygons. Fixing the drag behavior would require internal changes to JSXGraph.
export function getClickableObjectUnderMouse(board: JXG.Board, evt: any, draggable: boolean, scale?: number) {
  const coords = getEventCoords(board, evt, scale);
  const [ , x, y] = coords.scrCoords;
  const count = board.objectsList.length;
  let dragEl;
  for (let i = 0; i < count; ++i) {
    const pEl = board.objectsList[i];
    const hasPoint = pEl && pEl.hasPoint && pEl.hasPoint(x, y);
    const isFixed = pEl && pEl.getAttribute("fixed"); // !Type.evaluate(pEl.visProp.fixed)
    const isDraggable = pEl.isDraggable && !isFixed;
    if (hasPoint && pEl.visPropCalc.visible && (!draggable || isDraggable)) {
      if (isPreferredClickableObject(dragEl, pEl)) {
        dragEl = pEl;
      }
    }
  }
  return dragEl;
}

// Replacement for Board.getAllObjectsUnderMouse() which doesn't handle scaled coordinates
export function getAllObjectsUnderMouse(board: JXG.Board, evt: any, scale?: number) {
  const coords = getEventCoords(board, evt, scale);
  return board.objectsList.filter(obj => {
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
