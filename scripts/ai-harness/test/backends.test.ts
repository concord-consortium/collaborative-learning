import {
  getRenderBackend, isRenderModeId, kDefaultRenderModeId, renderModeIds
} from "../src/backends/index.js";
import {
  BrowserLike, ElementLike, FrameLike, FrameMeasurement, PageLike, RenderFailed, expectedTileCount,
  puppeteerBackend, startRenderPageServer
} from "../src/backends/puppeteer.js";
import {
  RenderLimitExceeded, checkCaptureSize, checkEncodedSize, isPublicHttpsUrl, redirectDowngradeReason
} from "../src/backends/types.js";
import { generateRenderHtml } from "../src/backends/render-html.js";
import { readPngInfo } from "../src/png.js";
import { makeTestPng } from "./helpers.js";

// Named to avoid shadowing the DOM `document` global in files that are about browser rendering.
const emptyDocument = { rowOrder: [], rowMap: {}, tileMap: {} };

// ---------------------------------------------------------------------------
// A fake browser, so the backend's protocol can be tested without Chromium
// ---------------------------------------------------------------------------

interface FakeOptions {
  png?: Buffer;
  boundingBox?: { x: number; y: number; width: number; height: number } | null;
  /** Makes the parent never report that it posted the document to the iframe. */
  neverPostsInitialValue?: boolean;
  /** What the CLUE frame reports. Merged over a sensible settled default. */
  measurement?: Partial<FrameMeasurement>;
  consoleMessages?: { type: string; text: string }[];
  pageErrors?: string[];
  requestFailures?: string[];
  frameUrl?: string | null;
  element?: ElementLike | null;
  /** The top-level tiles the CLUE frame draws, for the per-tile capture. */
  tiles?: { tileId: string; widthPx: number; heightPx: number }[];
}

const settledMeasurement: FrameMeasurement = {
  documentFailedToLoad: false,
  contentHeightPx: 1420,
  contentRowsHeightPx: 1200,
  totalTiles: 3,
  unknownTiles: 0,
  fontsReady: true
};

function fakeBrowser(options: FakeOptions = {}) {
  const state = {
    url: "",
    viewport: null as { width: number; height: number } | null,
    screenshots: 0,
    newPages: 0,
    closedPages: 0,
    closedBrowser: 0,
    frameHeights: [] as number[]
  };
  const png = options.png ?? makeTestPng(960, 1420);
  const handlers = new Map<string, ((payload: any) => void)[]>();

  const element: ElementLike = {
    // Follows the frame height the backend set, the way a real element's box does.
    boundingBox: async () => options.boundingBox === undefined
      ? { x: 0, y: 0, width: 960, height: state.frameHeights.at(-1) ?? 1420 }
      : options.boundingBox,
    screenshot: async () => {
      state.screenshots += 1;
      return png;
    }
  };

  const tiles = options.tiles ?? [];
  const frame: FrameLike = {
    url: () => options.frameUrl ?? "http://localhost:8080/iframe.html?unit=x&unwrapped&readOnly",
    // The settle poll asks for the measurement; the post-settle reads ask for the document text and
    // for the tile ids.
    evaluate: async (script) => (String(script).includes("innerText")
      ? "drawing-fixture-marker"
      : String(script).includes("data-tool-id")
      ? tiles.map((tile) => tile.tileId)
      : { ...settledMeasurement, ...options.measurement }) as never,
    $$: async (selector) => {
      // Pinned because this fake has no DOM: it returns `tiles` whatever it is asked for, so the
      // only thing it can say about the selector is what the selector was. The `:not()` is the part
      // that keeps a Question tile's nested tiles out of the capture, and dropping it would give one
      // top-level tile several pictures with nothing here noticing. `local-render.integration.ts`
      // is where that is checked against a real DOM.
      expect(selector).toBe(".tool-tile:not(.tool-tile .tool-tile)");
      return tiles.map((tile) => ({
        boundingBox: async () => ({ x: 0, y: 0, width: tile.widthPx, height: tile.heightPx }),
        screenshot: async () => {
          state.screenshots += 1;
          return makeTestPng(tile.widthPx, tile.heightPx);
        }
      }));
    }
  };

  const page: PageLike = {
    setViewport: async (viewport) => { state.viewport = viewport; },
    screenshot: async () => makeTestPng(40, 40),
    goto: async (url) => {
      state.url = url;
      // Listeners registered before navigation see the page's events, as puppeteer delivers them.
      for (const message of options.consoleMessages ?? []) {
        for (const handler of handlers.get("console") ?? []) {
          handler({ type: () => message.type, text: () => message.text });
        }
      }
      for (const message of options.pageErrors ?? []) {
        for (const handler of handlers.get("pageerror") ?? []) handler(new Error(message));
      }
      for (const failed of options.requestFailures ?? []) {
        for (const handler of handlers.get("requestfailed") ?? []) {
          handler({ url: () => failed, failure: () => ({ errorText: "net::ERR_FAILED" }) });
        }
      }
      return undefined;
    },
    evaluate: async (script) => {
      const match = /frame\.height = (\d+)/.exec(String(script));
      if (match) state.frameHeights.push(Number(match[1]));
      return undefined as never;
    },
    waitForFunction: async (fn) => {
      if (options.neverPostsInitialValue && /initialValuePosted/.test(String(fn))) {
        throw new Error("Waiting failed: 30000ms exceeded");
      }
      return true;
    },
    $: async () => options.element === undefined ? element : options.element,
    frames: () => options.frameUrl === null ? [] : [frame],
    on: (event, handler) => {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    },
    close: async () => { state.closedPages += 1; }
  };

  const browser: BrowserLike = {
    newPage: async () => {
      state.newPages += 1;
      return page;
    },
    close: async () => { state.closedBrowser += 1; }
  };
  return { browser, state, png };
}

/**
 * A page server that hands back URLs without opening a socket, keeping the HTML it was handed.
 *
 * Kept, because the URL it returns is a literal this file wrote: asserting the backend navigated to
 * something matching that pattern re-reads the fake rather than checking anything. What the page
 * actually holds is the interesting part.
 */
const servedPages = new Map<string, string>();
/** Everything ever served, which `forget` does not remove — so a finished render can be inspected. */
const servedPagesEver = new Map<string, string>();
const fakePageServer = async () => ({
  serve: (docId: string, html: string) => {
    servedPages.set(docId, html);
    servedPagesEver.set(docId, html);
    return { url: `http://127.0.0.1:9/${docId}`, forget: () => servedPages.delete(docId) };
  },
  close: async () => undefined
});

function makeBackend(options: FakeOptions = {}, overrides: Record<string, unknown> = {}) {
  const fake = fakeBrowser(options);
  const backend = puppeteerBackend({
    modeId: "puppeteer-full-height",
    clueUrl: "http://localhost:8080",
    unit: "http://127.0.0.1:5000/content.json",
    clueRevision: "9b53df828",
    launch: async () => fake.browser,
    startPageServer: fakePageServer,
    // The readiness poll needs two matching reads; zero stability and a 1ms interval keep the fake
    // tests quick. The short deadline keeps a "never settles" case from burning the real 30s budget.
    stableForMs: 0,
    pollIntervalMs: 1,
    timeoutMs: 1200,
    ...overrides
  });
  return { backend, ...fake };
}

describe("the puppeteer backend", () => {
  it("describes itself as a local full-document capture", () => {
    const { backend } = makeBackend();
    expect(backend.modeId).toBe("puppeteer-full-height");
    expect(backend.backendId).toBe("puppeteer");
    // "local", not "offline": the CLUE page may still pull fonts and other assets from elsewhere.
    expect(backend.kind).toBe("local");
    expect(backend.renderTarget).toEqual({
      clueUrl: "http://localhost:8080",
      unit: "http://127.0.0.1:5000/content.json",
      clueRevision: "9b53df828",
      shutterbugUrl: null,
      viewportWidthPx: 960,
      captureMode: "full-document",
      captureHeightPx: null
    });
  });

  it("renders the shared HTML through the iframe pathway and screenshots the iframe", async () => {
    const { backend, state, png } = makeBackend();
    servedPages.clear();
    const outcome = await backend.render({ docId: "drawing", content: emptyDocument });
    // Navigated to a real http origin, not injected: `setContent` leaves an opaque origin, and
    // Chromium then denies the CLUE iframe access to localStorage so it never finishes booting.
    // That it is never called is a type-level guarantee rather than something asserted here —
    // `PageLike` does not declare `setContent`, so a call would not compile.
    expect(state.url).toBe("http://127.0.0.1:9/drawing");
    // And the page that was served is the shared generator's output, unmodified. Pattern-matching
    // the fake's own URL proved nothing about what reached the browser.
    expect(servedPagesEver.get("drawing")).toBe(generateRenderHtml({
      content: emptyDocument, clueUrl: "http://localhost:8080", unit: "http://127.0.0.1:5000/content.json"
    }));
    // And it is no longer being served, because the render is over.
    expect(servedPages.has("drawing")).toBe(false);
    expect(state.viewport).toEqual({ width: 960, height: 1024 });
    expect(state.screenshots).toBe(1);
    expect(outcome.images).toEqual([{ bytes: png, url: null, tileId: null, purpose: "full-document" }]);
  });

  it("reports what it could see, so a render can be verified rather than just produced", async () => {
    const { backend } = makeBackend({
      measurement: { totalTiles: 4, unknownTiles: 0 }
    });
    const outcome = await backend.render({ docId: "drawing", content: emptyDocument });
    expect(outcome.diagnostics).toEqual({
      reportedHeightPx: 1420,
      unknownTiles: 0,
      totalTiles: 4,
      documentText: "drawing-fixture-marker",
      consoleWarnings: []
    });
  });

  it("counts placeholder tiles, which is how an unregistered tile type shows up", async () => {
    // CLUE logs nothing for an unregistered type — it substitutes an Unknown content model and draws
    // it with the placeholder component. Without this count the run stores a valid PNG of the wrong
    // thing and reports success.
    const { backend } = makeBackend({
      measurement: { totalTiles: 3, unknownTiles: 2 }
    });
    const outcome = await backend.render({ docId: "ai", content: emptyDocument });
    expect(outcome.diagnostics.unknownTiles).toBe(2);
  });

  it("fails when the document is never posted to the iframe", async () => {
    const { backend } = makeBackend({ neverPostsInitialValue: true });
    await expect(backend.render({ docId: "stuck", content: emptyDocument }))
      .rejects.toThrow(/never posted the document/);
  });

  it("fails when the CLUE frame never appears", async () => {
    const { backend } = makeBackend({ frameUrl: null });
    await expect(backend.render({ docId: "stuck", content: emptyDocument }))
      .rejects.toThrow(/ran out before the CLUE iframe appeared/);
  });

  it.each([
    ["nothing is ever drawn", { contentHeightPx: 0 }],
    ["the fonts never load", { fontsReady: false }]
  ])("fails when %s", async (_label, measurement) => {
    // Readiness is measured inside the frame. CLUE's own `updateHeight` message reports
    // document.body.scrollHeight, which is 0 in this build even for a fully rendered document, so
    // waiting on it could never succeed.
    const { backend } = makeBackend({ measurement }, { timeoutMs: 700 });
    await expect(backend.render({ docId: "stuck", content: emptyDocument }))
      .rejects.toThrow(/ran out before the document finished rendering/);
  });

  it("names the document, the URL and the last known height when it fails", async () => {
    const { backend } = makeBackend({ neverPostsInitialValue: true });
    await expect(backend.render({ docId: "stuck", content: emptyDocument }))
      .rejects.toThrow(/^stuck: .*rendering http:\/\/localhost:8080\/iframe\.html.*last reported height none/s);
  });

  it("fails on a page error", async () => {
    const { backend } = makeBackend({ pageErrors: ["ReferenceError: thing is not defined"] });
    await expect(backend.render({ docId: "broken", content: emptyDocument }))
      .rejects.toThrow(/reported 1 error\(s\).*ReferenceError/s);
  });

  it("fails on a console error that means code did not run", async () => {
    const { backend } = makeBackend({
      consoleMessages: [{ type: "error", text: "Failed to fetch dynamically imported module" }]
    });
    await expect(backend.render({ docId: "broken", content: emptyDocument }))
      .rejects.toThrow(/dynamically imported module/);
  });

  it("does not fail on console noise that says nothing about the document", async () => {
    // A real CLUE server logs React key warnings at error level and probes for an optional
    // teacher-guide that legitimately 404s. Treating either as fatal failed every document.
    const { backend } = makeBackend({
      consoleMessages: [{ type: "error", text: 'Warning: Each child in a list should have a unique "key" prop.' }],
      requestFailures: ["http://127.0.0.1:5000/teacher-guide/content.json"]
    });
    const outcome = await backend.render({ docId: "noisy", content: emptyDocument });
    expect(outcome.images).toHaveLength(1);
  });

  it("still fails when a script itself fails to load", async () => {
    const { backend } = makeBackend({
      requestFailures: ["http://localhost:8080/chunk.4f2a.js"]
    });
    await expect(backend.render({ docId: "broken", content: emptyDocument }))
      .rejects.toThrow(/chunk\.4f2a\.js/);
  });

  it("keeps a console warning without failing the document", async () => {
    const { backend } = makeBackend({ consoleMessages: [{ type: "warning", text: "slow thing" }] });
    const outcome = await backend.render({ docId: "noisy", content: emptyDocument });
    expect(outcome.diagnostics.consoleWarnings).toEqual(["warning: slow thing"]);
  });

  it("fails when the iframe has no visible area", async () => {
    const { backend } = makeBackend({ boundingBox: null });
    await expect(backend.render({ docId: "invisible", content: emptyDocument }))
      .rejects.toThrow(/no visible area/);
  });

  it("fails when the render page has no iframe at all", async () => {
    const { backend } = makeBackend({ element: null });
    await expect(backend.render({ docId: "gone", content: emptyDocument }))
      .rejects.toThrow(/no #clue-frame element/);
  });

  it("bounds the capture itself, not only the decision to start it", async () => {
    // The clock was checked before the capture, but `$`, `boundingBox` and `screenshot` take no
    // timeout of their own — so a wedged page could run indefinitely past a budget documented as
    // covering the capture.
    const fake = fakeBrowser();
    (fake.browser as any).newPage = async () => {
      const page = await fakeBrowser().browser.newPage();
      // Never settles, and never rejects: exactly the shape the deadline has to cut short.
      (page as any).$ = () => new Promise(() => undefined);
      return page;
    };
    const backend = puppeteerBackend({
      modeId: "puppeteer-full-height",
      clueUrl: "http://localhost:8080", unit: "harness-render", clueRevision: "r",
      launch: async () => fake.browser, startPageServer: fakePageServer,
      stableForMs: 0, pollIntervalMs: 1, timeoutMs: 600
    });
    const started = Date.now();
    await expect(backend.render({ docId: "wedged", content: emptyDocument }))
      .rejects.toThrow(/finding the iframe did not finish within the 600ms budget/);
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it("bounds a capture that hangs inside screenshot()", async () => {
    const fake = fakeBrowser();
    (fake.browser as any).newPage = async () => {
      const page = await fakeBrowser().browser.newPage();
      (page as any).$ = async () => ({
        boundingBox: async () => ({ x: 0, y: 0, width: 960, height: 1420 }),
        screenshot: () => new Promise(() => undefined)
      });
      return page;
    };
    const backend = puppeteerBackend({
      modeId: "puppeteer-full-height",
      clueUrl: "http://localhost:8080", unit: "harness-render", clueRevision: "r",
      launch: async () => fake.browser, startPageServer: fakePageServer,
      stableForMs: 0, pollIntervalMs: 1, timeoutMs: 600
    });
    await expect(backend.render({ docId: "wedged", content: emptyDocument }))
      .rejects.toThrow(/capturing the iframe did not finish within the 600ms budget/);
  });

  it("attaches evidence to a failure that is not a RenderFailed", async () => {
    // A navigation error, a size-limit rejection or a raw protocol error is exactly when the console
    // output and a picture of the page are most wanted, so evidence is attached to any failure and
    // not only to a RenderFailed.
    const fake = fakeBrowser();
    (fake.browser as any).newPage = async () => {
      const page = await fakeBrowser().browser.newPage();
      const failureHandlers: ((payload: any) => void)[] = [];
      const originalOn = page.on;
      (page as any).on = (event: string, handler: (payload: any) => void) => {
        if (event === "requestfailed") failureHandlers.push(handler);
        return originalOn.call(page, event, handler);
      };
      (page as any).goto = async () => {
        // The page got as far as failing to load its own code, which is the line worth keeping.
        for (const handler of failureHandlers) {
          handler({
            url: () => "http://localhost:8080/main.js",
            failure: () => ({ errorText: "net::ERR_CONNECTION_REFUSED" })
          });
        }
        throw new Error("net::ERR_CONNECTION_REFUSED");
      };
      return page;
    };
    const backend = puppeteerBackend({
      modeId: "puppeteer-full-height",
      clueUrl: "http://localhost:8080", unit: "harness-render", clueRevision: "r",
      launch: async () => fake.browser, startPageServer: fakePageServer,
      stableForMs: 0, pollIntervalMs: 1
    });
    const error = await backend.render({ docId: "unreachable", content: emptyDocument })
      .then(() => { throw new Error("expected the render to fail"); },
        (thrown) => thrown as Error & { context?: { screenshot?: Buffer; consoleOutput?: string[] } });
    expect(error).not.toBeInstanceOf(RenderFailed);
    expect(error.message).toContain("ERR_CONNECTION_REFUSED");
    expect(error.context?.screenshot).toBeInstanceOf(Buffer);
    // The content, not merely the presence of an array: `[]` satisfied `toBeDefined()`, so an
    // evidence file that captured nothing at all looked exactly like one that worked.
    expect(error.context?.consoleOutput).toEqual(expect.arrayContaining([
      expect.stringContaining("request failed: http://localhost:8080/main.js")
    ]));
  });

  it("attaches evidence when the failure is a size-limit rejection", async () => {
    const { backend } = makeBackend({}, {
      limits: { maxHeightPx: 20_000, maxPixels: 40_000_000, maxEncodedBytes: 10 }
    });
    const error = await backend.render({ docId: "huge", content: emptyDocument })
      .then(() => { throw new Error("expected the render to fail"); },
        (thrown) => thrown as Error & { context?: { screenshot?: Buffer } });
    expect(error).toBeInstanceOf(RenderLimitExceeded);
    expect(error.context?.screenshot).toBeInstanceOf(Buffer);
  });

  it("closes the page even when the render fails", async () => {
    const { backend, state } = makeBackend({ neverPostsInitialValue: true });
    await expect(backend.render({ docId: "stuck", content: emptyDocument })).rejects.toThrow(RenderFailed);
    expect(state.closedPages).toBe(1);
  });

  it("launches one browser even when renders start concurrently", async () => {
    // Both guards used to read `browser`, then await `launch()`, so two concurrent first-renders
    // each launched Chromium and `close()` shut down only one — leaving a process behind.
    let launches = 0;
    const fake = fakeBrowser();
    const backend = puppeteerBackend({
      modeId: "puppeteer-full-height",
      clueUrl: "http://localhost:8080", unit: "harness-render", clueRevision: "r",
      launch: async () => {
        launches += 1;
        return fake.browser;
      },
      // The same fakes every other case here passes. Without them this case bound a real port and
      // sat through the real settle interval — about 1.2 seconds — to count two calls to `launch`.
      startPageServer: fakePageServer,
      stableForMs: 0,
      pollIntervalMs: 1
    });
    await Promise.all([
      backend.render({ docId: "a", content: emptyDocument }),
      backend.render({ docId: "b", content: emptyDocument })
    ]);
    expect(launches).toBe(1);
    await backend.close!();
    expect(fake.state.closedBrowser).toBe(1);
  });

  it("uses one browser for the whole run, a fresh page per document, and closes both", async () => {
    const { backend, state } = makeBackend();
    await backend.open!();
    await backend.render({ docId: "a", content: emptyDocument });
    await backend.render({ docId: "b", content: emptyDocument });
    await backend.close!();
    expect(state.newPages).toBe(2);
    expect(state.closedPages).toBe(2);
    // Launched once by open(), not again per document.
    expect(state.closedBrowser).toBe(1);
  });

  it("closes the page server even when the browser refuses to close", async () => {
    // A crashed Chromium rejects on close. Closing the browser first and awaiting it meant the
    // loopback page server was never closed, and its open handle keeps the CLI alive after the
    // error has already been printed.
    const fake = fakeBrowser();
    (fake.browser as any).close = async () => { throw new Error("Chromium is gone"); };
    let pageServerClosed = 0;
    const backend = puppeteerBackend({
      modeId: "puppeteer-full-height",
      clueUrl: "http://localhost:8080", unit: "harness-render", clueRevision: "r",
      launch: async () => fake.browser,
      startPageServer: async () => ({
        serve: (docId: string) => ({ url: `http://127.0.0.1:9/${docId}`, forget: () => undefined }),
        close: async () => { pageServerClosed += 1; }
      }),
      stableForMs: 0, pollIntervalMs: 1
    });
    await backend.open!();
    // The failure still surfaces — it is just no longer allowed to skip the other close.
    await expect(backend.close!()).rejects.toThrow(/Chromium is gone/);
    expect(pageServerClosed).toBe(1);
  });

  it("fails a document CLUE could not load, rather than photographing its error page", async () => {
    // CLUE renders its own "Error loading the document" page when it cannot deserialize what it was
    // handed. That page photographs perfectly well — which is the problem. Two committed fixtures
    // were storing valid PNGs of an error screen as though they were student work, and nothing
    // said so, because the only diagnostic anyone checked was the *unknown tile* count.
    const { backend } = makeBackend({ measurement: { documentFailedToLoad: true } });
    await expect(backend.render({ docId: "unloadable", content: emptyDocument }))
      .rejects.toThrow(/CLUE could not load this document and showed its error page instead/);
  });

  it("fails before resizing, so a document that never loaded costs the cheap path", async () => {
    const { backend, state } = makeBackend({
      measurement: { documentFailedToLoad: true, contentRowsHeightPx: 4000 }
    });
    await expect(backend.render({ docId: "unloadable", content: emptyDocument })).rejects.toThrow();
    // No resize, and no capture: the frame was never asked to grow.
    expect(state.frameHeights).toEqual([]);
    expect(state.screenshots).toBe(0);
  });

  it("fails a render whose page breaks during the settle after the resize", async () => {
    // The fatal check ran once, right after the first settle. Anything that went wrong while the
    // resized frame settled again landed in the evidence file without failing the render, so a
    // broken page was captured and stored as though nothing had happened.
    const fake = fakeBrowser();
    let resized = false;
    (fake.browser as any).newPage = async () => {
      const page = await fakeBrowser().browser.newPage();
      const handlers: ((payload: any) => void)[] = [];
      (page as any).on = (event: string, handler: (payload: any) => void) => {
        if (event === "console") handlers.push(handler);
      };
      (page as any).evaluate = async (script: unknown) => {
        if (/frame\.height = \d+/.test(String(script))) resized = true;
        return undefined;
      };
      (page as any).frames = () => [{
        url: () => "http://localhost:8080/iframe.html",
        evaluate: async (script: unknown) => {
          if (String(script).includes("innerText")) return "marker";
          // Only once the frame has been resized. That is the settle whose failures the check
          // before the capture exists to catch: a fatal error here, after the resize, would
          // otherwise reach the evidence file without failing anything.
          if (resized) {
            for (const handler of handlers) {
              handler({ type: () => "error", text: () => "Failed to fetch dynamically imported module: tile.js" });
            }
          }
          return { ...settledMeasurement, contentRowsHeightPx: 1800 };
        }
      }];
      return page;
    };
    const backend = puppeteerBackend({
      modeId: "puppeteer-full-height",
      clueUrl: "http://localhost:8080", unit: "harness-render", clueRevision: "r",
      launch: async () => fake.browser, startPageServer: fakePageServer,
      stableForMs: 0, pollIntervalMs: 1
    });
    await expect(backend.render({ docId: "late-failure", content: emptyDocument }))
      .rejects.toThrow(/reported \d+ error\(s\).*dynamically imported module/s);
    // The failure really is the late one — the frame had already been resized when it happened.
    expect(resized).toBe(true);
  });

  it("spends one timeout budget across every phase, not one per phase", async () => {
    // One deadline covers load, readiness and capture together, and the failure names it. A fresh
    // budget per phase would let a stuck document burn several times the per-document timeout the
    // CLI documents.
    const started = Date.now();
    const { backend } = makeBackend({ measurement: { contentHeightPx: 0 } }, { timeoutMs: 800 });
    await expect(backend.render({ docId: "slow", content: emptyDocument }))
      .rejects.toThrow(/800ms budget for this document ran out/);
    // Comfortably inside a multiple of the budget — the point is that phases share it.
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it("sizes the frame from the document's own height, not the viewport", async () => {
    // CLUE lays out to fill its viewport — the iframe — rather than to its content, so a long
    // document is clipped to whatever height the frame happens to have. Version 1 captured the
    // 500px default and would have recorded it as a full-document capture.
    const fake = fakeBrowser();
    (fake.browser as any).newPage = async () => {
      const page = await fakeBrowser().browser.newPage();
      (page as any).evaluate = async (script: string) => {
        const match = /frame\.height = (\d+)/.exec(String(script));
        if (match) fake.state.frameHeights.push(Number(match[1]));
        return undefined;
      };
      (page as any).$ = async () => ({
        boundingBox: async () => ({
          x: 0, y: 0, width: 960, height: fake.state.frameHeights.at(-1) ?? 500
        }),
        screenshot: async () => makeTestPng(960, 1880)
      });
      (page as any).frames = () => [{
        url: () => "http://localhost:8080/iframe.html",
        // A document taller than the 500px the frame starts at.
        evaluate: async () => ({ ...settledMeasurement, contentRowsHeightPx: 1800 })
      }];
      return page;
    };
    const backend = puppeteerBackend({
      modeId: "puppeteer-full-height",
      clueUrl: "http://localhost:8080", unit: "harness-render", clueRevision: "r",
      launch: async () => fake.browser, startPageServer: fakePageServer,
      stableForMs: 0, pollIntervalMs: 1
    });
    await backend.render({ docId: "tall", content: emptyDocument });
    // Sized to cover the tiles rather than captured at the 500px viewport default. CLUE lays out to
    // fill its frame, so a taller document is simply absent from a default-height capture.
    expect(fake.state.frameHeights.length).toBeGreaterThan(0);
    expect(Math.max(...fake.state.frameHeights)).toBeGreaterThanOrEqual(1800);
  });

  it("fails rather than record a clipped capture as a full-document one", async () => {
    // The capture is 1420 tall (the fake's bounding box) while the document's tiles are 4000, so
    // most of it is missing. Recording that as a full-document capture is the one thing forbidden.
    // The frame refuses to grow past 1420 — a capped or unresizable layout — while the document's
    // tiles are 4000px, so most of it is missing from the picture.
    const { backend } = makeBackend({
      measurement: { contentRowsHeightPx: 4000 },
      boundingBox: { x: 0, y: 0, width: 960, height: 1420 }
    });
    await expect(backend.render({ docId: "endless", content: emptyDocument }))
      .rejects.toThrow(/would be a clipped capture recorded as a full-document one/);
  });

  it("fails a document that exceeds the height limit, rather than clipping it", async () => {
    // A clipped capture must never be recorded as a full-document one.
    const { backend } = makeBackend(
      { boundingBox: { x: 0, y: 0, width: 960, height: 30_000 } },
      { limits: { maxHeightPx: 20_000, maxPixels: 40_000_000, maxEncodedBytes: 20 * 1024 * 1024 } });
    await expect(backend.render({ docId: "endless", content: emptyDocument }))
      .rejects.toThrow(/30000px tall, over the 20000px limit/);
  });

  it("fails a document whose encoded image is too large", async () => {
    const { backend } = makeBackend({}, {
      limits: { maxHeightPx: 20_000, maxPixels: 40_000_000, maxEncodedBytes: 10 }
    });
    await expect(backend.render({ docId: "huge", content: emptyDocument }))
      .rejects.toThrow(/encoded image is \d+ bytes, over the 10 limit/);
  });
});

describe("the loopback page server", () => {
  it("serves a document's page, then forgets it", async () => {
    // The page holds the whole document. Keeping every one of them until the run ends meant the
    // server accumulated the entire corpus in memory.
    const server = await startRenderPageServer();
    try {
      const served = server.serve("drawing", "<p>a document</p>");
      expect(await (await fetch(served.url)).text()).toBe("<p>a document</p>");
      served.forget();
      expect((await fetch(served.url)).status).toBe(404);
    } finally {
      await server.close();
    }
  });

  it("answers 400 for a malformed URL rather than taking the process down", async () => {
    // `decodeURIComponent` throws on a stray `%`, and the request handler is synchronous, so an
    // unhandled throw there is not a 404 — it is the whole harness exiting mid-run.
    const server = await startRenderPageServer();
    try {
      const { port } = new URL(server.serve("x", "<p>x</p>").url);
      expect((await fetch(`http://127.0.0.1:${port}/%zz`)).status).toBe(400);
      // And the server is still answering afterwards.
      expect((await fetch(server.serve("y", "<p>y</p>").url)).status).toBe(200);
    } finally {
      await server.close();
    }
  });
});

describe("how many tiles a document should draw", () => {
  it("counts the tiles named by the rows", () => {
    expect(expectedTileCount({
      rowMap: { r1: { tiles: [{ tileId: "a" }, { tileId: "b" }] }, r2: { tiles: [{ tileId: "c" }] } }
    })).toBe(3);
  });

  it("falls through to the tile map when the rows name nothing", () => {
    // Answering 0 for a present-but-empty `rowMap` would mean waiting for "at least 0 tiles", which
    // any stable state satisfies — including a page that has not finished loading, whose picture is
    // blank.
    expect(expectedTileCount({ rowMap: {}, tileMap: { a: {}, b: {} } })).toBe(2);
    expect(expectedTileCount({ rowMap: { r1: { tiles: [] } }, tileMap: { a: {} } })).toBe(1);
  });

  it("answers zero only when the document really has no tiles", () => {
    expect(expectedTileCount({ rowMap: {}, tileMap: {} })).toBe(0);
    expect(expectedTileCount({})).toBe(0);
  });

  it("ignores tiles in the map that the rows do not name, when the rows name any at all", () => {
    // The count is what the frame is waited on to draw, so counting high is the expensive mistake:
    // the wait can never be satisfied and every such document pays the grace period instead, which
    // is six times the stable interval. `question` is the real case — its nested tiles are in the
    // tile map and named by no row — and the fallback must not turn its 1 into 3.
    expect(expectedTileCount({
      rowMap: { r1: { tiles: [{ tileId: "a" }] } },
      tileMap: { a: {}, nested1: {}, nested2: {} }
    })).toBe(1);
  });
});

describe("which hosted URLs may be fetched", () => {
  it("accepts a public https URL", () => {
    expect(isPublicHttpsUrl("https://images.example.test/shot.png")).toBe(true);
    expect(isPublicHttpsUrl("https://8.8.8.8/shot.png")).toBe(true);
  });

  it("refuses plain http and anything unparseable", () => {
    expect(isPublicHttpsUrl("http://images.example.test/shot.png")).toBe(false);
    expect(isPublicHttpsUrl("images.example.test/shot.png")).toBe(false);
  });

  it("refuses loopback and the private ranges, in both address families", () => {
    for (const host of [
      "localhost", "127.0.0.1", "127.1.2.3", "0.0.0.0", "10.0.0.5", "172.16.0.1", "172.31.255.255",
      "192.168.1.1", "169.254.169.254", "[::1]", "[::]", "[fd00::1]", "[fe80::1]",
      "[::ffff:127.0.0.1]",
      // Shared address space (RFC 6598), and both ends of it.
      "100.64.0.1", "100.127.255.255"
    ]) {
      expect({ host, allowed: isPublicHttpsUrl(`https://${host}/shot.png`) })
        .toEqual({ host, allowed: false });
    }
    // Just outside each private block, so the range checks are ranges and not prefix matches.
    for (const host of ["172.32.0.1", "100.63.255.255", "100.128.0.1"]) {
      expect({ host, allowed: isPublicHttpsUrl(`https://${host}/shot.png`) })
        .toEqual({ host, allowed: true });
    }
  });

  it("reads only the IPv4-mapped form, which is the only one that reaches the address", () => {
    // `::ffff:0:127.0.0.1` and `::ffff:0:0:127.0.0.1` normalize to `[::ffff:0:7f00:1]` and
    // `[::ffff:0:0:7f00:1]`, which put `ffff` in a different group: the deprecated IPv4-translated
    // range, which no stack here translates — both answer EHOSTUNREACH rather than reaching
    // 127.0.0.1. Treating them as private would be reading an unreachable IPv6 address as loopback.
    expect(isPublicHttpsUrl("https://[::ffff:127.0.0.1]/shot.png")).toBe(false);
    expect(isPublicHttpsUrl("https://[::ffff:0:127.0.0.1]/shot.png")).toBe(true);
    expect(isPublicHttpsUrl("https://[::ffff:0:0:127.0.0.1]/shot.png")).toBe(true);
  });

  it("reads an IPv4 address however it is written", () => {
    // `URL` normalizes the decimal, hex, octal and short forms, so the octet check sees 127.0.0.1
    // in every case and none of them is a way around it.
    for (const host of ["2130706433", "0x7f000001", "017700000001", "127.1"]) {
      expect({ host, allowed: isPublicHttpsUrl(`https://${host}/shot.png`) })
        .toEqual({ host, allowed: false });
    }
  });

  it("refuses a redirect that lands somewhere less safe than where it was asked to go", () => {
    const from = "https://images.example.test/shot.png";
    expect(redirectDowngradeReason(from, from)).toBeNull();
    expect(redirectDowngradeReason(from, "https://cdn.example.test/shot.png")).toBeNull();
    expect(redirectDowngradeReason(from, "http://images.example.test/shot.png"))
      .toMatch(/not a public https URL/);
    expect(redirectDowngradeReason(from, "https://127.0.0.1:9/shot.png"))
      .toMatch(/not a public https URL/);
  });

  it("leaves a deliberately local URL alone, since it cannot be downgraded", () => {
    // The rule is "no worse than what was asked for". An operator pointing the harness at a local
    // server has not been redirected anywhere they did not choose.
    expect(redirectDowngradeReason("http://127.0.0.1:9/a.png", "http://127.0.0.1:9/b.png")).toBeNull();
  });
});

describe("capture limits", () => {
  const limits = { maxHeightPx: 20_000, maxPixels: 1_000_000, maxEncodedBytes: 100 };

  it("passes a reasonable capture", () => {
    expect(() => checkCaptureSize("doc", 960, 1000, limits)).not.toThrow();
    expect(() => checkEncodedSize("doc", Buffer.alloc(50), limits)).not.toThrow();
  });

  it("names the document and says no envelope was written", () => {
    expect(() => checkCaptureSize("doc", 960, 30_000, limits))
      .toThrow(/^doc: .*No envelope was written/s);
  });

  it.each([
    [960, 30_000, /30000px tall, over the 20000px limit/],
    // Under the height limit, over the pixel count: a wide capture nothing else would catch.
    [2000, 2000, /4000000 pixels, over the 1000000 limit/]
  ])("refuses a %p x %p capture on its own terms", (widthPx, heightPx, pattern) => {
    expect(() => checkCaptureSize("doc", widthPx, heightPx, limits)).toThrow(pattern);
    expect(() => checkCaptureSize("doc", widthPx, heightPx, limits)).toThrow(RenderLimitExceeded);
  });

  it("refuses an encoded image over the byte limit", () => {
    expect(() => checkEncodedSize("doc", Buffer.alloc(200), limits)).toThrow(/200 bytes, over the 100 limit/);
    expect(() => checkEncodedSize("doc", Buffer.alloc(200), limits)).toThrow(RenderLimitExceeded);
  });
});

describe("the mode registry", () => {
  it("knows exactly the modes it can build, defaulting to the local full-document one", () => {
    expect([...renderModeIds]).toEqual([
      "puppeteer-full-height", "puppeteer-per-tile",
      "shutterbug-production-current", "shutterbug-parameterized", "shutterbug-accurate-height"
    ]);
    expect(kDefaultRenderModeId).toBe("puppeteer-full-height");
    expect(isRenderModeId("puppeteer-full-height")).toBe(true);
    expect(isRenderModeId("shutterbug")).toBe(false);
  });

  it("refuses an unknown mode by name", () => {
    expect(() => getRenderBackend("screenshot")).toThrow(/Unknown render mode "screenshot"/);
  });

  it("refuses to let the parity baseline be reconfigured", () => {
    // Silently ignoring a flag would make it look as though the baseline had been changed.
    expect(() => getRenderBackend("shutterbug-production-current", { clueUrl: "http://localhost:8080" }))
      .toThrow(/--clue-url .*not configurable for --mode shutterbug-production-current/s);
    expect(() => getRenderBackend("shutterbug-production-current", { unit: "qa" }))
      .toThrow(/--unit is not configurable/);
  });

  it("refuses a Shutterbug endpoint for the local mode", () => {
    expect(() => getRenderBackend("puppeteer-full-height",
      { unit: "qa", shutterbugUrl: "https://api.concord.org/shutterbug-staging" }))
      .toThrow(/--shutterbug-url is not configurable for --mode puppeteer-full-height/);
  });

  it("refuses a capture height for the local mode rather than dropping it", () => {
    // This mode always captures the whole document, so accepting the flag and ignoring it would
    // answer a different question from the one that was asked.
    expect(() => getRenderBackend("puppeteer-full-height", { unit: "qa", captureHeightPx: 1500 }))
      .toThrow(/--capture-height is not configurable for --mode puppeteer-full-height/);
  });

  it("builds every mode the way `plan` asks for it", () => {
    // `plan` prints each run's prerequisites, and passed a unit to every mode — which the parity
    // baseline refuses, so `plan` threw before printing anything for an experiment using it.
    for (const mode of renderModeIds) {
      const unit = mode === "puppeteer-full-height" ? "harness-render" : undefined;
      expect(() => getRenderBackend(mode, { unit, clueRevision: null })).not.toThrow();
    }
  });

  it("says what each mode needs before it can run, naming the hosts", () => {
    // "Truthy" passed for any non-empty string, including one naming the wrong endpoint. What a
    // reader needs from this line is where the run will reach.
    const prerequisitesOf = (mode: string, unit?: string) =>
      getRenderBackend(mode, { unit, clueRevision: null }).prerequisites;
    expect(prerequisitesOf("puppeteer-full-height", "harness-render"))
      .toContain("a CLUE dev server at http://localhost:8080");
    expect(prerequisitesOf("shutterbug-production-current"))
      .toContain("https://api.concord.org/shutterbug-production");
    // Omitting --shutterbug-url posts student work at staging; the line has to say so.
    expect(prerequisitesOf("shutterbug-parameterized"))
      .toContain("https://api.concord.org/shutterbug-staging");
    for (const mode of renderModeIds) {
      expect({ mode, key: prerequisitesOf(mode, mode === "puppeteer-full-height" ? "harness-render" : undefined)
        .includes("no OpenAI key") }).toEqual({ mode, key: true });
    }
  });

  it("supplies the harness rendering unit for the local mode rather than leaving it unset", () => {
    // The mode descriptor supplies it, rather than the caller deciding by string comparison in the
    // CLI. Getting it wrong is silent: CLUE falls back to its default unit and every tile draws as
    // an unknown tile in a perfectly valid PNG.
    expect(getRenderBackend("puppeteer-full-height", { clueRevision: null }).renderTarget.unit)
      .toBe("harness-render");
    // An explicit unit still wins.
    expect(getRenderBackend("puppeteer-full-height", { unit: "qa", clueRevision: null })
      .renderTarget.unit).toBe("qa");
  });

  it("builds the parameterized mode with everything given", () => {
    const backend = getRenderBackend("shutterbug-parameterized", {
      clueUrl: "http://localhost:8080",
      unit: "qa",
      shutterbugUrl: "https://api.concord.org/shutterbug-staging",
      captureHeightPx: 3000
    });
    expect(backend.renderTarget).toMatchObject({
      clueUrl: "http://localhost:8080", unit: "qa", captureHeightPx: 3000
    });
  });
});

describe("the per-tile capture", () => {
  const perTile = (options: FakeOptions = {}, overrides: Record<string, unknown> = {}) =>
    makeBackend(options, { capture: "per-tile", ...overrides });

  const threeTiles = [
    { tileId: "tile-a", widthPx: 300, heightPx: 200 },
    { tileId: "tile-b", widthPx: 480, heightPx: 320 },
    { tileId: "tile-c", widthPx: 120, heightPx: 90 }
  ];

  it("takes one picture per top-level tile, tagged with the tile it is a picture of", async () => {
    const { backend } = perTile({ tiles: threeTiles });
    const outcome = await backend.render({ docId: "three", content: emptyDocument });
    expect(outcome.images).toHaveLength(3);
    expect(outcome.images.map((image) => image.tileId)).toEqual(["tile-a", "tile-b", "tile-c"]);
    for (const image of outcome.images) {
      expect(image.purpose).toBe("tile");
      // A tile picture is a local capture, so it carries bytes and no hosted URL.
      expect(image.url).toBeNull();
      expect(image.bytes.length).toBeGreaterThan(0);
    }
    // Each picture really is that tile's own size, not the page's.
    expect(outcome.images.map((image) => readPngInfo(image.bytes, "tile").widthPx))
      .toEqual([300, 480, 120]);
  });

  it("records a per-tile capture as its own capture mode", () => {
    // Not "full-document": the set covers the document, but no single image is the document, and a
    // freshness check comparing targets has to be able to tell the two renders apart.
    expect(perTile().backend.renderTarget.captureMode).toBe("per-tile");
    expect(perTile().backend.renderTarget.captureHeightPx).toBeNull();
    expect(makeBackend().backend.renderTarget.captureMode).toBe("full-document");
  });

  it("fails a document that drew no tiles rather than writing an empty envelope", async () => {
    // An envelope with no images is treated as damaged everywhere else, so producing one here would
    // be indistinguishable from a broken render.
    const { backend } = perTile({ tiles: [] });
    await expect(backend.render({ docId: "bare", content: emptyDocument }))
      .rejects.toThrow(/drew no tiles, so a per-tile capture would produce no images at all/);
  });

  it("applies every size bound per image rather than to the set", async () => {
    const { backend } = perTile(
      { tiles: [{ tileId: "huge", widthPx: 960, heightPx: 30_000 }] },
      { limits: { maxHeightPx: 20_000, maxPixels: 40_000_000, maxEncodedBytes: 20 * 1024 * 1024 } });
    await expect(backend.render({ docId: "huge", content: emptyDocument }))
      .rejects.toThrow(/30000px tall, over the 20000px limit/);
  });

  it("records a tile with no id as having none, rather than as an empty one", async () => {
    // An empty string would be matched against the classification and silently find nothing; null
    // says outright that this picture cannot be traced back to a tile.
    const { backend } = perTile({ tiles: [{ tileId: "", widthPx: 100, heightPx: 100 }] });
    const outcome = await backend.render({ docId: "anonymous", content: emptyDocument });
    expect(outcome.images[0].tileId).toBeNull();
  });

  it("still reports what it could see, the same as a full-document capture", async () => {
    const { backend } = perTile({ tiles: threeTiles, measurement: { totalTiles: 3, unknownTiles: 1 } });
    const outcome = await backend.render({ docId: "three", content: emptyDocument });
    expect(outcome.diagnostics)
      .toMatchObject({ totalTiles: 3, unknownTiles: 1, documentText: "drawing-fixture-marker" });
  });
});
