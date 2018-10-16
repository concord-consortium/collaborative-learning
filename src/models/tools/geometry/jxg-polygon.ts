import { JXGChange, JXGChangeAgent } from "./jxg-changes";
import { objectChangeAgent } from "./jxg-object";
import { assign } from "lodash";
import * as uuid from "uuid/v4";

export const isPolygon = (v: any) => v instanceof JXG.Polygon;

export const polygonChangeAgent: JXGChangeAgent = {
  create: (board: JXG.Board, change: JXGChange) => {
    const parents = (change.parents || [])
                      .map(id => board.objects[id as string])
                      .filter(pt => pt != null);
    const props = assign({ id: uuid(), hasInnerPoints: true }, change.properties);
    return parents.length ? board.create("polygon", parents, props) : undefined;
  },

  // update can be handled generically
  update: objectChangeAgent.update,

  // delete can be handled generically
  delete: objectChangeAgent.delete
};
