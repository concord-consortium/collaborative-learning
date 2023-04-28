import { defaultBoldFont } from "../../components/constants";
import { defaultExpressionContent, ExpressionContentModel } from "./expression-content";

describe("ExpressionContent", () => {
  it("has default content of 'hello world'", () => {
    const content = defaultExpressionContent();
    expect(content.text).toBe("Math Expression");
  });

  it("supports changing the text", () => {
    const content = ExpressionContentModel.create();
    content.setText("New Text");
    expect(content.text).toBe("New Text");
  });

  it("is always user resizable", () => {
    const content = ExpressionContentModel.create();
    expect(content.isUserResizable).toBe(true);
  });
});


