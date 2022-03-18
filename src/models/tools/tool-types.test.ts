import { isToolType } from "./tool-types";
import { kTextToolID } from "./text/text-content";

// This is needed so isToolType knows about the text tool
import { registerTools } from "../../register-tools";
registerTools([kTextToolID]);

describe("ToolTypes", () => {

  it("isToolType() works as expected", () => {
    expect(isToolType(kTextToolID)).toBe(true);
    expect(isToolType("foo")).toBe(false);
  });
});
