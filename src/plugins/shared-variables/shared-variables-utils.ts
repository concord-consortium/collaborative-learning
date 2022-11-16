import { VariableType } from "@concord-consortium/diagram-view";

import { SharedVariablesType } from "./shared-variables";
import { drawingVariables } from "./drawing/variable-object";
import { DiagramContentModelType } from "../diagram-viewer/diagram-content";
import { kDiagramTileType } from "../diagram-viewer/diagram-types";
import { DrawingContentModelType } from "../drawing/model/drawing-content";
import { kDrawingTileType } from "../drawing/model/drawing-types";
import { kTextTileType } from "../../models/tiles/text/text-content";
import { ITileModel } from "../../models/tiles/tile-model";
import { ITileContentModel } from "../../models/tiles/tile-types";

const getTileVariables = (content: ITileContentModel) => {
  if (content.type === kDiagramTileType) {
    return (content as DiagramContentModelType).variables;
  } else if (content.type === kDrawingTileType) {
    return drawingVariables(content as DrawingContentModelType);
  } else if (content.type === kTextTileType) {
    // TODO Get variables used by text tiles
    return [];
  } else {
    return [];
  }
};

// Returns three lists containing all of the variables in the shared model.
// selfVariables are variables used by the tile content provided
// otherVariables are variables used by another tile but not the provided tile content
// unusedVariables are variables not used by any tile
export const variableBuckets =
  (content: ITileContentModel, sharedVariables?: SharedVariablesType) =>
{
  if (!sharedVariables) return { selfVariables: [], otherVariables: [], unusedVariables: [] };
  
  const sharedModelManager = content.tileEnv?.sharedModelManager;
  const tiles = sharedModelManager?.getSharedModelTiles(sharedVariables) ?? [];

  const selfVariables = getTileVariables(content);
  const otherVariables: VariableType[] = [];
  const unusedVariables: VariableType[] = [];
  sharedVariables.variables.forEach((variable: VariableType) => {
    if (!selfVariables.includes(variable)) {
      let found = false;
      for (let i = 0; i < tiles.length; i++) {
        const variables = getTileVariables(tiles[i].content);
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
