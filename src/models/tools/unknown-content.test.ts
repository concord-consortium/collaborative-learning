import { getSnapshot } from "mobx-state-tree";
import { kUnknownToolID, UnknownContentModel } from "./unknown-content";

describe("UnknownContentModel", () => {

  it("can be created from snapshots", () => {
    // can be created from other tool snapshots
    const toolType = "Text";
    const toolContent = "Some text";
    let content = UnknownContentModel.create({
                    type: kUnknownToolID,
                    originalType: toolType,
                    originalContent: toolContent
                  });
    expect(content.type).toBe(kUnknownToolID);
    expect(content.originalType).toBe(toolType);
    expect(content.originalContent).toBe(toolContent);

    // can be created from UnknownToolModel snapshots
    content = UnknownContentModel.create(getSnapshot(content));
    expect(content.type).toBe(kUnknownToolID);
    expect(content.originalType).toBe(toolType);
    expect(content.originalContent).toBe(toolContent);
  });

  it("stringifies original tool contents when appropriate", () => {
    // can be created from other tool snapshots
    const toolType = "Geometry";
    const toolContent = { geometry: "Some Geometry" };
    let content = UnknownContentModel.create({
                  type: toolType,
                  geometry: "Some Geometry"
                } as any);
    expect(content.type).toBe(kUnknownToolID);
    expect(content.originalType).toBe(toolType);
    expect(content.originalContent).toBe(JSON.stringify(toolContent));

    // can be created from UnknownToolModel snapshots
    content = UnknownContentModel.create(getSnapshot(content));
    expect(content.type).toBe(kUnknownToolID);
    expect(content.originalType).toBe(toolType);
    expect(content.originalContent).toBe(JSON.stringify(toolContent));
  });

});
