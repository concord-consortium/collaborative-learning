import { castArray } from "lodash";
import { getColorMapEntry } from "../../shared/shared-data-set-colors";
import { uniqueId } from "../../../utilities/js-utils";
import { JXGChangeAgent, JXGCoordPair, JXGUnsafeCoordPair } from "./jxg-changes";
import { objectChangeAgent, isPositionGraphable, getGraphablePosition } from "./jxg-object";
import { prepareToDeleteObjects } from "./jxg-polygon";

// For snap to grid
const kPrevSnapUnit = 0.2;
export const kSnapUnit = 0.1;

export const kPointDefaults = {
              fillColor: "#0069ff",
              strokeColor: "#000000",
              selectedFillColor: "#0069ff",
              selectedStrokeColor: "#0081ff"
            };

const defaultProps = {
        fillColor: kPointDefaults.fillColor,
        strokeColor: kPointDefaults.strokeColor
      };

// fillColor/strokeColor are ephemeral properties that change with selection;
// we store the desired colors in clientFillColor/clientStrokeColor for persistence
// colors for linked points are derived from the link color map
export function syncClientColors(props: any) {
  const { selectedFillColor, selectedStrokeColor, ...p } = props || {} as any;
  const colorMapEntry = getColorMapEntry(p.linkedTableId);

  if (colorMapEntry?.colorSet) {
    const { fill, stroke, selectedFill, selectedStroke } = colorMapEntry.colorSet;
    p.fillColor = p.clientFillColor = fill;
    p.strokeColor = p.clientStrokeColor = stroke;
    p.clientSelectedFillColor = selectedFill;
    p.clientSelectedStrokeColor = selectedStroke;
  }
  else {
    if (p.fillColor) {
      p.clientFillColor = p.fillColor;
      p.highlightFillColor = p.fillColor;
    }
    if (p.strokeColor) {
      p.clientStrokeColor = p.strokeColor;
      p.highlightStrokeColor = p.strokeColor;
    }
    if (selectedFillColor) p.clientSelectedFillColor = selectedFillColor;
    if (selectedStrokeColor) p.clientSelectedStrokeColor = selectedStrokeColor;
  }
  return p;
}

export function createPoint(board: JXG.Board, parents: JXGUnsafeCoordPair, changeProps: any) {
  // If id is not provided we generate one, but this will prevent
  // model-level synchronization. This should only occur for very
  // old geometry tiles created before the introduction of the uuid.
  const props = { id: uniqueId(), ...defaultProps, ...syncClientColors(changeProps) };

  // default snap size has changed over time
  if (props.snapSizeX === kPrevSnapUnit) {
    props.snapSizeX = kSnapUnit;
  }
  if (props.snapSizeY === kPrevSnapUnit) {
    props.snapSizeY = kSnapUnit;
  }
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
