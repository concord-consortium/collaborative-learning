import fs from "node:fs";
import path from "node:path";
import { main } from "../harness.js";
import { buildImageMessages, defaultAiPrompt } from "../../../shared/ai-analysis-messages.js";
import { corpusPaths } from "../src/corpus.js";
import {
  dataUrlFor, imageRepresentationPath, readImageEnvelope, resolveImageFile, sha256Bytes
} from "../src/represent-image.js";
import { CompletionRequest, CompletionResult } from "../src/execute.js";
import { ReportSummary } from "../src/report.js";
import { ResultRow } from "../src/schemas.js";
import { makeTestDataRoot, makeTestPng, readLines } from "./helpers.js";

/**
 * The mocked end-to-end path extended through an `image-only` run, with no browser and no network. The render backend is a fake that hands back a committed-shape PNG, so
 * what is exercised is the wiring — envelope, freshness, request construction, cost, rows, report —
 * rather than the rendering, which criterion 7's local integration step covers.
 */
describe("end-to-end image-only run against the synthetic corpus", () => {
  const dataRoot = makeTestDataRoot("smoke-image");
  const output: string[] = [];
  const requests: { messages: any; imageTokens: number }[] = [];
  const paths = corpusPaths(dataRoot, "image-corpus");
  const resultsFile = path.join(dataRoot, "results", "image-corpus__image-vs-text.jsonl");

  // Distinct sizes per document, so an envelope pointing at another document's PNG shows up as the
  // wrong dimensions. The queue is consumed one capture at a time — reading the *last* queued id
  // gave every document the same size and made this safeguard inert. Renders here are sequential
  // (renderConcurrency: 1), so the order is the manifest's.
  const pngFor = (docId: string) => makeTestPng(960, 1000 + (docId.length % 7) * 60);
  const pendingDocs: string[] = [];
  let lastRenderedDoc = "";

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
        evaluate: async () => ({
          // High enough for any fixture in the committed corpus — see render-command.test.ts.
          // Without `contentRowsHeightPx` the backend compares against `undefined`, skips the
          // resize, and skips the guard that keeps `captureMode: "full-document"` honest.
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
    // No unit server: the recorded unit is the stable identifier either way.
    startUnitServer: undefined,
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
  });

  it("renders an envelope and a PNG per document", async () => {
    output.length = 0;
    // The fake page needs to know which document it is drawing; render is sequential here.
    const documents = JSON.parse(fs.readFileSync(paths.manifest, "utf8")).documents as { id: string }[];
    pendingDocs.length = 0;
    for (const document of documents) pendingDocs.push(document.id);
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
    expect(output.join("\n")).toMatch(/Rendered 25 document\(s\)/);

    // Each document's envelope records the size its *own* capture produced — so an envelope holding
    // another document's picture would fail here rather than passing unnoticed.
    for (const docId of ["drawing", "text", "empty"]) {
      const each = readImageEnvelope(imageRepresentationPath(paths, "puppeteer-full-height", docId));
      expect({ docId, heightPx: each.images[0].heightPx })
        .toEqual({ docId, heightPx: 1000 + (docId.length % 7) * 60 });
    }
    // And the fixture sizes really do differ, or the check above would prove nothing.
    expect(new Set(["drawing", "text", "empty"].map((id) => 1000 + (id.length % 7) * 60)).size)
      .toBeGreaterThan(1);
  });

  it("reuses fresh renders instead of paying to make them again", async () => {
    output.length = 0;
    await main(["render", "--corpus", "image-corpus", "--mode", "puppeteer-full-height"], deps);
    expect(output.join("\n")).toMatch(/Rendered 0 document\(s\).*reused 25 still-fresh/s);
  });

  it("re-renders everything when --refresh is passed", async () => {
    output.length = 0;
    await main(["render", "--corpus", "image-corpus", "--mode", "puppeteer-full-height", "--refresh"], deps);
    expect(output.join("\n")).toMatch(/Rendered 25 document\(s\)/);
    // New pixels mean new request keys, which means a full re-spend. Said out loud.
    expect(output.join("\n")).toContain("will pay for those calls again");
  });

  it("re-renders when the document content changes", async () => {
    const manifestFile = paths.manifest;
    const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    const entry = manifest.documents.find((document: any) => document.id === "drawing");
    const original = entry.contentSha256;
    entry.contentSha256 = "9".repeat(64);
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
    output.length = 0;
    await main(["render", "--corpus", "image-corpus", "--mode", "puppeteer-full-height"], deps);
    expect(output.join("\n")).toMatch(/Rendered 1 document\(s\).*reused 24 still-fresh/s);
    entry.contentSha256 = original;
    fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
    await main(["render", "--corpus", "image-corpus", "--mode", "puppeteer-full-height"], deps);
  });

  it("plans an image run with image-token estimates and no network", async () => {
    output.length = 0;
    await main(["plan", "--corpus", "image-corpus", "--experiment", "experiments/image-vs-text.json"], deps);
    const printed = output.join("\n");
    expect(printed).toContain("3 run(s) × 25 document(s) = 75 call(s)");
    expect(printed).toContain("[image-only, --mode puppeteer-full-height");
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
    expect(rows).toHaveLength(75);

    const imageRows = rows.filter((row) => row.message === "image-only");
    expect(imageRows).toHaveLength(25);
    for (const row of imageRows) {
      expect(row.representation.kind).toBe("image");
      if (row.representation.kind === "image") {
        expect(row.representation.modeId).toBe("puppeteer-full-height");
        expect(row.representation.imageSha256s).toHaveLength(1);
        expect(row.representation.renderTarget.clueRevision).toBe("smoke-revision");
      }
      expect(row.promptImageTokensEstimated).toBeGreaterThan(10_000);
    }
    // A text row has a text descriptor and no image estimate at all.
    const textRow = rows.find((row) => row.runId === "text-default")!;
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

  it("reports image-only and text-only side by side rather than summed", async () => {
    output.length = 0;
    await main(["report", "--results", resultsFile], deps);
    const table = output[0];
    expect(table).toContain("image-puppeteer");
    expect(table).toContain("img tok est");

    const summary = JSON.parse(
      fs.readFileSync(path.join(dataRoot, "results", "image-corpus__image-vs-text.summary.json"), "utf8")) as ReportSummary;
    const imageAll = summary.groups.find((group) =>
      group.runId === "(all runs)" && group.message === "image-only" && group.modality === "all")!;
    const textAll = summary.groups.find((group) =>
      group.runId === "(all runs)" && group.message === "text-only" && group.modality === "all")!;
    expect(imageAll.docs).toBe(25);
    expect(textAll.docs).toBe(25);
    // The whole point of splitting by shape: the two totals are separate numbers.
    expect(imageAll.tokens.imageEstimatedTotal).toBeGreaterThan(0);
    expect(textAll.tokens.imageEstimatedTotal).toBe(0);
    expect(imageAll.tokens.promptTotal).not.toBe(textAll.tokens.promptTotal);
  });

  it("refuses an envelope with two images, naming milestone 3", async () => {
    // A genuine second image — real file, real hash, real byte count — so the envelope is entirely
    // valid and the only thing wrong with it is that milestone 2 does not know which one to send.
    // The first is never silently selected.
    const file = imageRepresentationPath(paths, "puppeteer-full-height", "drawing");
    const envelope = readImageEnvelope(file);
    const second = makeTestPng(480, 500);
    fs.writeFileSync(path.join(path.dirname(file), "drawing-2.png"), second);
    fs.writeFileSync(file, JSON.stringify({
      ...envelope,
      images: [envelope.images[0], {
        ...envelope.images[0],
        file: "drawing-2.png",
        sha256: sha256Bytes(second),
        bytes: second.length,
        widthPx: 480,
        heightPx: 500,
        purpose: "tile",
        tileId: "tile-1"
      }]
    }, null, 2));
    await expect(main(["plan", "--corpus", "image-corpus", "--experiment",
      "experiments/image-vs-text.json"], deps)).rejects.toThrow(/records 2 images[\s\S]*milestone 3/);
    fs.writeFileSync(file, JSON.stringify(envelope, null, 2));
    fs.rmSync(path.join(path.dirname(file), "drawing-2.png"));
  });

  it("refuses an envelope with no images at all", async () => {
    // Zero images is a damaged envelope rather than a milestone-3 feature, so it is reported as one
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
    expect(path.relative(path.join(dataRoot, "..", ".."), dataRoot).startsWith("..")).toBe(false);
  });
});
