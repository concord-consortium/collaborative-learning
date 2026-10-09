import fs from "fs";
import path from "path";

// The overlay is pointer-events: none so it doesn't swallow the plot's clicks, and each interactive
// part opts back in. jsdom ignores pointer-events when dispatching, so a rendering test cannot tell
// a dead control from a live one — a placed label that forgot to opt back in still passes every
// click test while being unusable in a browser. This reads the stylesheet instead.
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

  it.each([".time-marker-line", ".time-marker-label"])(
    "lets a placed %s receive pointer events, so it can be dragged and deleted",
    selector => {
      expect(block("&.placed", block(selector))).toMatch(/pointer-events:\s*auto/);
    }
  );

  it("leaves the overlay itself transparent to pointers", () => {
    expect(block(".time-marker-overlay")).toMatch(/pointer-events:\s*none/);
  });
});
