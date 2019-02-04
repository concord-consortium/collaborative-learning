import { JXGChangeAgent } from "./jxg-changes";
import { castArray, size } from "lodash";

// Inexplicably, we occasionally encounter JSXGraph objects with null
// transformations which cause JSXGraph to crash. Until we figure out
// the root cause of this phenomenon, this utility eliminates the nulls.
function validateTransformations(elt: JXG.GeometryElement) {
  elt.transformations = (elt.transformations || []).filter(t => t != null);
}

export const objectChangeAgent: JXGChangeAgent = {
  create: (board, change) => {
    // can't create generic objects
    return undefined;
  },

  update: (board, change) => {
    if (!change.targetID || !change.properties) { return; }
    const ids = castArray(change.targetID);
    const props = castArray(change.properties);
    ids.forEach((id, index) => {
      const obj = board.objects[id] as JXG.GeometryElement;
      const objProps = index < props.length ? props[index] : props[0];
      if (obj && objProps) {
        const { position, ...others } = objProps;
        if (position != null) {
          validateTransformations(obj);
          obj.setPosition(JXG.COORDS_BY_USER, position);
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
    const ids = Array.isArray(change.targetID) ? change.targetID : [change.targetID];
    ids.forEach((id) => {
      const obj = board.objects[id] as JXG.GeometryElement;
      if (obj) {
        board.removeObject(obj);
      }
    });
    board.update();
  }
};
