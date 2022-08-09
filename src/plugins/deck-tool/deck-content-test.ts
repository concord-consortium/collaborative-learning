import { defaultDeckContent, DeckContentModel } from "./deck-content";

describe("DeckContent", () => {
  it("has default content of 'hello world'", () => {
    const content = defaultDeckContent();
    expect(content.deckDescription).toBe("Hello World");
  });

  it("supports changing the description", () => {
    const content = DeckContentModel.create();
    content.setDescription("New Text");
    expect(content.deckDescription).toBe("New Text");
  });

  it("is always user resizable", () => {
    const content = DeckContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });
});
