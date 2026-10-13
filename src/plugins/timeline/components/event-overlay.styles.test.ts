import fs from "fs";
import path from "path";
import { kEventColorWords } from "../timeline-types";

// jsdom applies no stylesheets, so a rendering test cannot tell a colour word that scss knows about
// from one it has never heard of, nor a rule that degenerates correctly from one that doesn't.
// These read the stylesheets instead.
const read = (file: string) => fs.readFileSync(path.join(__dirname, file), "utf8");

/** The body of `name(...)` or `selector { ... }`, matched to its closing bracket so nesting comes along. */
function body(source: string, name: string, open: "(" | "{") {
  const close = open === "(" ? ")" : "}";
  const start = source.indexOf(`${name}${open === "(" ? ":" : ""}`);
  if (start < 0) throw new Error(`no ${name} in the stylesheet`);
  let depth = 0;
  for (let i = source.indexOf(open, start); i < source.length; i++) {
    if (source[i] === open) depth++;
    if (source[i] === close && --depth === 0) return source.slice(start, i);
  }
  throw new Error(`unbalanced ${open} after ${name}`);
}

describe("timeline-event-colors.scss", () => {
  const source = read("timeline-event-colors.scss");

  it("declares every colour word TypeScript knows about, and no others", () => {
    const declared = Array.from(body(source, "$event-colors", "(").matchAll(/"([a-z]+)":/g)).map(m => m[1]);
    expect(declared).toEqual([...kEventColorWords, "default"]);
  });

  // The design draws a mark as its icon colour at 40% over the black plot, not as the pale button
  // colour. Each `fill` is derived so the two can never drift apart.
  it("derives every fill from the icon colour", () => {
    kEventColorWords.concat("default").forEach(word => {
      expect(source).toContain(`$${word}-transparent: rgba($${word}-select, 0.4);`);
      expect(source).toContain(`$${word}-hover-transparent: rgba($${word}-hover, 0.4);`);
    });
  });
});

describe("event-overlay.scss", () => {
  const source = read("event-overlay.scss");

  // An event narrower than its own borders must read as a single line in the outline colour. With
  // border-box the two 1px borders fill the minimum width and leave no interior, so this falls out
  // of the box model rather than needing a pixel threshold to pick.
  it("draws a narrow event as a line in the outline colour", () => {
    const rule = body(source, ".event-overlay", "{");
    expect(rule).toMatch(/box-sizing:\s*border-box/);
    expect(rule).toMatch(/min-width:\s*2px/);
  });

  // "1- and 2-digit values use the same width button, while 3-digit values use a wider button."
  // A fixed width cannot widen, so the rule has to be a minimum with padding to grow into.
  it("lets a 3-digit event number widen its button", () => {
    const rule = body(source, ".event-label-button", "{");
    expect(rule).toMatch(/min-width:\s*24px/);
    expect(rule).not.toMatch(/^\s*width:/m);
  });

  it("colours the rectangle from the icon colour, not the pale button colour", () => {
    const rule = body(source, ".event-overlay", "{");
    expect(rule).toMatch(/border-color:\s*map-get\(\$colors,\s*select\)/);
    expect(rule).toMatch(/background-color:\s*map-get\(\$colors,\s*fill\)/);
    expect(rule).not.toMatch(/\$[a-z]+-base/);
  });
});
