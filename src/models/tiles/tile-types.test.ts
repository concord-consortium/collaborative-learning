import { kTextTileType } from "./text/text-content";
import { isRegisteredTileType } from "./tile-content-info";

// This is needed so isRegisteredTileType knows about the text tool
import { registerTileTypes } from "../../register-tile-types";
registerTileTypes([kTextTileType]);

describe("ToolTypes", () => {

  it("isRegisteredTileType() works as expected", () => {
    expect(isRegisteredTileType(kTextTileType)).toBe(true);
    expect(isRegisteredTileType("foo")).toBe(false);
  });
});
