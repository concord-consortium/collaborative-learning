import fs from "fs";
import path from "path";

// The overlay is pointer-events: none so it doesn't swallow the plot's clicks, and each interactive
// part opts back in. jsdom ignores pointer-events when dispatching, so a rendering test cannot tell
// a dead control from a live one — a placed label that forgot to opt back in still passes every
// click test while being unusable in a browser. touch-action is invisible to it in the same way.
// This reads the stylesheet instead.
describe("time-marker-overlay.scss", () => {
  const source = fs.readFileSync(path.join(__dirname, "time-marker-overlay.scss"), "utf8");

  /** The body of `selector { ... }`, brace-matched so nested rules come along. */
  function block(selector: string, within = source) {
    const start = within.indexOf(`${selector} {`);
    if (start < 0) throw new Error(`no ${selector} rule in time-marker-overlay.scss`);
    let depth = 0;
    for (let i = within.indexOf("{", start); i < within.length; i++) {
      if (within[i] === "{") depth++;
      if (within[i] === "}" && --depth === 0) return within.slice(start, i);
    }
    throw new Error(`unbalanced braces after ${selector}`);
  }

  const grip = block("@mixin marker-grip");

  it("lets a grip receive pointer events, so the marker can be dragged and deleted", () => {
    expect(grip).toMatch(/pointer-events:\s*auto/);
  });

  // The grips sit outside .timeline-plot, so the plot's own touch-action does not cover them.
  it("keeps a touch drag on a grip from being claimed for panning the page", () => {
    expect(grip).toMatch(/touch-action:\s*pan-y pinch-zoom/);
  });

  it.each([".time-marker-line", ".time-marker-label"])(
    "makes a placed %s a grip only while the tile is interactive",
    selector => {
      expect(block(selector)).toContain("&.placed.interactive {\n    @include marker-grip;");
    }
  );

  it("leaves the overlay itself transparent to pointers", () => {
    expect(block(".time-marker-overlay")).toMatch(/pointer-events:\s*none/);
  });
});
