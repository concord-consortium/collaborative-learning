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
import {
  kDefaultViewportWidthPx, kInitialFrameHeightPx, puppeteerBackend
} from "../src/backends/puppeteer.js";
import { startRenderUnitServer } from "../src/backends/render-unit.js";
import { readPngInfo } from "../src/png.js";

const kClueUrl = process.env.CLUE_URL ?? "http://localhost:8080";

/**
 * A subset, chosen to cover the things that can silently go wrong rather than for breadth:
 * a plain tile, a visual one, two tiles at once, an empty document, and the two fixtures whose
 * unknown-tile status is the point.
 */
const fixtures: {
  docId: string; expectUnknownTiles: number; minTiles: number; minHeightPx?: number;
  maxHeightPx?: number;
}[] = [
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
  { docId: "ai", expectUnknownTiles: 0, minTiles: 1 },
  // Taller than the 500px the generated page starts at, so a real browser exercises the frame
  // resize. Every other fixture is short enough that the resize never fires, which left the one
  // mechanism that keeps `captureMode: "full-document"` honest covered only by fake browsers.
  { docId: "tall", expectUnknownTiles: 0, minTiles: 10, minHeightPx: kInitialFrameHeightPx },
  // Nested rows: a Question tile draws its children as .tile-row elements inside its own row, and
  // the height measurement must count the parent row only. The regression mode is a silently
  // oversized frame — no error fires — so the upper bound is the check. Only a real DOM can catch
  // it: every jest fake answers the measurement script with a number of this file's choosing.
  // The bound is generous (double-counting inflated real documents by roughly half again or more);
  // the run prints the actual height, so tighten it if the fixture settles well below.
  { docId: "question", expectUnknownTiles: 0, minTiles: 3, maxHeightPx: 900 }
];

/**
 * Documents rendered a second time, per tile, with the number of pictures they must produce.
 *
 * Only a real browser can answer this. The fake in `smoke-image.test.ts` returns a fixed list of
 * elements whatever selector it is handed, so it has no DOM and cannot represent one tile inside
 * another — which is exactly the case this checks.
 *
 * `question` is the case: one top-level tile in the document's rows, and two more in its tile map
 * that it draws inside itself. A per-tile capture must produce one picture, not three.
 */
const perTileFixtures: { docId: string; expectImages: number }[] = [
  { docId: "question", expectImages: 1 },
  // Two top-level tiles, neither nested, so this is the control: the same code path must still
  // produce one picture each rather than being made blind by the rule above.
  { docId: "mixed", expectImages: 2 }
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
    modeId: "puppeteer-full-height",
    clueUrl: kClueUrl,
    unit: "harness-render",
    unitUrl: unitServer.unitUrl,
    clueRevision: "integration-check"
  });
  const failures: string[] = [];
  // Everything from here runs inside this, so the listening socket comes down whatever happens:
  // a fixture that will not parse, or a browser that will not launch, would otherwise leave it
  // holding the process open and `npm run test:render` would never return.
  try {
    try {
      await backend.open?.();
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
          if (fixture.minHeightPx !== undefined && info.heightPx <= fixture.minHeightPx) {
            problems.push(`height ${info.heightPx} is not past the ${fixture.minHeightPx}px the frame ` +
              "starts at, so this fixture did not exercise the resize");
          }
          if (fixture.maxHeightPx !== undefined && info.heightPx > fixture.maxHeightPx) {
            problems.push(`height ${info.heightPx} is over the ${fixture.maxHeightPx}px bound — ` +
              "an oversized frame usually means nested rows were counted into the measurement");
          }
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
    }

    const perTile = puppeteerBackend({
      modeId: "puppeteer-per-tile",
      clueUrl: kClueUrl,
      unit: "harness-render",
      unitUrl: unitServer.unitUrl,
      clueRevision: "integration-check",
      capture: "per-tile"
    });
    try {
      await perTile.open?.();
      for (const fixture of perTileFixtures) {
        const file = path.join(harnessRoot, "examples", "synthetic-corpus", "documents", `${fixture.docId}.json`);
        const content = JSON.parse(fs.readFileSync(file, "utf8"));
        try {
          const outcome = await perTile.render({ docId: fixture.docId, content });
          const tileIds = outcome.images.map((image) => image.tileId ?? "?");
          const problems: string[] = [];
          if (outcome.images.length !== fixture.expectImages) {
            problems.push(`captured ${outcome.images.length} tile(s), expected ${fixture.expectImages} ` +
              `(${tileIds.join(", ")})`);
          }
          const status = problems.length === 0 ? "ok  " : "FAIL";
          console.log(`${status} ${fixture.docId.padEnd(10)} per-tile: ${outcome.images.length} image(s) ` +
            `[${tileIds.join(", ")}]` + (problems.length ? `\n       ${problems.join("; ")}` : ""));
          if (problems.length) failures.push(`${fixture.docId} (per-tile): ${problems.join("; ")}`);
        } catch (error) {
          console.log(`FAIL ${fixture.docId.padEnd(10)} per-tile: ${(error as Error).message}`);
          failures.push(`${fixture.docId} (per-tile): ${(error as Error).message}`);
        }
      }
    } finally {
      await perTile.close?.();
    }
  } finally {
    await unitServer.close();
  }

  // Both passes, or the line understates what ran and a per-tile failure would be reported against
  // a total that never included it.
  const checks = fixtures.length + perTileFixtures.length;
  if (failures.length > 0) {
    console.error(`\n${failures.length} of ${checks} check(s) failed the local render check.`);
    process.exitCode = 1;
    return;
  }
  console.log(`\nAll ${checks} checks passed against ${kClueUrl} ` +
    `(${fixtures.length} full-document, ${perTileFixtures.length} per-tile).`);
}

// Caught, or a throw becomes an unhandled rejection rather than the message and exit code above.
main().catch((error) => {
  console.error(`\nThe local render check could not run: ${(error as Error).message}`);
  process.exitCode = 1;
});
