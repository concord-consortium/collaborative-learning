import { isToolType } from "./tool-types";
import { kTextToolID } from "./text/text-content";

describe("ToolTypes", () => {

  it("isToolType() works as expected", () => {
    expect(isToolType(kTextToolID)).toBe(true);
    expect(isToolType("foo")).toBe(false);
  });
});
