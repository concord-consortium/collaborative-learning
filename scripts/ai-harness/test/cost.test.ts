import {
  CostCeilingExceeded, CostLedger, estimateInputTokens, estimateTokensForText, kCharsPerToken, kRetries,
  loadPricingConfig, pricingFor, priceTokens, worstCaseUsd
} from "../src/cost.js";
import { canonicalJson } from "../src/schemas.js";
import { ResponseCache } from "../src/cache.js";
import { CompletionResult, RunTask, runTasks } from "../src/execute.js";
import { buildRequest, requestKeyFor } from "../src/messages.js";
import { defaultAiPrompt } from "../../../shared/ai-analysis-messages.js";
import { makeRequest, makeTask, makeTestDataRoot, testPricing, testRunMeta } from "./helpers.js";
import path from "node:path";

const experiment = { schemaVersion: 1, name: "ceiling", runs: [] as any[] };

describe("pricing config", () => {
  it("loads and prices gpt-4o-mini", () => {
    const config = loadPricingConfig();
    const pricing = pricingFor(config, "gpt-4o-mini");
    expect(pricing.inputPerMTokUsd).toBeGreaterThan(0);
    expect(pricing.outputPerMTokUsd).toBeGreaterThan(0);
    expect(pricing.maxOutputTokens).toBeGreaterThan(0);
    expect(config.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("refuses a model it has no price for", () => {
    expect(() => pricingFor(loadPricingConfig(), "gpt-5-imaginary")).toThrow(/no pricing for model/);
  });
});

describe("every request carries a completion cap", () => {
  it("puts the pricing config's maxOutputTokens into the request", () => {
    const pricing = pricingFor(loadPricingConfig(), "gpt-4o-mini");
    const request = buildRequest({
      model: "gpt-4o-mini",
      aiPrompt: defaultAiPrompt,
      message: "text-only",
      markdown: "# CLUE Document Summary",
      generationSettings: { max_completion_tokens: pricing.maxOutputTokens }
    });
    expect(request.generationSettings.max_completion_tokens).toBe(pricing.maxOutputTokens);
  });

  it("makes the cap part of the request key, so changing it re-runs", () => {
    expect(requestKeyFor(makeRequest("hello", 1024))).not.toBe(requestKeyFor(makeRequest("hello", 512)));
  });
});

describe("the reservation formula", () => {
  it("prices the input estimate plus a completion that runs all the way to the cap, times the retries", () => {
    const request = makeRequest("a".repeat(300));
    const estimate = estimateInputTokens(request);
    const expected = priceTokens(estimate, 1024, testPricing) * (1 + kRetries);
    expect(worstCaseUsd(request, testPricing)).toBeCloseTo(expected, 12);
  });

  it("never estimates fewer tokens than the message text divided by the chars-per-token divisor", () => {
    const request = makeRequest("a".repeat(3000));
    const messageChars = canonicalJson(request.messages).length;
    const schemaChars = canonicalJson(request.responseFormat).length;
    expect(estimateInputTokens(request))
      .toBeGreaterThanOrEqual(Math.ceil((messageChars + schemaChars) / kCharsPerToken));
  });

  it("counts non-ASCII characters as a whole token each, so CJK cannot undercut the reservation", () => {
    // 300 ASCII characters cost about 100 tokens; 300 CJK characters cost about 300.
    const ascii = estimateInputTokens(makeRequest("a".repeat(300)));
    const cjk = estimateInputTokens(makeRequest("学".repeat(300)));
    expect(cjk).toBeGreaterThan(ascii + 190);
    expect(estimateTokensForText("学".repeat(50))).toBe(50);
    expect(estimateTokensForText("a".repeat(300))).toBe(100);
    expect(estimateTokensForText("学a学a")).toBe(2 + Math.ceil(2 / kCharsPerToken));
  });

  it("prices emoji conservatively too", () => {
    expect(estimateTokensForText("🙂🙂🙂")).toBe(3);
  });
});

describe("the ledger", () => {
  it("refuses a reservation that would cross the ceiling", () => {
    const ledger = new CostLedger(1);
    ledger.reserve(0.6);
    expect(() => ledger.reserve(0.6)).toThrow(CostCeilingExceeded);
    expect(ledger.committedUsd).toBeCloseTo(0.6, 12);
  });

  it("replaces a reservation with the actual cost when the call completes", () => {
    const ledger = new CostLedger(1);
    const reservation = ledger.reserve(0.5);
    ledger.settle(reservation, 0.01);
    expect(ledger.incurredUsd).toBeCloseTo(0.01, 12);
    expect(ledger.remainingUsd).toBeCloseTo(0.99, 12);
  });

  it("releases a reservation for a call that never happened", () => {
    const ledger = new CostLedger(1);
    ledger.release(ledger.reserve(0.9));
    expect(ledger.committedUsd).toBe(0);
  });

  it("rejects a non-positive ceiling", () => {
    expect(() => new CostLedger(0)).toThrow(/--max-cost must be a positive number/);
  });
});

describe("an actual-cost overshoot is detected and reported", () => {
  it("flags the ledger when settled cost passes the ceiling", () => {
    const ledger = new CostLedger(1);
    expect(ledger.hasExceededCeiling).toBe(false);
    const reservation = ledger.reserve(0.9);
    // Reservations are conservative, but the input estimate is a character heuristic rather than a
    // tokenizer, so an actual cost can land above what was reserved.
    ledger.settle(reservation, 1.5);
    expect(ledger.hasExceededCeiling).toBe(true);
    expect(ledger.overshootUsd).toBeCloseTo(0.5, 10);
  });

  it("stays clear when actuals come in under the reservation", () => {
    const ledger = new CostLedger(1);
    ledger.settle(ledger.reserve(0.9), 0.1);
    expect(ledger.hasExceededCeiling).toBe(false);
    expect(ledger.overshootUsd).toBe(0);
  });

  it("stops the run and reports the overshoot in the summary", async () => {
    const dataRoot = makeTestDataRoot("cost-overshoot");
    const tasks: RunTask[] = Array.from({ length: 8 }, (_, index) =>
      makeTask(`doc-${index}`, "text-default", `document ${index}`, 0.02));
    const ledger = new CostLedger(0.05);
    const messages: string[] = [];
    const summary = await runTasks({
      corpus: "synthetic-corpus",
      experiment: experiment as any,
      experimentSha256: "hash",
      tasks,
      outputFile: path.join(dataRoot, "results.jsonl"),
      ledger,
      cache: new ResponseCache(path.join(dataRoot, "cache")),
      pricing: testPricing,
      runMeta: testRunMeta,
      // Each response really costs far more than the estimate reserved for it.
      createCompletion: async () => ({
        parsed: { category: "form" },
        refusal: null,
        raw: {},
        usage: { promptTokens: 400_000, completionTokens: 1024 },
        originMeta: { date: "2026-08-12T00:00:00.000Z", modelReturned: "gpt-4o-mini", systemFingerprint: null }
      }),
      concurrency: 1,
      log: (message) => messages.push(message)
    });

    expect(summary.stoppedOnCeiling).toBe(true);
    expect(summary.overshootUsd).toBeGreaterThan(0);
    expect(summary.apiCalls).toBeLessThan(tasks.length);
    expect(messages.join("\n")).toMatch(/passed the --max-cost ceiling by \$/);
  });
});

describe("concurrent runs cannot overshoot --max-cost", () => {
  it("stops dispatching once reservations reach the ceiling", async () => {
    const dataRoot = makeTestDataRoot("cost-ceiling");
    // 20 calls, each reserving a worst case of $0.02 and really costing about $0.0156. The ceiling
    // pays for a handful of them, so the run has to stop partway through.
    const tasks: RunTask[] = Array.from({ length: 20 }, (_, index) =>
      makeTask(`doc-${index}`, "text-default", `document ${index}`, 0.02));
    const ceiling = 0.085;
    const ledger = new CostLedger(ceiling);

    let inFlight = 0;
    let peakInFlight = 0;
    // Recorded rather than asserted in place: an expect() that throws inside createCompletion is
    // caught by runTasks' own retry handling and turned into an error row, so the failure would be
    // swallowed. The peak is checked after runTasks returns.
    let peakCommittedUsd = 0;
    const createCompletion = async (): Promise<CompletionResult> => {
      inFlight += 1;
      peakInFlight = Math.max(peakInFlight, inFlight);
      // Yield so every worker is mid-call at once — the moment a naive ledger would overshoot.
      await new Promise((resolve) => setTimeout(resolve, 5));
      peakCommittedUsd = Math.max(peakCommittedUsd, ledger.committedUsd);
      inFlight -= 1;
      return {
        parsed: { category: "form" },
        refusal: null,
        raw: {},
        usage: { promptTokens: 100_000, completionTokens: 1024 },
        originMeta: { date: "2026-08-11T00:00:00.000Z", modelReturned: "gpt-4o-mini", systemFingerprint: null }
      };
    };

    const messages: string[] = [];
    const summary = await runTasks({
      corpus: "synthetic-corpus",
      experiment: experiment as any,
      experimentSha256: "hash",
      tasks,
      outputFile: path.join(dataRoot, "results.jsonl"),
      ledger,
      cache: new ResponseCache(path.join(dataRoot, "cache")),
      pricing: testPricing,
      runMeta: testRunMeta,
      createCompletion,
      log: (message) => messages.push(message)
    });

    expect(peakInFlight).toBeGreaterThan(1);
    expect(peakCommittedUsd).toBeGreaterThan(0);
    expect(peakCommittedUsd).toBeLessThanOrEqual(ceiling);
    expect(summary.stoppedOnCeiling).toBe(true);
    expect(summary.apiCalls).toBeGreaterThan(0);
    expect(summary.apiCalls).toBeLessThan(tasks.length);
    expect(summary.reservedPeakUsd).toBeLessThanOrEqual(ceiling);
    expect(ledger.incurredUsd).toBeLessThanOrEqual(ceiling);
    expect(messages.join("\n")).toContain("No further requests were dispatched");
  });
});
