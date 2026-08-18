import { formatSummaryTable, summarizeResults } from "../src/report.js";
import { ResultRow } from "../src/schemas.js";
import { testRunMeta } from "./helpers.js";

/**
 * Implementation doc 1 asks reports to use the override when present *and show both*. Carrying only
 * the effective modality meant a hand-set `modalityOverride` silently regrouped a document with
 * nothing to say a human rather than the classifier had put it there — a judgement call presented as
 * a measurement.
 */
const base = {
  schemaVersion: 2 as const,
  experiment: "e",
  experimentSha256: "hash",
  runId: "text-default",
  corpus: "c",
  message: "text-only" as const,
  representation: {
    kind: "text" as const, variantId: "default", variantVersion: 1, sourceContentSha256: "0".repeat(64)
  },
  prompt: { name: "p", sha256: "s" },
  runMeta: testRunMeta,
  status: "success" as const,
  response: { parsed: { category: "form" }, raw: {} },
  usage: { promptTokens: 100, completionTokens: 10, source: "api" as const },
  cost: { modeledUsd: 0.001, incurredThisRunUsd: 0.001 },
  responseOriginMeta: { date: "2026-08-17T00:00:00.000Z", modelReturned: "gpt-4o-mini", systemFingerprint: null }
};

const row = (docId: string, modality: ResultRow["modality"], computedModality: ResultRow["modality"]): ResultRow =>
  ({ ...base, docId, modality, computedModality, requestKey: `key-${docId}` });

/** Reads the `overridden` cell out of every data row of the printed table. */
function overriddenColumn(table: string): string[] {
  const lines = table.split("\n").filter((line) => line.trim().length > 0 && !/^-+[\s-]*$/.test(line));
  const columnIndex = lines[0].split(/\s{2,}/).indexOf("overridden");
  expect(columnIndex).toBeGreaterThan(-1);
  return lines.slice(1).map((line) => line.split(/\s{2,}/)[columnIndex]);
}

describe("a human's modality override is visible in the report", () => {
  it("groups by the override but records what the classifier said", () => {
    // The classifier called this one visual-only; a human overrode it to mixed.
    const rows = [row("a", "text-only", "text-only"), row("b", "mixed", "visual-only")];
    const summary = summarizeResults(rows, "results.jsonl", new Date("2026-08-17T00:00:00.000Z"));

    const overall = summary.groups.find((group) => group.runId === "(all runs)" && group.modality === "all")!;
    expect(overall.docs).toBe(2);
    expect(overall.overriddenModality).toBe(1);

    // Grouping still follows the override, which is what makes recording the computed value matter.
    expect(summary.groups.find((group) => group.modality === "mixed")!.docs).toBe(1);
    expect(summary.groups.some((group) => group.modality === "visual-only")).toBe(false);
  });

  it("shows nothing where no override is in play", () => {
    const rows = [row("a", "text-only", "text-only"), row("b", "visual-only", "visual-only")];
    const summary = summarizeResults(rows, "results.jsonl", new Date("2026-08-17T00:00:00.000Z"));
    for (const group of summary.groups) expect(group.overriddenModality).toBe(0);
    // "-" rather than "0", so an untouched corpus does not read as "checked and found clean".
    expect(overriddenColumn(formatSummaryTable(summary))).toEqual(["-", "-", "-", "-", "-"]);
  });

  it("puts the count in the printed table", () => {
    const summary = summarizeResults(
      [row("a", "mixed", "visual-only")], "results.jsonl", new Date("2026-08-17T00:00:00.000Z"));
    // Every group here holds the one overridden document, so every cell reads 1 rather than "-".
    expect(overriddenColumn(formatSummaryTable(summary))).toEqual(["1", "1", "1", "1"]);
  });

  it("counts a document once however many runs it appears in", () => {
    // The count sits beside `docs`, which is also per document, so the two read together.
    const rows: ResultRow[] = [
      row("b", "mixed", "visual-only"),
      { ...base, docId: "b", modality: "mixed", computedModality: "visual-only",
        runId: "text-minimal", requestKey: "key-b2" }
    ];
    const summary = summarizeResults(rows, "results.jsonl", new Date("2026-08-17T00:00:00.000Z"));
    const overall = summary.groups.find((group) => group.runId === "(all runs)" && group.modality === "all")!;
    expect(overall.docs).toBe(1);
    expect(overall.overriddenModality).toBe(1);
  });
});
