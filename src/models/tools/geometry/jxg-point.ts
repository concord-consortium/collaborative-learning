import { getElementByUuid } from "./jxg-board";
import { JXGChangeAgent } from "./jxg-changes";
import * as uuid from "uuid/v4";

export const isPoint = (v: any) => v instanceof JXG.Point;

export const pointChangeAgent: JXGChangeAgent = {
  create: (board, change) => {
    const { _uuid_, ...otherProps } = (change.properties || {}) as any;
    const pt = (board as JXG.Board).create("point", change.parents, otherProps);
    if (pt) {
      // If uuid is not provided we generate one, but this will prevent
      // model-level synchronization. This should only occur for very
      // old geometry tiles created before the introduction of the uuid.
      pt._uuid_ = _uuid_ || uuid();
    }
    return pt;
  },

  update: (board, change) => {
    if (!change.targetID || !change.properties) { return; }
    const ids = Array.isArray(change.targetID) ? change.targetID : [change.targetID];
    const props = Array.isArray(change.properties) ? change.properties : [change.properties];
    ids.forEach((id, index) => {
      const pt = getElementByUuid(board, id) as JXG.Point;
      if (pt) {
        const p = props[index];
        if (p.position != null) {
          pt.setPosition(JXG.COORDS_BY_USER, p.position);
        }
      }
    });
    board.update();
  },

  delete: (board, change) => {
    // delete stuff
  }
};
