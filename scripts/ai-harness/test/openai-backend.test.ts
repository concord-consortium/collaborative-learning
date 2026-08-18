import path from "node:path";
// Under the ESM runner the `jest` object is not a global; it has to be imported.
import { jest } from "@jest/globals";
import { APIConnectionError, APIConnectionTimeoutError, APIError } from "openai";
import { ResponseCache } from "../src/cache.js";
import { CostLedger } from "../src/cost.js";
import { CreateCompletion, isTransientError, openAiCompletion, runTasks } from "../src/execute.js";
import { defaultAiPrompt } from "../../../shared/ai-analysis-messages.js";
import { ResultRow } from "../src/schemas.js";
import { makeTask, makeTestDataRoot, readLines, testPricing, testRunMeta } from "./helpers.js";

/**
 * The two bugs carried over from the milestone-1 review, both of which turned on how
 * `openai@6.45.0` actually behaves rather than on how it reads.
 */

describe("network failures are retried", () => {
  it("treats an SDK connection error as transient", () => {
    // The SDK wraps every network-level failure — DNS, socket reset, and this file's own timeout —
    // in these classes. They report name "Error", status undefined and code undefined, so the
    // status and code checks below them cannot see them. Since the harness sets maxRetries: 0
    // precisely so it owns retries, missing these meant a connection blip got one attempt.
    expect(isTransientError(new APIConnectionTimeoutError({}))).toBe(true);
    expect(isTransientError(new APIConnectionError({ cause: new Error("socket hang up") }))).toBe(true);
  });

  it("still sees a raw Node error code, and one buried on the cause", () => {
    expect(isTransientError({ code: "ECONNRESET" })).toBe(true);
    expect(isTransientError({ cause: { code: "ETIMEDOUT" } })).toBe(true);
    expect(isTransientError({ code: "ENOENT" })).toBe(false);
    expect(isTransientError({ cause: { code: "ENOENT" } })).toBe(false);
  });

  it("keeps retrying the statuses it always did, and nothing else", () => {
    for (const status of [408, 409, 429, 500, 503]) expect(isTransientError({ status })).toBe(true);
    for (const status of [400, 401, 404, 422]) expect(isTransientError({ status })).toBe(false);
  });

  it("does not retry a plain error", () => {
    expect(isTransientError(new Error("nope"))).toBe(false);
    expect(isTransientError(new APIError(400, undefined, "bad request", undefined))).toBe(false);
  });

  it("actually re-dispatches a connection failure, up to the reserved number of attempts", async () => {
    const dataRoot = makeTestDataRoot("transient-retry");
    let attempts = 0;
    const createCompletion: CreateCompletion = async () => {
      attempts += 1;
      if (attempts < 3) throw new APIConnectionTimeoutError({});
      return {
        parsed: { category: "form" },
        refusal: null,
        raw: {},
        usage: { promptTokens: 10, completionTokens: 5 },
        originMeta: { date: "2026-08-17T00:00:00.000Z", modelReturned: "gpt-4o-mini", systemFingerprint: null }
      };
    };
    const summary = await runTasks({
      corpus: "c",
      experiment: { schemaVersion: 1, name: "e", runs: [] } as any,
      experimentSha256: "hash",
      tasks: [makeTask("doc", "text-default", "hello")],
      outputFile: path.join(dataRoot, "results.jsonl"),
      ledger: new CostLedger(1),
      cache: new ResponseCache(path.join(dataRoot, "cache")),
      pricing: testPricing,
      runMeta: testRunMeta,
      createCompletion,
      sleep: async () => undefined
    });
    // Three dispatches, one successful row — the two retries the spec asks for.
    expect(attempts).toBe(3);
    expect(summary.apiCalls).toBe(3);
    const rows = readLines(path.join(dataRoot, "results.jsonl")) as ResultRow[];
    expect(rows.map((row) => row.status)).toEqual(["success"]);
  });
});

describe("a truncated completion keeps what it cost", () => {
  it("does not throw on finish_reason length, and reports the usage", async () => {
    // `client.chat.completions.parse()` throws LengthFinishReasonError from inside its parse step,
    // *before* returning, whenever a choice's finish_reason is `length`. Because every request sets
    // max_completion_tokens, that is the likeliest unusable response there is — and the throw used
    // to land in the retry loop's catch, producing a row with no usage, no cost and no finish
    // reason. The response was billed; the row said nothing about it.
    const OpenAI = (await import("openai")).default;
    const truncated = {
      choices: [{ finish_reason: "length", message: { content: '{"category":"fo', refusal: null } }],
      usage: { prompt_tokens: 900, completion_tokens: 1024 },
      model: "gpt-4o-mini",
      system_fingerprint: "fp_test"
    };
    const create = jest.spyOn(OpenAI.Chat.Completions.prototype, "create")
      .mockResolvedValue(truncated as never);
    try {
      const result = await openAiCompletion("test-key")({
        request: {
          apiRequest: {
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: "hi" }],
            responseFormat: { type: "json_schema", json_schema: { name: "n", schema: {} } },
            generationSettings: { max_completion_tokens: 1024 }
          },
          inputAccounting: { images: [] }
        },
        aiPrompt: defaultAiPrompt
      });
      expect(result.parsed).toBeNull();
      expect(result.refusal).toBeNull();
      expect(result.finish_reason).toBe("length");
      // The point of the fix: the billing information survives.
      expect(result.usage).toEqual({ promptTokens: 900, completionTokens: 1024 });
      expect(result.originMeta.systemFingerprint).toBe("fp_test");
      // And the request it sent carried no accounting data.
      expect(JSON.stringify(create.mock.calls[0][0])).not.toContain("inputAccounting");
    } finally {
      create.mockRestore();
    }
  });

  it("turns that into an unparsed error row that carries usage and cost", async () => {
    const dataRoot = makeTestDataRoot("truncated-row");
    const OpenAI = (await import("openai")).default;
    const create = jest.spyOn(OpenAI.Chat.Completions.prototype, "create").mockResolvedValue({
      choices: [{ finish_reason: "length", message: { content: '{"cat', refusal: null } }],
      usage: { prompt_tokens: 900, completion_tokens: 1024 },
      model: "gpt-4o-mini",
      system_fingerprint: "fp_test"
    } as never);
    try {
      await runTasks({
        corpus: "c",
        experiment: { schemaVersion: 1, name: "e", runs: [] } as any,
        experimentSha256: "hash",
        tasks: [makeTask("doc", "text-default", "hello")],
        outputFile: path.join(dataRoot, "results.jsonl"),
        ledger: new CostLedger(1),
        cache: new ResponseCache(path.join(dataRoot, "cache")),
        pricing: testPricing,
        runMeta: testRunMeta,
        // The real wrapper, not a hand-written stub: the bug lived in the wrapper.
        createCompletion: openAiCompletion("test-key"),
        sleep: async () => undefined
      });
      const rows = readLines(path.join(dataRoot, "results.jsonl")) as ResultRow[];
      expect(rows).toHaveLength(1);
      const row = rows[0];
      expect(row.status).toBe("error");
      if (row.status !== "error") throw new Error("expected an error row");
      expect(row.error.type).toBe("unparsed");
      expect(row.error.message).toContain("finish_reason: length");
      // Not a bare error: the API answered and billed for it.
      expect(row.usage).toEqual({ promptTokens: 900, completionTokens: 1024, source: "api" });
      expect(row.cost!.incurredThisRunUsd).toBeGreaterThan(0);
      expect(row.responseOriginMeta!.systemFingerprint).toBe("fp_test");
    } finally {
      create.mockRestore();
    }
  });

  it("parses a normal completion exactly as before", async () => {
    const OpenAI = (await import("openai")).default;
    const create = jest.spyOn(OpenAI.Chat.Completions.prototype, "create").mockResolvedValue({
      choices: [{
        finish_reason: "stop",
        message: { content: '{"category":"form","keyIndicators":["x"],"discussion":"d"}', refusal: null }
      }],
      usage: { prompt_tokens: 900, completion_tokens: 40 },
      model: "gpt-4o-mini",
      system_fingerprint: "fp_test"
    } as never);
    try {
      const result = await openAiCompletion("test-key")({
        request: {
          apiRequest: {
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: "hi" }],
            responseFormat: { type: "json_schema", json_schema: { name: "n", schema: {} } },
            generationSettings: { max_completion_tokens: 1024 }
          },
          inputAccounting: { images: [] }
        },
        aiPrompt: defaultAiPrompt
      });
      // Routing through create() rather than parse() must not change a successful outcome.
      expect(result.parsed).toEqual({ category: "form", keyIndicators: ["x"], discussion: "d" });
      expect(result.finish_reason).toBe("stop");
      expect(result.usage.completionTokens).toBe(40);
    } finally {
      create.mockRestore();
    }
  });

  it("passes a refusal through without trying to parse it", async () => {
    const OpenAI = (await import("openai")).default;
    const create = jest.spyOn(OpenAI.Chat.Completions.prototype, "create").mockResolvedValue({
      choices: [{ finish_reason: "stop", message: { content: null, refusal: "I cannot help with that." } }],
      usage: { prompt_tokens: 300, completion_tokens: 12 },
      model: "gpt-4o-mini",
      system_fingerprint: null
    } as never);
    try {
      const result = await openAiCompletion("test-key")({
        request: {
          apiRequest: {
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: "hi" }],
            responseFormat: { type: "json_schema", json_schema: { name: "n", schema: {} } },
            generationSettings: { max_completion_tokens: 1024 }
          },
          inputAccounting: { images: [] }
        },
        aiPrompt: defaultAiPrompt
      });
      expect(result.parsed).toBeNull();
      expect(result.refusal).toBe("I cannot help with that.");
    } finally {
      create.mockRestore();
    }
  });
});
