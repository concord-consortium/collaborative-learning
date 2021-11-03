import { sortByCreation, kReverse, getObjectById, syncLinkedPoints } from "./jxg-board";
import {
  ITableLinkProperties, JXGChangeAgent, JXGCoordPair, JXGPositionProperty, JXGProperties
} from "./jxg-changes";
import { isLinkedPoint, isText } from "./jxg-types";
import { castArrayCopy } from "../../../utilities/js-utils";
import { castArray, size } from "lodash";

// Inexplicably, we occasionally encounter JSXGraph objects with null
// transformations which cause JSXGraph to crash. Until we figure out
// the root cause of this phenomenon, this utility eliminates the nulls.
function validateTransformations(elt: JXG.GeometryElement) {
  elt.transformations = (elt.transformations || []).filter(t => t != null);
}

export function isPositionGraphable(pos: JXGPositionProperty) {
  let xPos: number | undefined;
  let yPos: number | undefined;
  // some operations used normalized coordinates, which take the form [1, x, y]
  if (pos.length === 3) {
    [, xPos, yPos] = pos;
  }
  else {
    [xPos, yPos] = pos;
  }
  return xPos != null && yPos != null && isFinite(xPos) && isFinite(yPos);
}

export function getGraphablePosition(position: JXGPositionProperty) {
  // some operations used normalized coordinates, which take the form [1, x, y]
  const pos = position.length === 3 ? position.slice(1) : position;
  return pos.map(val => {
    if (val == null) return 0;
    const num = Number(val);
    return isFinite(num) ? num : 0;
  }) as JXGCoordPair;
}

export function getElementName(elt: JXG.GeometryElement) {
  return (typeof elt.name === "function") ? elt.name() : elt.name;
}

export const objectChangeAgent: JXGChangeAgent = {
  create: (board, change) => {
    // can't create generic objects
    return undefined;
  },

  update: (board, change) => {
    if (!change.targetID || !change.properties) { return; }
    const ids = castArray(change.targetID);
    const props: JXGProperties[] = castArray(change.properties);
    let hasSuspendedTextUpdates = false;
    let hasLinkedPoints = false;
    ids.forEach((id, index) => {
      const obj = getObjectById(board, id);
      if (isLinkedPoint(obj)) hasLinkedPoints = true;
      const textObj = isText(obj) ? obj : undefined;
      const objProps = index < props.length ? props[index] : props[0];
      if (obj && objProps) {
        const { position, text, ...others } = objProps;

        // Text coordinates are not updated until a redraw occurs. If redraws are
        // suspended, and a text object (e.g. a comment or its anchor) has moved, the
        // transform will be calculated from a stale position. We unsuspend updates to
        // force a refresh on coordinate positions.
        if (textObj && board.isSuspendedUpdate) {
          hasSuspendedTextUpdates = true;
          board.unsuspendUpdate();
        }
        if (position != null) {
          validateTransformations(obj);
          if (isPositionGraphable(position)) {
            obj.setPosition(JXG.COORDS_BY_USER, position as JXGCoordPair);
            obj.setAttribute({visible: true});
          } else {
            obj.setPosition(JXG.COORDS_BY_USER, getGraphablePosition(position));
            obj.setAttribute({visible: false});
          }
        }

        if (textObj && (text != null)) {
          textObj.setText(text);
        }
        if (size(others)) {
          obj.setAttribute(others);
        }
      }
    });
    if (hasLinkedPoints) syncLinkedPoints(board, change.links as ITableLinkProperties);
    if (hasSuspendedTextUpdates) board.suspendUpdate();
    board.update();
    return undefined;
  },

  delete: (board, change) => {
    if (!change.targetID) { return; }
    const ids = castArrayCopy(change.targetID);
    sortByCreation(board, ids, kReverse);
    // remove objects in reverse order of creation
    ids.forEach((id) => {
      const obj = getObjectById(board, id);
      obj && board.removeObject(obj);
    });
    board.update();
  }
};
