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

/** Reads one named cell out of every data row of the printed table. */
function column(table: string, header: string): string[] {
  const lines = table.split("\n").filter((line) => line.trim().length > 0 && !/^-+[\s-]*$/.test(line));
  const columnIndex = lines[0].split(/\s{2,}/).indexOf(header);
  expect({ header, columnIndex: columnIndex > -1 }).toEqual({ header, columnIndex: true });
  return lines.slice(1).map((line) => line.split(/\s{2,}/)[columnIndex]);
}

const overriddenColumn = (table: string) => column(table, "overridden");

describe("a human's modality override is visible in the report", () => {
  it("groups by the override but records what the classifier said", () => {
    // The classifier called this one visual-only; a human overrode it to mixed.
    const rows = [row("a", "text-only", "text-only"), row("b", "mixed", "visual-only")];
    const summary = summarizeResults(rows, "results.jsonl", new Date("2026-08-17T00:00:00.000Z"));

    const overall = summary.groups.find((group) =>
      group.runId === "(all runs)" && group.message === "all" && group.modality === "all")!;
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
    const overall = summary.groups.find((group) =>
      group.runId === "(all runs)" && group.message === "all" && group.modality === "all")!;
    expect(overall.docs).toBe(1);
    expect(overall.overriddenModality).toBe(1);
  });
});

describe("averages are blank on a row that spans more than one message shape", () => {
  // A mean prompt size across image-only and text-only rows is arithmetic over two incomparable
  // populations — a ~14,000-token screenshot beside a ~400-token summary — and reads as a fact about
  // neither. Sums and cost stay, because "what did this file cost" is a real question.
  const imageRow = (docId: string, promptTokens: number): ResultRow => ({
    ...base,
    docId,
    runId: "image-puppeteer",
    message: "image-only",
    modality: "visual-only",
    computedModality: "visual-only",
    representation: {
      kind: "image",
      modeId: "puppeteer-full-height",
      backendId: "puppeteer",
      backendVersion: 2,
      renderTarget: {
        clueUrl: "http://localhost:8080", unit: "harness-render", clueRevision: "r",
        shutterbugUrl: null, viewportWidthPx: 960, captureMode: "full-document", captureHeightPx: null
      },
      sourceContentSha256: "0".repeat(64),
      imageSha256s: ["a".repeat(64)]
    },
    promptImageTokensEstimated: 36_835,
    usage: { promptTokens, completionTokens: 20, source: "api" },
    requestKey: `key-image-${docId}`
  });

  const table = () => formatSummaryTable(summarizeResults(
    [row("a", "text-only", "text-only"), imageRow("a", 37_000)],
    "results.jsonl", new Date("2026-08-17T00:00:00.000Z")));

  it("blanks the means on the row that mixes them, and only that row", () => {
    const rows = table().split("\n").filter((line) => /text-only|image-only|all/.test(line));
    const means = column(table(), "in mean");
    const shapes = column(table(), "message");
    // Every "all" row is a mixture here, and every named-shape row is not.
    for (const [index, shape] of shapes.entries()) {
      expect({ shape, mean: means[index] === "-" }).toEqual({ shape, mean: shape === "all" });
    }
    expect(rows.length).toBeGreaterThan(0);
  });

  it("keeps the sums and the cost, which stay comparable", () => {
    const printed = table();
    // The per-shape cross-run row still carries real numbers, so the blanking is about mixing
    // shapes rather than about aggregating at all.
    const imageIndex = column(printed, "message").indexOf("image-only");
    expect(column(printed, "in mean")[imageIndex]).toBe("37000");
    expect(column(printed, "img tok est")[imageIndex]).toBe("36835");
    // And the mixed row still sums its tokens rather than blanking those too.
    const mixedIndex = column(printed, "message").indexOf("all");
    expect(column(printed, "tok in")[mixedIndex]).toBe("37100");
  });

  it("blanks the image-token estimate only where no picture was sent", () => {
    const printed = table();
    const textIndex = column(printed, "message").indexOf("text-only");
    expect(column(printed, "img tok est")[textIndex]).toBe("-");
  });
});
