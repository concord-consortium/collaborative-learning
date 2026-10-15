import fs from "fs";
import path from "path";
import { kEventColorWords } from "../timeline-types";

// jsdom applies no stylesheets, so a rendering test cannot tell a color word that scss knows about
// from one it has never heard of. These read the stylesheets instead.
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
  const map = body(source, "$event-colors", "(");
  const words = [...kEventColorWords, "default"];

  it("declares every color word TypeScript knows about, and no others", () => {
    const declared = Array.from(map.matchAll(/"([a-z]+)":/g)).map(m => m[1]);
    expect(declared).toEqual(words);
  });

  // Every per-color rule in the plugin reads this map, so an entry missing one of these would
  // leave some rule with nothing to emit for that word. `fill` and `hover-fill` are not checked:
  // they are derived for every entry by the `@each` below the map, so they cannot go missing for
  // one word alone.
  it("gives every color word the values the rules read", () => {
    words.forEach(word => {
      const from = map.indexOf(`"${word}":`);
      const entry = map.slice(from, map.indexOf(")", from));
      ["base", "hover", "select", "full-timeline"].forEach(key => {
        expect(entry).toMatch(new RegExp(`\\b${key}: #[0-9a-f]{6}`));
      });
    });
  });

  // A color word sharing another's hex would be a copy-paste that no rendering test would catch:
  // the two would simply look alike.
  it("gives every color word its own select color", () => {
    const selects = words.map(word => {
      const from = map.indexOf(`"${word}":`);
      return map.slice(from, map.indexOf(")", from)).match(/select: (#[0-9a-f]{6})/)![1];
    });
    expect(new Set(selects).size).toBe(words.length);
  });
});

describe("event-overlay.scss", () => {
  const source = read("event-overlay.scss");

  // The border is what makes a brief event read as a line: under the global border-box from
  // index.scss it floors the width at 2px with no interior left for the fill. The outcome is
  // checked in a browser by timeline_event_key_spec, which is the only place the box model runs.
  it("gives the rectangle the border that degenerates it", () => {
    expect(body(source, ".event-overlay", "{")).toMatch(/border:\s*1px solid;/);
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
