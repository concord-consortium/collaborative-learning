import { defaultFont } from "../../constants";
import * as measureTextModule from "../hooks/use-measure-text";
import { headerFitWidth } from "./column-width";
import { kHeaderControlsReserve, kMaxAutoColumnWidth, kMinColumnWidth } from "./table-types";

// jest-canvas-mock measures one pixel per character, so these widths are exact.
describe("headerFitWidth", () => {
  it("floors a short name at the minimum column width", () => {
    expect(headerFitWidth("x")).toBe(kMinColumnWidth);
  });

  it("fits a name that needs more than the minimum", () => {
    const name = "a".repeat(40);
    expect(headerFitWidth(name)).toBe(40 + kHeaderControlsReserve);
    expect(headerFitWidth(name)).toBeGreaterThan(kMinColumnWidth);
  });

  it("clamps a long name at the maximum", () => {
    expect(headerFitWidth("a".repeat(400))).toBe(kMaxAutoColumnWidth);
  });

  // The header renders bold. Measuring it with the regular font under-measures and the fix
  // falls short on exactly the long names it is for.
  it("measures with the header's own bold font", () => {
    const spy = jest.spyOn(measureTextModule, "measureText");
    headerFitWidth("Event Number");
    expect(spy).toHaveBeenCalledWith("Event Number", expect.stringContaining("700"));
    expect(spy).not.toHaveBeenCalledWith("Event Number", defaultFont);
    spy.mockRestore();
  });

  it("floors an empty name rather than returning the reserve", () => {
    expect(headerFitWidth("")).toBe(kMinColumnWidth);
  });
});
