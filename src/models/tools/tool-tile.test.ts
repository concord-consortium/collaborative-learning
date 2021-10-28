import { getSnapshot } from "mobx-state-tree";
import { kDefaultMinWidth, ToolTileModel } from "./tool-tile";
import { kUnknownToolID, UnknownContentModelType } from "./tool-types";
import { getToolIds, getToolContentInfoById } from "./tool-content-info";

describe("ToolTileModel", () => {

  // Define the built in tool ids explicitly as strings.
  // Strings are used because importing the tool id constant could trigger a
  // registration of the tool. The tools should all be registered due to the
  // tool-tile import above.
  // The tools are listed instead of just using getToolIds (see below) inorder to
  // make sure all of these built in tools get registered correctly as expected.
  const builtInToolIds = [
    "Unknown",
    "Placeholder",
    "Table",
    "Geometry",
    "Image",
    "Text",
    "Drawing"
  ];

  // Add any dynamically registered tools to the list
  // currently there are no dynamically registered tools, but in the future hopefully
  // there will be at least one example of this
  const registeredToolIds = getToolIds();

  // Remove the duplicates.
  const uniqueToolIds = new Set([...registeredToolIds, ...builtInToolIds]);

  uniqueToolIds.forEach(toolID => {
    it(`supports the tool: ${toolID}`, () => {
      const SpecificToolContentModel = getToolContentInfoById(toolID).modelClass;

      // can create a model with each type of tool
      const content: any = { type: toolID };

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

    // If we have more tests verifying that Tools follow the right patterns this test
    // should be moved to next to them.
    it(`${toolID} content models can be created without the type`, () => {
      const SpecificToolContentModel = getToolContentInfoById(toolID).modelClass;

      // can create the model without passing the type
      const typelessContent: any = {};
      // UnknownToolModel has required property
      if (toolID === kUnknownToolID) {
        typelessContent.originalType = "foo";
      }
      const toolContentModel = SpecificToolContentModel.create(typelessContent);
      expect(toolContentModel.type).toBe(toolID);
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
