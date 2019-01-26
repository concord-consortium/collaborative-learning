import { JXGChangeAgent } from "./jxg-changes";
import { objectChangeAgent } from "./jxg-object";
import * as uuid from "uuid/v4";

export const isVisibleLine = (v: any) => (v.elType === "line") && v.visProp.visible;

// For snap to grid
const kPrevSnapUnit = 0.2;
export const kSnapUnit = 0.1;

const blue = "#009CDC";
const darkBlue = "#000099";

export const kLineDefaults = {
              fillColor: "#CCCCCC",
              strokeColor: "#009CDC",
              selectedFillColor: "#000099",
              selectedStrokeColor: "#000099"
            };

const sharedProps = {
        fillColor: kLineDefaults.fillColor,
        strokeColor: blue,
      };

const lineSpecificProps = {
  highlightStrokeOpacity: .5,
  strokeWidth: 5,
  highlightStrokeColor: blue,
};

const pointSpecificProps = {
  highlightStrokeColor: darkBlue,
  strokeWidth: 3
};

export const lineChangeAgent: JXGChangeAgent = {
  create: (board, change) => {
    const changeProps: any = change.properties || {};
    const props = {...sharedProps, ...changeProps};
    const lineProps = {...props, ...lineSpecificProps};
    const pointProps = {...props, ...pointSpecificProps};

    if (change.parents && change.parents.length === 2) {
      const interceptPoint = (board as JXG.Board).create("point", change.parents[0], {...pointProps, id: uuid()});
      const slopePoint = (board as JXG.Board).create("point", change.parents[1], {...pointProps, id: uuid()});

      return (board as JXG.Board).create(
        "line",
        [interceptPoint, slopePoint],
        {
          ...lineProps,
          id: uuid(),
          name: "y = mx + b",
          withLabel: true,
          label: {
            position: "top",
            anchorY: "bottom"
          }
        });
    }
  },

  // update can be handled generically
  update: objectChangeAgent.update,

  // delete can be handled generically
  delete: objectChangeAgent.delete
};
