// Draws a micro:bit board with a 5x5 LED pattern lit, using MakeCode's own simulator code, run
// under jsdom. The output has no dates, random values or platform-dependent numbers, so the
// same pattern always gives the same bytes.
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const nodeModulesDir = path.join(toolDir, "node_modules");
const require = createRequire(path.join(toolDir, "package.json"));
const { JSDOM } = require("jsdom");

const kSimScripts = [
  "pxt-core/built/pxtsim.js",
  "pxt-microbit/built/common-sim.js",
  "pxt-microbit/built/sim.js"
];

let simWindow;

// The simulator scripts are large, so they load once per process.
function getSimWindow() {
  if (!simWindow) {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", { runScripts: "outside-only" });
    for (const script of kSimScripts) {
      dom.window.eval(fs.readFileSync(path.join(nodeModulesDir, script), "utf8"));
    }
    simWindow = dom.window;
  }
  return simWindow;
}

/**
 * @param pattern 25 characters, row by row: `#` for a lit LED, `.` for an unlit one.
 * @returns the board as a standalone SVG document, ending with a newline.
 */
export function renderBoardSvg(pattern) {
  const pixels = pattern.replace(/\s+/g, "");
  if (!/^[#.]{25}$/.test(pixels)) {
    throw new Error(`An LED pattern needs 25 characters of # and ., got "${pattern}"`);
  }
  const window = getSimWindow();
  const { pxsim } = window;
  // A fixed theme: the board's default theme is picked at random.
  const board = new pxsim.visuals.MicrobitBoardSvg({ theme: pxsim.visuals.themes[0] });
  // Lights each LED the way the simulator's own LED matrix update does.
  board.leds.forEach((led, i) => {
    const on = pixels[i] === "#";
    led.style.opacity = on ? "1" : "0";
    if (on) {
      led.style.transformBox = "fill-box";
      led.style.transformOrigin = "50% 50%";
      led.style.transform = "scale(1)";
    }
  });
  return `${new window.XMLSerializer().serializeToString(board.element)}\n`;
}
