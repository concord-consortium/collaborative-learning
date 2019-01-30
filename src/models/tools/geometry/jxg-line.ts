import { JXGChangeAgent } from "./jxg-changes";
import { objectChangeAgent } from "./jxg-object";
import * as uuid from "uuid/v4";

export const isMovableLine = (v: any) => (v.elType === "line") && (v.getAttribute("clientType") === kMovableLineType);

export const isVisibleMovableLine = (v: any) => isMovableLine && v.visProp.visible;

export const clampControlPoint = (x: number, y: number, slope: number, intercept: number, board: JXG.Board) => {
  let newX = x;
  let newY = y;
  const boundingBox = board.attr.boundingbox;
  if (newX < boundingBox[0]) {
    newX = boundingBox[0];
    newY = solveForY(slope, intercept, newX);
  }
  if (newX > boundingBox[2]) {
    newX = boundingBox[2];
    newY = solveForY(slope, intercept, newX);
  }
  if (newY > boundingBox[1]) {
    newY = boundingBox[1];
    newX = solveForX(slope, intercept, newY);
  }
  if (newY < boundingBox[3]) {
    newY = boundingBox[3];
    newX = solveForX(slope, intercept, newY);
  }
  return [newX, newY];
};

export const kMovableLineType = "movableLine";

const solveForY = (slope: number, intercept: number, x: number) => {
  return slope * x + intercept;
};

const solveForX = (slope: number, intercept: number, y: number) => {
  return (y - intercept) / slope;
};

// For snap to grid
const kPrevSnapUnit = 0.2;
export const kSnapUnit = 0.1;

const gray = "#CCCCCC";
const blue = "#009CDC";
const darkBlue = "#000099";

export const kMovableLineDefaults = {
              fillColor: gray,
              strokeColor: blue,
              selectedFillColor: darkBlue,
              selectedStrokeColor: darkBlue
            };

const sharedProps = {
        fillColor: kMovableLineDefaults.fillColor,
        strokeColor: kMovableLineDefaults.strokeColor,
        clientType: kMovableLineType,
        strokeWidth: 3,
      };

const lineSpecificProps = {
  highlightStrokeOpacity: .5,
  highlightStrokeColor: kMovableLineDefaults.strokeColor,
};

const pointSpecificProps = {
  highlightStrokeColor: darkBlue,
};

export const lineChangeAgent: JXGChangeAgent = {
  create: (board, change) => {
    const changeProps: any = change.properties || {};
    const props = {...sharedProps, ...changeProps};
    const lineProps = {...props, ...lineSpecificProps};
    const pointProps = {...props, ...pointSpecificProps};
    const id = changeProps.id;

    if (change.parents && change.parents.length === 2) {
      const interceptPoint = (board as JXG.Board).create(
        "point",
        change.parents[0],
        {
          ...pointProps,
          id: `${id}-point1`
        }
      );
      const slopePoint = (board as JXG.Board).create(
        "point",
        change.parents[1],
        {
          ...pointProps,
          id: `${id}-point2`
        }
      );
      const overrides = {
        name() {
          return this.getSlope && this.getRise
            ? `y = ${JXG.toFixed(this.getSlope(), 1)}x + ${JXG.toFixed(this.getRise(), 1)}`
            : "";
        }
      };

      return (board as JXG.Board).create(
        "line",
        [interceptPoint, slopePoint],
        {
          ...lineProps,
          id,
          withLabel: true,
          label: {
            position: "top",
            anchorY: "bottom"
          },
          ...overrides
        });
    }
  },

  // update can be handled generically
  update: objectChangeAgent.update,

  // delete can be handled generically
  delete: objectChangeAgent.delete
};
