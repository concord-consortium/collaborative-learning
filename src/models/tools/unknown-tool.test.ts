import { getSnapshot } from "mobx-state-tree";
import { kUnknownToolID, UnknownToolModel } from "./unknown-tool";

describe("UnknownToolModel", () => {

  it("can be created from snapshots", () => {
    // can be created from other tool snapshots
    const toolType = "Text";
    const toolContent = "Some text";
    let tool = UnknownToolModel.create({
                  type: toolType,
                  content: toolContent
                });
    expect(tool.type).toBe(kUnknownToolID);
    expect(tool.content.originalType).toBe(toolType);
    expect(tool.content.originalContent).toBe(toolContent);

    // can be created from UnknownToolModel snapshots
    tool = UnknownToolModel.create(getSnapshot(tool));
    expect(tool.type).toBe(kUnknownToolID);
    expect(tool.content.originalType).toBe(toolType);
    expect(tool.content.originalContent).toBe(toolContent);
  });

  it("stringifies original tool contents when appropriate", () => {
    // can be created from other tool snapshots
    const toolType = "Geometry";
    const toolContent = { geometry: "Some geometry" };
    let tool = UnknownToolModel.create({
                  type: toolType,
                  content: toolContent
                });
    expect(tool.type).toBe(kUnknownToolID);
    expect(tool.content.originalType).toBe(toolType);
    expect(tool.content.originalContent).toBe(JSON.stringify(toolContent));

    // can be created from UnknownToolModel snapshots
    tool = UnknownToolModel.create(getSnapshot(tool));
    expect(tool.type).toBe(kUnknownToolID);
    expect(tool.content.originalType).toBe(toolType);
    expect(tool.content.originalContent).toBe(JSON.stringify(toolContent));
  });

});
