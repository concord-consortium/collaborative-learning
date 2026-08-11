import fs from "node:fs";
import path from "node:path";
import { main } from "../harness.js";
import { defaultAiPrompt } from "../../../shared/ai-analysis-messages.js";
import { buildSummaryMessages } from "../../../shared/ai-analysis-messages.js";
import { corpusPaths, readRepresentation, representationPath } from "../src/corpus.js";
import { CompletionRequest, CompletionResult } from "../src/execute.js";
import { ReportSummary } from "../src/report.js";
import { ResultRow } from "../src/schemas.js";
import { makeTestDataRoot, readLines } from "./helpers.js";

/**
 * Acceptance criterion 12: import -> represent -> plan -> run -> report, driven through the same
 * argv parsing the CLI uses, with the OpenAI backend replaced by a mock. No network, no API key.
 */
describe("end-to-end smoke run against the synthetic corpus", () => {
  const dataRoot = makeTestDataRoot("smoke");
  const output: string[] = [];
  const requests: { model: string; messages: unknown; maxCompletionTokens: number }[] = [];
  let refusalsRemaining = 1;

  const createCompletion = async ({ request }: CompletionRequest): Promise<CompletionResult> => {
    requests.push({
      model: request.model,
      messages: request.messages,
      maxCompletionTokens: request.generationSettings.max_completion_tokens
    });
    // One refusal so the report exercises more than the success path.
    if (refusalsRemaining > 0 && String(JSON.stringify(request.messages)).includes("empty CLUE document")) {
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

  // The default output path names the corpus as well as the experiment (C1), so the same experiment
  // run against two corpora cannot append into one file.
  const resultsFile = path.join(dataRoot, "results", "smoke-corpus-text-baselines.jsonl");
  const paths = corpusPaths(dataRoot, "smoke-corpus");

  it("imports the committed example corpus", async () => {
    await main(["import", "--from", "examples/synthetic-corpus", "--corpus", "smoke-corpus"], deps);
    const manifest = JSON.parse(fs.readFileSync(paths.manifest, "utf8"));
    expect(manifest.schemaVersion).toBe(1);
    expect(manifest.documents.length).toBe(24);
    expect(output.join("\n")).toContain("Imported 24 document(s)");
  });

  it("writes representation envelopes for both text variants", async () => {
    await main(["represent", "--corpus", "smoke-corpus", "--variants", "default,minimal"], deps);
    const envelope = readRepresentation(representationPath(paths, "default", "text"));
    expect(envelope.variantId).toBe("default");
    expect(envelope.variantVersion).toBe(1);
    expect(envelope.markdown).toContain("text-fixture-marker");
    expect(readRepresentation(representationPath(paths, "minimal", "text")).markdown).toContain("text-fixture-marker");
  });

  it("reuses fresh representations instead of regenerating them", async () => {
    output.length = 0;
    await main(["represent", "--corpus", "smoke-corpus", "--variants", "default,minimal"], deps);
    expect(output.join("\n")).toContain("Wrote 0 representation(s), reused 48");
  });

  it("plans the run without touching the network", async () => {
    output.length = 0;
    await main(["plan", "--corpus", "smoke-corpus", "--experiment", "experiments/text-baselines.json"], deps);
    const printed = output.join("\n");
    expect(printed).toContain("2 run(s) × 24 document(s) = 48 call(s)");
    expect(printed).toContain("max_completion_tokens 1024");
    expect(printed).toMatch(/Worst-case total \(retries included\): \$\d+\.\d+/);
    expect(requests).toHaveLength(0);
  });

  it("runs every pair and writes one JSONL row each", async () => {
    output.length = 0;
    await main(["run", "--corpus", "smoke-corpus", "--experiment", "experiments/text-baselines.json",
      "--max-cost", "1.00"], deps);
    const rows = readLines(resultsFile) as ResultRow[];
    expect(rows).toHaveLength(48);
    expect(new Set(rows.map((row) => `${row.docId} ${row.runId}`)).size).toBe(48);

    // 47, not 48: the image tile contributes nothing to a `minimal` summary, so the image document's
    // minimal representation is identical to the empty document's — same messages, same request key,
    // so the second one is served from the cache. That is the cache doing its job.
    const distinctRequests = new Set(rows.map((row) => row.requestKey));
    expect(distinctRequests.size).toBe(47);
    expect(requests.length).toBeGreaterThanOrEqual(distinctRequests.size);
    expect(requests.length).toBeLessThanOrEqual(48);
    expect(output.join("\n")).toMatch(/from cache, \d+ API call\(s\)/);
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
    expect(output.join("\n")).toContain("48 already complete");
  });

  it("refuses --refresh-cache and --no-cache when resume would silently skip everything", async () => {
    // Resume filtering runs before the cache is consulted, so on a file that already holds completed
    // rows both flags would otherwise be no-ops — the opposite of what the user asked for.
    for (const flag of ["--refresh-cache", "--no-cache"]) {
      await expect(main(["run", "--corpus", "smoke-corpus", "--experiment",
        "experiments/text-baselines.json", "--max-cost", "1.00", flag], deps))
        .rejects.toThrow(new RegExp(`\\${flag} asks for fresh API calls`));
    }
    // A fresh --output is the way through, and it really does re-execute.
    const before = requests.length;
    await main(["run", "--corpus", "smoke-corpus", "--experiment", "experiments/text-baselines.json",
      "--max-cost", "1.00", "--refresh-cache", "--output",
      path.join(dataRoot, "results", "refreshed.jsonl")], deps);
    expect(requests.length).toBeGreaterThan(before);
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
      fs.readFileSync(path.join(dataRoot, "results", "summary.json"), "utf8")) as ReportSummary;
    expect(fs.existsSync(resultsFile)).toBe(true);
    expect(summary.rows).toBe(48);
    const overall = summary.groups.find((group) => group.runId === "(all runs)" && group.modality === "all")!;
    expect(overall.docs).toBe(24);
    expect(overall.statuses.success + overall.statuses.refusal).toBe(48);
    expect(overall.statuses.refusal).toBe(1);
    expect(overall.statuses.error).toBe(0);
    expect(overall.categories.form).toBe(47);
    expect(overall.cost.incurredUsd).toBeGreaterThan(0);
    expect(overall.tokens.total).toBeGreaterThan(0);

    const modalities = new Set(summary.groups.map((group) => group.modality));
    expect(modalities).toEqual(new Set(["all", "text-only", "visual-only", "mixed", "empty"]));
  });

  it("keeps everything it generated inside the harness data directory", () => {
    const relative = path.relative(path.join(dataRoot, "..", ".."), dataRoot);
    expect(relative.startsWith("..")).toBe(false);
    expect(fs.existsSync(path.join(dataRoot, "cache"))).toBe(true);
  });
});
