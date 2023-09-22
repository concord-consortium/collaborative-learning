import { castArray, find, uniqWith } from "lodash";
import { getBaseAxisLabels, getObjectById } from "./jxg-board";
import { JXGChangeAgent } from "./jxg-changes";
import { objectChangeAgent } from "./jxg-object";
import { syncClientColors } from "./jxg-point";
import {
  getMovableLinePointIds, isBoard, isMovableLine, isMovableLineControlPoint, isMovableLineLabel, kMovableLineType
} from "./jxg-types";
import { uniqueId } from "../../../utilities/js-utils";

// Returns the two points where the given line intersects the given board, sorted from left to right
export const getBoundingBoxIntersections = (slope: number, intercept: number, board: JXG.Board) => {
  const boundingBox = board.getBoundingBox();
  const leftX = boundingBox[0];
  const topY = boundingBox[1];
  const rightX = boundingBox[2];
  const bottomY = boundingBox[3];
  const topIntersection = [solveForX(slope, intercept, topY), topY];
  const rightIntersection = [rightX, solveForY(slope, intercept, rightX)];
  const bottomIntersection = [solveForX(slope, intercept, bottomY), bottomY];
  const leftIntersection = [leftX, solveForY(slope, intercept, leftX)];
  // There will be duplicate intersection points if the line intersects a corner
  const uniqueIntersections = uniqWith(
    [topIntersection, rightIntersection, bottomIntersection, leftIntersection],
    (point, otherPoint) => {
      return (
        // Floating point equality test
        Math.abs(point[0] - otherPoint[0]) < Number.EPSILON && Math.abs(point[1] - otherPoint[1]) < Number.EPSILON
      );
    }
  );
  return uniqueIntersections
    .filter(pt => {
      return pt[0] >= leftX && pt[0] <= rightX && pt[1] >= bottomY && pt[1] <= topY;
    })
    .sort((a, b) => a[0] - b[0]);
};

export const solveForY = (slope: number, intercept: number, x: number) => {
  return slope * x + intercept;
};

export const solveForX = (slope: number, intercept: number, y: number) => {
  return (y - intercept) / slope;
};

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
  snapToGrid: false,
  highlightStrokeColor: darkBlue,
  clientUndeletable: true,
  showInfobox: false,
  name: "",
};

// given a movable line or its label or one of its control points, return the line itself
export function findMovableLineRelative(obj: JXG.GeometryElement): JXG.Line | undefined {
  if (isMovableLine(obj)) return obj;
  if (isMovableLineControlPoint(obj)) {
    return find(obj.childElements, isMovableLine);
  }
  if (isMovableLineLabel(obj)) {
    return find(obj.ancestors, isMovableLine);
  }
}

export const movableLineChangeAgent: JXGChangeAgent = {
  create: (board, change, context) => {
    const { id, pt1, pt2, line, ...shared }: any = change.properties || {};
    const lineId = id || uniqueId();
    const props = syncClientColors({ ...sharedProps, ...shared });
    const lineProps = { ...props, ...lineSpecificProps, ...line };
    const pointProps = { ...props, ...pointSpecificProps };
    const pointIds = getMovableLinePointIds(lineId);

    if (change.parents && change.parents.length === 2) {
      const interceptPoint = (board as JXG.Board).create(
        "point",
        change.parents[0],
        {
          id: pointIds[0],
          ...pointProps,
          ...pt1,
        }
      );
      const slopePoint = (board as JXG.Board).create(
        "point",
        change.parents[1],
        {
          id: pointIds[1],
          ...pointProps,
          ...pt2,
        }
      );
      const overrides: any = {
        name() {
          const disableEquation = context && context.isFeatureDisabled &&
                                    context.isFeatureDisabled("GeometryMovableLineEquation");
          const [xName, yName] = isBoard(board) ? getBaseAxisLabels(board) : ["x", "y"];
          return !disableEquation && this.getSlope && this.getRise && isFinite(this.getSlope())
            ? this.getRise() >= 0
              ? `${yName} = ${JXG.toFixed(this.getSlope(), 1)}${xName} + ${JXG.toFixed(this.getRise(), 1)}`
              : `${yName} = ${JXG.toFixed(this.getSlope(), 1)}${xName} \u2212 ${JXG.toFixed(this.getRise() * -1, 1)}`
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
            fontSize: 15,
            offset: [25, 0],
            clientType: kMovableLineType,
            fixed: false
          },
          ...line,
          ...overrides
        });
      const label = movableLine && movableLine.label;

      return [movableLine, interceptPoint, slopePoint, label];
    }
  },

  // update can be handled generically
  update: objectChangeAgent.update,

  delete: (board, change) => {
    if (!change.targetID) return;
    const ids = castArray(change.targetID);
    ids.forEach((id) => {
      const obj = getObjectById(board, id);
      if (isMovableLine(obj)) {
        const line = obj;
        board.removeObject(line);
        board.removeObject(line.point1);
        board.removeObject(line.point2);
      }
    });
    board.update();
  }
};
