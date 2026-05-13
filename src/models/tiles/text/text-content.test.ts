import { getSnapshot } from "mobx-state-tree";
import { EditorValue, htmlToSlate, registerPlugins, slateToHtml, slateToText
} from "@concord-consortium/slate-editor";
import { TextContentModel, kTextTileType } from "./text-content";
import { registerTextPluginInfo } from "./text-plugin-info";
import { registerVariables, kVariableFormat } from "../../../plugins/shared-variables/slate/variables-plugin";
import { kHighlightFormat, registerHighlight } from "../../../components/tiles/text/plugins/highlights-plugin";
import { kLinkFormat, registerLinkComponent } from "../../../components/tiles/text/plugins/link-plugin";

// slate-editor's core element renderers (paragraph, inline, etc.) are registered by
// registerPlugins(). In production this happens via createEditor() when the text tile
// boots. The test never instantiates an editor, so we register them here. Chip
// deserializers must be registered AFTER registerPlugins() so they take precedence
// over slate-editor's catch-all <span> deserializer (most-recent wins).
registerPlugins();
registerVariables();
registerHighlight();
registerLinkComponent();

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

  describe("linkDisplayModes", () => {
    it("returns 'link' by default when the linkId has no entry", () => {
      const content = TextContentModel.create();
      expect(content.getLinkDisplayMode("missing")).toBe("link");
    });

    it("returns 'link' when linkId is undefined", () => {
      const content = TextContentModel.create();
      expect(content.getLinkDisplayMode(undefined)).toBe("link");
    });

    it("stores 'button' mode", () => {
      const content = TextContentModel.create();
      content.setLinkDisplayMode("abc", "button");
      expect(content.getLinkDisplayMode("abc")).toBe("button");
      expect(content.linkDisplayModes.has("abc")).toBe(true);
    });

    it("deletes the map entry when setting mode back to 'link'", () => {
      const content = TextContentModel.create();
      content.setLinkDisplayMode("abc", "button");
      expect(content.linkDisplayModes.has("abc")).toBe(true);
      content.setLinkDisplayMode("abc", "link");
      expect(content.linkDisplayModes.has("abc")).toBe(false);
      expect(content.getLinkDisplayMode("abc")).toBe("link");
    });

    it("removeLinkDisplayMode clears the entry", () => {
      const content = TextContentModel.create();
      content.setLinkDisplayMode("abc", "button");
      content.removeLinkDisplayMode("abc");
      expect(content.linkDisplayModes.has("abc")).toBe(false);
      expect(content.getLinkDisplayMode("abc")).toBe("link");
    });

    it("survives snapshot round-trip", () => {
      const original = TextContentModel.create();
      original.setLinkDisplayMode("a", "button");
      original.setLinkDisplayMode("b", "button");
      const snapshot = getSnapshot(original);
      const restored = TextContentModel.create(snapshot);
      expect(restored.getLinkDisplayMode("a")).toBe("button");
      expect(restored.getLinkDisplayMode("b")).toBe("button");
      expect(restored.getLinkDisplayMode("missing")).toBe("link");
    });
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

describe("TextContentModel link round-trip", () => {
  // Link elements come from <a> tags in authored HTML. The slate-editor library
  // ships a built-in <a> deserializer; CLUE registers its own LinkComponent as
  // the renderer for this format.
  const linkHref = "https://example.com/page";
  const valueWithLink: EditorValue = [{
    type: "paragraph",
    children: [
      { text: "see " },
      { type: kLinkFormat, href: linkHref, children: [{ text: "link text" }] } as any,
      { text: " here" }
    ]
  }];

  it("does not throw when serializing a Slate value with a link element to HTML", () => {
    expect(() => slateToHtml(valueWithLink)).not.toThrow();
  });

  it("preserves link element type through slateToHtml -> htmlToSlate", () => {
    const reloaded = htmlToSlate(slateToHtml(valueWithLink));
    expect(findElementByType(reloaded as any[], kLinkFormat)).toBeDefined();
  });

  it("preserves link href through slateToHtml -> htmlToSlate", () => {
    const reloaded = htmlToSlate(slateToHtml(valueWithLink));
    const link = findElementByType(reloaded as any[], kLinkFormat);
    expect(link?.href).toBe(linkHref);
  });

  it("preserves link element type through TextContent export -> reimport", () => {
    const reloaded = roundTripThroughAuthoringExport(valueWithLink);
    expect(findElementByType(reloaded as any[], kLinkFormat)).toBeDefined();
  });

  it("preserves link href through TextContent export -> reimport", () => {
    const reloaded = roundTripThroughAuthoringExport(valueWithLink);
    const link = findElementByType(reloaded as any[], kLinkFormat);
    expect(link?.href).toBe(linkHref);
  });

  it("exports HTML text containing an <a> tag without throwing", () => {
    const model = TextContentModel.create({
      format: "html",
      text: [`<p>see <a href="${linkHref}">link text</a> here</p>`]
    });
    expect(() => model.exportJson()).not.toThrow();
  });
});
