import { isToolType } from "./tool-types";
import { kTextToolID } from "./text/text-content";

// This is needed so isToolType knows about the text tool
import "../../register-tools";

describe("ToolTypes", () => {

  it("isToolType() works as expected", () => {
    expect(isToolType(kTextToolID)).toBe(true);
    expect(isToolType("foo")).toBe(false);
  });
});
