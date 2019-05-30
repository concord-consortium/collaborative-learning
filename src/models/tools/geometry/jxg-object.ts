import { sortByCreation, kReverse } from "./jxg-board";
import { JXGChangeAgent, JXGProperties, JXGCoordPair, JXGUnsafeCoordPair } from "./jxg-changes";
import { castArrayCopy } from "../../../utilities/js-utils";
import { castArray, size } from "lodash";

export const isText = (v: any) => v instanceof JXG.Text;

// Inexplicably, we occasionally encounter JSXGraph objects with null
// transformations which cause JSXGraph to crash. Until we figure out
// the root cause of this phenomenon, this utility eliminates the nulls.
function validateTransformations(elt: JXG.GeometryElement) {
  elt.transformations = (elt.transformations || []).filter(t => t != null);
}

export function isPositionGraphable(pos: JXGUnsafeCoordPair) {
  return pos[0] != null && pos[1] != null && isFinite(pos[0]) && isFinite(pos[1]);
}

export function getGraphablePosition(pos: JXGUnsafeCoordPair) {
  return pos.map(val => {
    if (val == null) return 0;
    const num = Number(val);
    return isFinite(num) ? num : 0;
  }) as JXGCoordPair;
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
    ids.forEach((id, index) => {
      const obj = board.objects[id] as JXG.GeometryElement;
      const textObj = isText(obj) ? obj as JXG.Text : undefined;
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
    if (hasSuspendedTextUpdates) board.suspendUpdate();
    board.update();
},

  delete: (board, change) => {
    if (!change.targetID) { return; }
    const ids = castArrayCopy(change.targetID);
    sortByCreation(board, ids, kReverse);
    // remove objects in reverse order of creation
    ids.forEach((id) => {
      const obj = board.objects[id] as JXG.GeometryElement;
      if (obj) {
        board.removeObject(obj);
      }
    });
    board.update();
  }
};
