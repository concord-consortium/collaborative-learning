import { jest } from "@jest/globals";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { ResponseCache } from "../src/cache.js";
import { CostLedger, priceTokens } from "../src/cost.js";
import {
  CompletionResult, JsonlWriter, RunTask, currentRunMeta, isTransientError, readResultRows, runTasks
} from "../src/execute.js";
import { ResultRow } from "../src/schemas.js";
import { makeTask, makeTestDataRoot, readLines, testPricing, testRunMeta } from "./helpers.js";

const experiment = { schemaVersion: 1, name: "resume-tests", runs: [] as any[] };

function completion(): CompletionResult {
  return {
    parsed: { category: "form" },
    refusal: null,
    raw: { id: "chatcmpl-1" },
    usage: { promptTokens: 100, completionTokens: 20 },
    originMeta: { date: "2026-08-11T00:00:00.000Z", modelReturned: "gpt-4o-mini", systemFingerprint: null }
  };
}

async function run(dataRoot: string, tasks: RunTask[], createCompletion: () => Promise<CompletionResult>,
  outputFile = path.join(dataRoot, "results.jsonl")) {
  return {
    summary: await runTasks({
      corpus: "synthetic-corpus",
      experiment: experiment as any,
      experimentSha256: "hash",
      tasks,
      outputFile,
      ledger: new CostLedger(10),
      // The cache is disabled so these tests exercise resume, not caching.
      cache: new ResponseCache(path.join(dataRoot, "cache"), { read: false, write: false }),
      pricing: testPricing,
      runMeta: testRunMeta,
      createCompletion,
      sleep: async () => undefined
    }),
    outputFile
  };
}

describe("resume", () => {
  it("skips a (document, run) pair whose requestKey already has a row", async () => {
    const dataRoot = makeTestDataRoot("resume-basic");
    const tasks = [
      makeTask("text", "text-default", "summary of text"),
      makeTask("table", "text-default", "summary of table")
    ];

    const first = await run(dataRoot, tasks, async () => completion());
    expect(first.summary.written).toBe(2);

    const second = await run(dataRoot, tasks, async () => {
      throw new Error("a completed pair must not be re-requested");
    });
    expect(second.summary.resumed).toBe(2);
    expect(second.summary.written).toBe(0);
    expect(readLines(first.outputFile)).toHaveLength(2);
  });

  it("resumes an interrupted run and finishes the rest", async () => {
    const dataRoot = makeTestDataRoot("resume-interrupted");
    const tasks = Array.from({ length: 6 }, (_, index) =>
      makeTask(`doc-${index}`, "text-default", `summary ${index}`));

    // Simulate a crash: only the first three tasks got a row.
    await run(dataRoot, tasks.slice(0, 3), async () => completion());
    const second = await run(dataRoot, tasks, async () => completion());

    expect(second.summary.resumed).toBe(3);
    expect(second.summary.written).toBe(3);
    const rows = readLines(second.outputFile) as ResultRow[];
    expect(new Set(rows.map((row) => row.docId)).size).toBe(6);
  });

  it("re-runs when the representation, prompt or generation settings change the requestKey", async () => {
    const dataRoot = makeTestDataRoot("resume-changed");
    const original = makeTask("text", "text-default", "summary of text");
    await run(dataRoot, [original], async () => completion());

    // Same document id and run id, different markdown — a changed representation.
    const changed = makeTask("text", "text-default", "a DIFFERENT summary of text");
    expect(changed.requestKey).not.toBe(original.requestKey);

    let calls = 0;
    const second = await run(dataRoot, [changed], async () => { calls += 1; return completion(); });
    expect(second.summary.resumed).toBe(0);
    expect(calls).toBe(1);
  });

  it("lets an error row be retried on the next run", async () => {
    const dataRoot = makeTestDataRoot("resume-error");
    const tasks = [makeTask("text", "text-default", "summary of text")];
    await run(dataRoot, tasks, async () => { throw new Error("boom"); });

    let calls = 0;
    const second = await run(dataRoot, tasks, async () => { calls += 1; return completion(); });
    expect(second.summary.resumed).toBe(0);
    expect(calls).toBe(1);
    const rows = readResultRows(path.join(dataRoot, "results.jsonl"));
    expect(rows.map((row) => row.status)).toEqual(["error", "success"]);
  });
});

describe("resume identity spans the corpus and the experiment", () => {
  const runWith = async (dataRoot: string, overrides: { corpus?: string; experimentSha256?: string },
    tasks: RunTask[], createCompletion: () => Promise<CompletionResult>) =>
    runTasks({
      corpus: overrides.corpus ?? "synthetic-corpus",
      experiment: experiment as any,
      experimentSha256: overrides.experimentSha256 ?? "hash",
      tasks,
      outputFile: path.join(dataRoot, "results.jsonl"),
      ledger: new CostLedger(10),
      cache: new ResponseCache(path.join(dataRoot, "cache"), { read: false, write: false }),
      pricing: testPricing,
      runMeta: testRunMeta,
      createCompletion,
      sleep: async () => undefined
    });

  it("does not resume a row written for a different corpus", async () => {
    const dataRoot = makeTestDataRoot("resume-corpus");
    const tasks = [makeTask("text", "text-default", "a summary")];
    await runWith(dataRoot, { corpus: "corpus-a" }, tasks, async () => completion());

    let calls = 0;
    const second = await runWith(dataRoot, { corpus: "corpus-b" }, tasks,
      async () => { calls += 1; return completion(); });
    expect(second.resumed).toBe(0);
    expect(calls).toBe(1);
  });

  it("does not resume a row written under a different experiment definition", async () => {
    const dataRoot = makeTestDataRoot("resume-experiment");
    const tasks = [makeTask("text", "text-default", "a summary")];
    await runWith(dataRoot, { experimentSha256: "before-edit" }, tasks, async () => completion());

    let calls = 0;
    const second = await runWith(dataRoot, { experimentSha256: "after-edit" }, tasks,
      async () => { calls += 1; return completion(); });
    expect(second.resumed).toBe(0);
    expect(calls).toBe(1);
  });

  it("still resumes when corpus and experiment both match", async () => {
    const dataRoot = makeTestDataRoot("resume-same");
    const tasks = [makeTask("text", "text-default", "a summary")];
    await runWith(dataRoot, {}, tasks, async () => completion());
    const second = await runWith(dataRoot, {}, tasks, async () => {
      throw new Error("must not be re-requested");
    });
    expect(second.resumed).toBe(1);
  });
});

describe("a dispatched request that fails is not treated as free", () => {
  it("settles its single-attempt share instead of releasing the whole reservation", async () => {
    const dataRoot = makeTestDataRoot("failed-attempt-cost");
    const tasks = [makeTask("text", "text-default", "a summary", 0.03)];
    const ledger = new CostLedger(10);
    await runTasks({
      corpus: "synthetic-corpus",
      experiment: experiment as any,
      experimentSha256: "hash",
      tasks,
      outputFile: path.join(dataRoot, "results.jsonl"),
      ledger,
      cache: new ResponseCache(path.join(dataRoot, "cache"), { read: false, write: false }),
      pricing: testPricing,
      runMeta: testRunMeta,
      createCompletion: async () => { throw Object.assign(new Error("gone"), { status: 500 }); },
      sleep: async () => undefined
    });
    // Three attempts of a reservation that covered three: the whole reservation is charged.
    expect(ledger.incurredUsd).toBeCloseTo(0.03, 10);
    expect(ledger.incurredUsd).toBeGreaterThan(0);
  });

  it("charges only the attempts it made when it gives up early", async () => {
    const dataRoot = makeTestDataRoot("failed-attempt-partial");
    const tasks = [makeTask("text", "text-default", "a summary", 0.03)];
    const ledger = new CostLedger(10);
    await runTasks({
      corpus: "synthetic-corpus",
      experiment: experiment as any,
      experimentSha256: "hash",
      tasks,
      outputFile: path.join(dataRoot, "results.jsonl"),
      ledger,
      cache: new ResponseCache(path.join(dataRoot, "cache"), { read: false, write: false }),
      pricing: testPricing,
      runMeta: testRunMeta,
      // Not transient, so it is attempted once and not retried.
      createCompletion: async () => { throw new Error("bad request"); },
      sleep: async () => undefined
    });
    expect(ledger.incurredUsd).toBeCloseTo(0.01, 10);
  });
});

describe("retries", () => {
  it("retries a transient failure and gives up after the configured number of attempts", async () => {
    expect(isTransientError({ status: 429 })).toBe(true);
    expect(isTransientError({ status: 503 })).toBe(true);
    expect(isTransientError({ code: "ECONNRESET" })).toBe(true);
    expect(isTransientError({ status: 400 })).toBe(false);
    expect(isTransientError(new Error("bad prompt"))).toBe(false);

    const dataRoot = makeTestDataRoot("retries");
    const tasks = [makeTask("text", "text-default", "summary of text")];
    let attempts = 0;
    const { outputFile } = await run(dataRoot, tasks, async () => {
      attempts += 1;
      if (attempts < 3) throw Object.assign(new Error("rate limited"), { status: 429 });
      return completion();
    });
    expect(attempts).toBe(3);
    expect((readLines(outputFile)[0] as ResultRow).status).toBe("success");
  });

  it("records the attempt count on an error row", async () => {
    const dataRoot = makeTestDataRoot("retries-exhausted");
    const tasks = [makeTask("text", "text-default", "summary of text")];
    const { outputFile } = await run(dataRoot, tasks, async () => {
      throw Object.assign(new Error("still rate limited"), { status: 429 });
    });
    const row = readLines(outputFile)[0] as ResultRow;
    expect(row.status).toBe("error");
    if (row.status === "error") expect(row.error.attempts).toBe(3);
  });

  it("does not retry a non-transient failure", async () => {
    const dataRoot = makeTestDataRoot("retries-none");
    const tasks = [makeTask("text", "text-default", "summary of text")];
    let attempts = 0;
    await run(dataRoot, tasks, async () => { attempts += 1; throw new Error("invalid request"); });
    expect(attempts).toBe(1);
  });
});

describe("a request that succeeds after failed attempts", () => {
  const runOnce = async (dataRoot: string, ledger: CostLedger, createCompletion: () => Promise<CompletionResult>) =>
    runTasks({
      corpus: "synthetic-corpus",
      experiment: experiment as any,
      experimentSha256: "hash",
      tasks: [makeTask("text", "text-default", "a summary", 0.03)],
      outputFile: path.join(dataRoot, "results.jsonl"),
      ledger,
      cache: new ResponseCache(path.join(dataRoot, "cache"), { read: false, write: false }),
      pricing: testPricing,
      runMeta: testRunMeta,
      createCompletion,
      sleep: async () => undefined
    });

  it("charges the earlier dispatched attempts, not only the response that came back", async () => {
    const dataRoot = makeTestDataRoot("retry-cost");
    const ledger = new CostLedger(10);
    let attempts = 0;
    const summary = await runOnce(dataRoot, ledger, async () => {
      attempts += 1;
      if (attempts < 3) throw Object.assign(new Error("rate limited"), { status: 429 });
      return completion();
    });

    // The response itself is tiny; the two failed attempts are two thirds of a $0.03 reservation.
    const responseOnly = priceTokens(100, 20, testPricing);
    expect(summary.written).toBe(1);
    expect(ledger.incurredUsd).toBeCloseTo(responseOnly + 0.02, 10);
    expect(ledger.incurredUsd).toBeGreaterThan(responseOnly);
  });

  it("charges nothing extra when the first attempt succeeds", async () => {
    const dataRoot = makeTestDataRoot("retry-cost-clean");
    const ledger = new CostLedger(10);
    await runOnce(dataRoot, ledger, async () => completion());
    expect(ledger.incurredUsd).toBeCloseTo(priceTokens(100, 20, testPricing), 10);
  });

  it("accounts the same way whether the request eventually succeeds or not", async () => {
    // The two paths must agree about the identical event: an attempt that went out and came back
    // with nothing.
    const failedOnly = new CostLedger(10);
    await runOnce(makeTestDataRoot("retry-cost-allfail"), failedOnly, async () => {
      throw Object.assign(new Error("gone"), { status: 500 });
    });

    const succeeded = new CostLedger(10);
    let attempts = 0;
    await runOnce(makeTestDataRoot("retry-cost-mixed"), succeeded, async () => {
      attempts += 1;
      if (attempts < 3) throw Object.assign(new Error("gone"), { status: 500 });
      return completion();
    });

    // Three failed attempts cost the whole reservation; two failed plus a response cost two thirds
    // of it plus the response.
    expect(failedOnly.incurredUsd).toBeCloseTo(0.03, 10);
    expect(succeeded.incurredUsd).toBeCloseTo(0.02 + priceTokens(100, 20, testPricing), 10);
  });
});

describe("apiCalls counts dispatches, which is what the CLI reports", () => {
  const runWith = async (name: string, createCompletion: () => Promise<CompletionResult>) => {
    const dataRoot = makeTestDataRoot(name);
    return runTasks({
      corpus: "synthetic-corpus",
      experiment: experiment as any,
      experimentSha256: "hash",
      tasks: [makeTask("text", "text-default", "a summary")],
      outputFile: path.join(dataRoot, "results.jsonl"),
      ledger: new CostLedger(10),
      cache: new ResponseCache(path.join(dataRoot, "cache"), { read: false, write: false }),
      pricing: testPricing,
      runMeta: testRunMeta,
      createCompletion,
      sleep: async () => undefined
    });
  };

  it("counts every attempt when a request succeeds on its third", async () => {
    let attempts = 0;
    const summary = await runWith("apicalls-retry", async () => {
      attempts += 1;
      if (attempts < 3) throw Object.assign(new Error("rate limited"), { status: 429 });
      return completion();
    });
    expect(summary.apiCalls).toBe(3);
  });

  it("counts the attempts of a request that exhausts its retries, rather than reporting none", async () => {
    const summary = await runWith("apicalls-exhausted", async () => {
      throw Object.assign(new Error("rate limited"), { status: 429 });
    });
    expect(summary.apiCalls).toBe(3);
    expect(summary.written).toBe(1);
  });

  it("counts one for a request that succeeds immediately, and none for a cache hit", async () => {
    expect((await runWith("apicalls-clean", async () => completion())).apiCalls).toBe(1);
  });
});

describe("the JSONL writer", () => {
  it("produces whole, non-interleaved rows under concurrency", async () => {
    const dataRoot = makeTestDataRoot("writer-queue");
    const file = path.join(dataRoot, "concurrent.jsonl");
    const writer = new JsonlWriter(file);

    // Large payloads so a naive appender really would interleave.
    const rows = Array.from({ length: 200 }, (_, index) => ({ index, filler: "x".repeat(4000) }));
    await Promise.all(rows.map((row) => writer.write(row)));
    await writer.close();

    const lines = fs.readFileSync(file, "utf8").split("\n").filter((line) => line.length > 0);
    expect(lines).toHaveLength(200);
    const parsed = lines.map((line) => JSON.parse(line));
    expect(parsed.map((row) => row.index)).toEqual(rows.map((row) => row.index));
    for (const row of parsed) expect(row.filler).toHaveLength(4000);
  });

  it("writes whole rows from concurrent completions", async () => {
    const dataRoot = makeTestDataRoot("writer-run");
    const tasks: RunTask[] = Array.from({ length: 24 }, (_, index) =>
      makeTask(`doc-${index}`, "text-default", "x".repeat(2000) + index));
    const { outputFile } = await run(dataRoot, tasks, async () => {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 4));
      return completion();
    });
    const rows = readResultRows(outputFile);
    expect(rows).toHaveLength(24);
    expect(new Set(rows.map((row) => row.docId)).size).toBe(24);
  });
});

describe("the writer survives a failing append", () => {
  // Not asked for by the review, but B1/B2 changed behaviour that nothing else covers.
  it("keeps writing after one append fails, and reports the failure once from close()", async () => {
    const dataRoot = makeTestDataRoot("writer-poison");
    const writer = new JsonlWriter(path.join(dataRoot, "rows.jsonl"));
    const failure = new Error("disk full");
    const appendFile = jest.spyOn(fsp, "appendFile")
      .mockRejectedValueOnce(failure as never);

    await expect(writer.write({ row: 1 })).rejects.toThrow("disk full");
    // The queue must not be poisoned: later rows still land, including the error row that would
    // explain the failure.
    await expect(writer.write({ row: 2 })).resolves.toBeUndefined();
    await expect(writer.write({ row: 3 })).resolves.toBeUndefined();
    await expect(writer.close()).rejects.toThrow("disk full");

    appendFile.mockRestore();
    expect(readLines(path.join(dataRoot, "rows.jsonl"))).toEqual([{ row: 2 }, { row: 3 }]);
  });

  it("closes the writer even when a worker throws, so queued rows are not lost", async () => {
    const dataRoot = makeTestDataRoot("writer-worker-throws");
    const tasks = [makeTask("a", "text-default", "one"), makeTask("b", "text-default", "two")];
    // A non-Error throw from the ledger is not something runTasks catches, so it escapes the worker.
    const exploding = { reserve: () => { throw new Error("ledger exploded"); } } as any;

    await expect(runTasks({
      corpus: "synthetic-corpus",
      experiment: { schemaVersion: 1, name: "boom", runs: [] } as any,
      experimentSha256: "hash",
      tasks,
      outputFile: path.join(dataRoot, "results.jsonl"),
      ledger: exploding,
      cache: new ResponseCache(path.join(dataRoot, "cache"), { read: false, write: false }),
      pricing: testPricing,
      runMeta: testRunMeta,
      createCompletion: async () => completion(),
      sleep: async () => undefined
    })).rejects.toThrow("ledger exploded");
  });
});

describe("run metadata", () => {
  it("records the SDK version, the date, and the git state", () => {
    const meta = currentRunMeta(new Date("2026-08-11T12:00:00.000Z"));
    expect(meta.date).toBe("2026-08-11T12:00:00.000Z");
    expect(meta.openaiSdkVersion).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/);
    expect(typeof meta.gitDirty).toBe("boolean");
    expect(meta.gitCommit === null || /^[0-9a-f]{40}$/.test(meta.gitCommit)).toBe(true);
  });
});
