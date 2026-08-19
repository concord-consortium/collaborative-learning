/**
 * Reports as data: a stdout table plus a summary.json next to the results file.
 *
 * Every result status is handled explicitly — a new status would fail to compile rather than being
 * silently dropped from the counts.
 */
import path from "node:path";
import { ManifestDocument, MessageShape, Modality, ResultRow, kSchemaVersion } from "./schemas.js";
import { writeJsonFile } from "./corpus.js";

/**
 * Key for the cross-run aggregate. It is a sentinel rather than the display label because an
 * experiment could legitimately define a run whose id is the label, and that run's rows would then be
 * merged into the aggregate.
 */
export const kAllRunsKey = Symbol.for("clue-harness.all-runs");
export const kAllRunsLabel = "(all runs)";

export interface GroupSummary {
  runId: string;
  /**
   * Which message shape this group covers, or "all". Reported alongside the run because an image-only
   * run and a text-only run measure different things: summing them into one total would produce a
   * number that answers no question anyone asked.
   */
  message: MessageShape | "all";
  /** "all" aggregates every modality for that run. */
  modality: Modality | "all";
  docs: number;
  /**
   * How many of this group's rows were grouped under a human's `modalityOverride` rather than the
   * classifier's answer. A non-zero count means part of this row is a judgement call, and the reader
   * should know which part before comparing groups.
   */
  overriddenModality: number;
  /**
   * How many of this group's documents sent a mixed message with its text half dropped, because the
   * document carried no student-authored text. Those rows are half the input a mixed row usually
   * has, so a reader comparing mixed against text-only needs the count before drawing a conclusion.
   */
  textPartOmitted: number;
  cacheHits: number;
  statuses: { success: number; refusal: number; error: number; skipped: number };
  tokens: {
    promptTotal: number;
    completionTotal: number;
    total: number;
    promptMean: number;
    promptMedian: number;
    completionMean: number;
    completionMedian: number;
    /**
     * The harness's pre-flight image-token estimate, summed over the rows that sent a picture. Zero
     * for a text group. `promptTotal` is what the API actually billed and stays authoritative; this
     * says how much of it was the image.
     */
    imageEstimatedTotal: number;
  };
  cost: { modeledUsd: number; incurredUsd: number };
  categories: Record<string, number>;
}

export interface SupersededSummary {
  /** Rows in the file that a later re-run replaced. */
  rows: number;
  /** What those rows cost. Real money, so it is reported rather than dropped. */
  incurredUsd: number;
}

export interface ReportSummary {
  schemaVersion: number;
  results: string;
  generatedAt: string;
  /** Every row in the file, superseded ones included. */
  rows: number;
  /** Rows the groups below are computed from: the latest outcome per (document, run). */
  currentRows: number;
  superseded: SupersededSummary;
  groups: GroupSummary[];
}

/**
 * Splits a results file into the outcomes that still stand and the ones a later run replaced.
 *
 * Resume deliberately appends rather than rewrites: a changed document, prompt, representation or
 * generation setting produces a new request key, so it re-runs and lands beside the old row. Summing
 * both would double-count tokens and cost and split the category distribution between a superseded
 * answer and the current one — so aggregation uses the last row per (document, run), which is the
 * most recent because the writer only ever appends. An error row followed by a successful retry is
 * the same case: the success is the outcome, the error is history.
 */
export function partitionSuperseded(rows: ResultRow[]): { current: ResultRow[]; superseded: ResultRow[] } {
  const lastIndexForPair = new Map<string, number>();
  rows.forEach((row, index) => lastIndexForPair.set(`${row.docId} ${row.runId}`, index));
  const current: ResultRow[] = [];
  const superseded: ResultRow[] = [];
  rows.forEach((row, index) => {
    if (lastIndexForPair.get(`${row.docId} ${row.runId}`) === index) current.push(row);
    else superseded.push(row);
  });
  return { current, superseded };
}

function incurredUsdOf(rows: ResultRow[]): number {
  return rows.reduce((total, row) => total + (("cost" in row && row.cost) ? row.cost.incurredThisRunUsd : 0), 0);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

interface Accumulator {
  runId: string | typeof kAllRunsKey;
  message: MessageShape | "all";
  modality: Modality | "all";
  docs: Set<string>;
  overriddenModality: Set<string>;
  cacheHits: number;
  statuses: GroupSummary["statuses"];
  promptTokens: number[];
  completionTokens: number[];
  imageEstimatedTotal: number;
  textPartOmitted: Set<string>;
  modeledUsd: number;
  incurredUsd: number;
  categories: Record<string, number>;
}

function newAccumulator(
  runId: string | typeof kAllRunsKey, message: MessageShape | "all", modality: Modality | "all"
): Accumulator {
  return {
    runId,
    message,
    modality,
    docs: new Set(),
    overriddenModality: new Set(),
    cacheHits: 0,
    statuses: { success: 0, refusal: 0, error: 0, skipped: 0 },
    textPartOmitted: new Set(),
    promptTokens: [],
    completionTokens: [],
    imageEstimatedTotal: 0,
    modeledUsd: 0,
    incurredUsd: 0,
    categories: {}
  };
}

function accumulate(accumulator: Accumulator, row: ResultRow): void {
  accumulator.docs.add(row.docId);
  // Counted by document rather than by row, so it lines up with the `docs` column beside it.
  if (row.modality !== row.computedModality) accumulator.overriddenModality.add(row.docId);
  // Counted for every status that built a request, errors included: what a picture would have cost
  // is a fact about the request, not about whether the model answered. A skipped row built none.
  if (row.status !== "skipped") {
    accumulator.imageEstimatedTotal += row.promptImageTokensEstimated ?? 0;
    if (row.textPartOmitted) accumulator.textPartOmitted.add(row.docId);
  }
  switch (row.status) {
    case "success": {
      accumulator.statuses.success += 1;
      if (row.usage.source === "cache") accumulator.cacheHits += 1;
      accumulator.promptTokens.push(row.usage.promptTokens);
      accumulator.completionTokens.push(row.usage.completionTokens);
      accumulator.modeledUsd += row.cost.modeledUsd;
      accumulator.incurredUsd += row.cost.incurredThisRunUsd;
      const category = (row.response.parsed as any)?.category;
      const label = typeof category === "string" ? category : "(none)";
      accumulator.categories[label] = (accumulator.categories[label] ?? 0) + 1;
      break;
    }
    case "refusal": {
      accumulator.statuses.refusal += 1;
      if (row.usage.source === "cache") accumulator.cacheHits += 1;
      accumulator.promptTokens.push(row.usage.promptTokens);
      accumulator.completionTokens.push(row.usage.completionTokens);
      accumulator.modeledUsd += row.cost.modeledUsd;
      accumulator.incurredUsd += row.cost.incurredThisRunUsd;
      break;
    }
    case "error": {
      accumulator.statuses.error += 1;
      // An error row that carries usage was answered and billed (the "unparsed" case). Its money and
      // tokens belong in the totals even though it is not a usable result; leaving them out would
      // understate spend by exactly those responses. It stays counted as an error, not a success.
      if (row.usage && row.cost) {
        if (row.usage.source === "cache") accumulator.cacheHits += 1;
        accumulator.promptTokens.push(row.usage.promptTokens);
        accumulator.completionTokens.push(row.usage.completionTokens);
        accumulator.modeledUsd += row.cost.modeledUsd;
        accumulator.incurredUsd += row.cost.incurredThisRunUsd;
      }
      break;
    }
    case "skipped": {
      accumulator.statuses.skipped += 1;
      break;
    }
    default: {
      const unhandled: never = row;
      throw new Error(`Unhandled result status: ${JSON.stringify(unhandled)}`);
    }
  }
}

function finish(accumulator: Accumulator): GroupSummary {
  const promptTotal = accumulator.promptTokens.reduce((total, value) => total + value, 0);
  const completionTotal = accumulator.completionTokens.reduce((total, value) => total + value, 0);
  return {
    runId: accumulator.runId === kAllRunsKey ? kAllRunsLabel : accumulator.runId,
    message: accumulator.message,
    modality: accumulator.modality,
    docs: accumulator.docs.size,
    overriddenModality: accumulator.overriddenModality.size,
    textPartOmitted: accumulator.textPartOmitted.size,
    cacheHits: accumulator.cacheHits,
    statuses: accumulator.statuses,
    tokens: {
      promptTotal,
      completionTotal,
      total: promptTotal + completionTotal,
      promptMean: mean(accumulator.promptTokens),
      promptMedian: median(accumulator.promptTokens),
      completionMean: mean(accumulator.completionTokens),
      completionMedian: median(accumulator.completionTokens),
      imageEstimatedTotal: accumulator.imageEstimatedTotal
    },
    cost: { modeledUsd: accumulator.modeledUsd, incurredUsd: accumulator.incurredUsd },
    categories: accumulator.categories
  };
}

/**
 * A results file is expected to describe one corpus and one experiment definition. Summing across two
 * would produce a table that looks fine and means nothing — different documents, or the same
 * documents under a silently edited experiment.
 */
export function assertSingleCorpusAndExperiment(rows: ResultRow[], resultsFile: string): void {
  const corpora = new Set(rows.map((row) => row.corpus));
  if (corpora.size > 1) {
    throw new Error(`${resultsFile}: mixes ${corpora.size} corpora (${[...corpora].sort().join(", ")}). ` +
      "Report one corpus at a time — use a separate --output per corpus.");
  }
  const hashes = new Set(rows.map((row) => row.experimentSha256));
  if (hashes.size > 1) {
    const names = [...new Set(rows.map((row) => row.experiment))].sort().join(", ");
    throw new Error(`${resultsFile}: mixes ${hashes.size} experiment definitions (name(s): ${names}). ` +
      "The experiment file changed between runs, so these rows are not comparable. Re-run into a " +
      "fresh --output.");
  }
}

export function summarizeResults(rows: ResultRow[], resultsFile: string, now: Date = new Date()): ReportSummary {
  assertSingleCorpusAndExperiment(rows, resultsFile);
  const { current, superseded } = partitionSuperseded(rows);
  // The keyed map holds per-run rows and the per-shape cross-run rows; those are keyed by the
  // `kAllRunsKey` *symbol*, not by its display label, so an experiment that happens to define a run
  // called "(all runs)" cannot merge into one of them. The whole-file `overall` row is kept outside
  // the map entirely, because nothing else should ever be able to accumulate into it.
  const groups = new Map<string, Accumulator>();
  const overall = newAccumulator(kAllRunsKey, "all", "all");
  const get = (
    runId: string | typeof kAllRunsKey, message: MessageShape | "all", modality: Modality | "all"
  ) => {
    const key = `${String(runId)} ${message} ${modality}`;
    let accumulator = groups.get(key);
    if (!accumulator) {
      accumulator = newAccumulator(runId, message, modality);
      groups.set(key, accumulator);
    }
    return accumulator;
  };

  for (const row of current) {
    accumulate(get(row.runId, row.message, row.modality), row);
    accumulate(get(row.runId, row.message, "all"), row);
    // The per-shape aggregate across runs: this is what puts image-only and text-only totals side by
    // side instead of merging them into a single meaningless sum.
    accumulate(get(kAllRunsKey, row.message, "all"), row);
    accumulate(overall, row);
  }

  return {
    schemaVersion: kSchemaVersion,
    results: resultsFile,
    generatedAt: now.toISOString(),
    rows: rows.length,
    currentRows: current.length,
    superseded: { rows: superseded.length, incurredUsd: incurredUsdOf(superseded) },
    // Per-run rows first, then the cross-run aggregates, then the whole-file row. Insertion order
    // interleaved them, so a reader scanning the table met an "(all runs)" row partway down and had
    // to work out which rows it was summing.
    groups: [
      ...[...groups.values()].filter((group) => group.runId !== kAllRunsKey),
      ...[...groups.values()].filter((group) => group.runId === kAllRunsKey),
      overall
    ].map(finish)
  };
}

const kColumns: { header: string; value: (group: GroupSummary) => string }[] = [
  { header: "run", value: (group) => group.runId },
  { header: "message", value: (group) => group.message },
  { header: "modality", value: (group) => group.modality },
  { header: "docs", value: (group) => String(group.docs) },
  // "-" rather than 0 so an untouched corpus does not look like it was checked and found clean.
  { header: "overridden", value: (group) =>
    group.overriddenModality === 0 ? "-" : String(group.overriddenModality) },
  { header: "ok", value: (group) => String(group.statuses.success) },
  { header: "refused", value: (group) => String(group.statuses.refusal) },
  { header: "errors", value: (group) => String(group.statuses.error) },
  { header: "skipped", value: (group) => String(group.statuses.skipped) },
  // Mixed rows that went without their text half, because the document carried no student-authored
  // text. "-" rather than 0, so a group where it never happened does not read like a measurement.
  { header: "no text", value: (group) =>
    group.textPartOmitted === 0 ? "-" : String(group.textPartOmitted) },
  { header: "cached", value: (group) => String(group.cacheHits) },
  { header: "tok in", value: (group) => String(group.tokens.promptTotal) },
  // What the harness estimated the pictures cost, beside what the API actually billed for the whole
  // prompt. "-" rather than 0 where no image was sent, so the two cases cannot be confused.
  { header: "img tok est", value: (group) =>
    group.tokens.imageEstimatedTotal === 0 ? "-" : String(group.tokens.imageEstimatedTotal) },
  { header: "tok out", value: (group) => String(group.tokens.completionTotal) },
  // Averages are blank on a row that spans more than one message shape. A mean prompt size across
  // image-only and text-only rows is arithmetic over two incomparable populations — a ~14,000-token
  // screenshot and a ~400-token summary — and reads as a fact about neither. Sums stay: "what did
  // this file cost" is a real question.
  { header: "in mean", value: (group) => spansMessageShapes(group) ? "-" : group.tokens.promptMean.toFixed(0) },
  { header: "in med", value: (group) => spansMessageShapes(group) ? "-" : group.tokens.promptMedian.toFixed(0) },
  { header: "out mean", value: (group) =>
    spansMessageShapes(group) ? "-" : group.tokens.completionMean.toFixed(0) },
  { header: "out med", value: (group) =>
    spansMessageShapes(group) ? "-" : group.tokens.completionMedian.toFixed(0) },
  { header: "modeled $", value: (group) => group.cost.modeledUsd.toFixed(4) },
  { header: "incurred $", value: (group) => group.cost.incurredUsd.toFixed(4) },
  { header: "categories", value: (group) => formatCategories(group.categories) }
];

/**
 * True when a row aggregates more than one message shape, making per-row averages meaningless.
 *
 * Not to be confused with the `mixed` message shape, which is one shape and averages fine.
 */
function spansMessageShapes(group: GroupSummary): boolean {
  return group.message === "all";
}

function formatCategories(categories: Record<string, number>): string {
  const entries = Object.entries(categories).sort(([a], [b]) => a.localeCompare(b));
  return entries.length === 0 ? "-" : entries.map(([name, count]) => `${name}:${count}`).join(" ");
}

export function formatSummaryTable(summary: ReportSummary): string {
  const rows = [kColumns.map((column) => column.header)];
  for (const group of summary.groups) rows.push(kColumns.map((column) => column.value(group)));
  const widths = kColumns.map((_, index) => Math.max(...rows.map((row) => row[index].length)));
  const line = (row: string[]) => row.map((cell, index) => cell.padEnd(widths[index])).join("  ").trimEnd();
  const table = [line(rows[0]), widths.map((width) => "-".repeat(width)).join("  "),
    ...rows.slice(1).map(line)].join("\n");
  if (summary.superseded.rows === 0) return table;
  // Stated rather than silently dropped: the spend was real, and a reader should know the file holds
  // outcomes that a later run replaced.
  return `${table}\n\n${summary.superseded.rows} superseded row(s) excluded from the totals above ` +
    `(replaced by a later re-run); they cost $${summary.superseded.incurredUsd.toFixed(4)}.`;
}

/**
 * The summary sits beside its results file and is named after it.
 *
 * A single `summary.json` per directory was the wrong shape: the default output directory is
 * `data/results/`, so every experiment's summary landed on the same path and reporting on one
 * silently overwrote another's — the normal case, not an edge one.
 */
export function summaryPathFor(resultsFile: string): string {
  const directory = path.dirname(resultsFile);
  const base = path.basename(resultsFile, path.extname(resultsFile));
  return path.join(directory, `${base}.summary.json`);
}

export function writeSummary(summary: ReportSummary, summaryFile: string): string {
  writeJsonFile(summaryFile, summary);
  return summaryFile;
}

/**
 * A `done`-queue record describes an analysis of whatever the document looked like *then*. It may
 * only be lined up against a fresh run when the content hash proves the input is identical; a
 * historical record that does not carry the hash it ran against can never clear that bar.
 */
export function historicalIsComparable(document: ManifestDocument): boolean {
  const historical = document.historical;
  if (!historical) return false;
  return typeof historical.contentSha256 === "string" && historical.contentSha256 === document.contentSha256;
}
