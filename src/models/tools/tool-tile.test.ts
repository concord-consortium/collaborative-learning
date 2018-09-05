import { getSnapshot } from "mobx-state-tree";
import { ToolTileModel } from "./tool-tile";
import { _private } from "./tool-types";
import { each } from "lodash";

describe("ToolTileModel", () => {

  it("supports each tool type", () => {
    each(_private.toolMap, (ToolModel, toolID) => {
      // can create a model with each type of tool
      let toolTile = ToolTileModel.create({
                        widthPct: 100,
                        toolContent: ToolModel.create({ type: toolID })
                        });
      expect(toolTile.toolContent.type).toBe(toolID);

      // can create/recognize snapshots of each type of tool
      const snapshot = getSnapshot(toolTile);
      expect(snapshot.toolContent.type).toBe(toolID);

      // can create tool tiles with correct tool from snapshot
      toolTile = ToolTileModel.create(snapshot);
      expect(toolTile.toolContent.type).toBe(toolID);
    });
  });

});
