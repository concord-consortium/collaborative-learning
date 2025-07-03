import { HighlightsPlugin } from "./highlights-plugin";
import { TextContentModel, TextContentModelType } from "../../models/tiles/text/text-content";

describe("HighlightsPlugin", () => {
  let model: TextContentModelType;
  let plugin: HighlightsPlugin;

  beforeEach(() => {
    model = TextContentModel.create({text: "some text"});
    plugin = new HighlightsPlugin(model);
  });

  it("adds a highlight", () => {
    expect(model.highlightedText.length).toBe(0);
    plugin.addHighlight("id1", "some text");
    expect(model.highlightedText.length).toBe(1);
    expect(model.highlightedText[0]).toEqual({ id: "id1", text: "some text" });
  });

  it("removes a highlight", () => {
    plugin.addHighlight("id1", "some text");
    plugin.addHighlight("id2", "other text");
    expect(model.highlightedText.length).toBe(2);
    plugin.removeHighlight("id1");
    expect(model.highlightedText.length).toBe(1);
    expect(model.highlightedText[0]).toEqual({ id: "id2", text: "other text" });
  });

  it("does nothing if removing a non-existent highlight", () => {
    plugin.addHighlight("id1", "some text");
    expect(model.highlightedText.length).toBe(1);
    plugin.removeHighlight("not-there");
    expect(model.highlightedText.length).toBe(1);
  });
});
