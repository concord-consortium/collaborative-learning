import { JXGChangeAgent } from "./jxg-changes";
import { objectChangeAgent } from "./jxg-object";
import { syncClientColors } from "./jxg-point";
import { castArray, each, find, uniqWith } from "lodash";
import { uniqueId } from "../../../utilities/js-utils";
import { GeometryContentModelType } from "./geometry-content";

export const isMovableLine = (v: any) => {
  return v && (v.elType === "line") && (v.getAttribute("clientType") === kMovableLineType);
};

export const isVisibleMovableLine = (v: any) => isMovableLine(v) && v.visProp.visible;

export const isMovableLineControlPoint = (v: any) => {
  return v instanceof JXG.Point && v.getAttribute("clientType") === kMovableLineType;
};

// When a control point is clicked, deselect the rest of the line so the line slope can be changed
export const handleControlPointClick = (point: JXG.Point, content: GeometryContentModelType) => {
  const line = find(point.descendants, el => isMovableLine(el));
  if (line) {
    content.deselectElement(line.id);
    each(line.ancestors, (parentPoint, parentId) => {
      if (parentId !== point.id) {
        content.deselectElement(parentId);
      }
    });
  }
};

export const isMovableLineEquation = (v: any) => {
  return v instanceof JXG.Text && v.getAttribute("clientType") === kMovableLineType;
};

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
    .sort((a, b) => a[0] - b[0]) as number[][];
};

export const solveForY = (slope: number, intercept: number, x: number) => {
  return slope * x + intercept;
};

export const solveForX = (slope: number, intercept: number, y: number) => {
  return (y - intercept) / slope;
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
  snapToGrid: false,
  highlightStrokeColor: darkBlue,
  clientUndeletable: true,
  showInfobox: false,
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
        }
      );
      const slopePoint = (board as JXG.Board).create(
        "point",
        change.parents[1],
        {
          id: `${lineId}-point2`,
          ...pointProps,
          ...pt2,
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
