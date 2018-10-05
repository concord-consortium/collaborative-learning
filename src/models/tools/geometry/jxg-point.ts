import { JXGChangeAgent } from "./jxg-changes";
import { objectChangeAgent } from "./jxg-object";
import { assign, size } from "lodash";
import * as uuid from "uuid/v4";

export const isPoint = (v: any) => v instanceof JXG.Point;

export const isVisiblePoint = (v: any) => isPoint(v) && v.visProp.visible;

export const isFreePoint = (v: any) => isVisiblePoint(v) &&
                                        (size(v.childElements) <= 1) &&
                                        (size(v.descendants) <= 1);

export const pointChangeAgent: JXGChangeAgent = {
  create: (board, change) => {
    const changeProps: any = change.properties || {};
    const props = changeProps.id
                    ? changeProps
                    // If id is not provided we generate one, but this will prevent
                    // model-level synchronization. This should only occur for very
                    // old geometry tiles created before the introduction of the uuid.
                    : assign({ id: uuid() }, changeProps);
    return (board as JXG.Board).create("point", change.parents, props);
  },

  // update can be handled generically
  update: objectChangeAgent.update,

  // delete can be handled generically
  delete: objectChangeAgent.delete
};
