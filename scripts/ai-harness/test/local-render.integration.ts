/**
 * The local renderer, against a real CLUE dev server and a real headless Chromium.
 *
 *   npm start            # in the repository root, serving http://localhost:8080
 *   npm run test:render  # here
 *
 * Deliberately not a jest test — it needs a server this machine may not be running, and jest's
 * `test/**\/*.test.ts` pattern skips it. It is a required scripted step all the same: every other
 * render test drives a *fake* browser, which cannot have an opaque origin, does not run CLUE, and
 * answers whatever selector it is asked. Version 1 of this backend passed all of them and rendered
 * nothing at all against a real server.
 *
 * What it checks, per fixture: a PNG comes back, it decodes, it is the expected width, tiles were
 * counted, and a fixture that should draw as an unknown tile did — and one that should not, did not.
 */
import fs from "node:fs";
import path from "node:path";
import { harnessRoot } from "../src/corpus.js";
import { puppeteerBackend, kDefaultViewportWidthPx } from "../src/backends/puppeteer.js";
import { startRenderUnitServer } from "../src/backends/render-unit.js";
import { readPngInfo } from "../src/png.js";

const kClueUrl = process.env.CLUE_URL ?? "http://localhost:8080";

/**
 * A subset, chosen to cover the things that can silently go wrong rather than for breadth:
 * a plain tile, a visual one, two tiles at once, an empty document, and the two fixtures whose
 * unknown-tile status is the point.
 */
const fixtures: { docId: string; expectUnknownTiles: number; minTiles: number }[] = [
  { docId: "drawing", expectUnknownTiles: 0, minTiles: 1 },
  { docId: "table", expectUnknownTiles: 0, minTiles: 1 },
  { docId: "geometry", expectUnknownTiles: 0, minTiles: 1 },
  { docId: "mixed", expectUnknownTiles: 0, minTiles: 2 },
  { docId: "empty", expectUnknownTiles: 0, minTiles: 0 },
  // The Unknown fixture uses a made-up tile type, so it is *supposed* to draw as an unknown tile.
  // If this one ever reports 0, the check that catches an unregistered tile type has stopped working.
  { docId: "unknown", expectUnknownTiles: 1, minTiles: 1 },
  // AI is one of the two types the QA unit does not register, and the harness unit adds. If the
  // rendering unit regresses, this is where it shows up.
  { docId: "ai", expectUnknownTiles: 0, minTiles: 1 }
];

async function main(): Promise<void> {
  const response = await fetch(kClueUrl).catch(() => null);
  if (!response?.ok) {
    console.error(`No CLUE dev server at ${kClueUrl}. Run \`npm start\` in the repository root first.`);
    process.exitCode = 1;
    return;
  }

  const unitServer = await startRenderUnitServer({ clueUrl: kClueUrl });
  const backend = puppeteerBackend({
    clueUrl: kClueUrl,
    unit: "harness-render",
    unitUrl: unitServer.unitUrl,
    clueRevision: "integration-check"
  });
  const failures: string[] = [];

  await backend.open?.();
  try {
    for (const fixture of fixtures) {
      const file = path.join(harnessRoot, "examples", "synthetic-corpus", "documents", `${fixture.docId}.json`);
      const content = JSON.parse(fs.readFileSync(file, "utf8"));
      try {
        const outcome = await backend.render({ docId: fixture.docId, content });
        const image = outcome.images[0];
        const info = readPngInfo(image.bytes, fixture.docId);
        const { totalTiles, unknownTiles } = outcome.diagnostics;

        const problems: string[] = [];
        if (info.widthPx > kDefaultViewportWidthPx) {
          problems.push(`width ${info.widthPx} exceeds the ${kDefaultViewportWidthPx}px viewport`);
        }
        if (info.heightPx <= 0) problems.push(`height ${info.heightPx}`);
        if ((totalTiles ?? -1) < fixture.minTiles) {
          problems.push(`counted ${totalTiles} tiles, expected at least ${fixture.minTiles}`);
        }
        if (unknownTiles !== fixture.expectUnknownTiles) {
          problems.push(`counted ${unknownTiles} unknown tiles, expected ${fixture.expectUnknownTiles}`);
        }

        const status = problems.length === 0 ? "ok  " : "FAIL";
        console.log(`${status} ${fixture.docId.padEnd(10)} ${info.widthPx}×${String(info.heightPx).padEnd(5)} ` +
          `${String(image.bytes.length).padStart(7)} bytes  tiles=${totalTiles} unknown=${unknownTiles}` +
          (problems.length ? `\n       ${problems.join("; ")}` : ""));
        if (problems.length) failures.push(`${fixture.docId}: ${problems.join("; ")}`);
      } catch (error) {
        console.log(`FAIL ${fixture.docId.padEnd(10)} ${(error as Error).message}`);
        failures.push(`${fixture.docId}: ${(error as Error).message}`);
      }
    }
  } finally {
    await backend.close?.();
    await unitServer.close();
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} of ${fixtures.length} fixture(s) failed the local render check.`);
    process.exitCode = 1;
    return;
  }
  console.log(`\nAll ${fixtures.length} fixtures rendered against ${kClueUrl}.`);
}

main();
