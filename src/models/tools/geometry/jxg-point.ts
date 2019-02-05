import { JXGChangeAgent } from "./jxg-changes";
import { objectChangeAgent } from "./jxg-object";
import { assign, size, values } from "lodash";
import * as uuid from "uuid/v4";
import { isAnnotationType } from "./jxg-annotation";

export const isPoint = (v: any) => v instanceof JXG.Point;

export const isVisiblePoint = (v: any) => isPoint(v) && v.visProp.visible;

export const isFreePoint = (v: any) => {
  if (isVisiblePoint(v)) {
    const point = v as JXG.Point;
    return values(point.childElements).filter(el => !isAnnotationType(el)).length <= 1 &&
           values(point.descendants).filter(el => !isAnnotationType(el)).length <= 1;
  }
};

// For snap to grid
const kPrevSnapUnit = 0.2;
export const kSnapUnit = 0.1;

export const kPointDefaults = {
              fillColor: "#CCCCCC",
              strokeColor: "#888888",
              selectedFillColor: "#FF0000",
              selectedStrokeColor: "#FF0000"
            };

const defaultProps = {
        fillColor: kPointDefaults.fillColor,
        strokeColor: kPointDefaults.strokeColor
      };

export const pointChangeAgent: JXGChangeAgent = {
  create: (board, change) => {
    const changeProps: any = change.properties || {};
    const props = assign(
                    // If id is not provided we generate one, but this will prevent
                    // model-level synchronization. This should only occur for very
                    // old geometry tiles created before the introduction of the uuid.
                    changeProps.id ? {} : { id: uuid() },
                    defaultProps, changeProps);
    if (props.snapSizeX === kPrevSnapUnit) {
      props.snapSizeX = kSnapUnit;
    }
    if (props.snapSizeY === kPrevSnapUnit) {
      props.snapSizeY = kSnapUnit;
    }
    return (board as JXG.Board).create("point", change.parents, props);
  },

  // update can be handled generically
  update: objectChangeAgent.update,

  // delete can be handled generically
  delete: objectChangeAgent.delete
};
