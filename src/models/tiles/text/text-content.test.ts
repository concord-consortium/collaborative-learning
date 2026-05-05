import { EditorValue, htmlToSlate, registerPlugins, slateToHtml, slateToText
} from "@concord-consortium/slate-editor";
import { TextContentModel, kTextTileType } from "./text-content";
import { registerTextPluginInfo } from "./text-plugin-info";
import { registerVariables, kVariableFormat } from "../../../plugins/shared-variables/slate/variables-plugin";
import { kHighlightFormat, registerHighlight } from "../../../plugins/text/highlights-plugin";

// slate-editor's core element renderers (paragraph, inline, etc.) are registered by
// registerPlugins(). In production this happens via createEditor() when the text tile
// boots. The test never instantiates an editor, so we register them here. The chip
// deserializers must be registered AFTER registerPlugins() so they take precedence
// over slate-editor's catch-all <span> deserializer (most-recent wins).
registerPlugins();
registerVariables();
registerHighlight();

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

/**
 * Walk a Slate value and return the first inline element matching `type`, or undefined.
 */
function findElementByType(value: any[], type: string): any | undefined {
  for (const node of value) {
    if (node?.type === type) return node;
    if (Array.isArray(node?.children)) {
      const found = findElementByType(node.children, type);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Round-trip a Slate value through the same path the authoring "save" performs:
 * setSlate → exportJson → re-create TextContent from the exported JSON → asSlate.
 * This is the path the engineer suspects of dropping chip elements.
 */
function roundTripThroughAuthoringExport(value: EditorValue): EditorValue {
  const source = TextContentModel.create();
  source.setSlate(value);
  const exported = JSON.parse(source.exportJson());
  const reloaded = TextContentModel.create({ format: exported.format, text: exported.text });
  return reloaded.asSlate();
}

describe("TextContentModel chip serialization round-trips", () => {
  const variableReference = "test-variable-reference-id";
  const highlightId = "test-highlight-id";

  // Variable chips are void inlines: children is a single empty text node, the chip
  // identity is on the `reference` field. See VariablesPlugin.insertTextVariable.
  const valueWithVariableChip: EditorValue = [{
    type: "paragraph",
    children: [
      { text: "before " },
      { type: kVariableFormat, reference: variableReference, children: [{ text: "" }] } as any,
      { text: " after" }
    ]
  }];

  // Highlight chips are also void inlines and use `highlightId` (not `reference`).
  // The displayed text lives separately on textContent.highlightedText.
  const valueWithHighlightChip: EditorValue = [{
    type: "paragraph",
    children: [
      { text: "before " },
      { type: kHighlightFormat, highlightId, children: [{ text: "" }] } as any,
      { text: " after" }
    ]
  }];

  // --- Direct slate-editor library round-trip ---

  it("preserves variable chip element type through slateToHtml -> htmlToSlate", () => {
    const reloaded = htmlToSlate(slateToHtml(valueWithVariableChip));
    expect(findElementByType(reloaded as any[], kVariableFormat)).toBeDefined();
  });

  it("preserves variable chip reference id through slateToHtml -> htmlToSlate", () => {
    const reloaded = htmlToSlate(slateToHtml(valueWithVariableChip));
    const chip = findElementByType(reloaded as any[], kVariableFormat);
    expect(chip?.reference).toBe(variableReference);
  });

  it("preserves highlight chip element type through slateToHtml -> htmlToSlate", () => {
    const reloaded = htmlToSlate(slateToHtml(valueWithHighlightChip));
    expect(findElementByType(reloaded as any[], kHighlightFormat)).toBeDefined();
  });

  it("preserves highlight chip id through slateToHtml -> htmlToSlate", () => {
    const reloaded = htmlToSlate(slateToHtml(valueWithHighlightChip));
    const chip = findElementByType(reloaded as any[], kHighlightFormat);
    expect(chip?.highlightId).toBe(highlightId);
  });

  // --- Full TextContent.exportJson -> re-import round-trip (the authoring save path) ---

  it("preserves variable chip element type through TextContent export -> reimport", () => {
    const reloaded = roundTripThroughAuthoringExport(valueWithVariableChip);
    expect(findElementByType(reloaded as any[], kVariableFormat)).toBeDefined();
  });

  it("preserves variable chip reference id through TextContent export -> reimport", () => {
    const reloaded = roundTripThroughAuthoringExport(valueWithVariableChip);
    const chip = findElementByType(reloaded as any[], kVariableFormat);
    expect(chip?.reference).toBe(variableReference);
  });

  it("preserves highlight chip element type through TextContent export -> reimport", () => {
    const reloaded = roundTripThroughAuthoringExport(valueWithHighlightChip);
    expect(findElementByType(reloaded as any[], kHighlightFormat)).toBeDefined();
  });

  it("preserves highlight chip id through TextContent export -> reimport", () => {
    const reloaded = roundTripThroughAuthoringExport(valueWithHighlightChip);
    const chip = findElementByType(reloaded as any[], kHighlightFormat);
    expect(chip?.highlightId).toBe(highlightId);
  });

  // The chip element surviving isn't enough on its own. Resolving the chip at
  // render time requires a matching {id, text} entry in textContent.highlightedText.
  // If that array isn't part of the export, every reloaded highlight chip renders
  // as "invalid reference: <id>".
  it("preserves textContent.highlightedText entries through export -> reimport", () => {
    const source = TextContentModel.create();
    source.setSlate(valueWithHighlightChip);
    source.addHighlight(highlightId, "notice");
    const exported = JSON.parse(source.exportJson());
    const reloaded = TextContentModel.create({
      format: exported.format,
      text: exported.text,
      highlightedText: exported.highlightedText,
    });
    expect(reloaded.highlightedText.length).toBe(1);
    expect(reloaded.highlightedText[0].id).toBe(highlightId);
    expect(reloaded.highlightedText[0].text).toBe("notice");
  });
});
