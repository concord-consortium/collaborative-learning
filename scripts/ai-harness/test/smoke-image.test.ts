import fs from "node:fs";
import path from "node:path";
import { main } from "../harness.js";
import { buildImageMessages, defaultAiPrompt } from "../../../shared/ai-analysis-messages.js";
import { corpusPaths, readRepresentation, representationPath } from "../src/corpus.js";
import {
  dataUrlFor, imageRepresentationPath, readImageEnvelope, resolveImageFile, sha256Bytes
} from "../src/represent-image.js";
import { CompletionRequest, CompletionResult, buildTasks, kDefaultModel } from "../src/execute.js";
import { loadPricingConfig, pricingFor } from "../src/cost.js";
import { ReportSummary } from "../src/report.js";
import { ExperimentFile, ResultRow } from "../src/schemas.js";
import { harnessRoot, isContainedBy } from "../src/files.js";
import {
  listFilesUnder, makeTestDataRoot, makeTestPng, readLines, syntheticCorpusShape, testRunsRoot
} from "./helpers.js";

/** Derived from the committed fixtures, so adding one moves the counts instead of breaking them. */
const shape = syntheticCorpusShape();

/**
 * The mocked end-to-end path extended through an `image-only` run, with no browser and no network.
 *
 * The render backend is a fake that hands back a committed-shape PNG, so what is exercised is the
 * wiring — envelope, freshness, request construction, cost, rows, report — rather than the
 * rendering itself. `test/local-render.integration.ts` covers that, against a real browser.
 */
describe("end-to-end image-only run against the synthetic corpus", () => {
  const dataRoot = makeTestDataRoot("smoke-image");
  const output: string[] = [];
  const requests: { messages: any; imageTokens: number }[] = [];
  const paths = corpusPaths(dataRoot, "image-corpus");
  const resultsFile = path.join(dataRoot, "results", "image-corpus__image-vs-text.jsonl");
  /** What was on disk before this suite ran anything, so the last test can diff against it. */
  const filesBefore = new Set(listFilesUnder(harnessRoot));

  // Distinct sizes per document, so an envelope pointing at another document's PNG shows up as the
  // wrong dimensions. The queue is consumed one capture at a time — reading the *last* queued id
  // gave every document the same size and made this safeguard inert. Renders here are sequential
  // (renderConcurrency: 1), so the order is the manifest's.
  const pngFor = (docId: string) => makeTestPng(960, 1000 + (docId.length % 7) * 60);
  const pendingDocs: string[] = [];
  let lastRenderedDoc = "";

  /** The corpus, read from the manifest — so adding a fixture does not break a count in here. */
  const documentIds = (): string[] =>
    (JSON.parse(fs.readFileSync(paths.manifest, "utf8")).documents as { id: string }[])
      .map((entry) => entry.id);

  /**
   * Refills the queue the fake capture draws document ids from.
   *
   * Filled once for the whole suite, it was drained by the first run's 25 captures, and every later
   * run then fell back to `lastRenderedDoc` — giving every document the *same* picture, which is
   * exactly what the distinct sizes above exist to catch. It has to be refilled before each render.
   */
  const queueDocuments = () => {
    pendingDocs.length = 0;
    for (const docId of documentIds()) pendingDocs.push(docId);
  };

  /** Every document's envelope really records the size its own capture produced. */
  const expectOwnPictures = () => {
    for (const docId of documentIds()) {
      const envelope = readImageEnvelope(imageRepresentationPath(paths, "puppeteer-full-height", docId));
      expect({ docId, heightPx: envelope.images[0].heightPx })
        .toEqual({ docId, heightPx: 1000 + (docId.length % 7) * 60 });
    }
    // And the fixture sizes really do differ, or the check above would prove nothing.
    expect(new Set(documentIds().map((docId) => 1000 + (docId.length % 7) * 60)).size)
      .toBeGreaterThan(1);
  };

  /** How tall this fake says the document's tile rows are — taller than the page's 500px default. */
  const contentRowsHeightPx = 1340;
  /** Every height the backend asked a frame to take, across every render in this suite. */
  const frameHeights: number[] = [];

  const fakeBrowser = () => ({
    newPage: async () => ({
      setViewport: async () => undefined,
      screenshot: async () => makeTestPng(40, 40),
      goto: async () => undefined,
      evaluate: async (script: unknown) => {
        const match = /frame\.height = (\d+)/.exec(String(script));
        if (match) frameHeights.push(Number(match[1]));
        return undefined as never;
      },
      waitForFunction: async () => true,
      $: async () => ({
        // Follows the height the backend set, the way a real element's box does. A fixed box let a
        // render that never resized still look like a full-document capture.
        boundingBox: async () => ({ x: 0, y: 0, width: 960, height: frameHeights.at(-1) ?? 500 }),
        // The docId is not visible here, so each capture takes the next document off the queue.
        screenshot: async () => {
          lastRenderedDoc = pendingDocs.shift() ?? lastRenderedDoc;
          return pngFor(lastRenderedDoc);
        }
      }),
      frames: () => [{
        url: () => "http://localhost:8080/iframe.html?unit=harness-render&unwrapped&readOnly",
        // Two top-level tiles, for the per-tile mode. The full-height mode never asks.
        $$: async () => [
          { boundingBox: async () => ({ x: 0, y: 0, width: 300, height: 200 }),
            screenshot: async () => makeTestPng(300, 200) },
          { boundingBox: async () => ({ x: 0, y: 0, width: 400, height: 260 }),
            screenshot: async () => makeTestPng(400, 260) }
        ],
        // High enough for any fixture in the committed corpus — see render-command.test.ts.
        // Without `contentRowsHeightPx` the backend compares against `undefined`, skips the
        // resize, and skips the guard that keeps `captureMode: "full-document"` honest.
        evaluate: async (script: unknown) => (String(script).includes("data-tool-id")
          ? ["tile-one", "tile-two"]
          : {
            contentHeightPx: 1420, contentRowsHeightPx, totalTiles: 99, unknownTiles: 0,
            fontsReady: true, documentText: "marker"
          }) as never
      }],
      on: () => undefined,
      close: async () => undefined
    }),
    close: async () => undefined
  });

  const deps = {
    dataRoot,
    log: (message: string) => output.push(message),
    now: () => new Date("2026-08-13T00:00:00.000Z"),
    renderConcurrency: 1,
    renderModeOptions: {
      // A fixed revision, so the test does not depend on the working tree being clean.
      clueRevision: "smoke-revision",
      launch: async () => fakeBrowser() as never,
      // A fake browser needs no real settle time.
      stableForMs: 0,
      pollIntervalMs: 1
    },
    // A stub rather than nothing. Left undefined, `render` fell back to the real unit server, which
    // reads src/public/demo/units/qa/content.json and binds an ephemeral port on every invocation —
    // so the comment saying "no unit server" was false and this test carried an undeclared
    // dependency on that file.
    startUnitServer: async () => ({
      unitUrl: "http://127.0.0.1:5000/harness-render/content.json",
      close: async () => undefined
    }),
    createCompletion: async ({ request }: CompletionRequest): Promise<CompletionResult> => {
      requests.push({
        messages: request.apiRequest.messages,
        imageTokens: request.inputAccounting.images.length
      });
      return {
        parsed: { category: "function", keyIndicators: ["a drawing"], discussion: "Mostly function." },
        refusal: null,
        raw: { id: `chatcmpl-${requests.length}` },
        usage: { promptTokens: 37_000, completionTokens: 40 },
        originMeta: { date: "2026-08-13T00:00:00.000Z", modelReturned: "gpt-4o-mini", systemFingerprint: "fp" }
      };
    }
  };

  it("imports the corpus and renders both text variants", async () => {
    await main(["import", "--from", "examples/synthetic-corpus", "--corpus", "image-corpus"], deps);
    await main(["represent", "--corpus", "image-corpus", "--variants", "default,minimal"], deps);
    expect(fs.existsSync(paths.manifest)).toBe(true);
    // The name says both variants were written, so both are checked. Asserting only that the
    // manifest exists would be satisfied by the import alone.
    expect(documentIds().length).toBeGreaterThan(0);
    for (const variantId of ["default", "minimal"]) {
      for (const docId of documentIds()) {
        const envelope = readRepresentation(representationPath(paths, variantId, docId));
        expect({ variantId, docId, of: envelope.docId, variant: envelope.variantId })
          .toEqual({ variantId, docId, of: docId, variant: variantId });
        expect(typeof envelope.markdown).toBe("string");
      }
    }
  });

  it("renders an envelope and a PNG per document", async () => {
    output.length = 0;
    // The fake page needs to know which document it is drawing; render is sequential here.
    queueDocuments();
    await main(["render", "--corpus", "image-corpus", "--mode", "puppeteer-full-height"], deps);

    const file = imageRepresentationPath(paths, "puppeteer-full-height", "drawing");
    const envelope = readImageEnvelope(file);
    expect(envelope.kind).toBe("image");
    expect(envelope.modeId).toBe("puppeteer-full-height");
    expect(envelope.backendId).toBe("puppeteer");
    expect(envelope.images).toHaveLength(1);
    // The recorded unit is a stable identifier, never an ephemeral loopback URL.
    expect(envelope.renderTarget.unit).toBe("harness-render");
    expect(envelope.renderTarget.captureMode).toBe("full-document");
    // "Full document" is earned by resizing the frame to cover the tile rows, so the frame really
    // has to have grown past the 500px the generated page starts at.
    expect(Math.max(...frameHeights)).toBeGreaterThanOrEqual(contentRowsHeightPx);
    expect(fs.existsSync(resolveImageFile(file, envelope.images[0]))).toBe(true);
    expect(output.join("\n")).toMatch(new RegExp(`Rendered ${documentIds().length} document\\(s\\)`));

    // Each document's envelope records the size its *own* capture produced — so an envelope holding
    // another document's picture would fail here rather than passing unnoticed.
    expectOwnPictures();
  });

  it("reuses fresh renders instead of paying to make them again", async () => {
    output.length = 0;
    await main(["render", "--corpus", "image-corpus", "--mode", "puppeteer-full-height"], deps);
    expect(output.join("\n"))
      .toMatch(new RegExp(`Rendered 0 document\\(s\\).*reused ${documentIds().length} still-fresh`, "s"));
  });

  it("re-renders everything when --refresh is passed", async () => {
    output.length = 0;
    // Refilled, or every document is handed the last one's picture and the per-document size check
    // below passes for the wrong reason.
    queueDocuments();
    await main(["render", "--corpus", "image-corpus", "--mode", "puppeteer-full-height", "--refresh"], deps);
    expect(output.join("\n")).toMatch(new RegExp(`Rendered ${documentIds().length} document\\(s\\)`));
    // New pixels mean new request keys, which means a full re-spend. Said out loud.
    expect(output.join("\n")).toContain("will pay for those calls again");
    // And every document still holds its own picture after the re-render, not the last one's.
    expectOwnPictures();
  });

  it("re-renders when the document content changes", async () => {
    queueDocuments();
    const manifestFile = paths.manifest;
    const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    const entry = manifest.documents.find((document: any) => document.id === "drawing");
    const original = entry.contentSha256;
    entry.contentSha256 = "9".repeat(64);
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
    output.length = 0;
    await main(["render", "--corpus", "image-corpus", "--mode", "puppeteer-full-height"], deps);
    expect(output.join("\n"))
      .toMatch(new RegExp(`Rendered 1 document\\(s\\).*reused ${documentIds().length - 1} still-fresh`, "s"));
    entry.contentSha256 = original;
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
    queueDocuments();
    await main(["render", "--corpus", "image-corpus", "--mode", "puppeteer-full-height"], deps);
  });

  it("plans an image run with image-token estimates and no network", async () => {
    output.length = 0;
    await main(["plan", "--corpus", "image-corpus", "--experiment", "experiments/image-vs-text.json"], deps);
    const printed = output.join("\n");
    // Skip-empty means the call count is no longer runs × documents: the text runs send only what
    // carries student text, and no shape sends an empty document.
    const sent = shape.withStudentText.length * 2 + shape.withContent.length;
    expect(printed).toContain(
      `3 run(s) × ${documentIds().length} document(s) = ${documentIds().length * 3} pair(s); ` +
      `${sent} call(s), ${documentIds().length * 3 - sent} skipped.`);
    expect(printed).toContain("[image-only, --mode puppeteer-full-height");
    // Each shape is described by what it actually sends. The old two-way label predated `mixed` and
    // called it "text-only" while printing its images underneath.
    expect(printed).toContain("[text-only, default]");
    // Where the pictures came from, resolved rather than described. Every render target value has a
    // default, and a default nobody states is one nobody checks.
    expect(printed).toMatch(/renders against: http:\/\/localhost:8080 \(--clue-url\), unit harness-render/);
    expect(printed).toMatch(/image tokens \(estimated, auto priced at the high rate\): \d{4,}/);
    expect(requests).toHaveLength(0);
  });

  it("runs image-only alongside the text baselines", async () => {
    output.length = 0;
    await main(["run", "--corpus", "image-corpus", "--experiment", "experiments/image-vs-text.json",
      "--max-cost", "2.00"], deps);
    const rows = readLines(resultsFile) as ResultRow[];
    // One row per (run, document) pair, sent or skipped.
    expect(rows).toHaveLength(documentIds().length * 3);

    // An image run sends every document it can: the empty ones show nothing in a picture, and the
    // unrenderable ones have no picture to send at all.
    const imageRows = rows.filter((row) => row.message === "image-only" && row.status !== "skipped");
    expect(imageRows).toHaveLength(shape.withContent.length);
    const skippedImages = rows.filter((row) => row.message === "image-only" && row.status === "skipped");
    expect(skippedImages.map((row) => row.docId).sort())
      .toEqual([...shape.empty, ...shape.unrenderable].sort());
    // Each says which of the two it was, in terms a reader can act on.
    expect(skippedImages.filter((row) =>
      row.status === "skipped" && row.skipReasons.join(" ").includes("cannot be rendered")))
      .toHaveLength(shape.unrenderable.length);
    for (const row of imageRows) {
      if (row.status === "skipped") continue;
      expect(row.representation.kind).toBe("image");
      if (row.representation.kind === "image") {
        expect(row.representation.modeId).toBe("puppeteer-full-height");
        expect(row.representation.imageSha256s).toHaveLength(1);
        expect(row.representation.renderTarget.clueRevision).toBe("smoke-revision");
      }
      expect(row.promptImageTokensEstimated).toBeGreaterThan(10_000);
    }
    // A text row has a text descriptor and no image estimate at all.
    const textRow = rows.find((row) => row.runId === "text-default" && row.status !== "skipped")!;
    if (textRow.status === "skipped") throw new Error("expected text-default to have sent a request");
    expect(textRow.representation.kind).toBe("text");
    expect(textRow.promptImageTokensEstimated).toBeUndefined();
  });

  it("sends the picture as a data URL through the shared image builder", async () => {
    // A local capture sends its bytes inline, exactly the way production's categorizeDocument()
    // does with a local file — and through the shared builder, unmodified.
    const file = imageRepresentationPath(paths, "puppeteer-full-height", "drawing");
    const envelope = readImageEnvelope(file);
    const bytes = fs.readFileSync(resolveImageFile(file, envelope.images[0]));
    const expected = buildImageMessages(defaultAiPrompt, dataUrlFor(bytes));
    const sent = requests.find((request) => JSON.stringify(request.messages) === JSON.stringify(expected));
    expect(sent).toBeDefined();
  });

  it("refuses a picture that changed between building the task and building the request", async () => {
    // A locally captured PNG becomes a base64 data URL roughly a third larger than the file. Holding
    // one on every task until the run ends puts a corpus of captures in memory before the first call
    // goes out, so tasks carry a `makeRequest` function and the bytes are read when it is called.
    //
    // Neither the retention nor the timing is observable directly, so this pins both through the one
    // consequence that is: swap the file after the tasks are built, and building the request fails
    // because the bytes no longer hash to what the task recorded. A request built eagerly would
    // still be carrying the old bytes and would never look at the file again, so it could not fail
    // this way — and the failure is the divergence itself, since `requestKey`,
    // `representation.imageSha256s` and the cache entry were all fixed when the task was built.
    const { tasks } = buildTasks({
      corpusPaths: paths,
      experiment: {
        schemaVersion: 1,
        name: "lazy-image",
        runs: [{
          id: "image-puppeteer",
          message: "image-only",
          imageMode: "puppeteer-full-height",
          prompt: "categorize-design-default"
        }]
      } as ExperimentFile,
      promptsDir: path.join(harnessRoot, "prompts"),
      pricing: pricingFor(loadPricingConfig(), kDefaultModel)
    });
    const task = tasks.find((entry) => entry.docId === "drawing")!;

    const file = imageRepresentationPath(paths, "puppeteer-full-height", "drawing");
    const png = resolveImageFile(file, readImageEnvelope(file).images[0]);
    const original = fs.readFileSync(png);
    const replaced = makeTestPng(120, 130);
    expect(replaced).not.toEqual(original);
    try {
      fs.writeFileSync(png, replaced);
      expect(() => task.makeRequest()).toThrow(
        new RegExp(`hashes to ${sha256Bytes(replaced)}, expected ${sha256Bytes(original)}`));
    } finally {
      fs.writeFileSync(png, original);
    }
    // And with the file back, the same task builds the request it always would have: the check is
    // on the bytes, not a latch that stays tripped.
    expect(JSON.stringify(task.makeRequest().apiRequest.messages)).toContain(dataUrlFor(original));
  });

  it("runs a mixed message, dropping the text half only where there is no student text", async () => {
    // The milestone's headline shape: both representations of the same document in one request.
    const experiment = path.join(dataRoot, "mixed.json");
    fs.writeFileSync(experiment, JSON.stringify({
      schemaVersion: 1,
      name: "mixed-check",
      runs: [{
        id: "mixed", message: "mixed", textVariant: "default",
        imageMode: "puppeteer-full-height", prompt: "categorize-design-default"
      }]
    }, null, 2));
    output.length = 0;
    // `plan` is the record of what a run was about to do, so its label has to name the shape that
    // will actually run. The old two-way label predated `mixed` and filed it under "text-only"
    // while printing its images underneath.
    await main(["plan", "--corpus", "image-corpus", "--experiment", experiment], deps);
    expect(output.join("\n"))
      .toContain("[mixed, default, --mode puppeteer-full-height");

    output.length = 0;
    requests.length = 0;
    const mixedResults = path.join(dataRoot, "results", "mixed.jsonl");
    await main(["run", "--corpus", "image-corpus", "--experiment", experiment,
      "--max-cost", "2.00", "--output", mixedResults], deps);

    const rows = readLines(mixedResults) as ResultRow[];
    expect(rows).toHaveLength(documentIds().length);
    const sent = rows.filter((row) => row.status !== "skipped");
    // A mixed run sends everything it has a picture for, and skips the rest.
    expect(sent).toHaveLength(shape.withContent.length);
    expect(rows.filter((row) => row.status === "skipped"))
      .toHaveLength(shape.empty.length + shape.unrenderable.length);

    // Both halves are recorded, and the two shapes are the ones the single-representation rows use.
    for (const row of sent) {
      expect(row.representation.kind).toBe("mixed");
      if (row.representation.kind !== "mixed") continue;
      expect(row.representation.text.variantId).toBe("default");
      expect(row.representation.image.modeId).toBe("puppeteer-full-height");
      expect(row.representation.image.imageSet).toBe("full-document");
      expect(row.promptImageTokensEstimated).toBeGreaterThan(10_000);
    }

    // The text half is dropped exactly for the documents that carry no student text — and those
    // rows are sent, not skipped, because the picture still has something to say.
    const omitted = sent.filter((row) => row.textPartOmitted).map((row) => row.docId).sort();
    const expectedOmitted = shape.withContent
      .filter((docId) => !shape.withStudentText.includes(docId)).sort();
    expect(omitted).toEqual(expectedOmitted);
    expect(omitted.length).toBeGreaterThan(0);

    // A dropped text half really means prompt-plus-picture and nothing else — which is exactly an
    // image-only message. So those rows share the image-only run's request key, and this run served
    // them from its cache rather than paying for them again. Asserted rather than worked around:
    // that identity is the cache doing precisely what it is for.
    const imageOnlyKeys = new Map((readLines(resultsFile) as ResultRow[])
      .filter((row) => row.runId === "image-puppeteer" && row.status !== "skipped")
      .map((row) => [row.docId, row.requestKey]));
    for (const row of sent) {
      const imageOnlyKey = imageOnlyKeys.get(row.docId);
      expect({ docId: row.docId, sameAsImageOnly: row.requestKey === imageOnlyKey })
        .toEqual({ docId: row.docId, sameAsImageOnly: Boolean(row.textPartOmitted) });
    }
    // And the dispatched calls were only the ones carrying a summary; the rest were cache hits.
    expect(requests).toHaveLength(shape.withStudentText.length);
    for (const request of requests) {
      expect((request.messages[1].content as any[]).map((part: any) => part.type))
        .toEqual(["text", "text", "image_url"]);
    }
  });

  it("reports image-only and text-only side by side rather than summed", async () => {
    output.length = 0;
    await main(["report", "--results", resultsFile], deps);
    const table = output[0];
    expect(table).toContain("image-puppeteer");
    expect(table).toContain("img tok est");

    const summary = JSON.parse(
      fs.readFileSync(path.join(dataRoot, "results", "image-corpus__image-vs-text.summary.json"), "utf8"),
    ) as ReportSummary;
    const imageAll = summary.groups.find((group) =>
      group.runId === "(all runs)" && group.message === "image-only" && group.modality === "all")!;
    const textAll = summary.groups.find((group) =>
      group.runId === "(all runs)" && group.message === "text-only" && group.modality === "all")!;
    // Both groups still cover every document — a skipped pair is a row in its group, not an absence.
    expect(imageAll.docs).toBe(documentIds().length);
    expect(textAll.docs).toBe(documentIds().length);
    expect(imageAll.statuses.skipped).toBe(shape.empty.length + shape.unrenderable.length);
    // The whole point of splitting by shape: the two totals are separate numbers.
    expect(imageAll.tokens.imageEstimatedTotal).toBeGreaterThan(0);
    expect(textAll.tokens.imageEstimatedTotal).toBe(0);
    expect(imageAll.tokens.promptTotal).not.toBe(textAll.tokens.promptTotal);
  });

  it("chooses by purpose when an envelope holds a tile picture as well", async () => {
    // A genuine second image — real file, real hash, real byte count — with `purpose: "tile"`. A
    // full-document run sends the full-document picture and ignores the tile, rather than picking
    // whichever came first.
    const file = imageRepresentationPath(paths, "puppeteer-full-height", "drawing");
    const envelope = readImageEnvelope(file);
    const second = makeTestPng(480, 500);
    fs.writeFileSync(path.join(path.dirname(file), "drawing-2.png"), second);
    const tile = {
      ...envelope.images[0],
      file: "drawing-2.png",
      sha256: sha256Bytes(second),
      bytes: second.length,
      widthPx: 480,
      heightPx: 500,
      purpose: "tile",
      tileId: "tile-1"
    };
    fs.writeFileSync(file, JSON.stringify({ ...envelope, images: [envelope.images[0], tile] }, null, 2));
    try {
      output.length = 0;
      await main(["plan", "--corpus", "image-corpus", "--experiment",
        "experiments/image-vs-text.json"], deps);
      // Still one image per document, and it is the full-document one.
      expect(output.join("\n"))
        .toMatch(new RegExp(`${shape.withContent.length} image\\(s\\) across ` +
          `${shape.withContent.length} call\\(s\\)`));

      // And an envelope holding *only* tiles refuses a full-document run outright, naming the fix.
      fs.writeFileSync(file, JSON.stringify({ ...envelope, images: [tile] }, null, 2));
      await expect(main(["plan", "--corpus", "image-corpus", "--experiment",
        "experiments/image-vs-text.json"], deps))
        .rejects.toThrow(/records 0 full-document image\(s\) out of 1[\s\S]*set imageSet on the run/);
    } finally {
      fs.writeFileSync(file, JSON.stringify(envelope, null, 2));
      fs.rmSync(path.join(path.dirname(file), "drawing-2.png"));
    }
  });

  it("refuses an envelope with no images at all", async () => {
    // Zero images is a damaged envelope rather than an unbuilt feature, so it is reported as one
    // — but it fails just as hard. See DEVIATIONS in the README.
    const file = imageRepresentationPath(paths, "puppeteer-full-height", "drawing");
    const envelope = readImageEnvelope(file);
    fs.writeFileSync(file, JSON.stringify({ ...envelope, images: [] }, null, 2));
    await expect(main(["plan", "--corpus", "image-corpus", "--experiment",
      "experiments/image-vs-text.json"], deps)).rejects.toThrow(/it records no images/);
    fs.writeFileSync(file, JSON.stringify(envelope, null, 2));
  });

  it("refuses to run against a render whose PNG has gone", async () => {
    const file = imageRepresentationPath(paths, "puppeteer-full-height", "drawing");
    const envelope = readImageEnvelope(file);
    const image = resolveImageFile(file, envelope.images[0]);
    const bytes = fs.readFileSync(image);
    fs.rmSync(image);
    await expect(main(["plan", "--corpus", "image-corpus", "--experiment",
      "experiments/image-vs-text.json"], deps))
      .rejects.toThrow(/Stale or damaged image representation[\s\S]*missing or unreadable/);
    fs.writeFileSync(image, bytes);
  });

  it("keeps everything it generated inside the harness data directory", () => {
    // Nothing derived from a student document is ever written outside `data/`, the gitignored tree.
    // The previous version of this compared `dataRoot` with its own grandparent — true for any
    // two-deep path, and it inspected no generated file at all. This looks at what really appeared
    // under the harness root while the suite ran.
    const dataDir = path.join(harnessRoot, "data");
    // Other suites' scratch directories are excluded, so this is about what *this* suite wrote.
    // Jest runs them in parallel, so without this the diff picks up their files too — which would
    // let the count below pass on somebody else's work.
    const mine = (file: string) =>
      !file.startsWith(testRunsRoot + path.sep) || file.startsWith(dataRoot + path.sep);
    const appeared = listFilesUnder(harnessRoot)
      .filter((file) => !filesBefore.has(file))
      .filter(mine);
    // This suite has run a full import, represent, render, run and report by now, so plenty did.
    expect(appeared.length).toBeGreaterThan(documentIds().length);
    for (const file of appeared) {
      expect({ file, inside: isContainedBy(file, dataDir) }).toEqual({ file, inside: true });
    }
  });
});

describe("a per-tile render, and the sets a run can send from it", () => {
  const dataRoot = makeTestDataRoot("per-tile");
  const paths = corpusPaths(dataRoot, "tile-corpus");
  const output: string[] = [];
  /** Two top-level tiles per document: one the classification calls visual, one it does not. */
  const tiles = [
    { tileId: "text-tile", widthPx: 300, heightPx: 200 },
    { tileId: "drawing-tile", widthPx: 400, heightPx: 260 }
  ];

  const fakeBrowser = () => ({
    newPage: async () => ({
      setViewport: async () => undefined,
      screenshot: async () => makeTestPng(40, 40),
      goto: async () => undefined,
      evaluate: async () => undefined as never,
      waitForFunction: async () => true,
      $: async () => ({
        boundingBox: async () => ({ x: 0, y: 0, width: 960, height: 1420 }),
        screenshot: async () => makeTestPng(960, 1420)
      }),
      frames: () => [{
        url: () => "http://localhost:8080/iframe.html?unit=harness-render&unwrapped&readOnly",
        $$: async () => tiles.map((tile) => ({
          boundingBox: async () => ({ x: 0, y: 0, width: tile.widthPx, height: tile.heightPx }),
          screenshot: async () => makeTestPng(tile.widthPx, tile.heightPx)
        })),
        evaluate: async (script: unknown) => (String(script).includes("data-tool-id")
          ? tiles.map((tile) => tile.tileId)
          : {
            contentHeightPx: 1420, contentRowsHeightPx: 1340, totalTiles: 99, unknownTiles: 0,
            fontsReady: true, documentText: "marker"
          }) as never
      }],
      on: () => undefined,
      close: async () => undefined
    }),
    close: async () => undefined
  });

  const deps = {
    dataRoot,
    log: (message: string) => output.push(message),
    now: () => new Date("2026-08-13T00:00:00.000Z"),
    renderConcurrency: 1,
    renderModeOptions: {
      clueRevision: "tile-revision",
      launch: async () => fakeBrowser() as never,
      stableForMs: 0,
      pollIntervalMs: 1
    },
    startUnitServer: async () => ({
      unitUrl: "http://127.0.0.1:5000/harness-render/content.json",
      close: async () => undefined
    })
  };

  it("writes one image per tile, each tagged with the tile it is a picture of", async () => {
    await main(["import", "--from", "examples/synthetic-corpus", "--corpus", "tile-corpus"], deps);
    await main(["represent", "--corpus", "tile-corpus", "--variants", "default"], deps);
    output.length = 0;
    await main(["render", "--corpus", "tile-corpus", "--mode", "puppeteer-per-tile"], deps);
    expect(output.join("\n")).toMatch(/Rendered \d+ document\(s\) with --mode puppeteer-per-tile/);

    const envelope = readImageEnvelope(imageRepresentationPath(paths, "puppeteer-per-tile", "drawing"));
    expect(envelope.images).toHaveLength(2);
    expect(envelope.images.map((image) => image.tileId)).toEqual(["text-tile", "drawing-tile"]);
    for (const image of envelope.images) expect(image.purpose).toBe("tile");
    // Its own capture mode, so a freshness check can tell the two renders apart.
    expect(envelope.renderTarget.captureMode).toBe("per-tile");
    // The full-document render is filed separately and is unaffected.
    expect(fs.existsSync(imageRepresentationPath(paths, "puppeteer-full-height", "drawing"))).toBe(false);
  });

  it("sends every tile for a per-tile run, and prices each one separately", async () => {
    const experiment = path.join(dataRoot, "per-tile.json");
    fs.writeFileSync(experiment, JSON.stringify({
      schemaVersion: 1,
      name: "per-tile-set",
      runs: [{
        id: "tiles", message: "image-only", imageMode: "puppeteer-per-tile",
        imageSet: "per-tile", prompt: "categorize-design-default"
      }]
    }, null, 2));
    output.length = 0;
    await main(["plan", "--corpus", "tile-corpus", "--experiment", experiment], deps);
    const printed = output.join("\n");
    // Two images per call is the thing to see before paying for it: each carries the base charge.
    expect(printed).toMatch(/\d+ image\(s\) across \d+ call\(s\) \(2\.0 per document, imageSet per-tile\)/);
    expect(printed).toMatch(/image tokens \(estimated, auto priced at the high rate\): \d+/);
  });

  it("refuses a full-document run against a per-tile render, naming the fix", async () => {
    const experiment = path.join(dataRoot, "full.json");
    fs.writeFileSync(experiment, JSON.stringify({
      schemaVersion: 1,
      name: "wrong-set",
      runs: [{
        id: "full", message: "image-only", imageMode: "puppeteer-per-tile",
        prompt: "categorize-design-default"
      }]
    }, null, 2));
    await expect(main(["plan", "--corpus", "tile-corpus", "--experiment", experiment], deps))
      .rejects.toThrow(/records 0 full-document image\(s\)[\s\S]*set imageSet on the run/);
  });
});
