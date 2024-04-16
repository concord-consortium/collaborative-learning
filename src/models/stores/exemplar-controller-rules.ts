import { kDrawingTileType } from "../../plugins/drawing/model/drawing-types";
import { kTextTileType } from "../tiles/text/text-content";
import { BaseExemplarControllerModelType } from "./exemplar-controller";

// Rules for the ExemplarController are specified as:
// - A name
// - A "test" function that is run over the controller's state.
//   If the rule matches it should return a list of tiles that satisfy the rule
//   If it does not match, it should return false.
// - A "reset" function that updates the controller's state after
//   the rule has matched. This typically involves transferring the involved
//   tile records to the 'complete' list.

interface IExemplarControllerRule {
  name: string;
  test: (model: BaseExemplarControllerModelType) => string[] | false;
  reset: (model: BaseExemplarControllerModelType, tiles: string[]) => void;
}

// "3 drawings/3 labels" Rule: reveal an exemplar for each:
// 3 drawing tiles, each with at least 3 actions AND
// 3 labels with least 10 words each, where a label can be a text tile or a text object in a drawing.

const kDrawingMinActivityLevel = 3;
const kLabelMinWords = 10;

const threeDrawingsRule: IExemplarControllerRule = {
  name: "3 drawings/3 labels",
  test: (model: BaseExemplarControllerModelType) => {
    let foundDrawings = 0, foundLabels = 0;
    const tileIds: string[] = [];
    for (const [key, tile] of model.inProgressTiles.entries()) {
      if (tile.type === kTextTileType && tile.wordCount >= kLabelMinWords && foundLabels < 3) {
        foundLabels++;
        tileIds.push(key);
      }
      if (tile.type === kDrawingTileType) {
        if (tile.activityLevel >= kDrawingMinActivityLevel && foundDrawings < 3) {
          foundDrawings++;
          tileIds.push(key);
        }
        if (tile.wordCount >= kLabelMinWords && foundLabels < 3) {
          foundLabels++;
          if (!tileIds.includes(key)) tileIds.push(key);
        }
      }

      if (foundDrawings >= 3 && foundLabels >= 3) {
        return tileIds;
      }
    }
    return false;
  },
  reset: (model: BaseExemplarControllerModelType, tiles: string[]) => {
    model.markTilesComplete(tiles);
  }
};

export const allExemplarControllerRules = [ threeDrawingsRule ];
