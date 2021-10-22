import { getSnapshot } from "mobx-state-tree";
import { kDefaultMinWidth, ToolTileModel } from "./tool-tile";
import { kUnknownToolID, UnknownContentModelType } from "./tool-types";
import { getToolIds, getToolContentInfoById } from "./tool-content-info";

describe("ToolTileModel", () => {

  // TODO this should really be explicit at least for the built in types so we can
  // make sure any dynamic registration is working
  getToolIds().forEach(toolID => {
    it(`supports the tool: ${toolID}`, () => {
      const SpecificToolContentModel = getToolContentInfoById(toolID).modelClass;

      // can create a model with each type of tool
      const content: any = { type: toolID };

      // TODO: currently the UnkownToolModel is not registered so it
      // doesn't have an id in getToolIds

      // UnknownToolModel has required property
      if (toolID === kUnknownToolID) {
        content.originalType = "foo";
      }
      let toolTile = ToolTileModel.create({
                      content: SpecificToolContentModel.create(content)
                    });
      expect(toolTile.content.type).toBe(toolID);

      // can create/recognize snapshots of each type of tool
      const snapshot: any = getSnapshot(toolTile);
      expect(snapshot.content.type).toBe(toolID);

      // can create tool tiles with correct tool from snapshot
      toolTile = ToolTileModel.create(snapshot);
      expect(toolTile.content.type).toBe(toolID);
    });
  });

  it("returns UnknownToolModel for unrecognized snapshots", () => {
    const type = "foo";
    const content: any = { type, bar: "baz" };
    const contentStr = JSON.stringify(content);
    let toolTile = ToolTileModel.create({ content });
    expect(toolTile.content.type).toBe(kUnknownToolID);
    const toolContent: UnknownContentModelType = toolTile.content as any;
    expect(toolContent.original).toBe(contentStr);

    toolTile = ToolTileModel.create(getSnapshot(toolTile));
    expect(toolTile.content.type).toBe(kUnknownToolID);
  });

  it("returns appropriate defaults for minWidth and maxWidth", () => {
    const toolTile = ToolTileModel.create({
                        content: {
                          type: "foo" as any,
                          bar: "baz"
                        } as any
                      });
    expect(toolTile.minWidth).toBe(kDefaultMinWidth);
    expect(toolTile.maxWidth).toBeUndefined();
  });

});
