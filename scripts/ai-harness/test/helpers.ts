import fs from "node:fs";
import path from "node:path";
import { harnessRoot } from "../src/corpus.js";
import type { RunTask } from "../src/execute.js";
import type { HarnessRequest } from "../src/messages.js";
import { requestKeyFor } from "../src/messages.js";
import type { ModelPricing, RunMeta } from "../src/schemas.js";

/** The repository root — two levels up from scripts/ai-harness. */
export const repoRoot = path.resolve(harnessRoot, "..", "..");

/**
 * Scratch space for tests. It lives inside `data/` because nothing the harness generates is ever
 * written outside that (gitignored) tree.
 */
export function makeTestDataRoot(name: string): string {
  const directory = path.join(harnessRoot, "data", "test-runs", name);
  fs.rmSync(directory, { recursive: true, force: true });
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

export const testPricing: ModelPricing = {
  inputPerMTokUsd: 0.15,
  outputPerMTokUsd: 0.6,
  maxOutputTokens: 1024
};

export const testRunMeta: RunMeta = {
  date: "2026-08-11T00:00:00.000Z",
  openaiSdkVersion: "6.45.0",
  gitCommit: "0000000000000000000000000000000000000000",
  gitDirty: false
};

export function makeRequest(text: string, maxCompletionTokens = 1024): HarnessRequest {
  return {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a teaching assistant." },
      { role: "user", content: [{ type: "text", text }] }
    ],
    responseFormat: {
      type: "json_schema",
      json_schema: { name: "categorization-response", strict: true, schema: { type: "object" } }
    },
    generationSettings: { max_completion_tokens: maxCompletionTokens }
  };
}

export function makeTask(docId: string, runId: string, text: string, worstCase = 0.01): RunTask {
  const request = makeRequest(text);
  return {
    docId,
    runId,
    run: { id: runId, message: "text-only", textVariant: "default", prompt: "categorize-design-default" },
    modality: "text-only",
    promptName: "categorize-design-default",
    promptSha256: "prompt-hash",
    aiPrompt: { systemPrompt: "You are a teaching assistant.", mainPrompt: "Evaluate this.", discussionPrompt: "?" },
    request,
    requestKey: requestKeyFor(request),
    worstCaseUsd: worstCase
  };
}

export function readLines(file: string): unknown[] {
  return fs.readFileSync(file, "utf8").split("\n").filter((line) => line.length > 0).map((line) => JSON.parse(line));
}
