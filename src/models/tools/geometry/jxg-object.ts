import { JXGChangeAgent } from "./jxg-changes";
import { size } from "lodash";

export const objectChangeAgent: JXGChangeAgent = {
  create: (board, change) => {
    // can't create generic objects
    return undefined;
  },

  update: (board, change) => {
    if (!change.targetID || !change.properties) { return; }
    const ids = Array.isArray(change.targetID) ? change.targetID : [change.targetID];
    const props = Array.isArray(change.properties) ? change.properties : [change.properties];
    ids.forEach((id, index) => {
      const obj = board.objects[id] as JXG.GeometryElement;
      const objProps = index < props.length ? props[index] : props[0];
      if (obj && objProps) {
        const { position, ...others } = objProps;
        if (position != null) {
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
