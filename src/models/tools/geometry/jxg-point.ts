import { JXGChangeAgent, JXGCoordPair } from "./jxg-changes";
import { objectChangeAgent } from "./jxg-object";
import { removePointsToBeDeletedFromPolygons } from "./jxg-polygon";
import { castArray, size } from "lodash";
import * as uuid from "uuid/v4";

export const isPoint = (v: any) => v instanceof JXG.Point;

export const isVisiblePoint = (v: any) => isPoint(v) && v.visProp.visible;

export const isFreePoint = (v: any) => isVisiblePoint(v) &&
                                        (size(v.childElements) <= 1) &&
                                        (size(v.descendants) <= 1);

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

export function createPoint(board: JXG.Board, parents: JXGCoordPair, changeProps: any) {
  // If id is not provided we generate one, but this will prevent
  // model-level synchronization. This should only occur for very
  // old geometry tiles created before the introduction of the uuid.
  const props = { id: uuid(), ...defaultProps, ...changeProps };
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
