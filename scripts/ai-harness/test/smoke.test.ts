import fs from "node:fs";
import path from "node:path";
import { main } from "../harness.js";
import { buildSummaryMessages, defaultAiPrompt } from "../../../shared/ai-analysis-messages.js";
import { corpusPaths, readRepresentation, representationPath } from "../src/corpus.js";
import { CompletionRequest, CompletionResult } from "../src/execute.js";
import { ReportSummary } from "../src/report.js";
import { ResultRow } from "../src/schemas.js";
import { makeTestDataRoot, readLines, syntheticCorpusShape } from "./helpers.js";

/**
 * import -> represent -> plan -> run -> report, driven through the same argv parsing the CLI uses,
 * with the OpenAI backend replaced by a mock. No network, no API key.
 */
/** Derived from the committed fixtures, so adding one moves the counts instead of breaking them. */
const shape = syntheticCorpusShape();

describe("end-to-end smoke run against the synthetic corpus", () => {
  const dataRoot = makeTestDataRoot("smoke");
  const output: string[] = [];
  const requests: { model: string; messages: unknown; maxCompletionTokens: number }[] = [];
  let refusalsRemaining = 1;

  const createCompletion = async ({ request }: CompletionRequest): Promise<CompletionResult> => {
    requests.push({
      model: request.apiRequest.model,
      messages: request.apiRequest.messages,
      maxCompletionTokens: request.apiRequest.generationSettings.max_completion_tokens
    });
    // One refusal so the report exercises more than the success path. Triggered on the first
    // request rather than on a particular document's text: the one that would carry it is empty, and
    // skip-empty means no run sends an empty document at all.
    if (refusalsRemaining > 0) {
      refusalsRemaining -= 1;
      return {
        parsed: null,
        refusal: "There is not enough here to categorize.",
        raw: { id: `chatcmpl-${requests.length}` },
        usage: { promptTokens: 300, completionTokens: 12 },
        originMeta: { date: "2026-08-11T00:00:00.000Z", modelReturned: "gpt-4o-mini", systemFingerprint: "fp_test" }
      };
    }
    return {
      parsed: { category: "form", keyIndicators: ["a sketch of the latch"], discussion: "Mostly about form." },
      raw: { id: `chatcmpl-${requests.length}` },
      refusal: null,
      usage: { promptTokens: 900, completionTokens: 60 },
      originMeta: { date: "2026-08-11T00:00:00.000Z", modelReturned: "gpt-4o-mini", systemFingerprint: "fp_test" }
    };
  };

  const deps = {
    dataRoot,
    createCompletion,
    log: (message: string) => output.push(message),
    now: () => new Date("2026-08-11T00:00:00.000Z")
  };

  // The default output path names the corpus as well as the experiment, so the same experiment run
  // against two corpora cannot append into one file.
  const resultsFile = path.join(dataRoot, "results", "smoke-corpus__text-baselines.jsonl");
  const paths = corpusPaths(dataRoot, "smoke-corpus");

  it("imports the committed example corpus", async () => {
    await main(["import", "--from", "examples/synthetic-corpus", "--corpus", "smoke-corpus"], deps);
    const manifest = JSON.parse(fs.readFileSync(paths.manifest, "utf8"));
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.documents.length).toBe(shape.documents.length);
    expect(output.join("\n")).toContain(`Imported ${shape.documents.length} document(s)`);
  });

  it("writes representation envelopes for both text variants", async () => {
    await main(["represent", "--corpus", "smoke-corpus", "--variants", "default,minimal"], deps);
    const envelope = readRepresentation(representationPath(paths, "default", "text"));
    expect(envelope.variantId).toBe("default");
    expect(envelope.variantVersion).toBe(2);
    expect(envelope.markdown).toContain("text-fixture-marker");
    expect(readRepresentation(representationPath(paths, "minimal", "text")).markdown).toContain("text-fixture-marker");
  });

  it("reuses fresh representations instead of regenerating them", async () => {
    output.length = 0;
    await main(["represent", "--corpus", "smoke-corpus", "--variants", "default,minimal"], deps);
    // Two variants per document, all of them already fresh.
    expect(output.join("\n"))
      .toContain(`Wrote 0 representation(s), reused ${shape.documents.length * 2}`);
  });

  it("plans the run without touching the network", async () => {
    output.length = 0;
    await main(["plan", "--corpus", "smoke-corpus", "--experiment", "experiments/text-baselines.json"], deps);
    const printed = output.join("\n");
    // Not runs × documents: a text-only run sends only the documents that carry student-authored
    // text, and says so about the rest rather than leaving them out of the results.
    // The product is of runs and documents, and the two figures after it add back up to it — which
    // `= N call(s)` did not, on any corpus with a skip.
    expect(printed).toContain(
      `2 run(s) × ${shape.documents.length} document(s) = ${shape.documents.length * 2} pair(s); ` +
      `${shape.withStudentText.length * 2} call(s), ` +
      `${(shape.documents.length - shape.withStudentText.length) * 2} skipped.`);
    expect(printed).toContain("max_completion_tokens 1024");
    expect(printed).toMatch(/Worst-case total \(retries included\): \$\d+\.\d+/);
    expect(requests).toHaveLength(0);
  });

  it("writes one row per pair, sent or skipped, and never leaves a document out", async () => {
    output.length = 0;
    await main(["run", "--corpus", "smoke-corpus", "--experiment", "experiments/text-baselines.json",
      "--max-cost", "1.00"], deps);
    const rows = readLines(resultsFile) as ResultRow[];
    // Every (run, document) pair appears exactly once, whether or not it was sent: a document that
    // simply did not appear would be indistinguishable from a bug.
    const pairs = shape.documents.length * 2;
    expect(rows).toHaveLength(pairs);
    expect(new Set(rows.map((row) => `${row.docId} ${row.runId}`)).size).toBe(pairs);

    const sent = rows.filter((row) => row.status !== "skipped");
    const skipped = rows.filter((row) => row.status === "skipped");
    expect(sent).toHaveLength(shape.withStudentText.length * 2);
    expect(skipped).toHaveLength((shape.documents.length - shape.withStudentText.length) * 2);
    // Every skip says why, in terms a reader can act on.
    for (const row of skipped) {
      expect(row.status === "skipped" && row.skipReasons.join(" "))
        .toMatch(/no student content at all|no tile carries student-authored text/);
    }
    expect(new Set(sent.map((row) => row.docId))).toEqual(new Set(shape.withStudentText));

    const distinctRequests = new Set(sent.map((row) => row.requestKey));
    expect(requests.length).toBeGreaterThanOrEqual(distinctRequests.size);
    expect(requests.length).toBeLessThanOrEqual(sent.length);
    expect(output.join("\n")).toMatch(/from cache, \d+ API call\(s\)/);
  });

  it("skips the empty documents for every shape, and says so once per run", async () => {
    // Acceptance: an empty document is skipped by every message shape, and a visual-only one by a
    // text-only run. Both classes are present in the committed corpus.
    const rows = readLines(resultsFile) as ResultRow[];
    for (const docId of shape.empty) {
      const forDoc = rows.filter((row) => row.docId === docId);
      expect(forDoc).toHaveLength(2);
      for (const row of forDoc) expect(row.status).toBe("skipped");
    }
    const visualOnly = shape.withContent.filter((docId) => !shape.withStudentText.includes(docId));
    expect(visualOnly.length).toBeGreaterThan(0);
    for (const docId of visualOnly) {
      expect(rows.filter((row) => row.docId === docId).every((row) => row.status === "skipped")).toBe(true);
    }
  });

  it("builds its messages with the shared production builders", () => {
    const envelope = readRepresentation(representationPath(paths, "default", "text"));
    const expected = buildSummaryMessages(defaultAiPrompt, envelope.markdown, []);
    const sent = requests.find((request) => JSON.stringify(request.messages) === JSON.stringify(expected));
    expect(sent).toBeDefined();
    expect(sent!.model).toBe("gpt-4o-mini");
  });

  it("caps every request's completion length", () => {
    expect(requests.every((request) => request.maxCompletionTokens === 1024)).toBe(true);
  });

  it("resumes rather than re-running when invoked again", async () => {
    output.length = 0;
    const before = requests.length;
    await main(["run", "--corpus", "smoke-corpus", "--experiment", "experiments/text-baselines.json",
      "--max-cost", "1.00"], deps);
    expect(requests).toHaveLength(before);
    // Every pair the first run wrote is resumed, sent and skipped alike.
    expect(output.join("\n")).toContain(`${shape.documents.length * 2} already complete`);
  });

  it("refuses --refresh-cache and --no-cache when resume would silently skip everything", async () => {
    // Resume filtering runs before the cache is consulted, so on a file that already holds completed
    // rows both flags would otherwise be no-ops — the opposite of what the user asked for.
    for (const flag of ["--refresh-cache", "--no-cache"]) {
      await expect(main(["run", "--corpus", "smoke-corpus", "--experiment",
        "experiments/text-baselines.json", "--max-cost", "1.00", flag], deps))
        .rejects.toThrow(new RegExp(`\\${flag} asks for fresh API calls`));
    }
    // Rows whose request keys differ from this run's must not block it: resume would not have
    // skipped them, so refusing was the guard being too broad. Matching on corpus and experiment
    // hash alone got this wrong — editing a prompt file changes every request key but not the
    // experiment hash. Simulated by rewriting the keys in a copy of the results, which keeps the
    // test inside its own data root rather than mutating a committed prompt other suites read.
    const stale = path.join(dataRoot, "results", "stale-keys.jsonl");
    fs.writeFileSync(stale, fs.readFileSync(resultsFile, "utf8")
      .split("\n").filter((line) => line.length > 0)
      .map((line) => {
        const row = JSON.parse(line);
        // A skipped row has no request key to make stale, and must not be given one.
        return JSON.stringify(row.status === "skipped"
          ? row
          : { ...row, requestKey: `stale-${row.docId}` });
      })
      .join("\n") + "\n");
    const beforeStale = requests.length;
    await main(["run", "--corpus", "smoke-corpus", "--experiment", "experiments/text-baselines.json",
      "--max-cost", "1.00", "--refresh-cache", "--output", stale], deps);
    expect(requests.length).toBeGreaterThan(beforeStale);

    // A fresh --output is the way through, and it really does re-execute.
    const before = requests.length;
    await main(["run", "--corpus", "smoke-corpus", "--experiment", "experiments/text-baselines.json",
      "--max-cost", "1.00", "--refresh-cache", "--output",
      path.join(dataRoot, "results", "refreshed.jsonl")], deps);
    expect(requests.length).toBeGreaterThan(before);
  });

  it.each([["represent", ["--variants", "default"]], ["plan", ["--experiment", "experiments/text-baselines.json"]],
    ["run", ["--experiment", "experiments/text-baselines.json", "--max-cost", "1.00"]]])(
    "%s refuses a corpus name that escapes the data root", async (command, rest) => {
      await expect(main([command, "--corpus", "../../escaped", ...rest], deps))
        .rejects.toThrow(/--corpus must match/);
    });

  it("reports modality breakdowns, statuses and costs", async () => {
    output.length = 0;
    await main(["report", "--results", resultsFile], deps);
    const table = output[0];
    expect(table).toContain("text-default");
    expect(table).toContain("text-minimal");
    for (const modality of ["text-only", "visual-only", "mixed", "empty"]) expect(table).toContain(modality);
    expect(table).toContain("(all runs)");

    const summary = JSON.parse(
      fs.readFileSync(path.join(dataRoot, "results", "smoke-corpus__text-baselines.summary.json"), "utf8"),
    ) as ReportSummary;
    expect(fs.existsSync(resultsFile)).toBe(true);
    const pairs = shape.documents.length * 2;
    const sentPairs = shape.withStudentText.length * 2;
    expect(summary.rows).toBe(pairs);
    const overall = summary.groups.find((group) =>
      group.runId === "(all runs)" && group.message === "all" && group.modality === "all")!;
    expect(overall.docs).toBe(shape.documents.length);
    // Skipped rows are counted, not dropped: the three statuses account for every pair.
    expect(overall.statuses.success + overall.statuses.refusal).toBe(sentPairs);
    expect(overall.statuses.skipped).toBe(pairs - sentPairs);
    expect(overall.statuses.refusal).toBe(1);
    expect(overall.statuses.error).toBe(0);
    expect(overall.categories.form).toBe(sentPairs - 1);
    expect(overall.cost.incurredUsd).toBeGreaterThan(0);
    expect(overall.tokens.total).toBeGreaterThan(0);

    const modalities = new Set(summary.groups.map((group) => group.modality));
    expect(modalities).toEqual(new Set(["all", "text-only", "visual-only", "mixed", "empty"]));
  });

  it("refuses to report on a results file that is not there", async () => {
    // Silently reporting zero rows turned a mistyped path into an all-zeros table and an empty
    // summary.json written over the previous one.
    await expect(main(["report", "--results", path.join(dataRoot, "results", "typo.jsonl")], deps))
      .rejects.toThrow(/No results file at .*typo\.jsonl/);
  });

  it("refuses to report on an empty results file", async () => {
    const empty = path.join(dataRoot, "results", "empty.jsonl");
    fs.writeFileSync(empty, "");
    await expect(main(["report", "--results", empty], deps))
      .rejects.toThrow(/contains no result rows/);
  });

  it("keeps everything it generated inside the harness data directory", () => {
    const relative = path.relative(path.join(dataRoot, "..", ".."), dataRoot);
    expect(relative.startsWith("..")).toBe(false);
    expect(fs.existsSync(path.join(dataRoot, "cache"))).toBe(true);
  });
});
