import fs from "node:fs";
import path from "node:path";
import { main } from "../harness.js";
import { corpusPaths, harnessRoot, importCorpus } from "../src/corpus.js";
import {
  imageRepresentationPath, readImageEnvelope, renderErrorDir, resolveImageFile
} from "../src/represent-image.js";
import { readPngInfo } from "../src/png.js";
import { makeTestDataRoot, makeTestPng } from "./helpers.js";

/**
 * A browser whose pages fail for the documents named in `failFor`.
 *
 * The frame this fake reports is taller than the 500px the generated page starts at, so every
 * render here goes through the resize the backend does for a real document — and the element's box
 * follows the height the backend set, the way a real one does. A fake that reported no
 * `contentRowsHeightPx` skipped the resize and the clipped-capture guard entirely, because both
 * compare against it and every comparison with `undefined` is false.
 */
function browserThatFails(failFor: Set<string>, order: string[], contentRowsHeightPx = 900) {
  let index = 0;
  /** Every height the backend asked the frame to take, newest last. */
  const frameHeights: number[] = [];
  return {
    frameHeights,
    newPage: async () => {
      const docId = order[index++];
      return {
        setViewport: async () => undefined,
        screenshot: async () => makeTestPng(40, 40),
        goto: async () => undefined,
        evaluate: async (script: unknown) => {
          const match = /frame\.height = (\d+)/.exec(String(script));
          if (match) frameHeights.push(Number(match[1]));
          return undefined as never;
        },
        waitForFunction: async () => {
          if (failFor.has(docId)) throw new Error("Waiting failed: 30000ms exceeded");
          return true;
        },
        $: async () => ({
          boundingBox: async () => ({
            x: 0, y: 0, width: 960, height: frameHeights.at(-1) ?? 500
          }),
          screenshot: async () => makeTestPng(960, frameHeights.at(-1) ?? 500)
        }),
        frames: () => [{
          url: () => "http://localhost:8080/iframe.html?unwrapped&readOnly",
          evaluate: async () => ({
            // High enough to satisfy any fixture's expected tile count; this fake renders every document
            // in the committed corpus, and a count below the document's own would never settle.
            contentHeightPx: 1000, contentRowsHeightPx, totalTiles: 99, unknownTiles: 0,
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
  // The corpus size comes from the manifest, so adding a fixture does not break counts in here.
  return { dataRoot, paths, order: documents.map((entry) => entry.id), corpusSize: documents.length };
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
    const { dataRoot, paths, order, corpusSize } = setUp("render-failures");
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
    expect(output.join("\n"))
      .toMatch(new RegExp(`Rendered ${corpusSize - 2} document\\(s\\).*2 failed`, "s"));
  });

  it("reuses the fresh renders and re-renders only what failed", async () => {
    const { dataRoot, paths, order, corpusSize } = setUp("render-retry");
    const output: string[] = [];
    await expect(main(["render", "--corpus", "render-corpus", "--mode", "puppeteer-full-height"],
      deps(dataRoot, browserThatFails(new Set(["drawing"]), order), output))).rejects.toThrow();

    // The second run reuses the 24 that worked and only re-attempts the one that did not.
    output.length = 0;
    const stillFailing = order.filter((docId) => docId === "drawing");
    // A taller document than the default fake reports, to show the frame is sized to the tiles
    // rather than left at the 500px the page starts at.
    const browser = browserThatFails(new Set(), stillFailing, 2000);
    await main(["render", "--corpus", "render-corpus", "--mode", "puppeteer-full-height"],
      deps(dataRoot, browser, output));
    expect(output.join("\n")).toMatch(
      new RegExp(`Rendered 1 document\\(s\\).*reused ${corpusSize - 1} still-fresh.*0 failed`, "s"));
    // 2000px of tiles plus the document's own chrome, so the capture covers the whole document.
    expect(Math.max(...browser.frameHeights)).toBeGreaterThanOrEqual(2000);
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

describe("evidence from a previous attempt is not reused", () => {
  it("clears the directory before writing this failure's evidence", async () => {
    const { dataRoot, paths, order } = setUp("render-stale-evidence");
    const output: string[] = [];
    const directory = renderErrorDir(paths, "puppeteer-full-height", order[0]);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "screenshot.png"), "an older attempt's picture");
    fs.writeFileSync(path.join(directory, "stale.txt"), "left over");

    await expect(main(["render", "--corpus", "render-corpus", "--mode", "puppeteer-full-height"],
      deps(dataRoot, browserThatFails(new Set([order[0]]), order), output)))
      .rejects.toThrow(/failed to render/);

    // The stale file is gone, and the screenshot is this attempt's rather than the old text.
    expect(fs.existsSync(path.join(directory, "stale.txt"))).toBe(false);
    expect(fs.readFileSync(path.join(directory, "screenshot.png"), "utf8"))
      .not.toContain("an older attempt");
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

  it("says when a mode cannot report what it drew, against a unit that is not the harness's", async () => {
    // A hosted service renders somewhere else, so `unknownTiles` is null and the unknown-tile
    // warning below can never fire. Rendering the corpus against `mods` therefore produced valid
    // PNGs of "Unknown" placeholders with nothing saying so.
    const dataRoot = makeTestDataRoot("render-unobserved");
    const output: string[] = [];
    // An empty corpus, so the warning is all this exercises: the Shutterbug modes post to a real
    // service, and there is nothing to render here.
    const empty = path.join(dataRoot, "no-documents");
    fs.mkdirSync(empty, { recursive: true });
    await main(["import", "--from", empty, "--corpus", "empty-corpus"],
      { dataRoot, log: (message: string) => output.push(message) });
    output.length = 0;
    await main(["render", "--corpus", "empty-corpus", "--mode", "shutterbug-parameterized"],
      deps(dataRoot, null, output));
    expect(output.join("\n"))
      .toMatch(/renders against unit "mods" and cannot report what it drew/);
    // The local mode renders against the harness's own unit and can see inside the page, so it says
    // nothing of the sort.
    output.length = 0;
    await main(["render", "--corpus", "empty-corpus", "--mode", "puppeteer-full-height"],
      deps(dataRoot, null, output));
    expect(output.join("\n")).not.toMatch(/cannot report what it drew/);
  });

  it("logs a failure to close the backend rather than letting it replace the real error", async () => {
    // Thrown from a `finally`, a close failure replaces whatever was already in flight — so a
    // browser that failed to launch surfaced as "close failed", which says nothing about why the
    // render did not happen.
    const { dataRoot, order, corpusSize } = setUp("render-close-failure");
    const output: string[] = [];
    const browser = browserThatFails(new Set(), order);
    (browser as any).close = async () => { throw new Error("Chromium is gone"); };
    await main(["render", "--corpus", "render-corpus", "--mode", "puppeteer-full-height"],
      deps(dataRoot, browser, output));
    expect(output.join("\n")).toMatch(/closing the render backend failed: Chromium is gone/);
    // And the run itself still reported what it did.
    expect(output.join("\n")).toMatch(new RegExp(`Rendered ${corpusSize} document\\(s\\)`));
  });

  it("rejects an unknown mode", async () => {
    const { dataRoot } = setUp("render-bad-mode");
    await expect(main(["render", "--corpus", "render-corpus", "--mode", "screenshot"],
      deps(dataRoot, null, []))).rejects.toThrow(/Unknown render mode "screenshot"/);
  });

  it("warns when the CLUE revision behind the target cannot be established", async () => {
    const { dataRoot, order } = setUp("render-no-revision");
    const output: string[] = [];
    // One base, spread over. Building `deps` three times put two throwaway browsers and two
    // throwaway loggers into play, all pushing into the same `output`.
    const base = deps(dataRoot, browserThatFails(new Set(), order), output);
    await main(["render", "--corpus", "render-corpus", "--mode", "puppeteer-full-height"], {
      ...base,
      // Spread, not replaced: dropping the fast poll timings made this sit through the real settle
      // loop for every document in the corpus.
      renderModeOptions: { ...base.renderModeOptions, clueRevision: null }
    });
    expect(output.join("\n")).toMatch(/CLUE revision behind .* could not be established/);
  });
});
