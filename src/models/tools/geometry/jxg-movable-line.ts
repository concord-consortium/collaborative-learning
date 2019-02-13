import { JXGChangeAgent } from "./jxg-changes";
import { objectChangeAgent } from "./jxg-object";
import { syncClientColors } from "./jxg-point";
import { castArray } from "lodash";
import { uniqueId } from "../../../utilities/js-utils";

export const isMovableLine = (v: any) => {
  return v && (v.elType === "line") && (v.getAttribute("clientType") === kMovableLineType);
};

export const isVisibleMovableLine = (v: any) => isMovableLine(v) && v.visProp.visible;

export const isMovableLineControlPoint = (v: any) => {
  return v instanceof JXG.Point && v.getAttribute("clientType") === kMovableLineType;
};

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

export const movableLineChangeAgent: JXGChangeAgent = {
  create: (board, change) => {
    const { id, pt1, pt2, line, ...shared }: any = change.properties || {};
    const lineId = id || uniqueId();
    const props = syncClientColors({...sharedProps, ...shared });
    const lineProps = {...props, ...lineSpecificProps, ...line };
    const pointProps = {...props, ...pointSpecificProps};

    if (change.parents && change.parents.length === 2) {
      const interceptPoint = (board as JXG.Board).create(
        "point",
        change.parents[0],
        {
          id: `${lineId}-point1`,
          ...pointProps,
          ...pt1,
          clientUndeletable: true
        }
      );
      const slopePoint = (board as JXG.Board).create(
        "point",
        change.parents[1],
        {
          id: `${lineId}-point2`,
          ...pointProps,
          ...pt2,
          clientUndeletable: true
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

      const movableLine = (board as JXG.Board).create(
        "line",
        [interceptPoint, slopePoint],
        {
          ...lineProps,
          id: lineId,
          withLabel: true,
          label: {
            position: "top",
            anchorY: "bottom",
            fontSize: 15
          },
          ...line,
          ...overrides
        });

      return [movableLine, interceptPoint, slopePoint];
    }
  },

  // update can be handled generically
  update: objectChangeAgent.update,

  delete: (board, change) => {
    if (!change.targetID) return;
    const ids = castArray(change.targetID);
    ids.forEach((id) => {
      const obj = board.objects[id] as JXG.GeometryElement;
      if (isMovableLine(obj)) {
        const line = obj as JXG.Line;
        board.removeObject(line);
        board.removeObject(line.point1);
        board.removeObject(line.point2);
      }
    });
    board.update();
  }
};
