import { defaultDeckContent, DeckContentModel } from "./deck-content";

describe("DeckContent", () => {
  it("has default content of 'hello world'", () => {
    const content = defaultDeckContent();
    expect(content.text).toBe("Hello World");
  });

  it("supports changing the text", () => {
    const content = DeckContentModel.create();
    content.setText("New Text");
    expect(content.text).toBe("New Text");
  });

  it("is always user resizable", () => {
    const content = DeckContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });
});
