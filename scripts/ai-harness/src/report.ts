/**
 * Reports as data: a stdout table plus a summary.json next to the results file.
 *
 * Every result status is handled explicitly — a new status would fail to compile rather than being
 * silently dropped from the counts.
 */
import path from "node:path";
import { ManifestDocument, Modality, ResultRow, kSchemaVersion } from "./schemas.js";
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
  /** "all" aggregates every modality for that run. */
  modality: Modality | "all";
  docs: number;
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
  };
  cost: { modeledUsd: number; incurredUsd: number };
  categories: Record<string, number>;
}

export interface ReportSummary {
  schemaVersion: number;
  results: string;
  generatedAt: string;
  rows: number;
  groups: GroupSummary[];
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
  modality: Modality | "all";
  docs: Set<string>;
  cacheHits: number;
  statuses: GroupSummary["statuses"];
  promptTokens: number[];
  completionTokens: number[];
  modeledUsd: number;
  incurredUsd: number;
  categories: Record<string, number>;
}

function newAccumulator(runId: string | typeof kAllRunsKey, modality: Modality | "all"): Accumulator {
  return {
    runId,
    modality,
    docs: new Set(),
    cacheHits: 0,
    statuses: { success: 0, refusal: 0, error: 0, skipped: 0 },
    promptTokens: [],
    completionTokens: [],
    modeledUsd: 0,
    incurredUsd: 0,
    categories: {}
  };
}

function accumulate(accumulator: Accumulator, row: ResultRow): void {
  accumulator.docs.add(row.docId);
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
    modality: accumulator.modality,
    docs: accumulator.docs.size,
    cacheHits: accumulator.cacheHits,
    statuses: accumulator.statuses,
    tokens: {
      promptTotal,
      completionTotal,
      total: promptTotal + completionTotal,
      promptMean: mean(accumulator.promptTokens),
      promptMedian: median(accumulator.promptTokens),
      completionMean: mean(accumulator.completionTokens),
      completionMedian: median(accumulator.completionTokens)
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
  // The cross-run aggregate is kept out of the keyed map rather than stored under its display label,
  // so an experiment that happens to define a run called "(all runs)" cannot merge into it.
  const groups = new Map<string, Accumulator>();
  const overall = newAccumulator(kAllRunsKey, "all");
  const get = (runId: string, modality: Modality | "all") => {
    const key = `${runId} ${modality}`;
    let accumulator = groups.get(key);
    if (!accumulator) {
      accumulator = newAccumulator(runId, modality);
      groups.set(key, accumulator);
    }
    return accumulator;
  };

  for (const row of rows) {
    accumulate(get(row.runId, row.modality), row);
    accumulate(get(row.runId, "all"), row);
    accumulate(overall, row);
  }

  return {
    schemaVersion: kSchemaVersion,
    results: resultsFile,
    generatedAt: now.toISOString(),
    rows: rows.length,
    groups: [...groups.values(), overall].map(finish)
  };
}

const kColumns: { header: string; value: (group: GroupSummary) => string }[] = [
  { header: "run", value: (group) => group.runId },
  { header: "modality", value: (group) => group.modality },
  { header: "docs", value: (group) => String(group.docs) },
  { header: "ok", value: (group) => String(group.statuses.success) },
  { header: "refused", value: (group) => String(group.statuses.refusal) },
  { header: "errors", value: (group) => String(group.statuses.error) },
  { header: "skipped", value: (group) => String(group.statuses.skipped) },
  { header: "cached", value: (group) => String(group.cacheHits) },
  { header: "tok in", value: (group) => String(group.tokens.promptTotal) },
  { header: "tok out", value: (group) => String(group.tokens.completionTotal) },
  { header: "in mean", value: (group) => group.tokens.promptMean.toFixed(0) },
  { header: "in med", value: (group) => group.tokens.promptMedian.toFixed(0) },
  { header: "out mean", value: (group) => group.tokens.completionMean.toFixed(0) },
  { header: "out med", value: (group) => group.tokens.completionMedian.toFixed(0) },
  { header: "modeled $", value: (group) => group.cost.modeledUsd.toFixed(4) },
  { header: "incurred $", value: (group) => group.cost.incurredUsd.toFixed(4) },
  { header: "categories", value: (group) => formatCategories(group.categories) }
];

function formatCategories(categories: Record<string, number>): string {
  const entries = Object.entries(categories).sort(([a], [b]) => a.localeCompare(b));
  return entries.length === 0 ? "-" : entries.map(([name, count]) => `${name}:${count}`).join(" ");
}

export function formatSummaryTable(summary: ReportSummary): string {
  const rows = [kColumns.map((column) => column.header)];
  for (const group of summary.groups) rows.push(kColumns.map((column) => column.value(group)));
  const widths = kColumns.map((_, index) => Math.max(...rows.map((row) => row[index].length)));
  const line = (row: string[]) => row.map((cell, index) => cell.padEnd(widths[index])).join("  ").trimEnd();
  return [line(rows[0]), widths.map((width) => "-".repeat(width)).join("  "), ...rows.slice(1).map(line)].join("\n");
}

export function summaryPathFor(resultsFile: string): string {
  return path.join(path.dirname(resultsFile), "summary.json");
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
