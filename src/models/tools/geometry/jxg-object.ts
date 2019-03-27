import { sortByCreation, kReverse } from "./jxg-board";
import { JXGChangeAgent, JXGProperties, JXGCoordPair, JXGUnsafeCoordPair } from "./jxg-changes";
import { castArrayCopy } from "../../../utilities/js-utils";
import { castArray, size } from "lodash";

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
    ids.forEach((id, index) => {
      const obj = board.objects[id] as JXG.GeometryElement;
      const objProps = index < props.length ? props[index] : props[0];
      if (obj && objProps) {
        const { position, ...others } = objProps;
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
        if (size(others)) {
          obj.setAttribute(others);
        }
      }
    });
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
