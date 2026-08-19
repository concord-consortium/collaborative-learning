import {
  assertSingleCorpusAndExperiment, formatSummaryTable, historicalIsComparable, partitionSuperseded,
  summarizeResults
} from "../src/report.js";
import { ManifestDocument, ResultRow } from "../src/schemas.js";
import { testRunMeta } from "./helpers.js";

const base = {
  schemaVersion: 2 as const,
  experiment: "text-baselines",
  experimentSha256: "hash",
  runId: "text-default",
  corpus: "synthetic-corpus",
  computedModality: "text-only" as const,
  message: "text-only" as const,
  representation: {
    kind: "text" as const, variantId: "default", variantVersion: 1,
    sourceContentSha256: "0".repeat(64)
  },
  prompt: { name: "categorize-design-default", sha256: "p" },
  runMeta: testRunMeta
};
const origin = { date: "2026-08-11T00:00:00.000Z", modelReturned: "gpt-4o-mini", systemFingerprint: null };

/** `base` without the fields only a row that sent a request carries. */
const { representation: _representation, ...skippedBase } = base;

const rows: ResultRow[] = [
  { ...base, docId: "text", modality: "text-only", requestKey: "k1", status: "success",
    response: { parsed: { category: "form" }, raw: {} },
    usage: { promptTokens: 100, completionTokens: 10, source: "api" },
    cost: { modeledUsd: 0.001, incurredThisRunUsd: 0.001 }, responseOriginMeta: origin },
  { ...base, docId: "table", modality: "text-only", requestKey: "k2", status: "success",
    response: { parsed: { category: "function" }, raw: {} },
    usage: { promptTokens: 300, completionTokens: 20, source: "cache" },
    cost: { modeledUsd: 0.002, incurredThisRunUsd: 0 }, responseOriginMeta: origin },
  { ...base, docId: "drawing", modality: "visual-only", requestKey: "k3", status: "refusal",
    refusal: "Not enough content.",
    usage: { promptTokens: 50, completionTokens: 5, source: "api" },
    cost: { modeledUsd: 0.0005, incurredThisRunUsd: 0.0005 }, responseOriginMeta: origin },
  { ...base, docId: "image", modality: "visual-only", requestKey: "k4", status: "error",
    error: { type: "APIError", message: "boom", attempts: 3 } },
  // A skipped row carries no representation — nothing was represented — and records the content it
  // was decided from, so a rerun can tell whether the decision still applies.
  { ...skippedBase, docId: "empty", modality: "empty", requestKey: null,
    status: "skipped", skipReasons: ["text-only run: no tile carries student-authored text"],
    decidedFromContentSha256: "0".repeat(64) }
];

describe("summarizeResults", () => {
  const summary = summarizeResults(rows, "results.jsonl", new Date("2026-08-11T00:00:00.000Z"));
  const overall = summary.groups.find((group) => group.runId === "(all runs)")!;

  it("counts every status", () => {
    expect(overall.statuses).toEqual({ success: 2, refusal: 1, error: 1, skipped: 1 });
  });

  it("counts cache hits separately from API calls", () => {
    expect(overall.cacheHits).toBe(1);
  });

  it("splits modeled from incurred cost", () => {
    expect(overall.cost.modeledUsd).toBeCloseTo(0.0035, 10);
    expect(overall.cost.incurredUsd).toBeCloseTo(0.0015, 10);
  });

  it("reports token totals, means and medians", () => {
    expect(overall.tokens.promptTotal).toBe(450);
    expect(overall.tokens.completionTotal).toBe(35);
    expect(overall.tokens.total).toBe(485);
    expect(overall.tokens.promptMean).toBeCloseTo(150, 10);
    expect(overall.tokens.promptMedian).toBe(100);
  });

  it("reports the category distribution from parsed successes", () => {
    expect(overall.categories).toEqual({ form: 1, function: 1 });
  });

  it("groups per run configuration and modality", () => {
    const textOnly = summary.groups.find(
      (group) => group.runId === "text-default" && group.modality === "text-only")!;
    expect(textOnly.docs).toBe(2);
    expect(textOnly.statuses.success).toBe(2);
    const visualOnly = summary.groups.find(
      (group) => group.runId === "text-default" && group.modality === "visual-only")!;
    expect(visualOnly.statuses).toEqual({ success: 0, refusal: 1, error: 1, skipped: 0 });
  });

  it("renders a table with a header for every column", () => {
    const table = formatSummaryTable(summary);
    expect(table.split("\n")[0]).toContain("modality");
    expect(table).toContain("(all runs)");
    expect(table.split("\n")).toHaveLength(summary.groups.length + 2);
  });
});

describe("historical analyses are never paired with a fresh run on trust", () => {
  const document = {
    id: "prod-1", contentSha256: "aaa", historical: null
  } as unknown as ManifestDocument;

  it("refuses when there is no historical record", () => {
    expect(historicalIsComparable(document)).toBe(false);
  });

  it("refuses when the historical record does not say what content it ran against", () => {
    expect(historicalIsComparable({
      ...document,
      historical: { summarizer: "default", promptTokens: 1, completionTokens: 1, response: {}, analyzedAt: "x" }
    })).toBe(false);
  });

  it("refuses when the document has changed since", () => {
    expect(historicalIsComparable({
      ...document,
      historical: { summarizer: "default", promptTokens: 1, completionTokens: 1, response: {}, analyzedAt: "x",
        contentSha256: "bbb" }
    })).toBe(false);
  });

  it("allows it only when the content hash proves the input is identical", () => {
    expect(historicalIsComparable({
      ...document,
      historical: { summarizer: "default", promptTokens: 1, completionTokens: 1, response: {}, analyzedAt: "x",
        contentSha256: "aaa" }
    })).toBe(true);
  });
});

describe("a results file must describe one corpus and one experiment", () => {
  it("accepts rows that agree", () => {
    expect(() => assertSingleCorpusAndExperiment(rows, "results.jsonl")).not.toThrow();
  });

  it("refuses rows from two corpora", () => {
    const mixed = [...rows, { ...rows[0], corpus: "other-corpus" }] as ResultRow[];
    expect(() => assertSingleCorpusAndExperiment(mixed, "results.jsonl"))
      .toThrow(/mixes 2 corpora \(other-corpus, synthetic-corpus\)/);
  });

  it("refuses rows from two experiment definitions", () => {
    const mixed = [...rows, { ...rows[0], experimentSha256: "edited" }] as ResultRow[];
    expect(() => assertSingleCorpusAndExperiment(mixed, "results.jsonl"))
      .toThrow(/mixes 2 experiment definitions/);
  });

  it("is enforced by summarizeResults itself", () => {
    const mixed = [...rows, { ...rows[0], corpus: "other-corpus" }] as ResultRow[];
    expect(() => summarizeResults(mixed, "results.jsonl")).toThrow(/mixes 2 corpora/);
  });
});

describe("a billed error row counts toward the totals", () => {
  const billed: ResultRow = {
    ...base, docId: "unparsed-doc", modality: "text-only", requestKey: "k9", status: "error",
    error: { type: "unparsed", message: "no parsed response (finish_reason: length)", attempts: 1 },
    usage: { promptTokens: 700, completionTokens: 1024, source: "api" },
    cost: { modeledUsd: 0.0007, incurredThisRunUsd: 0.0007 }, responseOriginMeta: origin
  };
  const summary = summarizeResults([...rows, billed], "results.jsonl");
  const overall = summary.groups.find((group) => group.runId === "(all runs)")!;

  it("still counts as an error, not a success", () => {
    expect(overall.statuses).toEqual({ success: 2, refusal: 1, error: 2, skipped: 1 });
  });

  it("adds its money to the totals, so spend is not understated", () => {
    expect(overall.cost.incurredUsd).toBeCloseTo(0.0015 + 0.0007, 10);
    expect(overall.cost.modeledUsd).toBeCloseTo(0.0035 + 0.0007, 10);
  });

  it("adds its tokens to the totals", () => {
    expect(overall.tokens.promptTotal).toBe(450 + 700);
    expect(overall.tokens.completionTotal).toBe(35 + 1024);
  });

  it("leaves an unbilled error row out of the totals", () => {
    const unbilled = summarizeResults(rows, "results.jsonl").groups.find((g) => g.runId === "(all runs)")!;
    expect(unbilled.cost.incurredUsd).toBeCloseTo(0.0015, 10);
    expect(unbilled.statuses.error).toBe(1);
  });
});

describe("a re-run supersedes the row it replaces", () => {
  const success = (docId: string, requestKey: string, category: string, tokens: number): ResultRow => ({
    ...base, docId, modality: "text-only", requestKey, status: "success",
    response: { parsed: { category }, raw: {} },
    usage: { promptTokens: tokens, completionTokens: 10, source: "api" },
    cost: { modeledUsd: 0.001, incurredThisRunUsd: 0.001 }, responseOriginMeta: origin
  });

  it("keeps the later row and sets the earlier one aside", () => {
    const { current, superseded } = partitionSuperseded([
      success("text", "old", "form", 1000), success("text", "new", "function", 1000)
    ]);
    expect(current.map((row) => row.requestKey)).toEqual(["new"]);
    expect(superseded.map((row) => row.requestKey)).toEqual(["old"]);
  });

  it("counts a re-run document once, not twice", () => {
    // Editing a prompt and re-running into the same output file used to double every total and split
    // the category distribution between the old answer and the new one.
    const summary = summarizeResults(
      [success("text", "old", "form", 1000), success("text", "new", "function", 1000)], "r.jsonl");
    const overall = summary.groups.find((group) => group.runId === "(all runs)")!;

    expect(overall.docs).toBe(1);
    expect(overall.statuses.success).toBe(1);
    expect(overall.categories).toEqual({ function: 1 });
    expect(overall.tokens.promptTotal).toBe(1000);
    expect(overall.cost.incurredUsd).toBeCloseTo(0.001, 10);
  });

  it("reports the superseded spend rather than losing it", () => {
    const summary = summarizeResults(
      [success("text", "old", "form", 1000), success("text", "new", "function", 1000)], "r.jsonl");
    expect(summary.rows).toBe(2);
    expect(summary.currentRows).toBe(1);
    expect(summary.superseded).toEqual({ rows: 1, incurredUsd: 0.001 });
    expect(formatSummaryTable(summary)).toContain("1 superseded row(s) excluded");
  });

  it("treats an error followed by a successful retry as one success", () => {
    const failed: ResultRow = {
      ...base, docId: "text", modality: "text-only", requestKey: "k", status: "error",
      error: { type: "APIError", message: "boom", attempts: 3 }
    };
    const summary = summarizeResults([failed, success("text", "k", "form", 500)], "r.jsonl");
    const overall = summary.groups.find((group) => group.runId === "(all runs)")!;
    expect(overall.statuses).toEqual({ success: 1, refusal: 0, error: 0, skipped: 0 });
    expect(summary.superseded.rows).toBe(1);
  });

  it("leaves a file with no re-runs completely unchanged", () => {
    const summary = summarizeResults(rows, "results.jsonl");
    expect(summary.superseded).toEqual({ rows: 0, incurredUsd: 0 });
    expect(summary.currentRows).toBe(rows.length);
    expect(formatSummaryTable(summary)).not.toContain("superseded");
  });

  it("keeps distinct documents and runs separate", () => {
    const summary = summarizeResults([
      success("text", "a", "form", 100), success("table", "b", "user", 100)
    ], "r.jsonl");
    const overall = summary.groups.find((group) => group.runId === "(all runs)")!;
    expect(overall.docs).toBe(2);
    expect(overall.statuses.success).toBe(2);
    expect(summary.superseded.rows).toBe(0);
  });
});
