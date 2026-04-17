import { defaultStarterContent, StarterContentModel } from "./starter-content";

describe("StarterContent", () => {
  it("has default content of 'hello world'", () => {
    const content = defaultStarterContent();
    expect(content.text).toBe("Hello World");
  });

  it("supports changing the text", () => {
    const content = StarterContentModel.create();
    content.setText("New Text");
    expect(content.text).toBe("New Text");
  });

  it("is always user resizable", () => {
    const content = StarterContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });

  it("exports a JSON string including the persisted fields", () => {
    const content = StarterContentModel.create({ text: "Greeting" });
    const json = content.exportJson();
    expect(typeof json).toBe("string");
    expect(json.length).toBeGreaterThan(0);
    expect(JSON.parse(json)).toEqual({
      type: "Starter",
      text: "Greeting"
    });
  });
});
