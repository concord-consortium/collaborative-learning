import { defaultAIContent, AIContentModel, kDefaultAIDescription } from "./ai-content";

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

  it("has a default description", () => {
    const content = AIContentModel.create();
    expect(content.description).toBe(kDefaultAIDescription);
  });

  it("supports changing the description", () => {
    const content = AIContentModel.create();
    content.setDescription("Custom instructions for students");
    expect(content.description).toBe("Custom instructions for students");
  });

  it("supports setting description to empty string", () => {
    const content = AIContentModel.create();
    content.setDescription("");
    expect(content.description).toBe("");
  });

  it("supports hidePrompt", () => {
    const content = AIContentModel.create();
    expect(content.hidePrompt).toBe(false);
    content.setHidePrompt(true);
    expect(content.hidePrompt).toBe(true);
    content.setHidePrompt(false);
    expect(content.hidePrompt).toBe(false);
  });

  it("requestRefresh increments refreshCount", () => {
    const content = AIContentModel.create();
    expect(content.refreshCount).toBe(0);
    content.requestRefresh();
    expect(content.refreshCount).toBe(1);
    content.requestRefresh();
    expect(content.refreshCount).toBe(2);
  });

  it("exportJson excludes refreshCount", () => {
    const content = AIContentModel.create();
    content.requestRefresh();
    content.requestRefresh();
    expect(content.refreshCount).toBe(2);
    const json = JSON.parse(content.exportJson());
    expect(json.refreshCount).toBeUndefined();
  });
});
