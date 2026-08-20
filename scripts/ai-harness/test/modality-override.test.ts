import { formatSummaryTable, summarizeResults } from "../src/report.js";
import { ResultRow } from "../src/schemas.js";
import { testRunMeta } from "./helpers.js";

/**
 * A report groups by the override when there is one, and shows both values. Carrying only
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
    const means = column(table(), "in mean");
    const shapes = column(table(), "message");
    // The loop below is vacuous on an empty column, so the guard is on the array it iterates.
    expect(shapes.length).toBeGreaterThan(0);
    // Every "all" row is a mixture here, and every named-shape row is not.
    for (const [index, shape] of shapes.entries()) {
      expect({ shape, mean: means[index] === "-" }).toEqual({ shape, mean: shape === "all" });
    }
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

describe("a report reads a mixed run the way it reads the two it sits between", () => {
  const mixedRow = (docId: string, textPartOmitted?: true): ResultRow => ({
    ...base,
    docId,
    runId: "mixed",
    message: "mixed",
    modality: "mixed",
    computedModality: "mixed",
    representation: {
      kind: "mixed",
      text: { variantId: "default", variantVersion: 1, sourceContentSha256: "0".repeat(64) },
      image: {
        modeId: "puppeteer-full-height",
        backendId: "puppeteer",
        backendVersion: 2,
        renderTarget: {
          clueUrl: "http://localhost:8080", unit: "harness-render", clueRevision: "r",
          shutterbugUrl: null, viewportWidthPx: 960, captureMode: "full-document", captureHeightPx: null
        },
        sourceContentSha256: "0".repeat(64),
        imageSha256s: ["a".repeat(64)],
        imageSet: "full-document"
      }
    },
    promptImageTokensEstimated: 14_399,
    usage: { promptTokens: 15_000, completionTokens: 30, source: "api" },
    requestKey: `key-mixed-${docId}`,
    ...(textPartOmitted ? { textPartOmitted } : {})
  });

  const skippedRow = (docId: string): ResultRow => {
    const { representation, promptImageTokensEstimated, ...rest } = base as never as Record<string, unknown>;
    return {
      ...rest,
      docId,
      runId: "mixed",
      message: "mixed",
      modality: "empty",
      computedModality: "empty",
      status: "skipped",
      requestKey: null,
      skipReasons: ["mixed run: the document has no student content at all"],
      decidedFromContentSha256: "0".repeat(64)
    } as unknown as ResultRow;
  };

  const printed = () => formatSummaryTable(summarizeResults(
    [mixedRow("a"), mixedRow("b", true), skippedRow("c")],
    "results.jsonl", new Date("2026-08-17T00:00:00.000Z")));

  it("gives a mixed run its own group rather than folding it into either baseline", () => {
    const summary = summarizeResults(
      [mixedRow("a"), row("d", "text-only", "text-only")],
      "results.jsonl", new Date("2026-08-17T00:00:00.000Z"));
    const shapes = new Set(summary.groups.map((group) => group.message));
    expect(shapes).toEqual(new Set(["mixed", "text-only", "all"]));
  });

  it("counts the image tokens of a mixed row, the way it does for an image row", () => {
    const table = printed();
    const mixedIndex = column(table, "message").indexOf("mixed");
    expect(column(table, "img tok est")[mixedIndex]).toBe(String(14_399 * 2));
  });

  it("averages a mixed group, because one shape is one population", () => {
    // `mixed` is a shape, not a mixture of shapes: the means are comparable and are shown.
    const table = printed();
    const mixedIndex = column(table, "message").indexOf("mixed");
    expect(column(table, "in mean")[mixedIndex]).toBe("15000");
  });

  it("counts the rows that went without their text half, and blanks the count where none did", () => {
    const table = printed();
    const messages = column(table, "message");
    const noText = column(table, "no text");
    expect(noText[messages.indexOf("mixed")]).toBe("1");
    // A group where it never happened reads "-", not 0, so it cannot be mistaken for a measurement.
    const summary = summarizeResults(
      [row("d", "text-only", "text-only")], "results.jsonl", new Date("2026-08-17T00:00:00.000Z"));
    expect(column(formatSummaryTable(summary), "no text").every((cell) => cell === "-")).toBe(true);
  });

  it("counts a skipped mixed row as skipped, and not as a document that answered", () => {
    // Read off the run's all-modality row: a skipped document is classified `empty`, so it lands in
    // a different per-modality group from the ones that answered.
    const summary = summarizeResults(
      [mixedRow("a"), mixedRow("b", true), skippedRow("c")],
      "results.jsonl", new Date("2026-08-17T00:00:00.000Z"));
    const run = summary.groups.find((group) =>
      group.runId === "mixed" && group.message === "mixed" && group.modality === "all")!;
    expect(run.statuses).toMatchObject({ success: 2, skipped: 1, error: 0, refusal: 0 });
    // Every document is represented, sent or not: that is what makes a skip readable as a decision.
    expect(run.docs).toBe(3);
    expect(run.textPartOmitted).toBe(1);
  });
});
