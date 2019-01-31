import { JXGChangeAgent } from "./jxg-changes";
import { objectChangeAgent } from "./jxg-object";
import { castArray, values } from "lodash";
import { isPoint } from "./jxg-point";

export const isMovableLine = (v: any) => {
  return v && (v.elType === "line") && (v.getAttribute("clientType") === kMovableLineType);
};

export const isVisibleMovableLine = (v: any) => isMovableLine && v.visProp.visible;

export const kMovableLineType = "movableLine";

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
        clientFillColor: kMovableLineDefaults.fillColor,
        clientStrokeColor: kMovableLineDefaults.strokeColor,
        clientSelectedFillColor: kMovableLineDefaults.selectedFillColor,
        clientSelectedStrokeColor: kMovableLineDefaults.selectedStrokeColor,
      };

const lineSpecificProps = {
  highlightStrokeOpacity: .5,
  highlightStrokeColor: kMovableLineDefaults.strokeColor,
  firstArrow: true,
  lastArrow: true,
};

const pointSpecificProps = {
  highlightStrokeColor: darkBlue,
  name: "",
};

const removeLine = (line: JXG.Line, board: JXG.Board) => {
  board.removeObject(line);
  board.removeObject(line.point1);
  board.removeObject(line.point2);
};

export const movableLineChangeAgent: JXGChangeAgent = {
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
          return this.getSlope && this.getRise && this.getSlope() !== Infinity
            ? this.getRise() >= 0
              ? `y = ${JXG.toFixed(this.getSlope(), 1)}x + ${JXG.toFixed(this.getRise(), 1)}`
              : `y = ${JXG.toFixed(this.getSlope(), 1)}x \u2212 ${JXG.toFixed(this.getRise() * -1, 1)}`
            : "";
        }
      };

      const line = (board as JXG.Board).create(
        "line",
        [interceptPoint, slopePoint],
        {
          ...lineProps,
          id,
          withLabel: true,
          label: {
            position: "top",
            anchorY: "bottom",
            fontSize: 15
          },
          ...overrides
        });

      return [line, interceptPoint, slopePoint];
    }
  },

  // update can be handled generically
  update: objectChangeAgent.update,

  delete: (board, change) => {
    if (!change.targetID) return;
    const ids = castArray(change.targetID);
    ids.forEach((id) => {
      const obj = board.objects[id] as JXG.GeometryElement;
      if (isPoint(obj)) {
        const point = obj as JXG.Point;
        const line = values(point.childElements).find(elem => elem.elType === "line");
        if (line) {
          removeLine(line as JXG.Line, board);
        }
      }
      if (isMovableLine(obj)) {
        removeLine(obj as JXG.Line, board);
      }
    });
    board.update();
  }
};
