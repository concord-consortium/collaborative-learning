import { VariableType } from "@concord-consortium/diagram-view";

import { SharedVariablesType } from "./shared-variables";
import { drawingVariables } from "./drawing/variable-object";
import { DiagramContentModelType } from "../diagram-viewer/diagram-content";
import { kDiagramTileType } from "../diagram-viewer/diagram-types";
import { DrawingContentModelType } from "../drawing/model/drawing-content";
import { kDrawingTileType } from "../drawing/model/drawing-types";
import { ITileModel } from "../../models/tiles/tile-model";
import { kTextTileType } from "../../models/tiles/text/text-content";

const getTileVariables = (tile: ITileModel) => {
  if (tile.content.type === kDiagramTileType) {
    return (tile.content as DiagramContentModelType).variables;
  } else if (tile.content.type === kDrawingTileType) {
    return drawingVariables(tile.content as DrawingContentModelType);
  } else if (tile.content.type === kTextTileType) {
    // TODO Get variables used by text tiles
    return [];
  } else {
    return [];
  }
};

// Returns three lists containing all of the variables in the shared model.
// selfVariables are variables used by the tile provided
// otherVariables are variables used by another tile but not the provided tile
// unusedVariables are variables not used by any tile
export const variableBuckets = (tile: ITileModel, tiles: ITileModel[], sharedVariables: SharedVariablesType) => {
  const selfVariables = getTileVariables(tile);
  const otherVariables: VariableType[] = [];
  const unusedVariables: VariableType[] = [];
  sharedVariables.variables.forEach((variable: VariableType) => {
    if (!selfVariables.includes(variable)) {
      let found = false;
      for (let i = 0; i < tiles.length; i++) {
        const variables = getTileVariables(tiles[i]);
        if (variables.includes(variable)) {
          otherVariables.push(variable);
          found = true;
          break;
        }
      }
      if (!found) unusedVariables.push(variable);
    }
  });
  return { selfVariables, otherVariables, unusedVariables };
};
