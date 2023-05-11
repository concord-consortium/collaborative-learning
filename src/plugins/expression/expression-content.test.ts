import { defaultExpressionContent, ExpressionContentModel } from "./expression-content";

describe("ExpressionContent", () => {
  it("has default content of area of a circle formula", () => {
    const content = defaultExpressionContent();
    expect(content.latexStr).toBe("a=\\pi r^2");
  });

  it("supports changing the text", () => {
    const content = ExpressionContentModel.create();
    content.setLatexStr("abc");
    expect(content.latexStr).toBe("abc");
  });

  it("is always user resizable", () => {
    const content = ExpressionContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });
});


