import { castArray } from "lodash";
import { uniqueId } from "../../../utilities/js-utils";
import { JXGChangeAgent, JXGCoordPair, JXGUnsafeCoordPair } from "./jxg-changes";
import { objectChangeAgent, isPositionGraphable, getGraphablePosition } from "./jxg-object";
import { prepareToDeleteObjects } from "./jxg-polygon";
import { getColorMapEntry } from "./shared-model-color-map";

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
// we stored the desired colors in clientFillColor/clientStrokeColor for persistence
// now they are replaced by colors from shared-table-colors map
// TODO: find where client colors can be removed
export function syncClientColors(props: any) {
  const colorMapEntry = getColorMapEntry(props.linkedTableId);
  const { selectedFillColor, selectedStrokeColor, ...p } = props || {} as any;
  p.fillColor = colorMapEntry?.colorSet.fill;
  p.strokeColor = colorMapEntry?.colorSet.stroke;
  p.clientFillColor = colorMapEntry?.colorSet.fill;
  p.clientStrokeColor = colorMapEntry?.colorSet.stroke;

  // if(selectedFillColor) p.clientSelectedFillColor = selectedFill
  // if(selectedStrokeColor) p.clientSelectedStrokeColor = selectedStroke
  // if (p.fillColor) p.clientFillColor = p.fillColor;
  // if (p.strokeColor) p.clientStrokeColor = p.strokeColor;
  // if (selectedFillColor) p.clientSelectedFillColor = selectedFillColor;
  // if (selectedStrokeColor) p.clientSelectedStrokeColor = selectedStrokeColor;
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
