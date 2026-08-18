/**
 * CLUE AI evaluation harness.
 *
 *   npx tsx harness.ts import    --from <dir> --corpus <name> [--source synthetic|demo|qa] [--prune]
 *   npx tsx harness.ts represent --corpus <name> --variants default,minimal
 *   npx tsx harness.ts render    --corpus <name> --mode <mode> [--clue-url <url>] [--unit <unit>]
 *                                [--shutterbug-url <url>] [--capture-height <px>] [--refresh]
 *   npx tsx harness.ts plan      --corpus <name> --experiment <file>
 *   npx tsx harness.ts run       --corpus <name> --experiment <file> --max-cost <usd>
 *                                [--output <file>] [--no-cache | --refresh-cache]
 *   npx tsx harness.ts report    --results <file>.jsonl
 *
 * See README.md for setup and per-command prerequisites.
 */
import fs from "node:fs";
import path from "node:path";
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
  imageRepresentationFreshness, imageRepresentationPath, readImageEnvelope, renderErrorDir,
  writeImageRepresentation
} from "./src/represent-image.js";
import {
  RenderModeOptions, assertRenderModeOptions, getRenderBackend, kDefaultClueUrl, kDefaultRenderModeId,
  renderMode, renderModeIds
} from "./src/backends/index.js";
import type { RenderBackend } from "./src/backends/types.js";
import {
  RenderUnitServer, kHarnessRenderUnitId, startRenderUnitServer
} from "./src/backends/render-unit.js";
import { formatSummaryTable, summarizeResults, summaryPathFor, writeSummary } from "./src/report.js";
import {
  CorpusSource, corpusSources, kSchemaVersion, sha256Canonical, validateExperimentFile
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
}

const promptsDir = path.join(harnessRoot, "prompts");

// ---------------------------------------------------------------------------
// argv
// ---------------------------------------------------------------------------

export interface ParsedArgs {
  command: string;
  flags: Record<string, string | true>;
}

const kBooleanFlags = new Set(["prune", "no-cache", "refresh-cache", "refresh"]);

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
  import: ["from", "corpus", "source", "prune"],
  represent: ["corpus", "variants"],
  render: ["corpus", "mode", "clue-url", "unit", "shutterbug-url", "capture-height", "refresh"],
  plan: ["corpus", "experiment"],
  run: ["corpus", "experiment", "max-cost", "output", "no-cache", "refresh-cache"],
  report: ["results"]
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
async function commandRender(flags: Record<string, string | true>, deps: HarnessDeps): Promise<void> {
  const log = deps.log ?? console.log;
  const now = deps.now ?? (() => new Date());
  const corpus = required(flags, "corpus");
  const paths = corpusPaths(dataRootFor(deps), corpus);
  const manifest = readManifest(paths);
  const modeId = typeof flags.mode === "string" ? flags.mode : kDefaultRenderModeId;
  const refresh = flags.refresh === true;

  const captureHeight = typeof flags["capture-height"] === "string"
    ? Number(flags["capture-height"]) : undefined;
  if (captureHeight !== undefined && (!Number.isInteger(captureHeight) || captureHeight <= 0)) {
    throw new Error(`--capture-height must be a positive whole number of pixels, got ` +
      `"${String(flags["capture-height"])}"`);
  }

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
  const failures: string[] = [];
  const concurrency = Math.max(1, deps.renderConcurrency ?? kDefaultRenderConcurrency);

  let unitServer: RenderUnitServer | undefined;
  let openBackend: RenderBackend | undefined;
  try {
    if (mode.needsUnitServer && !explicitUnit) {
      unitServer = await (deps.startUnitServer ?? startRenderUnitServer)({ clueUrl });
      log(`Serving the harness rendering unit at ${unitServer.unitUrl}`);
    }
    // Built once, after the unit server is up, so the backend knows where its unit is served.
    const renderer = getRenderBackend(modeId, { ...backendOptions, unitUrl: unitServer?.unitUrl });
    openBackend = renderer;

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
          renderTarget: renderer.renderTarget
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
        try {
          const outcome = await renderer.render({
            docId: document.id,
            content: readCorpusDocument(paths, document)
          });
          writeImageRepresentation({
            envelopeFile: file,
            docId: document.id,
            modeId: renderer.modeId,
            backendId: renderer.backendId,
            backendVersion: renderer.backendVersion,
            renderTarget: renderer.renderTarget,
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
          if (outcome.diagnostics.unknownTiles) {
            // Not fatal — the Unknown and Placeholder fixtures are *supposed* to draw this way — but
            // never silent, because for any other document it means the unit did not register its
            // tile types and the picture is of the wrong thing.
            log(`warning: ${document.id} rendered ${outcome.diagnostics.unknownTiles} unknown tile(s) ` +
              `of ${outcome.diagnostics.totalTiles ?? "?"}`);
          }
        } catch (error) {
          failures.push(document.id);
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
          log(`error: ${(error as Error).message}`);
          log(`  evidence written to ${directory}`);
        }
      }
    };
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
  } finally {
    // Nested: if closing the backend throws — a crashed Chromium, say — the unit server still has
    // to come down, or its open handle keeps the CLI alive after the error has been printed.
    try {
      if (openBackend?.close) await openBackend.close();
    } finally {
      await unitServer?.close();
    }
  }

  log(`Rendered ${rendered} document(s) with --mode ${modeId}, reused ${reused} still-fresh ` +
    `one(s), ${failures.length} failed.`);
  if (rendered > 0) {
    // New pixels mean new request keys, which means a full re-spend on any run that uses them.
    log("Regenerated renders produce new request keys, so runs using them will pay for those calls again.");
  }
  if (failures.length > 0) {
    throw new Error(`${failures.length} document(s) failed to render: ${failures.join(", ")}. ` +
      `See ${renderErrorDir(paths, modeId, "<docId>")}.`);
  }
}

function commandPlan(flags: Record<string, string | true>, deps: HarnessDeps): void {
  const log = deps.log ?? console.log;
  const corpus = required(flags, "corpus");
  const { experiment } = loadExperiment(required(flags, "experiment"));
  const pricingConfig = loadPricingConfig();
  const pricing = pricingFor(pricingConfig, kDefaultModel);
  const { tasks } = buildTasks({
    corpusPaths: corpusPaths(dataRootFor(deps), corpus),
    experiment,
    promptsDir,
    pricing
  });

  log(`Experiment "${experiment.name}": ${experiment.runs.length} run(s) × ` +
    `${tasks.length / Math.max(1, experiment.runs.length)} document(s) = ${tasks.length} call(s).`);
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
    const shape = run.message === "image-only"
      ? ` [image-only, --mode ${run.imageMode}; ${renderMode(run.imageMode!).prerequisites}]`
      : ` [text-only, ${run.textVariant}]`;
    log(`  ${run.id}: ${runTasksForRun.length} call(s), worst case $${runTotal.toFixed(4)}${shape}`);
    if (imageTokens > 0) {
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
  const { tasks } = buildTasks({
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
  const resultsFile = resolveDataPath(required(flags, "results"), "--results", dataRootFor(deps));
  // readResultRows treats a missing file as "no rows", which is what `run` needs when it creates a
  // fresh output file. For `report` that is a typo waiting to be misread as a result: an all-zeros
  // table and an empty summary.json written over whatever was there before.
  if (!fs.existsSync(resultsFile)) {
    throw new Error(`No results file at ${resultsFile}. Run \`harness.ts run\` first, or check ` +
      "--results — the default output path is data/results/<corpus>-<experiment>.jsonl.");
  }
  const rows = readResultRows(resultsFile);
  if (rows.length === 0) {
    throw new Error(`${resultsFile} contains no result rows, so there is nothing to report.`);
  }
  const summary = summarizeResults(rows, resultsFile, deps.now?.());
  const summaryFile = resolveDataPath(summaryPathFor(resultsFile), "--results", dataRootFor(deps));
  log(formatSummaryTable(summary));
  log(`\nRead ${summary.rows} row(s) from ${resultsFile}; ` +
    `${summary.currentRows} current, ${summary.superseded.rows} superseded by a later re-run.`);
  log(`Wrote ${writeSummary(summary, summaryFile)}`);
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
