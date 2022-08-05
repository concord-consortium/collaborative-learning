import { DeckContentModel } from "./deck-content";

describe("DeckContent", () => {
  it("is always user resizable", () => {
    const content = DeckContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });
});
