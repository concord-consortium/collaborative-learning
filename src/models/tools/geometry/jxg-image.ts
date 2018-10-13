import { JXGChange, JXGChangeAgent } from "./jxg-changes";
import { objectChangeAgent } from "./jxg-object";
import { assign } from "lodash";
import * as uuid from "uuid/v4";

export const isImage = (v: any) => v instanceof JXG.Image;

export const imageChangeAgent: JXGChangeAgent = {
  create: (board: JXG.Board, change: JXGChange) => {
    const parents = change.parents;
    const props = assign({ id: uuid() }, change.properties);
    return parents && parents.length >= 3
            ? board.create("image", change.parents, props)
            : undefined;
  },

  // update can be handled generically
  update: objectChangeAgent.update,

  // delete can be handled generically
  delete: objectChangeAgent.delete
};
