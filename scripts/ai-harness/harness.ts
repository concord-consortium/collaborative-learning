/**
 * CLUE AI evaluation harness (CLUE-371, milestone 1).
 *
 *   npx tsx harness.ts import    --from <dir> --corpus <name> [--source synthetic|demo|qa] [--prune]
 *   npx tsx harness.ts represent --corpus <name> --variants default,minimal
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
  corpusPaths, defaultDataRoot, harnessRoot, importCorpus, readCorpusDocument, readJsonFile, readManifest,
  readRepresentation, representationIsFresh, representationPath, writeJsonFile
} from "./src/corpus.js";
import { ResponseCache, cacheOptionsFor } from "./src/cache.js";
import { CostLedger, loadPricingConfig, pricingFor } from "./src/cost.js";
import {
  CreateCompletion, buildTasks, currentRunMeta, kDefaultModel, openAiCompletion, readResultRows, runTasks
} from "./src/execute.js";
import { getTextVariant, textVariantIds } from "./src/represent-text.js";
import { formatSummaryTable, summarizeResults, summaryPathFor, writeSummary } from "./src/report.js";
import {
  CorpusSource, corpusSources, kSchemaVersion, sha256Canonical, validateExperimentFile
} from "./src/schemas.js";

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
}

const promptsDir = path.join(harnessRoot, "prompts");

// ---------------------------------------------------------------------------
// argv
// ---------------------------------------------------------------------------

export interface ParsedArgs {
  command: string;
  flags: Record<string, string | true>;
}

const kBooleanFlags = new Set(["prune", "no-cache", "refresh-cache"]);

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
 * Names the corpus as well as the experiment, so running the same experiment against two corpora does
 * not append both into one file. Routed through the same containment check as `--output`: the corpus
 * name and experiment name are both validated, but the check is cheap and this is the path that
 * writes student work.
 */
function defaultOutputFile(dataRoot: string, corpus: string, experimentName: string): string {
  // Absolute, so it resolves identically whatever the relative base is.
  return resolveDataPath(path.join(dataRoot, "results", `${corpus}-${experimentName}.jsonl`),
    "--output", dataRoot);
}

/**
 * Resolves a results path and refuses anything outside the data root.
 *
 * Relative paths resolve against the harness directory, the same base as `--from` and `--experiment`
 * and the same way the README writes them (`data/results/…`). Containment is then checked against the
 * data root separately: result rows carry student work and never leave `data/`.
 */
export function resolveDataPath(
  value: string, flag: string, dataRoot: string, base: string = harnessRoot
): string {
  const resolved = path.resolve(base, value);
  const relative = path.relative(dataRoot, resolved);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
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
  for (const run of experiment.runs) {
    const runTasksForRun = tasks.filter((task) => task.runId === run.id);
    const runTotal = runTasksForRun.reduce((sum, task) => sum + task.worstCaseUsd, 0);
    total += runTotal;
    log(`  ${run.id}: ${runTasksForRun.length} call(s), worst case $${runTotal.toFixed(4)}`);
  }
  log(`Worst-case total (retries included): $${total.toFixed(4)}. No network access was used.`);
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
  if (!cacheOptions.read) {
    const alreadyComplete = readResultRows(outputFile)
      .filter((row) => row.status !== "error" && row.requestKey !== null &&
        row.corpus === corpus && row.experimentSha256 === experimentSha256);
    if (alreadyComplete.length > 0) {
      const flag = flags["no-cache"] === true ? "--no-cache" : "--refresh-cache";
      throw new Error(`${flag} asks for fresh API calls, but ${outputFile} already holds ` +
        `${alreadyComplete.length} completed row(s) for this corpus and experiment, which resume would ` +
        "skip before the cache is consulted. Pass a fresh --output (or delete that file) to re-execute.");
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
    log
  });

  log(`Wrote ${summary.written} row(s) to ${outputFile} ` +
    `(${summary.resumed} already complete, ${summary.cacheHits} from cache, ${summary.apiCalls} API call(s)).`);
  log(`Reserved at peak $${summary.reservedPeakUsd.toFixed(4)} of the $${maxCost.toFixed(4)} ceiling; ` +
    `actually spent $${summary.incurredUsd.toFixed(4)}.`);
  if (summary.stoppedOnCeiling) log("Stopped early: the spend ceiling was reached.");
}

function commandReport(flags: Record<string, string | true>, deps: HarnessDeps): void {
  const log = deps.log ?? console.log;
  // Reports are derived from student work, so both the file read and the summary written beside it
  // stay inside the data root.
  const resultsFile = resolveDataPath(required(flags, "results"), "--results", dataRootFor(deps));
  const rows = readResultRows(resultsFile);
  const summary = summarizeResults(rows, resultsFile, deps.now?.());
  const summaryFile = resolveDataPath(summaryPathFor(resultsFile), "--results", dataRootFor(deps));
  log(formatSummaryTable(summary));
  log(`\nWrote ${writeSummary(summary, summaryFile)}`);
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
