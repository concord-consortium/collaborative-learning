import path from "node:path";
import { CostLedger, kRetries } from "../src/cost.js";
import { ResponseCache } from "../src/cache.js";
import { HostedImageCheck, HostedImageUnusable, RunTask, runTasks } from "../src/execute.js";
import { buildImageRequest, requestKeyFor } from "../src/messages.js";
import { defaultAiPrompt } from "../../../shared/ai-analysis-messages.js";
import { makeTestDataRoot, testPricing, testRunMeta } from "./helpers.js";

const experiment = { schemaVersion: 1, name: "hosted", runs: [] as any[] };

const kSha = "a".repeat(64);

function hostedTask(docId: string, url: string, sha256 = kSha): RunTask {
  const request = buildImageRequest({
    model: "gpt-4o-mini",
    aiPrompt: defaultAiPrompt,
    message: "image-only",
    imageUrl: url,
    accounting: { sha256, widthPx: 960, heightPx: 1420 },
    generationSettings: { max_completion_tokens: 1024 }
  });
  return {
    docId,
    runId: "image-shutterbug",
    run: { id: "image-shutterbug", message: "image-only", imageMode: "shutterbug-production-current",
      prompt: "categorize-design-default" },
    modality: "visual-only",
    computedModality: "visual-only",
    promptName: "categorize-design-default",
    promptSha256: "hash",
    aiPrompt: defaultAiPrompt,
    makeRequest: () => request,
    requestKey: requestKeyFor(request),
    worstCaseUsd: 0.02,
    retries: kRetries,
    representation: {
      kind: "image",
      modeId: "shutterbug-production-current",
      backendId: "shutterbug",
      backendVersion: 1,
      renderTarget: {
        clueUrl: "https://collaborative-learning.concord.org/branch/shutterbug-support",
        unit: "mods",
        clueRevision: null,
        shutterbugUrl: "https://api.concord.org/shutterbug-production",
        viewportWidthPx: 1000,
        captureMode: "fixed-height",
        captureHeightPx: 1500
      },
      sourceContentSha256: "0".repeat(64),
      imageSha256s: [sha256]
    },
    imageTokensEstimated: 36_835,
    hostedImages: [{ url, sha256 }]
  };
}

const answer = async () => ({
  parsed: { category: "form" },
  refusal: null,
  raw: {},
  usage: { promptTokens: 37_000, completionTokens: 30 },
  originMeta: { date: "2026-08-13T00:00:00.000Z", modelReturned: "gpt-4o-mini", systemFingerprint: null }
});

function run(tasks: RunTask[], checkHostedImage?: HostedImageCheck, name = "hosted") {
  const dataRoot = makeTestDataRoot(name);
  const messages: string[] = [];
  const dispatched: string[] = [];
  return {
    messages,
    dispatched,
    promise: runTasks({
      corpus: "image-corpus",
      experiment: experiment as any,
      experimentSha256: "hash",
      tasks,
      outputFile: path.join(dataRoot, "results.jsonl"),
      ledger: new CostLedger(1),
      cache: new ResponseCache(path.join(dataRoot, "cache")),
      pricing: testPricing,
      runMeta: testRunMeta,
      createCompletion: async (request) => {
        dispatched.push(JSON.stringify(request.request.apiRequest.messages).slice(0, 40));
        return answer();
      },
      checkHostedImage,
      concurrency: 2,
      log: (message) => messages.push(message)
    })
  };
}

const usable: HostedImageCheck = async () => null;

describe("hosted images are verified before anything is dispatched", () => {
  it("runs normally when every image still serves the pixels that were rendered", async () => {
    const tasks = [hostedTask("a", "https://images.test/a.png"), hostedTask("b", "https://images.test/b.png")];
    const checked: string[] = [];
    const harness = run(tasks, async (url, sha) => {
      checked.push(`${url} ${sha}`);
      return null;
    }, "hosted-ok");
    const summary = await harness.promise;
    expect(summary.written).toBe(2);
    // The expected hash is handed to the check, not just the URL — that is the whole point.
    expect(checked.sort()).toEqual([`https://images.test/a.png ${kSha}`, `https://images.test/b.png ${kSha}`]);
    expect(harness.messages.join("\n")).toContain("Verified 2 hosted image(s) still serve the pixels");
  });

  it("refuses to spend anything when a URL has expired", async () => {
    // Reuse-if-fresh skips the Shutterbug call entirely, so a stored URL never rotates on its own —
    // it just quietly stops resolving while the envelope still looks perfectly valid. Without this
    // check the run fails partway through, after money has been spent on whichever tasks went first.
    const tasks = [hostedTask("a", "https://images.test/a.png"), hostedTask("b", "https://images.test/gone.png")];
    const harness = run(tasks, async (url) => url.includes("gone") ? "HTTP 404 Not Found" : null,
      "hosted-expired");
    await expect(harness.promise).rejects.toThrow(HostedImageUnusable);
    expect(harness.dispatched).toEqual([]);
  });

  it("refuses when the URL resolves but now serves different pixels", async () => {
    // Reachability was never the guarantee. The request key, the cache entry and the row's
    // provenance all use the hash captured at render time, so a URL that has quietly started
    // serving a different image would have the model analyse one picture and the results record
    // another.
    const tasks = [hostedTask("swapped", "https://images.test/a.png")];
    const harness = run(tasks, async () => `now serves different pixels (sha256 ${"b".repeat(64)}, ` +
      `expected ${kSha})`, "hosted-swapped");
    await expect(harness.promise).rejects.toThrow(/now serves different pixels/);
    expect(harness.dispatched).toEqual([]);
  });

  it("says which documents are affected, why, and how to fix it", async () => {
    const tasks = [hostedTask("drawing-only", "https://images.test/gone.png")];
    const harness = run(tasks, async () => "HTTP 410 Gone", "hosted-message");
    await expect(harness.promise).rejects.toThrow(
      /drawing-only \(image-shutterbug\): https:\/\/images\.test\/gone\.png[\s\S]*HTTP 410 Gone/);
    await expect(harness.promise).rejects.toThrow(/render --mode <mode> --refresh/);
    await expect(harness.promise).rejects.toThrow(/Nothing was dispatched/);
  });

  it("checks each distinct image once, however many tasks point at it", async () => {
    const shared = "https://images.test/shared.png";
    const tasks = [hostedTask("a", shared), hostedTask("b", shared)];
    let checks = 0;
    const harness = run(tasks, async () => {
      checks += 1;
      return null;
    }, "hosted-shared");
    await harness.promise;
    expect(checks).toBe(1);
  });

  it("checks the same URL twice when two documents expect different pixels from it", async () => {
    // Deduplication is by (url, hash), not by URL: two envelopes disagreeing about what a URL holds
    // is exactly the case this preflight exists to catch.
    const shared = "https://images.test/shared.png";
    const tasks = [hostedTask("a", shared, kSha), hostedTask("b", shared, "c".repeat(64))];
    let checks = 0;
    const harness = run(tasks, async () => {
      checks += 1;
      return null;
    }, "hosted-two-hashes");
    await harness.promise;
    expect(checks).toBe(2);
  });

  it("checks no more images at once than the run loop dispatches", async () => {
    // Each check downloads a whole image, allowed up to 20 MB. Starting them all with `Promise.all`
    // put half a gigabyte in flight for a 25-document corpus, and opened 25 connections to one host.
    const tasks = Array.from({ length: 9 }, (_, index) =>
      hostedTask(`d${index}`, `https://images.test/${index}.png`));
    let inFlight = 0;
    let peak = 0;
    const harness = run(tasks, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      return null;
    }, "hosted-concurrency");
    await harness.promise;
    // `run` above passes concurrency: 2.
    expect(peak).toBe(2);
  });

  it("makes no check at all for a run with no hosted images", async () => {
    // A local capture sends its bytes inline, and a text run has no images — neither touches the
    // network before dispatch.
    const local = hostedTask("a", "data:image/png;base64,AAAA");
    local.hostedImages = [];
    let checks = 0;
    const harness = run([local], async () => {
      checks += 1;
      return null;
    }, "hosted-none");
    await harness.promise;
    expect(checks).toBe(0);
    expect(harness.messages.join("\n")).not.toContain("Verified");
  });
});
