import { isToolType } from "./tile-types";
import { kTextToolID } from "./text/text-content";

// This is needed so isToolType knows about the text tool
import { registerTiles } from "../../register-tiles";
registerTiles([kTextToolID]);

describe("ToolTypes", () => {

  it("isToolType() works as expected", () => {
    expect(isToolType(kTextToolID)).toBe(true);
    expect(isToolType("foo")).toBe(false);
  });
});
