import { EditorValue, slateToText } from "@concord-consortium/slate-editor";
import { TextContentModel, kTextTileType } from "./text-content";
import { registerTextPluginInfo } from "./text-plugin-info";

const empty: EditorValue = [
  {
    type: 'paragraph',
    children: [{ text: '' }],
  },
];

const testTextPluginInfo = {
  pluginName: "test",
  createSlatePlugin: jest.fn(),
  buttonDefs: {},
};
const testTextPluginInfoWithUpdate = {
  pluginName: "testWithUpdate",
  createSlatePlugin: jest.fn(),
  buttonDefs: {},
  updateTextContentAfterSharedModelChanges: jest.fn()
};

registerTextPluginInfo(testTextPluginInfo);
registerTextPluginInfo(testTextPluginInfoWithUpdate);

describe("TextContentModel", () => {

  it("accepts default arguments on creation", () => {
    const model = TextContentModel.create();
    expect(model.type).toBe(kTextTileType);
    expect(model.text).toBe("");
    expect(model.format).toBeUndefined();
  });

  it("accepts override arguments on creation", () => {
    const text = "Some text";
    const format = "plain";
    const model = TextContentModel.create({
                    type: kTextTileType,
                    text, format
                  });
    expect(model.type).toBe(kTextTileType);
    expect(model.text).toBe(text);
    expect(model.joinText).toBe(text);
    expect(model.format).toBe(format);
  });

  it("handles arrays of strings", () => {
    const text = ["some", "array", "strings"];
    const model = TextContentModel.create({ text });
    expect(model.text).toEqual(text);
    expect(model.joinText).toBe(text.join("\n"));

    const flat = "flat string";
    model.setText(flat);
    expect(model.text).toBe(flat);
  });

  it("handles slate format strings", () => {
    const model = TextContentModel.create();
    model.setSlate(empty);
    const slate = model.getSlate();
    expect(slateToText(slate)).toBe("");

    // handles errors gracefully
    const bogus1 = TextContentModel.create({ format: "slate", text: "foo" });
    expect(bogus1.getSlate()).toBeDefined();
    const bogus2 = TextContentModel.create({ format: "slate", text: ["foo", "bar"] });
    expect(bogus2.asSlate()).toBeDefined();
  });

  it("converts to slate correctly", () => {
    const foo = "foo";
    const model = TextContentModel.create({ text: foo });
    expect(slateToText(model.asSlate())).toBe(foo);
  });

  it("calls updateTextContentAfterSharedModelChanges on each plugin that provides it", () => {
    const model = TextContentModel.create({ text: "foo" });
    model.updateAfterSharedModelChanges(undefined);
    expect(testTextPluginInfoWithUpdate.updateTextContentAfterSharedModelChanges).toHaveBeenCalled();
  });
});
