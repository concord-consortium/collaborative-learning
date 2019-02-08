import { JXGChangeAgent, JXGCoordPair } from "./jxg-changes";
import { objectChangeAgent } from "./jxg-object";
import { removePointsToBeDeletedFromPolygons } from "./jxg-polygon";
import { values, castArray } from "lodash";
import * as uuid from "uuid/v4";
import { isCommentType } from "./jxg-comment";

export const isPoint = (v: any) => v instanceof JXG.Point;

export const isVisiblePoint = (v: any) => isPoint(v) && v.visProp.visible;

export const isFreePoint = (v: any) => {
  if (isVisiblePoint(v)) {
    const point = v as JXG.Point;
    return values(point.childElements).filter(el => !isCommentType(el)).length <= 1 &&
           values(point.descendants).filter(el => !isCommentType(el)).length <= 1;
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

// fillColor/strokeColor are ephemeral properties that change with selection;
// we store the desired colors in clientFillColor/clientStrokeColor for persistence.
export function syncClientColors(props: any) {
  const { selectedFillColor, selectedStrokeColor, ...p } = props || {} as any;
  if (p.fillColor) p.clientFillColor = p.fillColor;
  if (p.strokeColor) p.clientStrokeColor = p.strokeColor;
  if (selectedFillColor) p.clientSelectedFillColor = selectedFillColor;
  if (selectedStrokeColor) p.clientSelectedStrokeColor = selectedStrokeColor;
  return p;
}

export function createPoint(board: JXG.Board, parents: JXGCoordPair, changeProps: any) {
  // If id is not provided we generate one, but this will prevent
  // model-level synchronization. This should only occur for very
  // old geometry tiles created before the introduction of the uuid.
  const props = { id: uuid(), ...defaultProps, ...syncClientColors(changeProps) };

  // default snap size has changed over time
  if (props.snapSizeX === kPrevSnapUnit) {
    props.snapSizeX = kSnapUnit;
  }
  if (props.snapSizeY === kPrevSnapUnit) {
    props.snapSizeY = kSnapUnit;
  }
  return board.create("point", parents, props);
}

export const pointChangeAgent: JXGChangeAgent = {
  create: (board, change) => {
    const parents: any = change.parents;
    if (Array.isArray(parents && parents[0])) {
      const changeProps = change.properties && castArray(change.properties);
      const points = (parents as JXGCoordPair[]).map((coords, i) => {
        const props = changeProps && (changeProps[i] || changeProps[0]);
        return createPoint(board as JXG.Board, coords, props);
      });
      return points;
    }
    else {
      return createPoint(board as JXG.Board, change.parents as JXGCoordPair, change.properties);
    }
  },

  // update can be handled generically
  update: objectChangeAgent.update,

  delete: (board, change) => {
    removePointsToBeDeletedFromPolygons(board, castArray(change.targetID));
    objectChangeAgent.delete(board, change);
  }
};
