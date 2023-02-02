import { VariableType } from "@concord-consortium/diagram-view";

import { SharedVariablesType } from "./shared-variables";
import { drawingVariables } from "./drawing/variable-object";
import { DiagramContentModelType } from "../diagram-viewer/diagram-content";
import { kDiagramTileType } from "../diagram-viewer/diagram-types";
import { DrawingContentModelType } from "../drawing/model/drawing-content";
import { kDrawingTileType } from "../drawing/model/drawing-types";
import { kTextTileType, TextContentModelType } from "../../models/tiles/text/text-content";
import { ITileContentModel } from "../../models/tiles/tile-content";
import { VariablesPlugin } from "./slate/variables-plugin";

const getTileVariables = (content: ITileContentModel) => {
  if (content.type === kDiagramTileType) {
    return (content as DiagramContentModelType).variables;
  } else if (content.type === kDrawingTileType) {
    return drawingVariables(content as DrawingContentModelType);
  } else if (content.type === kTextTileType) {
    // Note: This isn't the most efficient. But it reduces duplicate
    // code. One way to improve this would be to make plugins to tiles
    // more official. Then we could maintain a document level structure
    // that lists all a tiles plugins. Then we could use this to lookup
    // the text tile's plugin.
    const textContent = content as TextContentModelType;
    const textPlugin = new VariablesPlugin(textContent);
    // FIXME: The intention here is to return unique variables used by the.
    // Currently this will return a variable object for each chip in the text
    // tile and there might be multiple chips per variable
    return textPlugin.chipVariables;
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
