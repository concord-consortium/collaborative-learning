import path from "path";
import { clueBasicDataColorInfo } from "../../../utilities/color-utils";

// Tests the color class resolution logic used by geometry toolbar buttons
// (LineButton, PointButton, PolygonButton, CircleButton).
// The actual buttons use `clueBasicDataColorInfo[selectedColor].name` to
// derive the CSS class, and the icon SVGs must have `reactive-to-color-change`
// on their colored elements for the CSS to take effect.

describe("geometry toolbar button color class", () => {

  it("returns the correct color name for each selectedColor index", () => {
    // Index 0 is the default (blue)
    expect(clueBasicDataColorInfo[0].name).toBe("blue");
    expect(clueBasicDataColorInfo[1].name).toBe("orange");
    expect(clueBasicDataColorInfo[2].name).toBe("green");
    expect(clueBasicDataColorInfo[3].name).toBe("red");
  });

  it("all color entries have a name for the CSS class", () => {
    clueBasicDataColorInfo.forEach((info) => {
      expect(info.name).toBeTruthy();
      expect(typeof info.name).toBe("string");
    });
  });

  it("line icon SVG has reactive-to-color-change class on colored elements", () => {
    const fs = require("fs");
    const svgPath = path.resolve(__dirname, "../../../clue/assets/icons/geometry/line-icon.svg");
    const svg = fs.readFileSync(svgPath, "utf8");
    // The line path and point ring paths should have the reactive class
    const matches = svg.match(/class="reactive-to-color-change"/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(3); // line path + 2 point ring paths
    // The parent <g> should NOT have a hardcoded fill color
    expect(svg).toContain('fill="none"');
    expect(svg).not.toMatch(/<g[^>]*fill="#4782B4"/);
  });
});
