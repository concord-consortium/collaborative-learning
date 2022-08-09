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
});
