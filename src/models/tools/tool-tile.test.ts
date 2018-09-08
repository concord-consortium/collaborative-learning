import { getSnapshot } from "mobx-state-tree";
import { kDefaultMinWidth, ToolTileModel } from "./tool-tile";
import { kUnknownToolID, UnknownContentModelType } from "./unknown-content";
import { _private } from "./tool-types";
import { each } from "lodash";

describe("ToolTileModel", () => {

  it("supports each tool type", () => {
    each(_private.toolMap, (ToolContentModel, toolID) => {
      // can create a model with each type of tool
      const content: any = { type: toolID };
      // UnknownToolModel has required property
      if (toolID === kUnknownToolID) {
        content.originalType = "foo";
      }
      let toolTile = ToolTileModel.create({
                      content: ToolContentModel.create(content)
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
    const layout = { widthPct: 100 };
    const content: any = { type, bar: "baz" };
    const contentStr = JSON.stringify({ bar: "baz" });
    let toolTile = ToolTileModel.create({ layout, content });
    expect(toolTile.content.type).toBe(kUnknownToolID);
    expect(toolTile.layout).toEqual(layout);
    const toolContent: UnknownContentModelType = toolTile.content as any;
    expect(toolContent.originalType).toBe(content.type);
    expect(toolContent.originalContent).toBe(contentStr);

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
