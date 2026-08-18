import path from "node:path";
import { APIConnectionTimeoutError, APIError } from "openai";
import { ResponseCache } from "../src/cache.js";
import { CostLedger } from "../src/cost.js";
import { RunTask, errorTypeOf, runTasks } from "../src/execute.js";
import { ResultRow } from "../src/schemas.js";
import { makeTask, makeTestDataRoot, readLines, testPricing, testRunMeta } from "./helpers.js";

const experiment = { schemaVersion: 1, name: "e", runs: [] as any[] };

function run(name: string, tasks: RunTask[], createCompletion: any, ceiling = 1) {
  const dataRoot = makeTestDataRoot(name);
  const messages: string[] = [];
  return {
    messages,
    outputFile: path.join(dataRoot, "results.jsonl"),
    promise: runTasks({
      corpus: "c",
      experiment: experiment as any,
      experimentSha256: "hash",
      tasks,
      outputFile: path.join(dataRoot, "results.jsonl"),
      ledger: new CostLedger(ceiling),
      cache: new ResponseCache(path.join(dataRoot, "cache")),
      pricing: testPricing,
      runMeta: testRunMeta,
      createCompletion,
      sleep: async () => undefined,
      log: (message: string) => messages.push(message)
    })
  };
}

const ok = async () => ({
  parsed: { category: "form" },
  refusal: null,
  raw: {},
  usage: { promptTokens: 10, completionTokens: 5 },
  originMeta: { date: "2026-08-17T00:00:00.000Z", modelReturned: "gpt-4o-mini", systemFingerprint: null }
});

describe("an error row says what kind of failure it was", () => {
  it("uses the constructor name, because no SDK error class sets .name", () => {
    // Every one of these reported "Error" before, so the field distinguished nothing at all.
    expect(errorTypeOf(new APIConnectionTimeoutError({}))).toBe("APIConnectionTimeoutError");
    expect((new APIConnectionTimeoutError({}) as Error).name).toBe("Error");
  });

  it("records the HTTP status alongside it, where there is one", () => {
    expect(errorTypeOf(new APIError(429, undefined, "rate limited", undefined))).toBe("APIError(429)");
    expect(errorTypeOf({ status: 503, constructor: { name: "InternalServerError" } }))
      .toBe("InternalServerError(503)");
  });

  it("falls back sensibly on something that is not an Error at all", () => {
    expect(errorTypeOf("a string")).toBe("String");
    expect(errorTypeOf(undefined)).toBe("Error");
  });

  it("puts a distinguishing type on the written row", async () => {
    const harness = run("error-type", [makeTask("doc", "r", "x")], async () => {
      throw new APIError(400, undefined, "bad request", undefined);
    });
    await harness.promise;
    const row = (readLines(harness.outputFile) as ResultRow[])[0];
    expect(row.status).toBe("error");
    if (row.status === "error") expect(row.error.type).toBe("APIError(400)");
  });
});

describe("stopping early is reported only when work was actually skipped", () => {
  it("does not claim to have stopped early when every task ran", async () => {
    // The ceiling check used to precede the "any work left?" check, so the worker that wrote the
    // final row came back for one more turn, found the ledger full, and flagged the run as stopped.
    const tasks = [makeTask("a", "r", "x", 0.4), makeTask("b", "r", "y", 0.4)];
    const harness = run("no-false-stop", tasks, async () => ({
      ...(await ok()),
      // Costs enough that the ledger is over its ceiling by the time the last row is written.
      usage: { promptTokens: 4_000_000, completionTokens: 1024 }
    }), 1);
    const summary = await harness.promise;
    expect(summary.written).toBe(2);
    expect(summary.notDispatched).toBe(0);
  });

  it("counts what was left undispatched when it really did stop", async () => {
    const tasks = Array.from({ length: 8 }, (_, index) => makeTask(`doc-${index}`, "r", `x${index}`, 0.02));
    const harness = run("real-stop", tasks, ok, 0.05);
    const summary = await harness.promise;
    expect(summary.stoppedOnCeiling).toBe(true);
    expect(summary.notDispatched).toBeGreaterThan(0);
    expect(summary.written + summary.notDispatched).toBe(tasks.length);
  });
});

describe("cache hits are not double-counted against the skipped total", () => {
  it("counts undispatched work correctly when a run mixes cache hits with a ceiling stop", async () => {
    // A cache hit increments both `cacheHits` and `written`, and the total used to subtract both —
    // so the skipped count came out far too low and, with enough hits, hit zero and suppressed the
    // "stopped early" message for a run that really had stopped.
    const dataRoot = makeTestDataRoot("nd-cache-hits");
    const cache = new ResponseCache(path.join(dataRoot, "cache"));
    const cached = Array.from({ length: 6 }, (_, i) => makeTask(`cached-${i}`, "r", `c${i}`, 0.02));
    const fresh = Array.from({ length: 10 }, (_, i) => makeTask(`fresh-${i}`, "r", `f${i}`, 0.02));
    const expensive = async () => ({
      ...(await ok()), usage: { promptTokens: 4_000_000, completionTokens: 1024 }
    });
    const common = {
      corpus: "c", experiment: experiment as any, experimentSha256: "hash", cache,
      pricing: testPricing, runMeta: testRunMeta, sleep: async () => undefined
    };
    // Warm the cache for the first six.
    await runTasks({ ...common, tasks: cached, outputFile: path.join(dataRoot, "warm.jsonl"),
      ledger: new CostLedger(10), createCompletion: ok });
    const summary = await runTasks({ ...common, tasks: [...cached, ...fresh],
      outputFile: path.join(dataRoot, "out.jsonl"), ledger: new CostLedger(0.5),
      createCompletion: expensive, concurrency: 1 });

    expect(summary.cacheHits).toBe(6);
    expect(summary.stoppedOnCeiling).toBe(true);
    // The only honest figure: everything that never produced a row.
    expect(summary.notDispatched).toBe(16 - summary.written);
    expect(summary.notDispatched).toBeGreaterThan(0);
  });
});

describe("the two overshoots are reported separately", () => {
  it("keeps committed overshoot distinct from incurred overshoot", async () => {
    // A run that stops on the ceiling has usually committed more than it spent — reservations are
    // conservative. Reporting the committed figure as "actual spend" overstated what it cost.
    const tasks = Array.from({ length: 8 }, (_, index) => makeTask(`doc-${index}`, "r", `x${index}`, 0.02));
    const harness = run("overshoot-split", tasks, ok, 0.05);
    const summary = await harness.promise;
    expect(summary.incurredUsd).toBeLessThan(0.05);
    // Nothing was really overspent, so the incurred overshoot is zero even though the run stopped.
    expect(summary.overshootUsd).toBe(0);
    expect(summary.stoppedOnCeiling).toBe(true);
  });
});
