import fs from "node:fs";
import path from "node:path";
import { main } from "../harness.js";
import { corpusPaths, importCorpus } from "../src/corpus.js";
import {
  imageRepresentationPath, readImageEnvelope, renderErrorDir, resolveImageFile
} from "../src/represent-image.js";
import { harnessRoot } from "../src/corpus.js";
import { readPngInfo } from "../src/png.js";
import { makeTestDataRoot, makeTestPng } from "./helpers.js";

/** A browser whose pages fail for the documents named in `failFor`. */
function browserThatFails(failFor: Set<string>, order: string[]) {
  let index = 0;
  return {
    newPage: async () => {
      const docId = order[index++];
      return {
        setViewport: async () => undefined,
        screenshot: async () => makeTestPng(40, 40),
        goto: async () => undefined,
        evaluate: async () => 1000 as never,
        waitForFunction: async () => {
          if (failFor.has(docId)) throw new Error("Waiting failed: 30000ms exceeded");
          return true;
        },
        $: async () => ({
          boundingBox: async () => ({ x: 0, y: 0, width: 960, height: 1000 }),
          screenshot: async () => makeTestPng(960, 1000)
        }),
        frames: () => [{
          url: () => "http://localhost:8080/iframe.html?unwrapped&readOnly",
          evaluate: async () => ({
            // High enough to satisfy any fixture's expected tile count; this fake renders every document
            // in the committed corpus, and a count below the document's own would never settle.
            contentHeightPx: 1000, totalTiles: 99, unknownTiles: 0,
            fontsReady: true, documentText: "x"
          }) as never
        }],
        on: () => undefined,
        close: async () => undefined
      };
    },
    close: async () => undefined
  };
}

function setUp(name: string) {
  const dataRoot = makeTestDataRoot(name);
  const paths = corpusPaths(dataRoot, "render-corpus");
  importCorpus({
    from: path.join(harnessRoot, "examples", "synthetic-corpus"),
    corpus: "render-corpus",
    source: "synthetic",
    prune: false,
    dataRoot,
    now: () => new Date("2026-08-13T00:00:00.000Z")
  });
  const documents = JSON.parse(fs.readFileSync(paths.manifest, "utf8")).documents as { id: string }[];
  return { dataRoot, paths, order: documents.map((document) => document.id) };
}

function deps(dataRoot: string, browser: unknown, output: string[]) {
  return {
    dataRoot,
    log: (message: string) => output.push(message),
    now: () => new Date("2026-08-13T00:00:00.000Z"),
    renderConcurrency: 1,
    renderModeOptions: {
      clueRevision: "test-revision", launch: async () => browser as never,
      stableForMs: 0, pollIntervalMs: 1
    }
  };
}

describe("a document that fails to render", () => {
  it("writes no envelope, keeps the evidence, finishes the rest, and exits non-zero", async () => {
    const { dataRoot, paths, order } = setUp("render-failures");
    const output: string[] = [];
    const failing = new Set(["drawing", "geometry"]);

    // A render failure is a bug to look at, not a transient — there is no retry, and the other
    // documents still get rendered.
    await expect(main(["render", "--corpus", "render-corpus", "--mode", "puppeteer-full-height"],
      deps(dataRoot, browserThatFails(failing, order), output)))
      .rejects.toThrow(/2 document\(s\) failed to render: drawing, geometry/);

    for (const docId of failing) {
      expect(fs.existsSync(imageRepresentationPath(paths, "puppeteer-full-height", docId))).toBe(false);
      const directory = renderErrorDir(paths, "puppeteer-full-height", docId);
      expect(fs.existsSync(path.join(directory, "error.txt"))).toBe(true);
      // The picture of the failure — often the only evidence for a visual failure, where the
      // console is empty and the page is half drawn.
      expect(fs.existsSync(path.join(directory, "screenshot.png"))).toBe(true);
      expect(readPngInfo(fs.readFileSync(path.join(directory, "screenshot.png")), "evidence").widthPx)
        .toBeGreaterThan(0);
      // The failure names the document, the URL it was rendering and the last height it saw.
      expect(fs.readFileSync(path.join(directory, "error.txt"), "utf8"))
        .toMatch(new RegExp(`RenderFailed: ${docId}: .*rendering http://localhost:8080/iframe\\.html`));
    }
    // Everything else came through.
    expect(fs.existsSync(imageRepresentationPath(paths, "puppeteer-full-height", "text"))).toBe(true);
    expect(output.join("\n")).toMatch(/Rendered 23 document\(s\).*2 failed/s);
  });

  it("retries nothing on a rerun but does re-attempt the failures", async () => {
    const { dataRoot, paths, order } = setUp("render-retry");
    const output: string[] = [];
    await expect(main(["render", "--corpus", "render-corpus", "--mode", "puppeteer-full-height"],
      deps(dataRoot, browserThatFails(new Set(["drawing"]), order), output))).rejects.toThrow();

    // The second run reuses the 24 that worked and only re-attempts the one that did not.
    output.length = 0;
    const stillFailing = order.filter((docId) => docId === "drawing");
    await main(["render", "--corpus", "render-corpus", "--mode", "puppeteer-full-height"],
      deps(dataRoot, browserThatFails(new Set(), stillFailing), output));
    expect(output.join("\n")).toMatch(/Rendered 1 document\(s\).*reused 24 still-fresh.*0 failed/s);
    expect(fs.existsSync(imageRepresentationPath(paths, "puppeteer-full-height", "drawing"))).toBe(true);
    // The document renders now, so last run's evidence is gone — including a PNG of student work
    // that no envelope would refer to.
    expect(fs.existsSync(renderErrorDir(paths, "puppeteer-full-height", "drawing"))).toBe(false);
  });
});

describe("a failure that is not a RenderFailed still leaves evidence", () => {
  it("writes the console output and a screenshot for a navigation error", async () => {
    // These used to arrive with neither: the CLI only wrote them for RenderFailed, and a raw
    // puppeteer error carried no context at all.
    const { dataRoot, paths, order } = setUp("render-nav-failure");
    const output: string[] = [];
    const browser = browserThatFails(new Set(), order);
    const original = browser.newPage;
    browser.newPage = async () => {
      const page = await original();
      (page as any).goto = async () => { throw new Error("net::ERR_CONNECTION_REFUSED"); };
      return page;
    };
    await expect(main(["render", "--corpus", "render-corpus", "--mode", "puppeteer-full-height"],
      deps(dataRoot, browser, output))).rejects.toThrow(/failed to render/);
    const directory = renderErrorDir(paths, "puppeteer-full-height", order[0]);
    expect(fs.readFileSync(path.join(directory, "error.txt"), "utf8")).toContain("ERR_CONNECTION_REFUSED");
    expect(fs.existsSync(path.join(directory, "screenshot.png"))).toBe(true);
    expect(fs.existsSync(path.join(directory, "console.txt"))).toBe(true);
  });
});

describe("--prune removes a document's pictures too", () => {
  it("deletes image envelopes, their PNGs and any render errors", async () => {
    const { dataRoot, paths, order } = setUp("render-prune");
    const output: string[] = [];
    await expect(main(["render", "--corpus", "render-corpus", "--mode", "puppeteer-full-height"],
      deps(dataRoot, browserThatFails(new Set(["geometry"]), order), output))).rejects.toThrow();

    const file = imageRepresentationPath(paths, "puppeteer-full-height", "text");
    const png = resolveImageFile(file, readImageEnvelope(file).images[0]);
    expect(fs.existsSync(png)).toBe(true);
    const errors = renderErrorDir(paths, "puppeteer-full-height", "geometry");
    expect(fs.existsSync(errors)).toBe(true);

    // Import from a directory holding only one document, with --prune: everything else goes.
    const trimmed = path.join(dataRoot, "one-document");
    fs.mkdirSync(trimmed, { recursive: true });
    fs.copyFileSync(path.join(harnessRoot, "examples", "synthetic-corpus", "documents", "empty.json"),
      path.join(trimmed, "empty.json"));
    await main(["import", "--from", trimmed, "--corpus", "render-corpus", "--prune"],
      { dataRoot, log: (message: string) => output.push(message) });

    // Once a manifest entry is gone the picture of that student's document must not linger.
    expect(fs.existsSync(file)).toBe(false);
    expect(fs.existsSync(png)).toBe(false);
    expect(fs.existsSync(errors)).toBe(false);
  });
});

describe("render refuses what it cannot do", () => {
  it("rejects a capture height that is not a positive whole number", async () => {
    const { dataRoot } = setUp("render-bad-height");
    await expect(main(["render", "--corpus", "render-corpus", "--mode", "shutterbug-parameterized",
      "--capture-height", "-5"], deps(dataRoot, null, [])))
      .rejects.toThrow(/--capture-height must be a positive whole number/);
  });

  it("rejects an unknown mode", async () => {
    const { dataRoot } = setUp("render-bad-mode");
    await expect(main(["render", "--corpus", "render-corpus", "--mode", "screenshot"],
      deps(dataRoot, null, []))).rejects.toThrow(/Unknown render mode "screenshot"/);
  });

  it("warns when the CLUE revision behind the target cannot be established", async () => {
    const { dataRoot, order } = setUp("render-no-revision");
    const output: string[] = [];
    await main(["render", "--corpus", "render-corpus", "--mode", "puppeteer-full-height"], {
      ...deps(dataRoot, browserThatFails(new Set(), order), output),
      // Spread, not replaced: dropping the fast poll timings made this sit through the real settle
      // loop for all 25 documents.
      renderModeOptions: {
        ...deps(dataRoot, browserThatFails(new Set(), order), output).renderModeOptions,
        clueRevision: null,
        launch: async () => browserThatFails(new Set(), order) as never
      }
    });
    expect(output.join("\n")).toMatch(/CLUE revision behind .* could not be established/);
  });
});
