import fs from "node:fs";
import path from "node:path";
import { main } from "../harness.js";
import { corpusPaths, harnessRoot, importCorpus } from "../src/corpus.js";
import {
  imageRepresentationPath, readImageEnvelope, renderErrorDir, resolveImageFile
} from "../src/represent-image.js";
import { readPngInfo } from "../src/png.js";
import { makeTestDataRoot, makeTestPng } from "./helpers.js";

/** A response body that streams, the way `fetch` delivers one. */
const bodyOf = (bytes: Buffer) => ({
  async *[Symbol.asyncIterator]() { yield bytes; }
});

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
          // Two top-level tiles, so the per-tile mode has something to photograph. The
          // full-document mode never asks.
          $$: async () => [
            { boundingBox: async () => ({ x: 0, y: 0, width: 300, height: 200 }),
              screenshot: async () => makeTestPng(300, 200) },
            { boundingBox: async () => ({ x: 0, y: 0, width: 400, height: 260 }),
              screenshot: async () => makeTestPng(400, 260) }
          ],
          evaluate: async (script: unknown) => (String(script).includes("data-tool-id")
            ? ["tile-one", "tile-two"]
            : {
              // High enough to satisfy any fixture's expected tile count; this fake renders every
              // document in the committed corpus, and a count below the document's own would never
              // settle.
              documentFailedToLoad: false,
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
    // nothing of the sort. It gets a working fake browser even though there is nothing to render,
    // because `open()` launches one up front and a `null` would then fail to close.
    output.length = 0;
    await main(["render", "--corpus", "empty-corpus", "--mode", "puppeteer-full-height"],
      deps(dataRoot, browserThatFails(new Set(), []), output));
    expect(output.join("\n")).not.toMatch(/cannot report what it drew/);
  });

  it("reports a close failure without letting it replace the real error", async () => {
    // Thrown from a `finally`, a close failure replaces whatever was already in flight — so a
    // browser that failed to launch surfaced as "close failed", which says nothing about why the
    // render did not happen. It is still a failure of the command, though: exiting 0 would say the
    // run finished, with a browser that would not close possibly still running.
    const { dataRoot, order, corpusSize } = setUp("render-close-failure");
    const output: string[] = [];
    const browser = browserThatFails(new Set(), order);
    (browser as any).close = async () => { throw new Error("Chromium is gone"); };
    await expect(main(["render", "--corpus", "render-corpus", "--mode", "puppeteer-full-height"],
      deps(dataRoot, browser, output)))
      .rejects.toThrow(/shutting down afterwards failed: Chromium is gone/);
    expect(output.join("\n")).toMatch(/closing the render backend failed: Chromium is gone/);
    // And the run itself still reported what it did, so the summary is not lost to the throw.
    expect(output.join("\n")).toMatch(new RegExp(`Rendered ${corpusSize} document\\(s\\)`));
  });

  it("lets the render failures win when the close fails too", async () => {
    // Both went wrong, and the documents that would not render are the more useful thing to be told.
    const { dataRoot, order } = setUp("render-close-and-render-failure");
    const output: string[] = [];
    const browser = browserThatFails(new Set(["drawing"]), order);
    (browser as any).close = async () => { throw new Error("Chromium is gone"); };
    await expect(main(["render", "--corpus", "render-corpus", "--mode", "puppeteer-full-height"],
      deps(dataRoot, browser, output)))
      .rejects.toThrow(/1 document\(s\) failed to render: drawing/);
    expect(output.join("\n")).toMatch(/closing the render backend failed: Chromium is gone/);
  });

  it("does not let a failing unit server close replace the error already in flight", async () => {
    // The unit server comes down after the backend and used to do so unguarded, which is the same
    // masking the backend's own close is wrapped to avoid.
    const { dataRoot, order } = setUp("render-unit-close-failure");
    const output: string[] = [];
    const browser = browserThatFails(new Set(["drawing"]), order);
    await expect(main(["render", "--corpus", "render-corpus", "--mode", "puppeteer-full-height"], {
      ...deps(dataRoot, browser, output),
      startUnitServer: async () => ({
        unitUrl: "http://127.0.0.1:9/content.json",
        close: async () => { throw new Error("the unit server would not stop"); }
      })
    })).rejects.toThrow(/1 document\(s\) failed to render: drawing/);
    expect(output.join("\n")).toMatch(/closing the unit server failed: the unit server would not stop/);
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

describe("a mode whose height is measured needs a local render to measure from", () => {
  it("refuses the whole corpus up front, naming the documents and the fix", async () => {
    // Checked before anything is posted: failing document by document would leave a half-rendered
    // corpus and a bill for the part that worked.
    const { dataRoot } = setUp("accurate-height-missing");
    const output: string[] = [];
    await expect(main(["render", "--corpus", "render-corpus", "--mode", "shutterbug-accurate-height"],
      deps(dataRoot, null, output)))
      .rejects.toThrow(/captures each document at its own measured height/);
    await expect(main(["render", "--corpus", "render-corpus", "--mode", "shutterbug-accurate-height"],
      deps(dataRoot, null, output)))
      .rejects.toThrow(/have no usable puppeteer-full-height render/);
    await expect(main(["render", "--corpus", "render-corpus", "--mode", "shutterbug-accurate-height"],
      deps(dataRoot, null, output)))
      .rejects.toThrow(/Render locally first: harness\.ts render --corpus <name> --mode puppeteer-full-height/);
    // Nothing was posted, so nothing was written.
    expect(output.join("\n")).not.toMatch(/Rendered \d+ document/);
  });

  it("does not demand a height for a document that is expected not to render", async () => {
    // The fixture that cannot render has no local render to measure, and never will, so requiring
    // one refused every corpus that contains one — which the committed example corpus does. It is
    // skipped rather than captured, because an absent height reaches the backend as the fixed
    // production height and would be filed as a capture at the document's own measured one.
    const { dataRoot, paths, order } = setUp("accurate-height-expected-failure");
    const output: string[] = [];
    await main(["render", "--corpus", "render-corpus", "--mode", "puppeteer-full-height"],
      deps(dataRoot, browserThatFails(new Set(), order, 900), output));
    // Drop the local render for `error-test`, which is what a real run has: it never rendered.
    const marked = "error-test";
    fs.rmSync(imageRepresentationPath(paths, "puppeteer-full-height", marked), { force: true });
    const manifestFile = path.join(paths.root, "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
    expect(manifest.documents.find((entry: { id: string }) => entry.id === marked).expectedRenderFailure)
      .toEqual(expect.any(String));

    // A fake Shutterbug, so the whole command runs without a network. The posted body carries the
    // document, so the marker in `error-test` says whether it was sent.
    const png = makeTestPng(960, 980);
    const posted: string[] = [];
    const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
      if (init?.method === "POST") {
        posted.push(String(JSON.parse(String(init.body)).content));
        return {
          ok: true, status: 200, statusText: "OK",
          body: bodyOf(Buffer.from(JSON.stringify({ url: "https://images.test/shot.png" })))
        } as unknown as Response;
      }
      return {
        ok: true, status: 200, statusText: "OK", url: "https://images.test/shot.png",
        headers: new Headers({ "content-type": "image/png" }), body: bodyOf(png)
      } as unknown as Response;
    };

    output.length = 0;
    await main(["render", "--corpus", "render-corpus", "--mode", "shutterbug-accurate-height"], {
      ...deps(dataRoot, null, output),
      renderConcurrency: 1,
      renderModeOptions: { clueRevision: "test-revision", fetchImpl }
    });

    // The corpus rendered rather than being refused whole, and the marked document was not posted.
    expect(output.join("\n")).toMatch(new RegExp(`skipped ${marked}: it is expected not to render`));
    expect(output.join("\n")).toMatch(/Rendered \d+ document\(s\)/);
    expect(posted).toHaveLength(order.length - 1);
    expect(posted.some((body) => body.includes("ErrorTest"))).toBe(false);
    expect(fs.existsSync(imageRepresentationPath(paths, "shutterbug-accurate-height", marked))).toBe(false);
  });

  it("posts each document at the height its own local render measured", async () => {
    const { dataRoot, paths, order } = setUp("accurate-height-present");
    const output: string[] = [];
    await main(["render", "--corpus", "render-corpus", "--mode", "puppeteer-full-height"],
      deps(dataRoot, browserThatFails(new Set(), order, 900), output));
    const heights = new Map(order.map((docId) => [
      docId,
      readImageEnvelope(imageRepresentationPath(paths, "puppeteer-full-height", docId)).images[0].heightPx
    ]));

    // A fake Shutterbug, so the whole command runs without a network.
    const posted: { height: number }[] = [];
    const png = makeTestPng(960, 980);
    const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
      if (init?.method === "POST") {
        posted.push({ height: JSON.parse(String(init.body)).height });
        return {
          ok: true, status: 200, statusText: "OK",
          body: bodyOf(Buffer.from(JSON.stringify({ url: "https://images.test/shot.png" })))
        } as unknown as Response;
      }
      return {
        ok: true, status: 200, statusText: "OK", url: "https://images.test/shot.png",
        headers: new Headers({ "content-type": "image/png" }), body: bodyOf(png)
      } as unknown as Response;
    };

    output.length = 0;
    await main(["render", "--corpus", "render-corpus", "--mode", "shutterbug-accurate-height"], {
      ...deps(dataRoot, null, output),
      renderConcurrency: 1,
      renderModeOptions: { clueRevision: "test-revision", fetchImpl }
    });

    // Every document was posted at its own measured height, not one height for all of them.
    expect(posted.map((call) => call.height)).toEqual(order.map((docId) => heights.get(docId)));
    // And the envelope records the height the picture was actually taken at, so freshness compares
    // against that rather than the mode's nominal 1500.
    for (const docId of order) {
      const envelope = readImageEnvelope(imageRepresentationPath(paths, "shutterbug-accurate-height", docId));
      expect({ docId, height: envelope.renderTarget.captureHeightPx })
        .toEqual({ docId, height: heights.get(docId) });
      expect(envelope.renderTarget.captureMode).toBe("fixed-height");
    }
  });
});

describe("a document that renders nothing", () => {
  it("warns when a document declares tiles but drew none", async () => {
    // Not fatal: `empty` is a real fixture with no tiles. But for a document whose content declares
    // some, a capture that drew none is a picture of the wrong thing, and until now only *unknown*
    // tiles were ever mentioned.
    const { dataRoot, order } = setUp("render-drew-nothing");
    const output: string[] = [];
    const browser = browserThatFails(new Set(), order);
    const original = browser.newPage;
    browser.newPage = async () => {
      const page = await original();
      (page as any).frames = () => [{
        url: () => "http://localhost:8080/iframe.html",
        $$: async () => [],
        evaluate: async (script: unknown) => (String(script).includes("innerText") ? "" : {
          documentFailedToLoad: false, contentHeightPx: 500, contentRowsHeightPx: 100,
          totalTiles: 0, unknownTiles: 0, fontsReady: true
        }) as never
      }];
      return page;
    };
    await main(["render", "--corpus", "render-corpus", "--mode", "puppeteer-full-height"],
      deps(dataRoot, browser, output));
    expect(output.join("\n")).toMatch(/declares \d+ tile\(s\) but drew none/);
  });

  it("skips a document with no tiles for a per-tile mode, without calling it a failure", async () => {
    // A per-tile mode cannot represent a document whose content declares no tiles. That is a fact
    // about the document, not a failure of the render, and a run skips it for the same reason.
    const { dataRoot, order } = setUp("render-per-tile-empty");
    const output: string[] = [];
    await main(["render", "--corpus", "render-corpus", "--mode", "puppeteer-per-tile"],
      deps(dataRoot, browserThatFails(new Set(), order), output));
    const printed = output.join("\n");
    expect(printed).toMatch(/skipped empty: its content declares no tiles/);
    expect(printed).toMatch(/with nothing to capture/);
    // Not counted as a failure, so the command still succeeds.
    expect(printed).not.toMatch(/failed to render/);
  });

  it("clears the pictures a document leaves behind when it stops having tiles", async () => {
    // A document that had tiles and then has none is stale rather than absent, so it lands in
    // `pending` and the skip above takes over. Nothing else would ever clear what it left: `render`
    // only overwrites what it re-renders, and `--prune` only reaches documents that have left the
    // manifest. Those files are pictures of a document that no longer looks like that, and once a
    // corpus is real they are pictures of student work.
    const { dataRoot, paths, order } = setUp("render-per-tile-emptied");
    const output: string[] = [];
    await main(["render", "--corpus", "render-corpus", "--mode", "puppeteer-per-tile"],
      deps(dataRoot, browserThatFails(new Set(), order), output));

    const docId = "drawing";
    const envelopeFile = imageRepresentationPath(paths, "puppeteer-per-tile", docId);
    const pngs = readImageEnvelope(envelopeFile).images
      .map((image) => resolveImageFile(envelopeFile, image));
    expect(pngs.length).toBeGreaterThan(0);
    expect(pngs.every((png) => fs.existsSync(png))).toBe(true);

    // Empty the document, which is what makes its existing render stale.
    const documentFile = path.join(paths.root, "documents", `${docId}.json`);
    fs.writeFileSync(documentFile, JSON.stringify({ rowOrder: [], rowMap: {}, tileMap: {} }), "utf8");
    await main(["import", "--from", path.join(paths.root, "documents"), "--corpus", "render-corpus"],
      { dataRoot, log: () => undefined });

    output.length = 0;
    await main(["render", "--corpus", "render-corpus", "--mode", "puppeteer-per-tile"],
      deps(dataRoot, browserThatFails(new Set(), order), output));
    expect(output.join("\n")).toMatch(new RegExp(`skipped ${docId}: its content declares no tiles`));
    expect(output.join("\n")).toMatch(/removed \d+ stale file\(s\)/);
    expect(fs.existsSync(envelopeFile)).toBe(false);
    expect(pngs.filter((png) => fs.existsSync(png))).toEqual([]);
  });
});

describe("a document the corpus says cannot be rendered", () => {
  it("is reported apart from real failures, and does not fail the command", async () => {
    // A corpus that always exits non-zero is a corpus nobody checks, which is how a picture of an
    // error page survived a whole milestone.
    const { dataRoot, paths, order } = setUp("render-expected-failure");
    const output: string[] = [];
    const manifest = JSON.parse(fs.readFileSync(paths.manifest, "utf8"));
    for (const entry of manifest.documents) {
      if (entry.id === "drawing") entry.expectedRenderFailure = "this fixture throws on purpose";
    }
    fs.writeFileSync(paths.manifest, JSON.stringify(manifest, null, 2));

    await main(["render", "--corpus", "render-corpus", "--mode", "puppeteer-full-height"],
      deps(dataRoot, browserThatFails(new Set(["drawing"]), order), output));

    const printed = output.join("\n");
    expect(printed).toMatch(/expected failure: drawing \(this fixture throws on purpose\)/);
    expect(printed).toMatch(/1 expected to fail/);
    // Not counted among the failures, so the command succeeded rather than throwing.
    expect(printed).toMatch(/0 failed/);
    // And no envelope was written for it, exactly as for any other failure.
    expect(fs.existsSync(imageRepresentationPath(paths, "puppeteer-full-height", "drawing"))).toBe(false);
    // Evidence is kept too. A document expected to fail one way and failing another is exactly the
    // case a screenshot is for, and the failure message points the reader at it.
    const evidence = renderErrorDir(paths, "puppeteer-full-height", "drawing");
    expect(fs.existsSync(path.join(evidence, "error.txt"))).toBe(true);
    expect(printed).toContain(`evidence written to ${evidence}`);
  });

  it("warns when a document it expected to fail renders after all", async () => {
    // A stale expectation is worse than none: it would go on hiding a real failure the day this
    // document breaks again.
    const { dataRoot, paths, order } = setUp("render-expectation-stale");
    const output: string[] = [];
    const manifest = JSON.parse(fs.readFileSync(paths.manifest, "utf8"));
    for (const entry of manifest.documents) {
      if (entry.id === "drawing") entry.expectedRenderFailure = "this used to throw";
    }
    fs.writeFileSync(paths.manifest, JSON.stringify(manifest, null, 2));

    await main(["render", "--corpus", "render-corpus", "--mode", "puppeteer-full-height"],
      deps(dataRoot, browserThatFails(new Set(), order), output));
    expect(output.join("\n"))
      .toMatch(/drawing rendered, but the manifest says it should not.*Clear expectedRenderFailure/s);
  });
});

describe("--concurrency and --timeout-ms", () => {
  it("refuses anything that is not a positive whole number", async () => {
    const { dataRoot } = setUp("render-bad-limits");
    for (const [flag, value] of [["--concurrency", "0"], ["--concurrency", "2.5"],
      ["--timeout-ms", "-1"], ["--timeout-ms", "abc"]] as const) {
      await expect(main(["render", "--corpus", "render-corpus", "--mode", "puppeteer-full-height",
        flag, value], deps(dataRoot, null, [])))
        .rejects.toThrow(new RegExp(`\\${flag} must be a positive whole number`));
    }
  });

  it("renders one page at a time when asked, instead of four", async () => {
    // Asserted through the fake browser rather than by timing: a timing assertion would be a
    // stopwatch on somebody else's machine.
    const { dataRoot, order } = setUp("render-concurrency-1");
    const output: string[] = [];
    let open = 0;
    let peak = 0;
    const browser = browserThatFails(new Set(), order);
    const original = browser.newPage;
    browser.newPage = async () => {
      const page = await original();
      open += 1;
      peak = Math.max(peak, open);
      const close = page.close;
      (page as any).close = async () => {
        open -= 1;
        return close();
      };
      return page;
    };
    await main(["render", "--corpus", "render-corpus", "--mode", "puppeteer-full-height",
      "--concurrency", "1"], {
      dataRoot,
      log: (message: string) => output.push(message),
      now: () => new Date("2026-08-13T00:00:00.000Z"),
      // No renderConcurrency here: the flag is the thing under test, and a dep would mask it.
      renderModeOptions: {
        clueRevision: "test-revision", launch: async () => browser as never,
        stableForMs: 0, pollIntervalMs: 1
      }
    });
    expect(peak).toBe(1);
    // The settings a run used are in its own output, not only in the shell history of whoever ran it.
    expect(output.join("\n")).toMatch(/\(1 at a time, 30000ms per document\.\)/);
  });

  it("hands the per-document budget to the backend, and says which one it used", async () => {
    const { dataRoot, order } = setUp("render-timeout");
    const output: string[] = [];
    // A budget this small cannot survive the fake's own settle loop, so the documents fail — which
    // is the observable proof the flag reached the backend rather than being parsed and dropped.
    await expect(main(["render", "--corpus", "render-corpus", "--mode", "puppeteer-full-height",
      "--timeout-ms", "1"], {
      dataRoot,
      log: (message: string) => output.push(message),
      now: () => new Date("2026-08-13T00:00:00.000Z"),
      renderConcurrency: 1,
      renderModeOptions: {
        clueRevision: "test-revision", launch: async () => browserThatFails(new Set(), order) as never,
        stableForMs: 0, pollIntervalMs: 1
      }
    })).rejects.toThrow(/failed to render/);
    expect(output.join("\n")).toMatch(/1ms budget for this document/);
    expect(output.join("\n")).toMatch(/\(1 at a time, 1ms per document\.\)/);
  });
});
