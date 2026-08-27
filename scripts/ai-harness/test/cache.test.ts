import fs from "node:fs";
import path from "node:path";
import { CacheEntry, ResponseCache, cacheOptionsFor, validateCacheEntry } from "../src/cache.js";
import { CostLedger } from "../src/cost.js";
import { CompletionResult, RunTask, runTasks } from "../src/execute.js";
import { SuccessResultRow, RefusalResultRow, ResultRow } from "../src/schemas.js";
import { makeTask, makeTestDataRoot, readLines, testPricing, testRunMeta } from "./helpers.js";

const experiment = { schemaVersion: 1, name: "cache-tests", runs: [] as any[] };

const originalOrigin = {
  date: "2026-01-01T00:00:00.000Z",
  modelReturned: "gpt-4o-mini-2024-07-18",
  systemFingerprint: "fp_original"
};

function completion(overrides: Partial<CompletionResult> = {}): CompletionResult {
  return {
    parsed: { category: "form", keyIndicators: ["a sketch"], discussion: "Looks like form." },
    refusal: null,
    raw: { id: "chatcmpl-1" },
    usage: { promptTokens: 120, completionTokens: 40 },
    originMeta: originalOrigin,
    ...overrides
  };
}

async function run(dataRoot: string, tasks: RunTask[], createCompletion: () => Promise<CompletionResult>,
  options: { cache?: ResponseCache; runMeta?: typeof testRunMeta; output?: string } = {}) {
  const outputFile = options.output ?? path.join(dataRoot, "results.jsonl");
  const summary = await runTasks({
    corpus: "synthetic-corpus",
    experiment: experiment as any,
    experimentSha256: "hash",
    tasks,
    outputFile,
    ledger: new CostLedger(10),
    cache: options.cache ?? new ResponseCache(path.join(dataRoot, "cache")),
    pricing: testPricing,
    runMeta: options.runMeta ?? testRunMeta,
    createCompletion
  });
  return { summary, rows: readLines(outputFile) as ResultRow[], outputFile };
}

describe("cache flags", () => {
  it("maps --no-cache and --refresh-cache onto read/write", () => {
    expect(cacheOptionsFor(false, false)).toEqual({ read: true, write: true });
    expect(cacheOptionsFor(true, false)).toEqual({ read: false, write: false });
    expect(cacheOptionsFor(false, true)).toEqual({ read: false, write: true });
    expect(() => cacheOptionsFor(true, true)).toThrow(/cannot be combined/);
  });

  it("shards entries by the first two characters of the key", () => {
    const cache = new ResponseCache("/tmp/never-written");
    expect(cache.pathFor("abcdef")).toBe(path.join("/tmp/never-written", "ab", "abcdef.json"));
  });
});

describe("a cache hit", () => {
  it("reports its source, spends nothing, and keeps the original call's provenance", async () => {
    const dataRoot = makeTestDataRoot("cache-hit");
    const tasks = [makeTask("text", "text-default", "a summary")];

    const first = await run(dataRoot, tasks, async () => completion());
    expect(first.summary.apiCalls).toBe(1);
    const firstRow = first.rows[0] as SuccessResultRow;
    expect(firstRow.usage.source).toBe("api");
    expect(firstRow.cost.incurredThisRunUsd).toBeGreaterThan(0);

    // A second run against a fresh output file, with a different runMeta, must hit the cache.
    const laterRunMeta = { ...testRunMeta, date: "2026-09-01T00:00:00.000Z", gitCommit: "beefbeef", gitDirty: true };
    const second = await run(dataRoot, tasks, async () => {
      throw new Error("the API must not be called on a cache hit");
    }, { runMeta: laterRunMeta, output: path.join(dataRoot, "second.jsonl") });

    expect(second.summary.cacheHits).toBe(1);
    expect(second.summary.apiCalls).toBe(0);
    const row = second.rows[0] as SuccessResultRow;
    expect(row.usage.source).toBe("cache");
    expect(row.usage.promptTokens).toBe(120);
    expect(row.cost.incurredThisRunUsd).toBe(0);
    expect(row.cost.modeledUsd).toBeGreaterThan(0);
    // runMeta describes *this* run...
    expect(row.runMeta).toEqual(laterRunMeta);
    // ...while responseOriginMeta still describes the call that produced the response.
    expect(row.responseOriginMeta).toEqual(originalOrigin);
  });

  it("does not read the cache under --no-cache, and writes nothing either", async () => {
    const dataRoot = makeTestDataRoot("cache-disabled");
    const tasks = [makeTask("text", "text-default", "a summary")];
    const cacheDir = path.join(dataRoot, "cache");
    let calls = 0;
    const cache = new ResponseCache(cacheDir, { read: false, write: false });

    await run(dataRoot, tasks, async () => { calls += 1; return completion(); }, { cache });
    await run(dataRoot, tasks, async () => { calls += 1; return completion(); },
      { cache, output: path.join(dataRoot, "second.jsonl") });

    expect(calls).toBe(2);
    expect(fs.existsSync(cacheDir)).toBe(false);
  });

  it("bypasses reads but refreshes writes under --refresh-cache", async () => {
    const dataRoot = makeTestDataRoot("cache-refresh");
    const tasks = [makeTask("text", "text-default", "a summary")];
    const cacheDir = path.join(dataRoot, "cache");

    await run(dataRoot, tasks, async () => completion());
    const refreshed = { ...originalOrigin, systemFingerprint: "fp_refreshed" };
    const second = await run(dataRoot, tasks, async () => completion({ originMeta: refreshed }), {
      cache: new ResponseCache(cacheDir, { read: false, write: true }),
      output: path.join(dataRoot, "second.jsonl")
    });

    expect(second.summary.apiCalls).toBe(1);
    const stored = JSON.parse(
      fs.readFileSync(new ResponseCache(cacheDir).pathFor(tasks[0].requestKey), "utf8")) as CacheEntry;
    expect(stored.responseOriginMeta.systemFingerprint).toBe("fp_refreshed");
  });
});

describe("refusals", () => {
  it("are cached, so a rerun does not spend money on the same refusal again", async () => {
    const dataRoot = makeTestDataRoot("cache-refusal");
    const tasks = [makeTask("text", "text-default", "a summary")];
    const refusal = completion({ parsed: null, refusal: "I can't help with that." });

    const first = await run(dataRoot, tasks, async () => refusal);
    expect((first.rows[0] as RefusalResultRow).status).toBe("refusal");
    expect((first.rows[0] as RefusalResultRow).refusal).toBe("I can't help with that.");
    expect((first.rows[0] as RefusalResultRow).cost.incurredThisRunUsd).toBeGreaterThan(0);

    const second = await run(dataRoot, tasks, async () => {
      throw new Error("a cached refusal must not be re-requested");
    }, { output: path.join(dataRoot, "second.jsonl") });

    const row = second.rows[0] as RefusalResultRow;
    expect(row.status).toBe("refusal");
    expect(row.usage.source).toBe("cache");
    expect(row.cost.incurredThisRunUsd).toBe(0);
    expect(second.summary.apiCalls).toBe(0);
  });
});

describe("errors", () => {
  it("are never cached, and the next run tries again", async () => {
    const dataRoot = makeTestDataRoot("cache-error");
    const tasks = [makeTask("text", "text-default", "a summary")];

    const first = await runTasks({
      corpus: "synthetic-corpus",
      experiment: experiment as any,
      experimentSha256: "hash",
      tasks,
      outputFile: path.join(dataRoot, "results.jsonl"),
      ledger: new CostLedger(10),
      cache: new ResponseCache(path.join(dataRoot, "cache")),
      pricing: testPricing,
      runMeta: testRunMeta,
      createCompletion: async () => { throw new Error("connection reset"); },
      sleep: async () => undefined
    });
    expect(first.written).toBe(1);
    const rows = readLines(path.join(dataRoot, "results.jsonl")) as ResultRow[];
    expect(rows[0].status).toBe("error");
    expect(fs.existsSync(new ResponseCache(path.join(dataRoot, "cache")).pathFor(tasks[0].requestKey))).toBe(false);

    let calls = 0;
    const second = await run(dataRoot, tasks, async () => { calls += 1; return completion(); });
    expect(calls).toBe(1);
    expect(second.summary.resumed).toBe(0);
  });

  it("treats a response with neither parsed nor refusal as an error, uncached and retryable", async () => {
    const dataRoot = makeTestDataRoot("cache-unparsed");
    const tasks = [makeTask("text", "text-default", "a summary")];

    // A hand-built `CompletionResult`, which is fine here: this test is about what the *run loop*
    // and the cache do with an unusable response, not about whether the backend can produce one.
    // That the real backend now delivers this shape rather than throwing is covered separately, in
    // test/openai-backend.test.ts, which drives `openAiCompletion` against a stubbed SDK.
    const first = await run(dataRoot, tasks,
      async () => completion({ parsed: null, refusal: null, finish_reason: "length" }));

    const row = first.rows[0];
    expect(row.status).toBe("error");
    if (row.status === "error") {
      expect(row.error.type).toBe("unparsed");
      expect(row.error.message).toContain("length");
      expect(row.error.attempts).toBe(1);
    }
    // The call still happened, so it still cost money even though the response was unusable.
    expect(first.summary.apiCalls).toBe(1);
    expect(first.summary.incurredUsd).toBeGreaterThan(0);

    // Nothing is cached, so a rerun really re-requests it rather than replaying the failure.
    expect(fs.existsSync(new ResponseCache(path.join(dataRoot, "cache")).pathFor(tasks[0].requestKey)))
      .toBe(false);

    let calls = 0;
    const second = await run(dataRoot, tasks, async () => { calls += 1; return completion(); });
    expect(calls).toBe(1);
    expect(second.summary.resumed).toBe(0);
    expect((readLines(path.join(dataRoot, "results.jsonl")) as ResultRow[]).map((r) => r.status))
      .toEqual(["error", "success"]);
  });
});

describe("a damaged cache entry is a miss, not a crash", () => {
  const good: CacheEntry = {
    schemaVersion: 1,
    key: "abc",
    status: "success",
    parsed: { category: "form" },
    raw: { id: "chatcmpl-1" },
    usage: { promptTokens: 10, completionTokens: 5 },
    responseOriginMeta: originalOrigin
  };

  it("accepts a complete entry", () => {
    expect(validateCacheEntry(good, "abc")).toEqual(good);
  });

  it.each([
    ["a mismatched key", { ...good, key: "other" }],
    ["a wrong schema version", { ...good, schemaVersion: 2 }],
    ["an unknown status", { ...good, status: "degraded" }],
    ["missing usage", { ...good, usage: undefined }],
    ["non-numeric usage", { ...good, usage: { promptTokens: "10", completionTokens: 5 } }],
    ["missing origin meta", { ...good, responseOriginMeta: undefined }],
    ["origin meta without a date", { ...good, responseOriginMeta: { modelReturned: "m" } }],
    ["a success without parsed", { ...good, parsed: undefined }],
    // The run loop calls a response with no parsed content an "unparsed" error and never caches it,
    // so an entry in that shape cannot be replayed as a success.
    ["a success whose parsed is null", { ...good, parsed: null }],
    ["a refusal without refusal text", { ...good, status: "refusal", refusal: undefined }],
    ["a refusal whose text is empty", { ...good, status: "refusal", refusal: "" }],
    ["missing raw", { ...good, raw: undefined }],
    ["a bare array", []],
    ["null", null]
  ])("treats %s as a miss", (_label, value) => {
    expect(validateCacheEntry(value, "abc")).toBeUndefined();
  });

  it("retries a null-parsed entry rather than replaying it as a success", async () => {
    const dataRoot = makeTestDataRoot("cache-null-parsed");
    const tasks = [makeTask("text", "text-default", "a summary")];
    const cache = new ResponseCache(path.join(dataRoot, "cache"));

    // Hand-written or left by an older build: a status the run loop would never produce.
    const file = cache.pathFor(tasks[0].requestKey);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({
      schemaVersion: 1, key: tasks[0].requestKey, status: "success", parsed: null, raw: {},
      usage: { promptTokens: 10, completionTokens: 5 }, responseOriginMeta: originalOrigin
    }));

    let calls = 0;
    const result = await run(dataRoot, tasks, async () => { calls += 1; return completion(); }, { cache });
    expect(calls).toBe(1);
    expect(result.rows[0].status).toBe("success");
    expect((result.rows[0] as SuccessResultRow).response.parsed).not.toBeNull();
  });

  it("does not hand a truncated entry to the run loop", async () => {
    const dataRoot = makeTestDataRoot("cache-truncated");
    const tasks = [makeTask("text", "text-default", "a summary")];
    const cache = new ResponseCache(path.join(dataRoot, "cache"));

    // Truncated at a record boundary: still valid JSON, so JSON.parse alone would let it through and
    // rowFromResponse would then crash on the missing usage.
    const file = cache.pathFor(tasks[0].requestKey);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ schemaVersion: 1, key: tasks[0].requestKey, status: "success" }));

    expect(cache.get(tasks[0].requestKey)).toBeUndefined();
    let calls = 0;
    const result = await run(dataRoot, tasks, async () => { calls += 1; return completion(); }, { cache });
    expect(calls).toBe(1);
    expect(result.rows[0].status).toBe("success");
  });
});
