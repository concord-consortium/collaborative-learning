// The text tile contributes its variable chips as highlight targets so a variable reference
// resolves to them and the chip can render its own emphasis (see docs/highlights.md).
//
// What is covered here is the aggregation seam: the model asks every registered text plugin and
// concatenates the result. The real contributor — the shared-variables plugin — walks a live Slate
// editor, which this suite deliberately does not stand up; that path is covered by Cypress in
// highlight_references_spec.js. A fake plugin stands in for it.
import { TextContentModel } from "./text-content";
import { registerTextPluginInfo } from "./text-plugin-info";
import { IClueTileObject } from "../../annotations/clue-object";

const kFakePlugin = "fake-variable-plugin";

// Chips the fake plugin reports, keyed by variable id.
let chipsByVariable: Record<string, IClueTileObject[]> = {};

registerTextPluginInfo({
  pluginName: kFakePlugin,
  getObjectsForVariable: (_textContent, variableId) => chipsByVariable[variableId] ?? []
});

describe("text content getObjectsForVariable", () => {
  beforeEach(() => {
    chipsByVariable = {};
  });

  it("returns the chips a plugin reports for the requested variable", () => {
    chipsByVariable = { v1: [{ objectId: "v1", objectType: "m2s-variable" }] };
    const content = TextContentModel.create();

    expect(content.getObjectsForVariable("v1")).toEqual([
      { objectId: "v1", objectType: "m2s-variable" }
    ]);
  });

  it("returns every chip when the same variable is referenced more than once", () => {
    chipsByVariable = {
      v1: [
        { objectId: "v1", objectType: "m2s-variable" },
        { objectId: "v1", objectType: "m2s-variable" }
      ]
    };
    const content = TextContentModel.create();

    expect(content.getObjectsForVariable("v1")).toHaveLength(2);
  });

  it("returns nothing for a variable no chip references", () => {
    chipsByVariable = { v1: [{ objectId: "v1", objectType: "m2s-variable" }] };
    const content = TextContentModel.create();

    expect(content.getObjectsForVariable("v2")).toEqual([]);
  });

  // Roughly half the registered text plugins implement no highlight hook at all, so the optional
  // call is load-bearing rather than defensive.
  it("skips plugins that do not implement the hook", () => {
    registerTextPluginInfo({ pluginName: "hookless-plugin" });
    chipsByVariable = { v1: [{ objectId: "v1", objectType: "m2s-variable" }] };
    const content = TextContentModel.create();

    expect(content.getObjectsForVariable("v1")).toHaveLength(1);
  });
});
