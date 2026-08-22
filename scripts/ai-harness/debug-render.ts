/**
 * Renders ONE corpus document through the same pathway `render --mode puppeteer-full-height` uses,
 * with everything observable: every console message from the page and the CLUE frame (timestamped),
 * a DOM probe every second showing exactly which rows and tiles have mounted, and screenshots at
 * the end regardless of outcome. Built to diagnose the teacher-workshop truncation: rows that are
 * measured but never paint, and documents that never mount at all
 * ("getTileSharedModels has no document").
 *
 *   npx tsx debug-render.ts --corpus <name> --doc <corpus-document-id>
 *   npx tsx debug-render.ts --corpus <name> --doc <corpus-document-id> --timeout-ms 90000
 *
 * Prerequisites: a CLUE dev server (npm start) at --clue-url (default http://localhost:8080), and
 * the corpus imported under data/corpus/<name>/. Output lands in data/debug/<doc>/: console.txt,
 * timeline.txt, snapshots.json, page.png (full render page), frame.png (the CLUE frame alone).
 *
 * Read the timeline bottom-up: the last snapshot shows which model rows never appeared in the DOM
 * (`missing rows`), and the per-row table shows each mounted row's height and tile count, so "it
 * stopped after row N" is a fact rather than an impression.
 */
import fs from "node:fs";
import path from "node:path";
import { corpusPaths, defaultDataRoot, readCorpusDocument, readManifest } from "./src/corpus.js";
import { generateRenderHtml, kInitialFrameHeightPx } from "./src/backends/render-html.js";
import { startRenderPageServer } from "./src/backends/puppeteer.js";
import { startRenderUnitServer } from "./src/backends/render-unit.js";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

// --- Arguments --------------------------------------------------------------

let corpus: string | undefined;
let docId: string | undefined;
let clueUrl = "http://localhost:8080";
let timeoutMs = 90_000;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case "--corpus": corpus = args[++i]; break;
    case "--doc": docId = args[++i]; break;
    case "--clue-url": clueUrl = (args[++i] ?? "").replace(/\/$/, ""); break;
    case "--timeout-ms": timeoutMs = Number(args[++i]); break;
    default: fail(`Unknown argument "${args[i]}". Usage: debug-render.ts --corpus <name> --doc <id> ` +
      "[--clue-url <url>] [--timeout-ms <n>]");
  }
}
if (!corpus || !docId) fail("Usage: debug-render.ts --corpus <name> --doc <id>");
if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) fail("--timeout-ms must be a positive number");

// --- Output -----------------------------------------------------------------

const outDir = path.join(defaultDataRoot(), "debug", docId);
fs.mkdirSync(outDir, { recursive: true });
const startedAt = Date.now();
const stamp = () => `+${((Date.now() - startedAt) / 1000).toFixed(1)}s`;

const consoleLines: string[] = [];
const timelineLines: string[] = [];
function logConsole(line: string) {
  consoleLines.push(line);
  console.log(line);
}
function logTimeline(line: string) {
  timelineLines.push(line);
  console.log(line);
}

// --- The probe run inside the CLUE frame ------------------------------------

/**
 * Everything the diagnosis needs from the frame, per poll. `rows` maps the DOM's `data-row-id`
 * attributes back to the document model, which is what turns "the bottom is blank" into "these
 * specific rows never mounted".
 */
const kProbeScript = `(() => {
  const app = document.getElementById("app");
  const rows = [];
  document.querySelectorAll(".tile-row").forEach((row) => {
    rows.push({
      rowId: row.getAttribute("data-row-id"),
      heightPx: Math.round(row.getBoundingClientRect().height),
      topPx: Math.round(row.getBoundingClientRect().top),
      tiles: row.querySelectorAll(".tool-tile").length,
      placeholders: row.querySelectorAll(".placeholder-tile").length,
      classes: row.className
    });
  });
  return {
    readyState: document.readyState,
    hasApp: !!app,
    appScrollHeightPx: app ? app.scrollHeight : 0,
    documentError: !!document.querySelector(".document-error"),
    totalTiles: document.querySelectorAll(".tool-tile").length,
    placeholderTiles: document.querySelectorAll(".placeholder-tile").length,
    sectionHeaderRows: document.querySelectorAll(".tile-row.section-header").length,
    bodyTextChars: document.body ? document.body.innerText.length : 0,
    rows
  };
})()`;

interface ProbeRow {
  rowId: string | null; heightPx: number; topPx: number; tiles: number;
  placeholders: number; classes: string;
}
interface Probe {
  readyState: string; hasApp: boolean; appScrollHeightPx: number; documentError: boolean;
  totalTiles: number; placeholderTiles: number; sectionHeaderRows: number; bodyTextChars: number;
  rows: ProbeRow[];
}

// --- Main -------------------------------------------------------------------

async function main() {
  const paths = corpusPaths(defaultDataRoot(), corpus!);
  const manifest = readManifest(paths);
  const entry = manifest.documents.find((doc) => doc.id === docId);
  if (!entry) fail(`Corpus "${corpus}" has no document "${docId}".`);
  const content = readCorpusDocument(paths, entry) as {
    rowOrder?: string[]; rowMap?: Record<string, { isSectionHeader?: boolean; tiles?: unknown[] }>;
    tileMap?: Record<string, unknown>;
  };
  const modelRowIds = content.rowOrder ?? [];
  logTimeline(`${stamp()} document "${docId}": ${modelRowIds.length} model rows, ` +
    `${Object.keys(content.tileMap ?? {}).length} tiles in tileMap`);

  const unitServer = await startRenderUnitServer({ clueUrl });
  const pageServer = await startRenderPageServer();
  const html = generateRenderHtml({
    content, clueUrl, unit: unitServer.unitUrl, initialHeightPx: kInitialFrameHeightPx
  });
  const served = pageServer.serve(docId!, html);
  logTimeline(`${stamp()} render page at ${served.url}; unit at ${unitServer.unitUrl}`);

  const puppeteer = (await import("puppeteer")) as any;
  const browser = await puppeteer.default.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 800 });

  // Every console message, from the page and every frame, timestamped. This is the stream the
  // backend truncates into evidence-on-failure; here it is the point.
  page.on("console", (message: any) => {
    logConsole(`${stamp()} console.${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error: any) => logConsole(`${stamp()} PAGEERROR: ${error?.message ?? error}`));
  page.on("requestfailed", (request: any) => {
    logConsole(`${stamp()} requestfailed: ${request.url()} (${request.failure()?.errorText})`);
  });
  page.on("framenavigated", (frame: any) => logConsole(`${stamp()} frame navigated: ${frame.url()}`));

  await page.goto(served.url, { waitUntil: "domcontentloaded" });

  const clueFrame = () => page.frames().find((frame: any) => frame.url().includes("iframe.html"));

  // Poll until nothing changes for a while or the timeout lapses — deliberately no early success
  // exit, because "what happens after it looks done" is part of what this tool is for.
  let lastSummary = "";
  let lastChangeAt = Date.now();
  const snapshots: { at: string; posted: boolean; probe: Probe | null }[] = [];
  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    let posted = false;
    try {
      posted = await page.evaluate(
        "window.__clueRender && window.__clueRender.initialValuePosted === true") as boolean;
    } catch { /* navigation in progress */ }
    const frame = clueFrame();
    let probe: Probe | null = null;
    if (frame) {
      try {
        probe = await frame.evaluate(kProbeScript) as Probe;
      } catch (error) {
        logTimeline(`${stamp()} probe failed: ${(error as Error).message}`);
      }
    }
    snapshots.push({ at: stamp(), posted, probe });
    const summary = probe
      ? `posted=${posted} rows=${probe.rows.length}/${modelRowIds.length} ` +
        `tiles=${probe.totalTiles} placeholders=${probe.placeholderTiles} ` +
        `appHeight=${probe.appScrollHeightPx} bodyText=${probe.bodyTextChars} ` +
        `docError=${probe.documentError}`
      : `posted=${posted} (no CLUE frame yet)`;
    if (summary !== lastSummary) {
      logTimeline(`${stamp()} ${summary}`);
      lastSummary = summary;
      lastChangeAt = Date.now();
    }
    // Stop once the frame has been completely still for 15s — long past the backend's 500ms
    // settle, so anything that was ever going to mount has had its chance.
    if (Date.now() - lastChangeAt > 15_000) {
      logTimeline(`${stamp()} no change for 15s; stopping`);
      break;
    }
  }

  // Final accounting: which model rows never made it into the DOM.
  const finalProbe = snapshots.at(-1)?.probe ?? null;
  if (finalProbe) {
    const domRowIds = new Set(finalProbe.rows.map((row) => row.rowId));
    const missing = modelRowIds.filter((rowId) => !domRowIds.has(rowId));
    const extra = finalProbe.rows.filter((row) => row.rowId && !modelRowIds.includes(row.rowId));
    logTimeline("");
    logTimeline("=== Final row accounting ===");
    for (const rowId of modelRowIds) {
      const domRow = finalProbe.rows.find((row) => row.rowId === rowId);
      const model = content.rowMap?.[rowId];
      const kind = model?.isSectionHeader ? "sectionHeader" : `${model?.tiles?.length ?? 0} tile(s)`;
      logTimeline(domRow
        ? `  ${rowId} (${kind}): mounted, height ${domRow.heightPx}px, top ${domRow.topPx}px, ` +
          `${domRow.tiles} tile(s), ${domRow.placeholders} placeholder(s)`
        : `  ${rowId} (${kind}): NEVER MOUNTED`);
    }
    if (extra.length) {
      logTimeline(`  plus ${extra.length} DOM row(s) not in the top-level rowOrder (nested rows): ` +
        extra.map((row) => `${row.rowId}(${row.tiles}t)`).join(", "));
    }
    logTimeline(missing.length
      ? `  => ${missing.length} of ${modelRowIds.length} model rows never mounted`
      : "  => every model row mounted");
  } else {
    logTimeline("=== No probe ever succeeded: the CLUE frame never became reachable ===");
  }

  try {
    await page.screenshot({ path: path.join(outDir, "page.png"), fullPage: true });
    const frameElement = await page.$("iframe");
    if (frameElement) await frameElement.screenshot({ path: path.join(outDir, "frame.png") });
  } catch (error) {
    logTimeline(`screenshot failed: ${(error as Error).message}`);
  }

  fs.writeFileSync(path.join(outDir, "console.txt"), consoleLines.join("\n") + "\n");
  fs.writeFileSync(path.join(outDir, "timeline.txt"), timelineLines.join("\n") + "\n");
  fs.writeFileSync(path.join(outDir, "snapshots.json"), JSON.stringify(snapshots, null, 2) + "\n");
  console.log(`\nWrote console.txt, timeline.txt, snapshots.json, page.png, frame.png to ${outDir}`);

  served.forget();
  await browser.close();
  await pageServer.close();
  await unitServer.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
