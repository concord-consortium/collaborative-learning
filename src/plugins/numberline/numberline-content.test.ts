import { defaultNumberlineContent, NumberlineContentModel } from "./numberline-content";

describe("NumberlineContent", () => {
  it("has default content of 'hello world'", () => {
    const content = defaultNumberlineContent();
    expect(content.text).toBe("Hello World");
  });

  it("supports changing the text", () => {
    const content = NumberlineContentModel.create();
    content.setText("New Text");
    expect(content.text).toBe("New Text");
  });

  it("is always user resizable", () => {
    const content = NumberlineContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });
});
