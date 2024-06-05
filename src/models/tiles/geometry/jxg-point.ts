import { castArray, merge } from "lodash";
import { uniqueId } from "../../../utilities/js-utils";
import { JXGChangeAgent, JXGCoordPair, JXGProperties, JXGUnsafeCoordPair } from "./jxg-changes";
import { objectChangeAgent, isPositionGraphable, getGraphablePosition } from "./jxg-object";
import { prepareToDeleteObjects } from "./jxg-polygon";
import { fillPropsForColorScheme } from "./geometry-utils";

// Set as snap unit for all points that have snapToGrid set.
// Also used as the distance moved by arrow-key presses.
export const kSnapUnit = 0.1;

const defaultPointProperties = Object.freeze({
  strokeColor: "#000000", highlightStrokeColor: "#0081ff",
  strokeWidth: 1,         highlightStrokeWidth: 10,
  strokeOpacity: 1,       highlightStrokeOpacity: .12,
  fillOpacity: 1,         highlightFillOpacity: 1,
  size: 4,
  snapSizeX: kSnapUnit,
  snapSizeY: kSnapUnit,
  withLabel: true,
  transitionDuration: 0
});

const selectedPointProperties = Object.freeze({
  strokeColor: "#0081ff", highlightStrokeColor: "#0081ff",
  strokeWidth: 10,        highlightStrokeWidth: 10,
  strokeOpacity: .25,     highlightStrokeOpacity: .25
});

const phantomPointProperties = Object.freeze({
  fillOpacity: .5,        highlightFillOpacity: .5,
  withLabel: false
});

export function getPointVisualProps(selected: boolean, colorScheme: number, phantom: boolean) {
  // const colorMapEntry = linkedTableId && getColorMapEntry(linkedTableId);
  const props: JXGProperties = { ...defaultPointProperties };
  merge(props, fillPropsForColorScheme(colorScheme));

  if (selected) {
    merge(props, selectedPointProperties);
  }

  if (phantom) {
    merge(props, phantomPointProperties);
  }
  return props;
}

export function createPoint(board: JXG.Board, parents: JXGUnsafeCoordPair, changeProps: any) {
  // If id is not provided we generate one, but this will prevent
  // model-level synchronization. This should only occur for very
  // old geometry tiles created before the introduction of the uuid.
  const props = {
    id: uniqueId(),
    ...getPointVisualProps(false, changeProps?.colorScheme||0, changeProps?.isPhantom||false),
    ...changeProps };
  const isGraphable = isPositionGraphable(parents);
  const point = board.create("point", getGraphablePosition(parents), {...props, visible: isGraphable});
  return point;
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
    prepareToDeleteObjects(board, castArray(change.targetID));
    objectChangeAgent.delete(board, change);
  }
};
