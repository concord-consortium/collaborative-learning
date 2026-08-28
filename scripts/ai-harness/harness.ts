/**
 * CLUE AI evaluation harness.
 *
 *   npx tsx harness.ts import    --from <dir> --corpus <name> [--source synthetic|demo|qa] [--prune]
 *                                [--source production --production-data-approved]
 *   npx tsx harness.ts represent --corpus <name> --variants default,minimal
 *   npx tsx harness.ts render    --corpus <name> --mode <mode> [--clue-url <url>] [--unit <unit>]
 *                                [--shutterbug-url <url>] [--capture-height <px>] [--refresh]
 *                                [--concurrency <n>] [--timeout-ms <n>]
 *   npx tsx harness.ts plan      --corpus <name> --experiment <file>
 *   npx tsx harness.ts run       --corpus <name> --experiment <file> --max-cost <usd>
 *                                [--output <file>] [--no-cache | --refresh-cache]
 *   npx tsx harness.ts report    --results <file>.jsonl
 *   npx tsx harness.ts review    --results <file>.jsonl --experiment <file>.json [--out <file>.html]
 *                                [--shareable] [--blind] [--reuse-key]
 *
 * See README.md for setup and per-command prerequisites.
 */
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import dotenv from "dotenv";
import {
  corpusPaths, defaultDataRoot, harnessRoot, importCorpus, isContainedBy, readCorpusDocument, readJsonFile,
  readManifest, readRepresentation, representationIsFresh, representationPath, writeJsonFile
} from "./src/corpus.js";
import { ResponseCache, cacheOptionsFor } from "./src/cache.js";
import { CostLedger, loadPricingConfig, pricingFor } from "./src/cost.js";
import {
  CreateCompletion, HostedImageCheck, buildTasks, currentRunMeta, kDefaultModel, openAiCompletion,
  readResultRows, resumeKeyFor, runTasks
} from "./src/execute.js";
import { getTextVariant, textVariantIds } from "./src/represent-text.js";
import {
  imageRepresentationFreshness, imageRepresentationIsUsable, imageRepresentationPath,
  readImageEnvelope, removeImageRepresentation, renderErrorDir, writeImageRepresentation
} from "./src/represent-image.js";
import {
  RenderModeOptions, assertRenderModeOptions, getRenderBackend, kDefaultClueUrl, kDefaultRenderModeId,
  renderBackendIdentity, renderMode, renderModeIds
} from "./src/backends/index.js";
import type { RenderBackend } from "./src/backends/types.js";
import { expectedTileCount, kDefaultRenderTimeoutMs } from "./src/backends/puppeteer.js";
import {
  RenderUnitServer, kHarnessRenderUnitId, startRenderUnitServer
} from "./src/backends/render-unit.js";
import {
  assertSingleCorpusAndExperiment, formatSummaryTable, summarizeResults, summaryPathFor, writeSummary
} from "./src/report.js";
import {
  ReviewModes, assertExperimentMatchesRows, buildReviewModel, ratingsTemplateCsv, renderReviewHtml,
  reviewKeyFileFor, reviewOutputPathFor, reviewSidecarPaths
} from "./src/review.js";
import { writeFileAtomically } from "./src/files.js";
import {
  CorpusSource, corpusSources, kSchemaVersion, sendsImages, sendsText, sha256Canonical,
  validateExperimentFile, validateReviewKeyFile
} from "./src/schemas.js";

/** Four pages at a time: enough to be quick, few enough not to starve a dev server. */
export const kDefaultRenderConcurrency = 4;

export interface HarnessDeps {
  /** Injected by the smoke test so the whole CLI can run without a network or an API key. */
  createCompletion?: CreateCompletion;
  log?: (message: string) => void;
  now?: () => Date;
  /**
   * Overridden by tests so they get their own corpora, caches and results. It must still point
   * inside `data/` — nothing derived from a document is ever written outside that tree.
   */
  dataRoot?: string;
  /** Injected by tests so `render` drives a fake browser and no unit server is started. */
  renderModeOptions?: RenderModeOptions;
  startUnitServer?: (options: { clueUrl: string }) => Promise<RenderUnitServer>;
  renderConcurrency?: number;
  /** Injected by tests so `run` does not really download hosted images to check them. */
  checkHostedImage?: HostedImageCheck;
  /**
   * The random seed a blind `review` orders its cards by. Injected by tests, which need two reports
   * that differ only in their seed; a real run generates 32 fresh bytes and keeps them in the key.
   */
  reviewSeed?: () => string;
}

const promptsDir = path.join(harnessRoot, "prompts");

// ---------------------------------------------------------------------------
// argv
// ---------------------------------------------------------------------------

export interface ParsedArgs {
  command: string;
  flags: Record<string, string | true>;
}

const kBooleanFlags = new Set([
  "prune", "no-cache", "refresh-cache", "refresh", "shareable", "blind", "reuse-key",
  "production-data-approved"
]);

/** Plain `--name value` pairs; a handful of flags are boolean. Unknown flags are errors. */
export function parseArgs(argv: string[], knownFlags: Record<string, readonly string[]>): ParsedArgs {
  const [command, ...rest] = argv;
  if (!command) {
    throw new Error(`Usage: harness.ts <${Object.keys(knownFlags).join("|")}> [flags]`);
  }
  const allowed = knownFlags[command];
  if (!allowed) {
    throw new Error(`Unknown command "${command}". Known commands: ${Object.keys(knownFlags).join(", ")}`);
  }

  const flags: Record<string, string | true> = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument "${token}"; flags are --name value pairs`);
    }
    const name = token.slice(2);
    if (!allowed.includes(name)) {
      throw new Error(`Unknown flag "--${name}" for command "${command}". ` +
        `Known flags: ${allowed.map((flag) => `--${flag}`).join(", ")}`);
    }
    if (name in flags) throw new Error(`Flag "--${name}" was given more than once`);
    if (kBooleanFlags.has(name)) {
      flags[name] = true;
      continue;
    }
    const value = rest[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Flag "--${name}" needs a value`);
    }
    flags[name] = value;
    index += 1;
  }
  return { command, flags };
}

const kKnownFlags = {
  import: ["from", "corpus", "source", "prune", "production-data-approved"],
  represent: ["corpus", "variants"],
  render: ["corpus", "mode", "clue-url", "unit", "shutterbug-url", "capture-height", "refresh",
    "concurrency", "timeout-ms"],
  plan: ["corpus", "experiment"],
  run: ["corpus", "experiment", "max-cost", "output", "no-cache", "refresh-cache"],
  report: ["results"],
  review: ["results", "experiment", "out", "shareable", "blind", "reuse-key"]
} as const;

function required(flags: Record<string, string | true>, name: string): string {
  const value = flags[name];
  if (typeof value !== "string") throw new Error(`--${name} is required`);
  return value;
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function dataRootFor(deps: HarnessDeps): string {
  return deps.dataRoot ?? defaultDataRoot();
}

/**
 * Separates the corpus from the experiment with something their id pattern forbids.
 *
 * A hyphen could not do the job it was there for. Both names match `[a-z0-9-]+`, so corpus `a-b` +
 * experiment `c` and corpus `a` + experiment `b-c` produced the same filename — and `report` then
 * refuses the merged file for mixing two corpora. Naming the corpus exists to prevent exactly that
 * collision, so the separator has to be one neither name can contain.
 */
export const kOutputNameSeparator = "__";

/**
 * Names the corpus as well as the experiment, so running the same experiment against two corpora does
 * not append both into one file. Routed through the same containment check as `--output`: the corpus
 * name and experiment name are both validated, but the check is cheap and this is the path that
 * writes student work.
 */
function defaultOutputFile(dataRoot: string, corpus: string, experimentName: string): string {
  // Absolute, so it resolves identically whatever the relative base is.
  return resolveDataPath(
    path.join(dataRoot, "results", `${corpus}${kOutputNameSeparator}${experimentName}.jsonl`),
    "--output", dataRoot);
}

/**
 * Resolves a results path and refuses anything outside the data root.
 *
 * Relative paths resolve against the harness directory, the same base as `--from` and `--experiment`
 * and the same way the README writes them (`data/results/…`). Containment is then checked against the
 * data root separately, through symlinks rather than lexically: result rows carry student work and
 * never leave `data/`.
 */
export function resolveDataPath(
  value: string, flag: string, dataRoot: string, base: string = harnessRoot
): string {
  const resolved = path.resolve(base, value);
  if (!isContainedBy(resolved, dataRoot)) {
    throw new Error(`${flag} must name a file inside the harness data directory (${dataRoot}); ` +
      `"${value}" resolves to ${resolved}. Result rows contain student work and never leave data/. ` +
      `Try a path like "${path.join(path.relative(harnessRoot, dataRoot), "results", "my-run.jsonl")}".`);
  }
  return resolved;
}

function loadExperiment(file: string) {
  const resolved = path.isAbsolute(file) ? file : path.resolve(harnessRoot, file);
  const raw = readJsonFile(resolved);
  const experiment = validateExperimentFile(raw, resolved, {
    knownTextVariants: textVariantIds,
    knownImageModes: renderModeIds,
    promptExists: (name) => fs.existsSync(path.join(promptsDir, `${name}.json`))
  });
  return { experiment, experimentSha256: sha256Canonical(raw), file: resolved };
}

function commandImport(flags: Record<string, string | true>, deps: HarnessDeps): void {
  const log = deps.log ?? console.log;
  const corpus = required(flags, "corpus");
  const source = (flags.source ?? "synthetic") as CorpusSource;
  if (!corpusSources.includes(source)) {
    throw new Error(`--source must be one of ${corpusSources.join(", ")}, got "${String(source)}"`);
  }
  const result = importCorpus({
    from: path.resolve(harnessRoot, required(flags, "from")),
    corpus,
    source,
    prune: flags.prune === true,
    productionDataApproved: flags["production-data-approved"] === true,
    dataRoot: dataRootFor(deps),
    now: deps.now
  });
  for (const warning of result.warnings) log(`warning: ${warning}`);
  log(`Imported ${result.imported.length} document(s) into corpus "${corpus}" ` +
    `(${result.missing.length} missing, ${result.pruned.length} pruned).`);
}

function commandRepresent(flags: Record<string, string | true>, deps: HarnessDeps): void {
  const log = deps.log ?? console.log;
  const now = deps.now ?? (() => new Date());
  const corpus = required(flags, "corpus");
  const paths = corpusPaths(dataRootFor(deps), corpus);
  const manifest = readManifest(paths);
  const variantIds = required(flags, "variants").split(",").map((id) => id.trim()).filter(Boolean);
  if (variantIds.length === 0) throw new Error("--variants needs at least one variant id");

  let written = 0;
  let reused = 0;
  for (const variantId of variantIds) {
    const variant = getTextVariant(variantId);
    for (const document of manifest.documents) {
      const file = representationPath(paths, variant.id, document.id);
      if (fs.existsSync(file)) {
        try {
          if (representationIsFresh(readRepresentation(file), {
            docId: document.id,
            variantId: variant.id,
            contentSha256: document.contentSha256,
            variantVersion: variant.variantVersion
          })) {
            reused += 1;
            continue;
          }
        } catch {
          // An unreadable or invalid envelope is simply stale; regenerate it.
        }
      }
      const content = readCorpusDocument(paths, document);
      writeJsonFile(file, {
        schemaVersion: kSchemaVersion,
        docId: document.id,
        variantId: variant.id,
        variantVersion: variant.variantVersion,
        sourceContentSha256: document.contentSha256,
        generatedAt: now().toISOString(),
        markdown: variant.render(content)
      });
      written += 1;
    }
  }
  log(`Wrote ${written} representation(s), reused ${reused} still-fresh one(s).`);
}

/**
 * The image analogue of `represent`.
 *
 * One browser for the whole run, a page per document, concurrency capped, pages closed in a finally,
 * and no retry — a render failure is a bug to look at, not a transient. A document that fails writes
 * no envelope, leaves what evidence it has under `render-errors/`, and does not stop the others; the
 * command exits non-zero at the end.
 */
/**
 * The height each document should be captured at, from its local full-document render.
 *
 * A hosted service cannot measure anything: it is handed a page and a height and clips to it. The
 * only thing that knows how tall a CLUE document really is, is a browser that has laid it out — so
 * an accurate-height render is a two-step operation, and this is the step that reads the answer.
 *
 * Every document is checked before any is posted. Failing document by document would leave a
 * half-rendered corpus, and a bill for the part that worked.
 */
function measuredHeightsFor(
  paths: ReturnType<typeof corpusPaths>,
  documents: { id: string; contentSha256: string; expectedRenderFailure: string | null }[],
  modeId: string
): Map<string, number> {
  const source = kDefaultRenderModeId;
  const backend = renderBackendIdentity(source);
  const heights = new Map<string, number>();
  const missing: string[] = [];
  // A document known not to render has no local render to measure from, and never will. Demanding
  // one would make any corpus holding a deliberately unrenderable fixture unusable with this mode.
  // Only the demand is waived: a marked document that *does* have a usable render still contributes
  // its height and is captured like any other, and one that does not is simply absent from the map,
  // which the render loop skips rather than falling back on a height this mode was built to avoid.
  const wanted = (document: { id: string; expectedRenderFailure: string | null }) => {
    if (!document.expectedRenderFailure) missing.push(document.id);
  };
  for (const document of documents) {
    const file = imageRepresentationPath(paths, source, document.id);
    if (!fs.existsSync(file)) {
      wanted(document);
      continue;
    }
    try {
      const envelope = readImageEnvelope(file);
      const usable = imageRepresentationIsUsable(envelope, {
        docId: document.id,
        modeId: source,
        backendId: backend.backendId,
        backendVersion: backend.backendVersion,
        contentSha256: document.contentSha256
      }, file);
      const image = envelope.images.find((entry) => entry.purpose === "full-document");
      if (!usable.fresh || !image) {
        wanted(document);
        continue;
      }
      heights.set(document.id, image.heightPx);
    } catch {
      wanted(document);
    }
  }
  if (missing.length > 0) {
    throw new Error(`--mode ${modeId} captures each document at its own measured height, and ` +
      `${missing.length} document(s) have no usable ${source} render to measure from: ` +
      `${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ", …" : ""}. Render locally first: ` +
      `harness.ts render --corpus <name> --mode ${source}`);
  }
  return heights;
}

/** The render target a document would be captured against now, height included. */
function targetFor(
  renderer: RenderBackend, measuredHeights: Map<string, number> | null, docId: string
) {
  if (!measuredHeights) return renderer.renderTarget;
  return { ...renderer.renderTarget, captureHeightPx: measuredHeights.get(docId) ?? null };
}

async function commandRender(flags: Record<string, string | true>, deps: HarnessDeps): Promise<void> {
  const log = deps.log ?? console.log;
  const now = deps.now ?? (() => new Date());
  const corpus = required(flags, "corpus");
  const paths = corpusPaths(dataRootFor(deps), corpus);
  const manifest = readManifest(paths);
  const modeId = typeof flags.mode === "string" ? flags.mode : kDefaultRenderModeId;
  const refresh = flags.refresh === true;

  const positiveInteger = (name: string, unit: string): number | undefined => {
    const raw = flags[name];
    if (typeof raw !== "string") return undefined;
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`--${name} must be a positive whole number of ${unit}, got "${String(raw)}"`);
    }
    return value;
  };
  const captureHeight = positiveInteger("capture-height", "pixels");
  // Both default to what they always were. They exist because a cold dev server times out the first
  // documents of a run — four pages at once against a server still compiling chunks — and until now
  // re-running was the only lever.
  const concurrencyFlag = positiveInteger("concurrency", "pages at a time");
  const timeoutMs = positiveInteger("timeout-ms", "milliseconds");

  // The local mode needs a unit that registers every tile type the corpus uses, and CLUE registers
  // tile types from the unit's own configuration. With no unit it loads its default one and draws
  // most of these fixtures as unknown tiles — in a perfectly valid PNG. The harness therefore serves
  // its own unit, unless the caller names one.
  const explicitUnit = typeof flags.unit === "string" ? flags.unit : undefined;
  const clueUrlFlag = typeof flags["clue-url"] === "string" ? flags["clue-url"] : undefined;

  const backendOptions = {
    clueUrl: clueUrlFlag,
    unit: explicitUnit,
    shutterbugUrl: typeof flags["shutterbug-url"] === "string" ? flags["shutterbug-url"] : undefined,
    captureHeightPx: captureHeight,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
    ...(deps.renderModeOptions ?? {})
  };
  // Validated *before* anything is started. When this ran after the unit server was listening, an
  // unusable flag left the server open and hung the CLI after the error had already been printed.
  assertRenderModeOptions(modeId, backendOptions);
  const mode = renderMode(modeId);
  // The unit server serves the same CLUE deployment the backend renders against.
  const clueUrl = backendOptions.clueUrl ?? kDefaultClueUrl;

  let rendered = 0;
  let reused = 0;
  /** Documents a per-tile mode cannot represent, because their content declares no tiles. */
  let nothingToCapture = 0;
  /** Documents the manifest says cannot render, which failed as expected. */
  const expectedFailures: string[] = [];
  const failures: string[] = [];
  const concurrency = concurrencyFlag ?? Math.max(1, deps.renderConcurrency ?? kDefaultRenderConcurrency);

  let unitServer: RenderUnitServer | undefined;
  let openBackend: RenderBackend | undefined;
  let closeFailure: Error | undefined;
  try {
    if (mode.needsUnitServer && !explicitUnit) {
      unitServer = await (deps.startUnitServer ?? startRenderUnitServer)({ clueUrl });
      log(`Serving the harness rendering unit at ${unitServer.unitUrl}`);
    }
    // Built once, after the unit server is up, so the backend knows where its unit is served.
    const renderer = getRenderBackend(modeId, { ...backendOptions, unitUrl: unitServer?.unitUrl });
    openBackend = renderer;

    // A mode whose height is measured needs a local full-document render to measure from. Read for
    // the whole corpus before anything is posted: discovering it document by document would leave a
    // half-rendered corpus and a bill for the part that worked.
    const measuredHeights = mode.needsMeasuredHeight
      ? measuredHeightsFor(paths, manifest.documents, modeId)
      : null;

    // Nothing will notice if these renders are pictures of the wrong thing.
    //
    // CLUE registers tile types from the unit's own configuration, so a unit that does not declare
    // the corpus's tile types draws them with the placeholder component — a perfectly valid PNG of
    // an "Unknown" box. The `unknownTiles` warning below is what normally catches that, and it
    // needs a backend that can see inside the page. A hosted service renders somewhere else and
    // reports nothing, so for the Shutterbug modes (which render against `mods`) both halves are
    // missing at once, and the run just says it rendered every document.
    if (renderer.renderTarget.unit !== kHarnessRenderUnitId && renderer.kind === "network") {
      log(`warning: --mode ${modeId} renders against unit "${renderer.renderTarget.unit}" and cannot ` +
        "report what it drew. Any tile type that unit does not register draws as an unknown-tile " +
        "placeholder, and nothing here will say so — check the pictures before trusting a run that " +
        "uses them.");
    }

    if (renderer.renderTarget.clueRevision === null) {
      // Recorded as unknown rather than guessed. A target whose code can change underneath a stored
      // render, with no way to tell, is worth saying out loud.
      log(`warning: the CLUE revision behind ${renderer.renderTarget.clueUrl} could not be established, ` +
        "so freshness cannot notice if it changes. Use --refresh to re-render regardless.");
    }

    const pending = manifest.documents.filter((document) => {
      if (refresh) return true;
      const file = imageRepresentationPath(paths, renderer.modeId, document.id);
      if (!fs.existsSync(file)) return true;
      try {
        if (imageRepresentationFreshness(readImageEnvelope(file), {
          docId: document.id,
          modeId: renderer.modeId,
          backendId: renderer.backendId,
          backendVersion: renderer.backendVersion,
          contentSha256: document.contentSha256,
          // Compared against the height this document would be captured at now, not the mode's
          // nominal one: a document whose local render has since changed height is stale here too.
          renderTarget: targetFor(renderer, measuredHeights, document.id)
        }, file).fresh) {
          reused += 1;
          return false;
        }
      } catch {
        // An unreadable or invalid envelope is simply stale; render it again.
      }
      return true;
    });

    if (renderer.open) await renderer.open();
    let next = 0;
    const worker = async (): Promise<void> => {
      for (;;) {
        const index = next++;
        if (index >= pending.length) return;
        const document = pending[index];
        const file = imageRepresentationPath(paths, renderer.modeId, document.id);
        // A document this mode cannot represent leaves nothing behind. It is in `pending` because
        // whatever is on disk is stale, and those files are pictures of a document that no longer
        // looks like that — unusable, and student work once the corpus is real. Nothing else would
        // ever clear them: `render` only overwrites what it re-renders, and `--prune` only reaches
        // documents that have left the manifest.
        const skipWithoutCapturing = (reason: string) => {
          log(`skipped ${document.id}: ${reason}`);
          const removed = removeImageRepresentation(file);
          if (removed.length > 0) {
            log(`  removed ${removed.length} stale file(s) from the previous ${renderer.modeId} render`);
          }
          nothingToCapture += 1;
        };
        try {
          const content = readCorpusDocument(paths, document);
          const declaredTiles = expectedTileCount(content);
          // A per-tile mode has nothing to photograph in a document whose content declares no tiles.
          // That is a fact about the document, not a failure of the render — the mode simply cannot
          // represent it, and a run skips it for the same reason.
          if (renderer.renderTarget.captureMode === "per-tile" && declaredTiles === 0) {
            skipWithoutCapturing("its content declares no tiles, so a per-tile capture has " +
              "nothing to photograph");
            continue;
          }
          // A measured-height mode has no height for a document that is known not to render, and
          // must not fall back: an absent `captureHeightPx` reaches the backend as the fixed
          // production height, which is the very thing this mode exists not to do — and the result
          // would be filed as a capture at the document's own measured height.
          if (measuredHeights && !measuredHeights.has(document.id)) {
            skipWithoutCapturing(`${document.expectedRenderFailure
              ? `it is expected not to render ("${document.expectedRenderFailure}"), so there is no `
              : "it has no "}measured height for --mode ${modeId} to capture at`);
            continue;
          }
          const outcome = await renderer.render({
            docId: document.id,
            content,
            ...(measuredHeights ? { captureHeightPx: measuredHeights.get(document.id) } : {})
          });
          writeImageRepresentation({
            envelopeFile: file,
            docId: document.id,
            modeId: renderer.modeId,
            backendId: renderer.backendId,
            backendVersion: renderer.backendVersion,
            // The backend reports its own target when the render differed from the mode's nominal
            // one, which is how a per-document height reaches the envelope.
            renderTarget: outcome.renderTarget ?? renderer.renderTarget,
            sourceContentSha256: document.contentSha256,
            generatedAt: now().toISOString(),
            images: outcome.images.map((image) => ({
              bytes: image.bytes, url: image.url, tileId: image.tileId, purpose: image.purpose
            }))
          });
          rendered += 1;
          // The document renders now, so the previous run's evidence is evidence of nothing — and
          // leaving it behind would keep a PNG of student work that no envelope refers to.
          fs.rmSync(renderErrorDir(paths, renderer.modeId, document.id), { recursive: true, force: true });
          // The document loaded and drew nothing. Not fatal — `empty` is a real fixture — but for
          // any document whose content declares tiles it means the picture is of the wrong thing,
          // and until now only *unknown* tiles were ever mentioned.
          if (document.expectedRenderFailure) {
            // The expectation is now wrong, and a stale one is worse than none: it would go on
            // hiding a real failure the day this document breaks again.
            log(`warning: ${document.id} rendered, but the manifest says it should not ` +
              `("${document.expectedRenderFailure}"). Clear expectedRenderFailure for it.`);
          }
          if (declaredTiles > 0 && outcome.diagnostics.totalTiles === 0) {
            log(`warning: ${document.id} declares ${declaredTiles} tile(s) but drew none; the ` +
              "capture is of a document that rendered nothing");
          }
          if (outcome.diagnostics.unknownTiles) {
            // Not fatal — the Unknown and Placeholder fixtures are *supposed* to draw this way — but
            // never silent, because for any other document it means the unit did not register its
            // tile types and the picture is of the wrong thing.
            log(`warning: ${document.id} rendered ${outcome.diagnostics.unknownTiles} unknown tile(s) ` +
              `of ${outcome.diagnostics.totalTiles ?? "?"}`);
          }
        } catch (error) {
          // Known not to render, and why: reported apart from real failures so the exit code keeps
          // meaning something, since a corpus that always exits non-zero is one nobody checks. The
          // evidence is written either way — a document expected to fail one way and failing
          // another is exactly the case the screenshot is for, and the failure message points at it.
          const expected = document.expectedRenderFailure;
          if (expected) expectedFailures.push(document.id);
          else failures.push(document.id);
          const directory = renderErrorDir(paths, renderer.modeId, document.id);
          // Cleared first: a previous attempt's screenshot and console output would otherwise be
          // presented as evidence for this error, and would keep an older copy of the document.
          fs.rmSync(directory, { recursive: true, force: true });
          fs.mkdirSync(directory, { recursive: true });
          fs.writeFileSync(path.join(directory, "error.txt"),
            `${(error as Error).stack ?? String(error)}\n`, "utf8");
          const context = (error as {
            context?: { consoleOutput?: string[]; screenshot?: Buffer };
          }).context;
          if (context?.consoleOutput) {
            fs.writeFileSync(path.join(directory, "console.txt"),
              `${context.consoleOutput.join("\n")}\n`, "utf8");
          }
          // The picture of the failure, where the backend could take one. For a visual failure this
          // is often the only evidence there is — the console is empty and the page is half drawn.
          if (context?.screenshot) fs.writeFileSync(path.join(directory, "screenshot.png"), context.screenshot);
          log(expected
            ? `expected failure: ${document.id} (${expected})`
            : `error: ${(error as Error).message}`);
          log(`  ${expected ? `${(error as Error).message}\n  ` : ""}evidence written to ${directory}`);
        }
      }
    };
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
  } finally {
    // A close failure is logged here and kept, never thrown from the `finally` itself. Rethrowing
    // from a `finally` replaces whatever was already in flight, so a Chromium launch failure would
    // surface as a close failure — the wrong error, and the one that says nothing about why the
    // render did not happen. Both halves come down whatever the other one does: the unit server's
    // open handle keeps the CLI alive on its own, and the browser is a process.
    const closeQuietly = async (what: string, close: (() => Promise<void>) | undefined) => {
      if (!close) return;
      try {
        await close();
      } catch (error) {
        log(`warning: closing ${what} failed: ${(error as Error).message}`);
        closeFailure ??= error as Error;
      }
    };
    await closeQuietly("the render backend", openBackend?.close?.bind(openBackend));
    await closeQuietly("the unit server", unitServer?.close?.bind(unitServer));
  }

  // The settings are named in the line, so a run that needed them says so in its own output rather
  // than only in the shell history of whoever typed it. The per-document budget is named only by the
  // modes that keep one: a hosted mode bounds its request and its download separately and has no
  // whole-document deadline, so printing one would describe a limit nothing enforces.
  const settings = mode.unusableFlags.includes("timeoutMs")
    ? `${concurrency} at a time`
    : `${concurrency} at a time, ${timeoutMs ?? kDefaultRenderTimeoutMs}ms per document`;
  log(`Rendered ${rendered} document(s) with --mode ${modeId}, reused ${reused} still-fresh ` +
    `one(s), ${failures.length} failed` +
    (expectedFailures.length > 0 ? `, ${expectedFailures.length} expected to fail` : "") +
    (nothingToCapture > 0 ? `, ${nothingToCapture} with nothing to capture` : "") +
    `. (${settings}.)`);
  if (rendered > 0) {
    // New pixels mean new request keys, which means a full re-spend on any run that uses them.
    log("Regenerated renders produce new request keys, so runs using them will pay for those calls again.");
  }
  if (failures.length > 0) {
    throw new Error(`${failures.length} document(s) failed to render: ${failures.join(", ")}. ` +
      `See ${renderErrorDir(paths, modeId, "<docId>")}.`);
  }
  // Reported only once the render failures have had their turn, since they say more about what went
  // wrong. On its own, though, it is still a failure: a command that exits 0 says it finished, and
  // a browser that would not close may still be running.
  if (closeFailure) {
    throw new Error(`Every document rendered, but shutting down afterwards failed: ` +
      `${closeFailure.message}. The renders on disk are good, so a re-run will reuse them.`);
  }
}

function commandPlan(flags: Record<string, string | true>, deps: HarnessDeps): void {
  const log = deps.log ?? console.log;
  const corpus = required(flags, "corpus");
  const { experiment } = loadExperiment(required(flags, "experiment"));
  const pricingConfig = loadPricingConfig();
  const pricing = pricingFor(pricingConfig, kDefaultModel);
  const { tasks, skipped, documents } = buildTasks({
    corpusPaths: corpusPaths(dataRootFor(deps), corpus),
    experiment,
    promptsDir,
    pricing
  });

  // The product is of runs and documents, which is the number of *pairs* — not the number of calls,
  // because skip-empty declines some of them. Stating it as `= N call(s), M skipped` made the
  // multiplication false on any corpus with a skip, in the one command someone reads to decide
  // whether to spend money. Both figures below are checkable: the product, and the split of it.
  const pairs = experiment.runs.length * documents.length;
  log(`Experiment "${experiment.name}": ${experiment.runs.length} run(s) × ` +
    `${documents.length} document(s) = ${pairs} pair(s)` +
    (skipped.length > 0
      ? `; ${tasks.length} call(s), ${skipped.length} skipped.`
      : `, all sent as ${tasks.length} call(s).`));
  log(`Model ${kDefaultModel}, prices effective ${pricingConfig.effectiveDate}, ` +
    `max_completion_tokens ${pricing.maxOutputTokens}.`);
  let total = 0;
  let sawHostedImages = false;
  for (const run of experiment.runs) {
    const runTasksForRun = tasks.filter((task) => task.runId === run.id);
    const runTotal = runTasksForRun.reduce((sum, task) => sum + task.worstCaseUsd, 0);
    total += runTotal;
    const imageTokens = runTasksForRun.reduce((sum, task) => sum + task.imageTokensEstimated, 0);
    sawHostedImages ||= runTasksForRun.some((task) => task.hostedImages.length > 0);
    // Read from the mode descriptor rather than by building a backend: construction validates URLs
    // and limits, and shells out to git for the local mode, none of which belongs in a command that
    // promises to touch nothing.
    // `plan` is the record of what a run was about to do, so this label has to name the shape that
    // will actually run: one naming the wrong shape would describe a mixed run as something else
    // while printing its images underneath.
    const carries = [run.message as string];
    if (sendsText(run.message)) carries.push(run.textVariant!);
    if (sendsImages(run.message)) carries.push(`--mode ${run.imageMode}`);
    const shape = ` [${carries.join(", ")}` +
      (run.imageMode ? `; ${renderMode(run.imageMode).prerequisites}` : "") + "]";
    log(`  ${run.id}: ${runTasksForRun.length} call(s), worst case $${runTotal.toFixed(4)}${shape}`);
    if (run.imageMode) {
      // Where the pictures came from, resolved rather than described. Every render target value has
      // a default, and omitting `--shutterbug-url` posts student work at staging without saying so.
      log(`    renders against: ${renderMode(run.imageMode).renderTargetSummary}`);
    }
    if (imageTokens > 0) {
      // How many pictures, not just what they cost: a per-tile set sends one image per tile, and
      // each one carries the base charge again. That multiplication is the thing to see *before*
      // paying for it, so it is stated per run beside the total it produces.
      const images = runTasksForRun.reduce((sum, task) => sum + task.imageCount, 0);
      const perDocument = images / Math.max(1, runTasksForRun.length);
      log(`    ${images} image(s) across ${runTasksForRun.length} call(s) ` +
        `(${perDocument.toFixed(1)} per document, imageSet ${run.imageSet ?? "full-document"})`);
      // Reserved at the high-detail rate, because the shared builder sends `auto` and the provider
      // publishes an exact formula only for explicit low and high.
      log(`    image tokens (estimated, auto priced at the high rate): ${imageTokens}`);
    }
  }
  log(`Worst-case total (retries included): $${total.toFixed(4)}. No network access was used.`);
  if (sawHostedImages) {
    // `plan` stays network-free by definition, so it cannot know whether the URLs still resolve.
    log("Some runs point at hosted image URLs, which were NOT verified — plan makes no network " +
      "requests. `run` downloads each one and checks it still serves the pixels that were " +
      "rendered, before dispatching anything.");
  }
}

async function commandRun(flags: Record<string, string | true>, deps: HarnessDeps): Promise<void> {
  const log = deps.log ?? console.log;
  const corpus = required(flags, "corpus");
  const { experiment, experimentSha256 } = loadExperiment(required(flags, "experiment"));
  const maxCost = Number(required(flags, "max-cost"));
  if (!Number.isFinite(maxCost) || maxCost <= 0) {
    throw new Error(`--max-cost must be a positive number of US dollars, got "${String(flags["max-cost"])}"`);
  }

  const dataRoot = dataRootFor(deps);
  const pricingConfig = loadPricingConfig();
  const pricing = pricingFor(pricingConfig, kDefaultModel);
  const { tasks, skipped } = buildTasks({
    corpusPaths: corpusPaths(dataRoot, corpus),
    experiment,
    promptsDir,
    pricing
  });

  const outputFile = typeof flags.output === "string"
    ? resolveDataPath(flags.output, "--output", dataRoot)
    : defaultOutputFile(dataRoot, corpus, experiment.name);

  const cacheOptions = cacheOptionsFor(flags["no-cache"] === true, flags["refresh-cache"] === true);
  // Resume runs before the cache is ever consulted, so completed rows in the output file would make
  // both flags no-ops: the run would skip the very requests the user asked to re-execute. Fail loudly
  // rather than silently doing nothing (or appending a second set of rows to the same file).
  //
  // The comparison is the run loop's own resume key, request key included. Matching on corpus and
  // experiment hash alone was too loose: editing a prompt file changes every request key but not the
  // experiment hash, so `--refresh-cache` refused a rerun that resume would not have skipped at all.
  if (!cacheOptions.read) {
    const wouldResume = new Set(readResultRows(outputFile)
      .filter((row) => row.status !== "error" && row.requestKey !== null)
      .map((row) => resumeKeyFor(row)));
    const blocked = tasks.filter((task) => wouldResume.has(resumeKeyFor({
      corpus, experimentSha256, docId: task.docId, runId: task.runId, requestKey: task.requestKey
    })));
    if (blocked.length > 0) {
      const flag = flags["no-cache"] === true ? "--no-cache" : "--refresh-cache";
      throw new Error(`${flag} asks for fresh API calls, but ${outputFile} already holds ` +
        `${blocked.length} completed row(s) matching ${blocked.length === 1 ? "a task" : "tasks"} in ` +
        "this run, which resume would skip before the cache is consulted. Pass a fresh --output " +
        "(or delete that file) to re-execute.");
    }
  }
  const createCompletion = deps.createCompletion ?? openAiCompletion(requireApiKey());

  const ledger = new CostLedger(maxCost);
  const summary = await runTasks({
    corpus,
    experiment,
    experimentSha256,
    tasks,
    skipped,
    outputFile,
    ledger,
    cache: new ResponseCache(path.join(dataRoot, "cache"), cacheOptions),
    pricing,
    runMeta: currentRunMeta(deps.now?.()),
    createCompletion,
    checkHostedImage: deps.checkHostedImage,
    log
  });

  log(`Wrote ${summary.written} row(s) to ${outputFile} ` +
    `(${summary.resumed} already complete, ${summary.cacheHits} from cache, ${summary.apiCalls} API call(s)).`);
  if (summary.skipped > 0) {
    // Named rather than folded into the row count: a skipped row costs nothing and answers nothing,
    // and a reader comparing runs needs to know how much of the corpus each one actually looked at.
    log(`${summary.skipped} (run, document) pair(s) were skipped and recorded as skipped rows, with ` +
      "reasons. See the `skipped` column in `report`.");
  }
  log(`Reserved at peak $${summary.reservedPeakUsd.toFixed(4)} of the $${maxCost.toFixed(4)} ceiling; ` +
    `actually spent $${summary.incurredUsd.toFixed(4)}.`);
  // Gated on work actually skipped, not merely on the ceiling having been reached: a run that
  // dispatched every task and then noticed the ledger was full has not stopped early.
  if (summary.stoppedOnCeiling && summary.notDispatched > 0) {
    log(`Stopped early: the spend ceiling was reached with ${summary.notDispatched} task(s) not dispatched.`);
  }
}

function commandReport(flags: Record<string, string | true>, deps: HarnessDeps): void {
  const log = deps.log ?? console.log;
  // Reports are derived from student work, so both the file read and the summary written beside it
  // stay inside the data root.
  const { resultsFile, rows } = readResultsFileFor(flags, dataRootFor(deps));
  const summary = summarizeResults(rows, resultsFile, deps.now?.());
  const summaryFile = resolveDataPath(summaryPathFor(resultsFile), "--results", dataRootFor(deps));
  log(formatSummaryTable(summary));
  log(`\nRead ${summary.rows} row(s) from ${resultsFile}; ` +
    `${summary.currentRows} current, ${summary.superseded.rows} superseded by a later re-run.`);
  log(`Wrote ${writeSummary(summary, summaryFile)}`);
}

/**
 * The results file every `report`/`review` invocation reads, with the two ways of getting it wrong
 * separated: a path that is not there at all, and a file that holds no rows.
 *
 * `readResultRows` treats a missing file as "no rows", which is what `run` needs on a fresh
 * `--output`. Here that would turn a typo into an all-zeros report written over whatever was there.
 */
function readResultsFileFor(flags: Record<string, string | true>, dataRoot: string) {
  const resultsFile = resolveDataPath(required(flags, "results"), "--results", dataRoot);
  if (!fs.existsSync(resultsFile)) {
    throw new Error(`No results file at ${resultsFile}. Run \`harness.ts run\` first, or check ` +
      "--results — the default output path is data/results/<corpus>__<experiment>.jsonl.");
  }
  const rows = readResultRows(resultsFile);
  if (rows.length === 0) {
    throw new Error(`${resultsFile} contains no result rows, so there is nothing to report.`);
  }
  return { resultsFile, rows };
}

/**
 * The side-by-side HTML review report: what a human judge reads to compare runs on one document.
 *
 * Reads the results file, the experiment file and the corpus tree, and writes an HTML file plus —
 * in the modes that need one — a key and a ratings template beside it. No network, no API key.
 *
 * Every collision is settled before anything is written, so a refused run leaves nothing behind. An
 * existing key is never overwritten and never rewritten: rotating it would orphan every rating a
 * judge has already written against the old labels.
 */
function commandReview(flags: Record<string, string | true>, deps: HarnessDeps): void {
  const log = deps.log ?? console.log;
  const dataRoot = dataRootFor(deps);
  const { resultsFile, rows } = readResultsFileFor(flags, dataRoot);
  assertSingleCorpusAndExperiment(rows, resultsFile);

  // Required, and hash-checked. Result rows do not carry `detail`, `imageSet` or `extras`, a skipped
  // row carries no representation descriptor at all, and run order lives in the experiment file —
  // so the report needs that file, and needs to know it is the one these rows were produced with.
  const { experiment, experimentSha256, file: experimentFile } =
    loadExperiment(required(flags, "experiment"));
  assertExperimentMatchesRows(rows, experimentSha256, experimentFile, resultsFile);

  const corpus = rows[0].corpus;
  const paths = corpusPaths(dataRoot, corpus);
  if (!fs.existsSync(paths.manifest)) {
    throw new Error(`These results were produced against corpus "${corpus}", which is not in ` +
      `${dataRoot}. The review report shows the summaries and pictures each run sent, so it needs ` +
      `the corpus tree: import it as "${corpus}" first.`);
  }

  const modes: ReviewModes = { shareable: flags.shareable === true, blind: flags.blind === true };
  const outputFile = resolveDataPath(
    typeof flags.out === "string" ? flags.out : reviewOutputPathFor(resultsFile, modes),
    "--out", dataRoot);
  if (!outputFile.endsWith(".html")) {
    // The key and the ratings template are named from this path, so an `--out` with another
    // extension would produce sidecars whose names nobody can predict — including the next
    // invocation, which has to find the key it must not overwrite.
    throw new Error(`--out must name a .html file, got ${outputFile}.`);
  }
  const sidecars = reviewSidecarPaths(outputFile);
  const needsKey = modes.shareable || modes.blind;
  const reuseKey = flags["reuse-key"] === true;

  if (!needsKey && reuseKey) {
    throw new Error("--reuse-key applies to --shareable and --blind reports, which are the ones " +
      "that write a key. A plain review report writes no sidecars.");
  }
  // Every path this run would touch is settled here, before a single byte is written — and the
  // rules do not depend on the mode. A sidecar beside the output path belongs to some report, and
  // with `--out` the mode is not in the filename, so those sidecars are the only record of what
  // that path is. Checking them only in the modes that write them let a plain report overwrite a
  // blinded one: an unredacted page in a file believed to be shareable, a key that decodes nothing,
  // and a judge's page replaced mid-round.
  if (fs.existsSync(sidecars.key) && !reuseKey) {
    throw new Error(`${sidecars.key} already exists, so this path holds a shareable or blinded ` +
      `report. A key is never overwritten: its labels and pseudonyms are what any ratings already ` +
      "collected refer to" + (needsKey
        ? ". Pass --reuse-key to regenerate that same report, or --out to write a different one."
        : ", and a plain report would replace its HTML with an unredacted one and leave the key " +
          "decoding a page that no longer exists. Pass --out to write a different report."));
  }
  if (!fs.existsSync(sidecars.key) && reuseKey) {
    throw new Error(`--reuse-key was given, but there is no key at ${sidecars.key} to reuse.`);
  }
  // A template is preserved by exactly one kind of run: a blinded regeneration against its own key.
  // Any other run at this path would leave a judge's ratings naming labels the page no longer has.
  const preservesRatings = modes.blind && reuseKey;
  if (fs.existsSync(sidecars.ratings) && !preservesRatings) {
    throw new Error(`${sidecars.ratings} already exists, and this run would not preserve it: a ` +
      "ratings template names the labels of the blinded report that wrote it, and may hold a " +
      "judge's answers against them. Move it aside, or pass --out to write a different report.");
  }

  const existingKey = reuseKey
    ? { key: validateReviewKeyFile(readJsonFile(sidecars.key), sidecars.key), file: sidecars.key }
    : undefined;

  const model = buildReviewModel({
    rows,
    resultsFile,
    experiment,
    experimentSha256,
    paths,
    now: deps.now?.() ?? new Date(),
    modes,
    // 32 bytes from the OS, kept only in the key file: an ordering derived from anything in the
    // results is reconstructible by whoever reads `blindLabelsFor`.
    seed: (deps.reviewSeed ?? (() => randomBytes(32).toString("hex")))(),
    existingKey
  });

  // The key goes down first. A key with no report beside it costs a re-run — `--reuse-key`
  // regenerates the report exactly — while a report with no key is a document nobody can decode.
  if (needsKey && !reuseKey) {
    writeJsonFile(sidecars.key, reviewKeyFileFor(model));
    log(`Wrote ${sidecars.key} — the only copy of ` +
      `${[modes.shareable && "the pseudonyms", modes.blind && "the label mapping"]
        .filter(Boolean).join(" and ")}. Keep it; without it the report cannot be decoded.`);
  }
  writeFileAtomically(outputFile, renderReviewHtml(model));
  log(`Wrote ${outputFile} — ${model.documents.length} document(s), ${model.judgeable.length} ` +
    `judgeable outcome(s), ${model.counts.skipped} skipped.`);
  if (modes.blind) {
    if (fs.existsSync(sidecars.ratings)) {
      // Never regenerated: it may already hold a judge's half-entered ratings.
      log(`Left ${sidecars.ratings} as it is.`);
    } else {
      writeFileAtomically(sidecars.ratings, ratingsTemplateCsv(model));
      log(`Wrote ${sidecars.ratings} — one empty row per labelled outcome.`);
    }
  }
}

function requireApiKey(): string {
  dotenv.config({ path: path.join(harnessRoot, "..", ".env") });
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set. Put it in scripts/.env or export it in your environment.");
  }
  return apiKey;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function main(argv: string[], deps: HarnessDeps = {}): Promise<void> {
  const { command, flags } = parseArgs(argv, kKnownFlags);
  switch (command) {
    case "import": return commandImport(flags, deps);
    case "represent": return commandRepresent(flags, deps);
    case "render": return commandRender(flags, deps);
    case "plan": return commandPlan(flags, deps);
    case "run": return commandRun(flags, deps);
    case "report": return commandReport(flags, deps);
    case "review": return commandReview(flags, deps);
    default: throw new Error(`Unknown command "${command}"`);
  }
}

// Compared by basename rather than by the literal harness.ts path, so running through a symlink, a
// compiled entry point or a differently-resolved path still starts the CLI instead of silently
// importing it and doing nothing.
const invokedDirectly = !!process.argv[1] &&
  path.basename(process.argv[1]).replace(/\.[^.]+$/, "") === "harness";

if (invokedDirectly) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
