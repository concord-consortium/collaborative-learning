import { castArray } from "lodash";
import { PointAttributes } from "jsxgraph";
import { uniqueId } from "../../../utilities/js-utils";
import { ELabelOption, JXGChangeAgent, JXGCoordPair, JXGUnsafeCoordPair } from "./jxg-changes";
import { objectChangeAgent, isPositionGraphable, getGraphablePosition } from "./jxg-object";
import { prepareToDeleteObjects } from "./jxg-polygon";
import { fillPropsForColorScheme } from "./geometry-utils";
import { kGeometryHighlightColor } from "./jxg-types";

// Set as snap unit for all points that have snapToGrid set.
// Also used as the distance moved by arrow-key presses.
export const kSnapUnit = 0.1;

const defaultPointProperties = Object.freeze({
  strokeColor: "#000000", highlightStrokeColor: kGeometryHighlightColor,
  strokeWidth: 1,         highlightStrokeWidth: 10,
  strokeOpacity: 1,       highlightStrokeOpacity: .12,
  fillOpacity: 1,         highlightFillOpacity: 1,
  size: 4,
  snapSizeX: kSnapUnit,
  snapSizeY: kSnapUnit,
  transitionDuration: 0
});

const selectedPointProperties = Object.freeze({
  strokeColor: kGeometryHighlightColor, highlightStrokeColor: kGeometryHighlightColor,
  strokeWidth: 10,        highlightStrokeWidth: 10,
  strokeOpacity: .25,     highlightStrokeOpacity: .25
});

const phantomPointProperties = Object.freeze({
  fillOpacity: .5,        highlightFillOpacity: .5,
  withLabel: false
});

export function getPointVisualProps(selected: boolean, colorScheme: number, phantom: boolean,
    labelOption?: ELabelOption) {
  const withLabel = labelOption && [ELabelOption.kLabel, ELabelOption.kLength].includes(labelOption);
  const props: PointAttributes = {
    ...defaultPointProperties,
    ...fillPropsForColorScheme(colorScheme),
    ...(selected ? selectedPointProperties : {}),
    ...(phantom ? phantomPointProperties : {}),
    withLabel
  };

  return props;
}

export function createPoint(board: JXG.Board, parents: JXGUnsafeCoordPair, changeProps: any) {
  // If id is not provided we generate one, but this will prevent
  // model-level synchronization. This should only occur for very
  // old geometry tiles created before the introduction of the uuid.
  const props = {
    id: uniqueId(),
    ...getPointVisualProps(false, changeProps?.colorScheme||0, changeProps?.isPhantom||false,
        changeProps?.clientLabelOption),
    ...changeProps };
  const isGraphable = isPositionGraphable(parents);
  const point = board.create("point", getGraphablePosition(parents), {...props, visible: isGraphable});
  point._set("clientName", point.name); // Hold onto original name for later use
  setPropertiesForLabelOption(point);
  return point;
}

export function pointName(point: JXG.Point) {
  const origName = point.getAttribute("clientName");
  if (origName) return origName;
  if (typeof(point.name) === "string") {
    return point.name;
  }
  return "";
}

export function setPropertiesForLabelOption(point: JXG.Point) {
  const labelOption = point.getAttribute("clientLabelOption") || ELabelOption.kNone;
  switch (labelOption) {
    case ELabelOption.kLength:
      point.setAttribute({
        showInfobox: false,
        withLabel: true,
        name() { return `(${point.X().toFixed(2)}, ${point.Y().toFixed(2)})`; }
      });
      break;
    case ELabelOption.kLabel:
      point.setAttribute({
        showInfobox: true,
        withLabel: true,
        name: point.getAttribute("clientName")
      });
      break;
    default:
      point.setAttribute({
        showInfobox: true,
        withLabel: false
      });
  }
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
    // Removes the point from any polygons
    const idsToDelete = prepareToDeleteObjects(board, castArray(change.targetID));
    const revisedChange = { ...change, targetID: idsToDelete };
    objectChangeAgent.delete(board, revisedChange);
  }
};
