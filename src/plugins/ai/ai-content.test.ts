import { defaultAIContent, AIContentModel } from "./ai-content";

describe("AIContent", () => {
  it("has default content of 'hello world'", () => {
    const content = defaultAIContent();
    expect(content.prompt).toBe("");
  });

  it("supports changing the prompt", () => {
    const content = AIContentModel.create();
    content.setPrompt("New Text");
    expect(content.prompt).toBe("New Text");
  });

  it("is not user resizable", () => {
    const content = AIContentModel.create();
    expect(content.isUserResizable).toBe(false);
  });
});
