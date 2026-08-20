import { kColors } from "./fill-color-palette";
import { SwatchColor } from "./color-swatch";

// Duplicate hex values in a palette cause duplicate React keys and double-highlight, so the fill
// palette must stay unique. It also carries the pastels synced with Dataflow blocks / variable chips.
describe("FillColorPalette kColors (CLUE-543)", () => {
  it("has no duplicate values", () => {
    expect(new Set(kColors).size).toBe(kColors.length);
  });

  it("includes the synced pastels", () => {
    for (const c of [SwatchColor.paleGray, SwatchColor.lightOrange, SwatchColor.lightGreen,
      SwatchColor.lightBlue, SwatchColor.lightPurple, SwatchColor.lightYellow]) {
      expect(kColors).toContain(c);
    }
  });

  it("keeps the bold row ending with yellow before the white/pastel row", () => {
    expect(kColors[0]).toBe(SwatchColor.none);
    expect(kColors[7]).toBe(SwatchColor.yellow);
    expect(kColors[8]).toBe(SwatchColor.white);
  });
});

// These three pastels are shared across tiles by hex value (there is no single source of truth: the
// same literals live in dataflow-vars.scss $operator-blue/$input-purple/$output-yellow and the external
// diagram-view chip theme). This pins the Sketch side so it can't silently drift out of sync. If you
// intentionally change a synced color, update dataflow-vars.scss (and the chip theme) to match, then
// update the expected value here.
describe("Sketch pastels synced with Dataflow / chips (CLUE-543)", () => {
  it("matches the shared hex values", () => {
    expect(SwatchColor.lightBlue).toBe("#addef4");   // == $operator-blue / chip blue
    expect(SwatchColor.lightPurple).toBe("#a5b2ff"); // == $input-purple
    expect(SwatchColor.lightYellow).toBe("#f7e58f"); // == $output-yellow / chip yellow
  });
});
