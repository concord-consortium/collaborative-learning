/**
 * The default render mode: build the page production sends to Shutterbug, load it in headless
 * Chromium, and screenshot the iframe.
 *
 * This renders through the *same* iframe pathway production's screenshots use — same HTML, same
 * `iframe.html?unwrapped&readOnly` entry point, same `initialValue` message. The only difference is
 * who takes the picture, and that the picture is the whole document rather than production's first
 * 1500 pixels. The harness captures reality; production's clipping is a production concern.
 *
 * Puppeteer is imported lazily so that every other module here — and every test that does not drive
 * a browser — loads without it.
 */
import { CaptureMode, RenderTarget } from "../schemas.js";
import { readPngInfo } from "../png.js";
import { generateRenderHtml, iframeUrlFor, kInitialFrameHeightPx } from "./render-html.js";
import {
  RenderBackend, RenderDiagnostics, RenderLimits, RenderOutcome, RenderRequest, checkCaptureSize,
  checkEncodedSize, kDefaultRenderLimits
} from "./types.js";

/**
 * The slice of puppeteer this backend uses, written out structurally so a test can supply a fake
 * browser and so the module type-checks whether or not puppeteer is installed.
 *
 * This is also where the capture contract lives. Elements are measured, never screenshotted: every
 * capture — full-document and per-tile alike — is a page screenshot clipped to a measured box,
 * because `ElementHandle.screenshot()` runs scroll-into-view, visibility and viewport machinery
 * before capturing, and that machinery hangs against continuously animating content (a live
 * Dataflow program repaints forever). A plain clipped surface capture does not. The box comes from
 * `boundingBox()`, which reports viewport coordinates, while `page.screenshot` clips in page
 * coordinates — so every capture adds the visual viewport's page offset to the box first (see
 * `viewportPageOffset`), the same conversion puppeteer's own element screenshot performs, rather
 * than relying on the render page never scrolling.
 */
export interface ElementLike {
  boundingBox(): Promise<{ x: number; y: number; width: number; height: number } | null>;
}

export interface FrameLike {
  url(): string;
  evaluate<T>(fn: string | ((...args: any[]) => T), ...args: any[]): Promise<T>;
  /** Every element matching the selector, in document order. Used by the per-tile capture. */
  $$(selector: string): Promise<ElementLike[]>;
}

export interface PageLike {
  setViewport(viewport: { width: number; height: number }): Promise<void>;
  /** Evidence capture (no clip), and the per-tile capture (clipped to a tile's box). */
  screenshot(options: {
    type: "png";
    clip?: { x: number; y: number; width: number; height: number };
    captureBeyondViewport?: boolean;
  }): Promise<Uint8Array | Buffer>;
  goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  evaluate<T>(fn: string | ((...args: any[]) => T), ...args: any[]): Promise<T>;
  waitForFunction(
    fn: string | ((...args: any[]) => unknown),
    options?: { timeout?: number; polling?: number },
    ...args: any[]
  ): Promise<unknown>;
  $(selector: string): Promise<ElementLike | null>;
  frames(): FrameLike[];
  on(event: string, handler: (payload: any) => void): void;
  close(): Promise<void>;
}

export interface BrowserLike {
  newPage(): Promise<PageLike>;
  close(): Promise<void>;
}

/**
 * Bumped when the capture pipeline changes in a way that makes stored renders untrustworthy; the
 * freshness check invalidates every envelope recorded under an older version.
 *
 * 2: the render page is served over loopback HTTP and navigated to (never `setContent`), and
 * readiness is measured inside the CLUE frame rather than taken from the `updateHeight` message.
 *
 * 3: the frame height counts top-level tile rows only, the viewport grows to cover the resized
 * frame, and the render page is served same-site with a localhost CLUE server.
 */
export const kPuppeteerBackendVersion = 3;

/** Production's screenshots are about this wide once the iframe fills Shutterbug's page. */
export const kDefaultViewportWidthPx = 960;

/** How long the height has to stay put before rendering counts as settled. */
export const kDefaultStableForMs = 500;

/**
 * Per document, covering load, settle and capture — one deadline for the whole render, not one per
 * phase. Given separately to `setContent` and to each of the four readiness waits, a stuck document
 * could spend five times this before the capture even began.
 */
export const kDefaultRenderTimeoutMs = 30_000;

export class RenderFailed extends Error {
  constructor(
    public readonly docId: string,
    public readonly detail: string,
    public readonly context: {
      url: string;
      heightPx: number | null;
      consoleOutput: string[];
      /**
       * What the page looked like when it failed. Attached where one could be taken — a visual
       * failure often leaves an empty console and a half-drawn page, and the picture is then the
       * only evidence of what went wrong.
       */
      screenshot?: Buffer;
    }
  ) {
    super(`${docId}: ${detail} (rendering ${context.url}; last reported height ` +
      `${context.heightPx ?? "none"})`);
    this.name = "RenderFailed";
  }
}

export interface PuppeteerBackendOptions {
  /**
   * The `--mode` id this backend is being built for, which is also the directory its envelopes are
   * filed under. Passed in rather than fixed: the same backend serves more than one mode, and a
   * hardcoded id filed a per-tile render on top of the full-document one.
   */
  modeId: string;
  clueUrl: string;
  /**
   * The unit's stable identifier — what goes into the render target and is compared for freshness.
   */
  unit: string;
  /**
   * Where CLUE actually fetches the unit from, when that is not the identifier itself. The harness's
   * own rendering unit is served on an ephemeral loopback port, and a port number changes on every
   * run — recording *that* would make every stored render look stale immediately.
   */
  unitUrl?: string;
  /** The CLUE commit plus dirty flag being rendered. `null` is recorded and warned about. */
  clueRevision: string | null;
  viewportWidthPx?: number;
  limits?: RenderLimits;
  timeoutMs?: number;
  stableForMs?: number;
  /** How often the frame is measured while waiting. Lowered in tests to keep them quick. */
  pollIntervalMs?: number;
  /** Injected by tests. The default lazily imports puppeteer and launches headless Chromium. */
  launch?: () => Promise<BrowserLike>;
  /** Injected by tests, so a fake browser needs no real loopback server. */
  startPageServer?: () => Promise<RenderPageServer>;
  /**
   * What the mode captures: one picture of the whole document, or one per top-level tile.
   *
   * Per-tile is the same page, the same readiness protocol and the same sizing — only the last step
   * differs, so the two modes cannot disagree about when a document is ready to photograph.
   */
  capture?: Extract<CaptureMode, "full-document" | "per-tile">;
}

export async function launchPuppeteer(): Promise<BrowserLike> {
  const puppeteer = await import("puppeteer");
  const browser = await (puppeteer as any).default.launch({ headless: true });
  return browser as BrowserLike;
}

/**
 * What is measured inside the CLUE frame, both to decide when rendering has settled and to report
 * what was drawn.
 *
 * The height comes from `#app`, not from the `updateHeight` message. CLUE posts
 * `document.body.scrollHeight` (src/iframe/iframe.tsx), and in this build the body has no scroll
 * height — the content lives inside `#app` — so the message reports 0 for a perfectly rendered
 * document, and waiting on it could never succeed. Measuring inside the frame is available to the
 * harness precisely because it drives the browser; production cannot, which is why an explicit
 * "document rendered" message remains the right production-side fix.
 *
 * `tool-tile` is the class every tile carries, and the placeholder component adds `placeholder-tile`
 * alongside it. An unregistered tile type becomes an `Unknown` content model drawn by that
 * component, and nothing is logged when it happens — so this count is the only way a render notices
 * that the unit did not register what the document uses.
 */
const kMeasureFrameScript = `(() => {
  const app = document.getElementById('app');
  // Top-level rows only, the same not-nested selector idea as kTileSelector: a Question tile's
  // nested rows are .tile-row elements too, and their height is already inside their parent's.
  const rows = document.querySelectorAll('.tile-row:not(.tile-row .tile-row)');
  let rowsHeight = 0;
  rows.forEach((row) => { rowsHeight += row.getBoundingClientRect().height; });
  const documentError = document.querySelector('.document-error');
  return {
    // CLUE renders its own "Error loading the document" page when it cannot deserialize what it was
    // handed. That page photographs perfectly well, which is exactly the problem: without this the
    // capture is a valid PNG of an error screen, stored as though it were the student's work.
    documentFailedToLoad: !!documentError,
    contentHeightPx: app ? app.scrollHeight : 0,
    // The document's own height — the tile rows themselves. CLUE lays out to fill its viewport (the
    // iframe element) rather than to its content, so nothing else reports how tall the document
    // actually is: the scroller always matches the frame exactly, at any frame height. Sizing the
    // frame from this is what makes the capture the whole document rather than a viewport of it.
    contentRowsHeightPx: Math.ceil(rowsHeight),
    // Every tile, nested ones included — deliberately not \`kTileSelector\`, which photographs
    // top-level tiles only. This one is counting what drew, and an unregistered tile type inside a
    // Question is exactly as worth reporting as one in a row of its own.
    totalTiles: document.querySelectorAll('.tool-tile').length,
    unknownTiles: document.querySelectorAll('.placeholder-tile').length,
    fontsReady: !document.fonts || document.fonts.status === 'loaded'
  };
})()`;

/**
 * The rendered text, read once after settling rather than on every poll: it is a full layout and
 * text serialization of the document, and only the final value is ever used.
 */
const kReadDocumentTextScript = "document.body ? document.body.innerText : ''";

export interface FrameMeasurement {
  /** True when CLUE showed its document-error page instead of the document. */
  documentFailedToLoad: boolean;
  contentHeightPx: number;
  contentRowsHeightPx: number;
  totalTiles: number;
  unknownTiles: number;
  fontsReady: boolean;
}

/**
 * The generated page, served over loopback HTTP.
 *
 * `page.setContent` was the obvious way to do this, and it is the reason version 1 rendered nothing:
 * it leaves the document on an opaque origin, so Chromium denies storage access to the CLUE iframe
 * and CLUE throws reading `localStorage` before it finishes booting. Serving the same HTML from a
 * real http origin gives the embedded application the origin it expects. Shutterbug does this by
 * construction, which is why production never hit it.
 */
export interface RenderPageServer {
  /**
   * Registers a document's HTML and returns the URL to navigate to, plus a `forget` that drops it
   * again. The page holds the whole document, so it is dropped as soon as the render is done rather
   * than kept until the server closes.
   */
  serve(docId: string, html: string): { url: string; forget(): void };
  close(): Promise<void>;
}

/**
 * `urlHost` chooses the host the page is served and addressed on (default `127.0.0.1`). Passing
 * `localhost` makes the render page same-SITE with a localhost CLUE server, which keeps the CLUE
 * iframe in the same renderer process — see the comment at `openPageServer` for what a cross-site
 * frame does to captures.
 */
export async function startRenderPageServer(
  options: { urlHost?: string } = {}
): Promise<RenderPageServer> {
  const urlHost = options.urlHost ?? "127.0.0.1";
  const http = await import("node:http");
  const pages = new Map<string, string>();
  const server = http.createServer((request, response) => {
    let key: string;
    try {
      key = decodeURIComponent((request.url ?? "").split("?")[0].replace(/^\//, ""));
    } catch {
      // `decodeURIComponent` throws on a malformed percent sequence, and this handler is
      // synchronous, so an unhandled throw here takes the whole process down.
      response.writeHead(400, { "content-type": "text/plain" });
      response.end("bad request");
      return;
    }
    const html = pages.get(key);
    if (html === undefined) {
      response.writeHead(404, { "content-type": "text/plain" });
      response.end("not found");
      return;
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    response.end(html);
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    // Bound by the same name the URL uses: on a machine where `localhost` resolves to ::1 first, a
    // server bound to 127.0.0.1 would not answer a http://localhost URL.
    server.listen(0, urlHost, resolve);
  });
  const { port } = server.address() as { port: number };
  return {
    // Keyed per document, so concurrent pages cannot serve each other's HTML.
    serve(docId: string, html: string) {
      pages.set(docId, html);
      return {
        url: `http://${urlHost}:${port}/${encodeURIComponent(docId)}`,
        forget: () => { pages.delete(docId); }
      };
    },
    close: () => new Promise<void>((resolve) => {
      // `close` alone waits for connections that are mid-request, which a browser hung part-way
      // through reading a page would leave behind — and this resolves the promise `close()` awaits
      // before exiting, so waiting on one is a CLI that never returns. Idle keep-alive sockets are
      // dropped by `close` itself; this is for the ones that are not idle.
      server.closeAllConnections();
      server.close(() => resolve());
    })
  };
}

/**
 * One deadline for a whole document's render, shared by every phase.
 *
 * Each phase asks for the time that is left rather than getting a fresh allowance, so the budget is
 * what it says it is however many phases a document gets stuck in.
 */
class RenderDeadline {
  private readonly expiresAt: number;

  constructor(public readonly totalMs: number, now: number = Date.now()) {
    this.expiresAt = now + totalMs;
  }

  remainingMs(now: number = Date.now()): number {
    return this.expiresAt - now;
  }

  /** Time left for the next phase, or a failure when the budget is already gone. */
  requireRemaining(docId: string, what: string, context: RenderFailed["context"]): number {
    const remaining = this.remainingMs();
    if (remaining <= 0) {
      throw new RenderFailed(docId,
        `the ${this.totalMs}ms budget for this document ran out before ${what}`, context);
    }
    return remaining;
  }
}

/**
 * Waits for a page function to become true, turning puppeteer's own timeout into a `RenderFailed`
 * that says which document, which URL and what height was last reported.
 */
async function waitFor(
  page: PageLike, docId: string, what: string, script: string,
  deadline: RenderDeadline, contextOf: () => RenderFailed["context"]
): Promise<void> {
  const timeout = deadline.requireRemaining(docId, what, contextOf());
  try {
    await page.waitForFunction(script, { timeout, polling: 100 });
  } catch (error) {
    throw new RenderFailed(docId, `${what} (${(error as Error).message})`, contextOf());
  }
}

interface RenderState {
  heightPx: number | null;
  consoleOutput: string[];
  fatal: string[];
}

/**
 * What actually means the document did not render, as opposed to noise.
 *
 * Treating every console error and every failed request as fatal was too blunt to survive contact
 * with a real CLUE server: it logs React key warnings at error level, and it probes for an optional
 * `teacher-guide/content.json` that legitimately 404s. Neither says anything about whether the
 * document drew. What does: an uncaught exception, and a module that failed to load — a tile type
 * whose dynamic import fails renders nothing while everything around it looks fine.
 *
 * Everything is still written to the evidence file either way; this only decides what fails a render.
 */
const kFatalConsolePatterns = [
  /Failed to fetch dynamically imported module/i,
  /Loading chunk \S+ failed/i,
  /ChunkLoadError/i,
  /Unable to find tile model/i
];

function isFatalConsoleLine(line: string): boolean {
  return kFatalConsolePatterns.some((pattern) => pattern.test(line));
}

/** A failed script request means code that should have run did not. Other assets are not fatal. */
function isFatalRequestFailure(url: string): boolean {
  return /\.m?js(\?|$)/i.test(url);
}

/**
 * How many tiles the document we are about to send should draw.
 *
 * Waiting for the frame to show at least this many replaces a pure timing heuristic with a fact.
 * "Height and tile count unchanged for a while" is satisfiable *before* CLUE has finished loading
 * its dynamically imported tile modules — the page has a stable height and zero tiles — which
 * produced a clean, empty screenshot for a document that renders fine given another second.
 *
 * A lower bound on purpose: tiles nested inside a Question tile are not counted here, and counting
 * them low only ever makes the wait end sooner than it could have, never sooner than it should.
 */
export function expectedTileCount(content: unknown): number {
  const rowMap = (content as { rowMap?: Record<string, { tiles?: { tileId?: string }[] }> })?.rowMap;
  const ids = new Set<string>();
  for (const row of Object.values(rowMap ?? {})) {
    for (const tile of row?.tiles ?? []) if (tile?.tileId) ids.add(tile.tileId);
  }
  // An empty walk falls through to the tile map rather than answering 0. Expecting no tiles at all
  // is satisfied by any state whatsoever, including a page that has not finished loading, whose
  // screenshot is blank.
  if (ids.size > 0) return ids.size;
  const tileMap = (content as { tileMap?: Record<string, unknown> })?.tileMap;
  return tileMap ? Object.keys(tileMap).length : 0;
}

/** Re-exported for the callers that reach for it here; defined in `render-html.ts`, which says why. */
export { kInitialFrameHeightPx };

/** Room for the document's own chrome — margins and the annotation layer — above the tile rows. */
const kDocumentChromePx = 80;

/**
 * The tile elements a per-tile capture photographs, and the attribute carrying each one's id.
 *
 * `.tool-tile` is the element `TileComponent` renders (`data-testid="tool-tile"`), and it carries
 * `data-tool-id` — the tile model's id, which is what the envelope records so a per-tile image can
 * be matched back to the tile it is a picture of.
 *
 * The `:not()` is what makes this top-level tiles rather than all of them. A Question tile renders a
 * `RowListComponent` (`src/components/tiles/question/question-tile.tsx`), and the tiles inside it are
 * `.tool-tile` elements too — so a bare `.tool-tile` photographs the Question *and* each tile drawn
 * inside it, which duplicates content the outer picture already contains and gives one top-level tile
 * several images. A nested tile is drawn within its parent's picture; that is the picture of it.
 */
const kTileSelector = ".tool-tile:not(.tool-tile .tool-tile)";
const kReadTileIdsScript = `Array.from(document.querySelectorAll('${kTileSelector}'))
  .map((tile) => tile.getAttribute('data-tool-id') || '')`;

/**
 * An overflow this small, which growing the frame does not reduce, is a rounding or border artifact
 * rather than a clipped document — some containers report a scrollHeight a few pixels over their
 * clientHeight however tall they are made. Anything larger that will not shrink is a real clip, and
 * fails rather than being recorded as a full-document capture.
 */
const kOverflowTolerancePx = 16;

/**
 * How much smaller than its clip box a captured PNG may come back before it fails the render.
 *
 * A clipped, `captureBeyondViewport: false` screenshot is not a promise: puppeteer intersects the
 * clip with the visual viewport before capturing (`Page._screenshot` in cdp/Page.js, 22.13), so a
 * frame that outgrows the viewport after `setViewport` — the render page's `updateHeight` listener
 * is permanent, so a late message can grow it during the post-resize settle — captures short with
 * no error, and every box-based check passes because the box grew right along with the frame. The
 * decoded PNG is the only witness to what was actually captured, so the backend compares its
 * dimensions against the clip. `setViewport` never sets `deviceScaleFactor`, so it is 1 and PNG
 * pixels compare directly with CSS pixels; two pixels covers fractional-box rounding on either
 * side of the encode, while a viewport cut is tens to thousands of pixels.
 */
const kCaptureShortfallTolerancePx = 2;

/** Reads the visual viewport's page offset — [0, 0] unless something scrolled the render page. */
const kViewportOffsetScript = `(() => {
  const viewport = window.visualViewport;
  return viewport ? [viewport.pageLeft, viewport.pageTop] : [0, 0];
})()`;

/**
 * The offset that converts a `boundingBox()` (viewport coordinates) into the page coordinates
 * `page.screenshot` clips in — see the capture contract on `ElementLike`. The fallback covers
 * environments with no `visualViewport` (and test fakes that answer only the scripts they know),
 * where the page cannot have scrolled and the offset is zero.
 */
export async function viewportPageOffset(page: PageLike): Promise<{ leftPx: number; topPx: number }> {
  const value = await page.evaluate(kViewportOffsetScript) as unknown;
  const [leftPx, topPx] = Array.isArray(value) && value.length === 2 ? value : [0, 0];
  return { leftPx: Number(leftPx) || 0, topPx: Number(topPx) || 0 };
}

async function setFrameHeight(page: PageLike, heightPx: number): Promise<void> {
  await page.evaluate(`(() => {
    const frame = document.getElementById('clue-frame');
    if (frame) frame.height = ${Math.ceil(heightPx)} + 'px';
  })()`);
}

/**
 * Bounds an operation that has no timeout of its own by what is left of the document's budget.
 *
 * `page.$`, `boundingBox()` and `screenshot()` take no timeout, so checking the clock before the
 * capture bounded only the decision to start it, not the capture itself — a wedged page or a
 * pathological encode could run indefinitely past a budget documented as covering it.
 *
 * The losing operation is not cancellable; the page is closed in the caller's `finally`, which
 * settles it. Its result is swallowed so a late rejection is never unhandled.
 */
async function withinDeadline<T>(
  operation: Promise<T>, docId: string, what: string, deadline: RenderDeadline,
  contextOf: () => RenderFailed["context"]
): Promise<T> {
  const remaining = deadline.requireRemaining(docId, what, contextOf());
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new RenderFailed(docId,
          `${what} did not finish within the ${deadline.totalMs}ms budget for this document`,
          contextOf())), remaining);
      })
    ]);
  } finally {
    clearTimeout(timer);
    operation.catch(() => undefined);
  }
}

/** The CLUE frame, once it exists. Polled rather than awaited: frames appear asynchronously. */
async function waitForClueFrame(
  page: PageLike, docId: string, deadline: RenderDeadline, pollIntervalMs: number,
  contextOf: () => RenderFailed["context"]
): Promise<FrameLike> {
  for (;;) {
    deadline.requireRemaining(docId, "the CLUE iframe appeared", contextOf());
    const frame = page.frames().find((candidate) => candidate.url().includes("iframe.html"));
    if (frame) return frame;
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

/**
 * Polls the frame until it has drawn something and stopped changing.
 *
 * "Stopped changing" is the height holding still for `stableForMs`, with the fonts reported loaded.
 * Neither `networkidle0` nor a single height reading proves rendering finished: dynamically imported
 * tile modules and async tile content settle well after the first paint, and some pages never go
 * network-idle at all.
 */
async function waitUntilSettled(
  frame: FrameLike, docId: string, deadline: RenderDeadline, stableForMs: number,
  pollIntervalMs: number, expectedTiles: number, contextOf: () => RenderFailed["context"]
): Promise<FrameMeasurement> {
  // Two clocks: one for "everything has settled, tiles included", and one for "everything except
  // the tiles has settled". A page that never reaches its expected tile count must still stop
  // waiting eventually, so the second clock accepts what is there once it has been quiet for a good
  // while longer, and the caller decides whether what is there is worth keeping.
  const graceMs = stableForMs * 6;
  let previous: FrameMeasurement | undefined;
  let stableSince: number | undefined;
  let quietSince: number | undefined;
  for (;;) {
    deadline.requireRemaining(docId,
      `the document finished rendering (expected ${expectedTiles} tile(s))`, contextOf());
    let measured: FrameMeasurement;
    try {
      measured = await frame.evaluate<FrameMeasurement>(kMeasureFrameScript);
    } catch {
      // The frame can navigate or reload underneath us; try again until the deadline says otherwise.
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      continue;
    }
    const quiet = measured.contentHeightPx > 0 && measured.fontsReady &&
      previous?.contentHeightPx === measured.contentHeightPx &&
      previous?.totalTiles === measured.totalTiles;
    // Every tile the document declares has appeared, so this is not a stable *empty* page — the
    // state a purely timing-based wait would happily accept while CLUE was still loading its
    // dynamically imported tile modules.
    const complete = quiet && measured.totalTiles >= expectedTiles;

    if (!quiet) {
      quietSince = undefined;
      stableSince = undefined;
    } else {
      quietSince ??= Date.now();
      if (complete) {
        stableSince ??= Date.now();
        if (Date.now() - stableSince >= stableForMs) return measured;
      } else {
        stableSince = undefined;
        if (Date.now() - quietSince >= graceMs) return measured;
      }
    }
    previous = measured;
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

export function puppeteerBackend(options: PuppeteerBackendOptions): RenderBackend {
  const {
    modeId, clueUrl, unit, clueRevision,
    // Loaded from wherever it is served; recorded under its stable identifier.
    unitUrl = unit,
    viewportWidthPx = kDefaultViewportWidthPx,
    limits = kDefaultRenderLimits,
    timeoutMs = kDefaultRenderTimeoutMs,
    stableForMs = kDefaultStableForMs,
    pollIntervalMs = 100,
    capture = "full-document"
  } = options;
  const launch = options.launch ?? launchPuppeteer;
  const startPageServer = options.startPageServer;

  const renderTarget: RenderTarget = {
    clueUrl,
    unit,
    clueRevision,
    shutterbugUrl: null,
    viewportWidthPx,
    captureMode: capture,
    captureHeightPx: null
  };

  // The launch promise, not the browser: two concurrent first-renders would both read an undefined
  // `browser`, both launch Chromium, and `close()` would then shut down only one of them, leaving
  // the other process alive. `render` awaits `open()` first today, so this is latent rather than
  // active — but a second entry point would find it.
  let browserPromise: Promise<BrowserLike> | undefined;
  const openBrowser = () => (browserPromise ??= launch());
  // The render page has to come from a real http origin; see startRenderPageServer. When the CLUE
  // server is on localhost, the page is served from localhost too: with the page on 127.0.0.1 the
  // CLUE iframe is cross-SITE, Chromium puts it in its own process and rasterizes it only near the
  // visible viewport, so everything below captures as blank pixels. Same site, same process,
  // none of that.
  const sameSiteHost = (() => {
    try {
      return new URL(clueUrl).hostname === "localhost" ? "localhost" : undefined;
    } catch {
      return undefined;
    }
  })();
  let pageServerPromise: Promise<RenderPageServer> | undefined;
  const openPageServer = () => (pageServerPromise ??=
    startPageServer ? startPageServer() : startRenderPageServer({ urlHost: sameSiteHost }));

  return {
    modeId,
    backendId: "puppeteer",
    backendVersion: kPuppeteerBackendVersion,
    // "local", not "offline": the CLUE page it loads may still pull fonts, images or other assets
    // from elsewhere. Guaranteeing offline operation would mean intercepting and rejecting every
    // non-localhost request, and a test asserting it.
    kind: "local",
    prerequisites: `a CLUE dev server at ${clueUrl} (npm start); no OpenAI key`,
    renderTarget,

    // One browser and one page server for the whole run; a page per document, closed in a finally.
    async open() {
      await Promise.all([openBrowser(), openPageServer()]);
    },
    async close() {
      const pendingBrowser = browserPromise;
      const pendingServer = pageServerPromise;
      browserPromise = undefined;
      pageServerPromise = undefined;
      // Both are closed whatever either one does. Awaiting the browser first meant a crashed
      // Chromium — whose `close()` rejects — left the loopback page server listening, and its open
      // handle keeps the CLI alive after the error has been printed.
      const results = await Promise.allSettled([
        pendingBrowser?.then((browser) => browser.close()),
        pendingServer?.then((server) => server.close())
      ]);
      const failed = results.find((result) => result.status === "rejected");
      if (failed) throw (failed as PromiseRejectedResult).reason;
    },

    async render(request: RenderRequest): Promise<RenderOutcome> {
      const [browser, pageServer] = await Promise.all([openBrowser(), openPageServer()]);
      const url = iframeUrlFor(clueUrl, unitUrl);
      // One budget for the whole document: load, every readiness wait, and the capture.
      const deadline = new RenderDeadline(timeoutMs);
      const state: RenderState = { heightPx: null, consoleOutput: [], fatal: [] };
      const page = await browser.newPage();
      const contextOf = (): RenderFailed["context"] =>
        ({ url, heightPx: state.heightPx, consoleOutput: state.consoleOutput });
      let forgetPage = () => undefined as void;
      try {
        // Anything that stops the page from being what it claims to be is fatal. A render failure is
        // a bug to look at, not a transient — there is no retry.
        page.on("pageerror", (error: Error) => {
          state.fatal.push(`page error: ${error.message}`);
          state.consoleOutput.push(`page error: ${error.message}`);
        });
        page.on("console", (message: { type(): string; text(): string }) => {
          const line = `${message.type()}: ${message.text()}`;
          state.consoleOutput.push(line);
          if (isFatalConsoleLine(line)) state.fatal.push(line);
        });
        page.on("requestfailed", (failed: { url(): string; failure(): { errorText: string } | null }) => {
          const line = `request failed: ${failed.url()} (${failed.failure()?.errorText ?? "unknown"})`;
          state.consoleOutput.push(line);
          if (isFatalRequestFailure(failed.url())) state.fatal.push(line);
        });

        await page.setViewport({ width: viewportWidthPx, height: 1024 });
        const html = generateRenderHtml({ content: request.content, clueUrl, unit: unitUrl });
        const served = pageServer.serve(request.docId, html);
        forgetPage = served.forget;
        // Navigated to, not injected: `setContent` leaves an opaque origin and CLUE cannot read
        // localStorage from inside it.
        await page.goto(served.url, {
          waitUntil: "domcontentloaded",
          timeout: deadline.requireRemaining(request.docId, "the page was loaded", contextOf())
        });

        await waitFor(page, request.docId, "the render page never posted the document to the iframe",
          "window.__clueRender && window.__clueRender.initialValuePosted === true",
          deadline, contextOf);

        // The CLUE frame, then its content — measured inside the frame rather than taken from the
        // `updateHeight` message, which reports 0 for a perfectly rendered document.
        const frame = await waitForClueFrame(page, request.docId, deadline, pollIntervalMs, contextOf);
        const expectedTiles = expectedTileCount(request.content);
        let measured = await waitUntilSettled(
          frame, request.docId, deadline, stableForMs, pollIntervalMs, expectedTiles, contextOf);

        // Checked before the resize, so a document that never loaded fails on the cheap path rather
        // than after being measured, resized, settled again and photographed.
        if (measured.documentFailedToLoad) {
          throw new RenderFailed(request.docId,
            "CLUE could not load this document and showed its error page instead. A capture would " +
            "be a valid picture of an error screen stored as though it were the student's work — " +
            "see the screenshot in this document's render-errors directory", contextOf());
        }

        const failOnFatal = () => {
          if (state.fatal.length > 0) {
            throw new RenderFailed(request.docId, `the page reported ${state.fatal.length} error(s): ` +
              state.fatal.join("; "), contextOf());
          }
        };
        failOnFatal();

        // Size the iframe to the document, then let it settle again.
        //
        // CLUE lays out to fill its viewport rather than to its content, so at the default 500px the
        // capture is a viewport of the document, not the document — and for a long one the rest is
        // simply absent, with nothing in the DOM reporting that it was cut off. The tile rows are
        // the only thing that says how tall the document really is.
        const wantedHeightPx = Math.max(
          kInitialFrameHeightPx, measured.contentRowsHeightPx + kDocumentChromePx);
        if (wantedHeightPx > kInitialFrameHeightPx) {
          checkCaptureSize(request.docId, viewportWidthPx, Math.ceil(wantedHeightPx), limits);
          await setFrameHeight(page, wantedHeightPx);
          // The viewport grows with the frame. Chromium rasterizes a cross-site iframe only near
          // the visible viewport, so with a 1024px viewport a taller document's lower rows mount,
          // measure — and capture as blank. Same-site serving (see openPageServer) removes the
          // cross-site part; covering the frame with the viewport makes the capture independent of
          // it. checkCaptureSize just bounded the height, so this cannot grow without limit.
          await page.setViewport({ width: viewportWidthPx, height: Math.ceil(wantedHeightPx) + 64 });
          measured = await waitUntilSettled(
            frame, request.docId, deadline, stableForMs, pollIntervalMs, expectedTiles, contextOf);
        }
        // Checked again after the resize, because the second settle has its own failures: a fatal
        // console line or a failed script request there would otherwise reach the evidence file
        // without failing anything, and the document would be captured as if nothing had happened.
        failOnFatal();
        // The guarantee that nothing is cut off is made by construction — the frame is sized to
        // cover the tile rows, and the capture is checked against them below — rather than by a DOM
        // overflow reading. Measured directly, `.document-content` reports zero overflow at every
        // frame height, while the same selector read during a settle reports a constant ~75px for
        // documents whose content is a third of the frame; whatever that describes, it is not "the
        // document is cut off".
        state.heightPx = measured.contentHeightPx;

        const diagnosticsOf = async (): Promise<RenderDiagnostics> => ({
          reportedHeightPx: measured.contentHeightPx,
          unknownTiles: measured.unknownTiles,
          totalTiles: measured.totalTiles,
          documentText: await withinDeadline(
            frame.evaluate<string>(kReadDocumentTextScript), request.docId, "reading the document text",
            deadline, contextOf).catch(() => null),
          consoleWarnings: state.consoleOutput.filter((line) => line.startsWith("warning:"))
        });

        // Both capture paths clip page screenshots, so both need the same viewport-to-page
        // conversion; computed once, after the page has settled.
        const pageOffset = await viewportPageOffset(page);

        if (capture === "per-tile") {
          // One picture per top-level tile, of the same settled and resized page. Both reads use
          // `kTileSelector`, so the handles and the ids describe the same elements — the mismatch
          // check below is the backstop for that, since they are paired by index.
          const [handles, tileIds] = await Promise.all([
            withinDeadline(frame.$$(kTileSelector), request.docId, "finding the document's tiles",
              deadline, contextOf),
            withinDeadline(frame.evaluate<string[]>(kReadTileIdsScript), request.docId,
              "reading the tile ids", deadline, contextOf)
          ]);
          if (handles.length === 0) {
            // An envelope with no images is already treated as damaged everywhere else, so a
            // document that photographs to nothing is a failure with evidence rather than an empty
            // envelope nobody can tell from a broken one.
            throw new RenderFailed(request.docId,
              "the document drew no tiles, so a per-tile capture would produce no images at all",
              contextOf());
          }
          if (handles.length !== tileIds.length) {
            throw new RenderFailed(request.docId,
              `found ${handles.length} tile element(s) but ${tileIds.length} tile id(s); the two ` +
              "are read from the same selector, so they cannot be paired", contextOf());
          }
          const images = [];
          for (const [index, handle] of handles.entries()) {
            const tileBox = await withinDeadline(handle.boundingBox(), request.docId,
              `measuring tile ${tileIds[index] || index + 1}`, deadline, contextOf);
            if (!tileBox || tileBox.width <= 0 || tileBox.height <= 0) {
              throw new RenderFailed(request.docId,
                `tile ${tileIds[index] || index + 1} has no visible area ` +
                `(${JSON.stringify(tileBox)})`, contextOf());
            }
            // Every bound applies per image: a per-tile capture multiplies the count, not the
            // allowance.
            checkCaptureSize(request.docId, Math.ceil(tileBox.width), Math.ceil(tileBox.height), limits);
            // A page screenshot clipped to the tile's box, in page coordinates — never
            // `handle.screenshot()`. The whole contract is on `ElementLike`.
            const tileBytes = Buffer.from(await withinDeadline(
              page.screenshot({
                type: "png",
                clip: {
                  x: tileBox.x + pageOffset.leftPx, y: tileBox.y + pageOffset.topPx,
                  width: tileBox.width, height: tileBox.height
                },
                captureBeyondViewport: false
              }),
              request.docId, `capturing tile ${tileIds[index] || index + 1}`, deadline, contextOf));
            checkEncodedSize(request.docId, tileBytes, limits);
            const tileInfo = readPngInfo(tileBytes, `${request.docId} tile ${tileIds[index] || index + 1}`);
            // The pixels really cover the tile's box — see kCaptureShortfallTolerancePx for why a
            // clipped capture can silently come back smaller than what it was asked for.
            if (tileInfo.widthPx + kCaptureShortfallTolerancePx < Math.floor(tileBox.width) ||
                tileInfo.heightPx + kCaptureShortfallTolerancePx < Math.floor(tileBox.height)) {
              throw new RenderFailed(request.docId,
                `tile ${tileIds[index] || index + 1} captured ${tileInfo.widthPx}×${tileInfo.heightPx}px ` +
                `of its ${Math.round(tileBox.width)}×${Math.round(tileBox.height)}px box: the clip was ` +
                "cut to the viewport, and storing it would record a truncated image as the tile",
                contextOf());
            }
            images.push({
              bytes: tileBytes,
              url: null,
              // Empty rather than absent would be a lie: a tile with no id cannot be matched back to
              // the classification, and the selection step needs to know that.
              tileId: tileIds[index] || null,
              purpose: "tile" as const
            });
          }
          return { images, diagnostics: await diagnosticsOf() };
        }

        // Every step of the capture is inside the budget, not merely started inside it.
        const element = await withinDeadline(
          page.$("#clue-frame"), request.docId, "finding the iframe", deadline, contextOf);
        if (!element) {
          throw new RenderFailed(request.docId, "the render page has no #clue-frame element", contextOf());
        }
        const box = await withinDeadline(
          element.boundingBox(), request.docId, "measuring the iframe", deadline, contextOf);
        if (!box || box.width <= 0 || box.height <= 0) {
          throw new RenderFailed(request.docId,
            `the iframe has no visible area (${JSON.stringify(box)})`, contextOf());
        }
        // Checked before the capture, so an unreasonable document fails cheaply rather than after
        // Chromium has tried to encode it.
        checkCaptureSize(request.docId, Math.ceil(box.width), Math.ceil(box.height), limits);
        // The capture really does cover the document, rather than a viewport of it. This is the
        // check that keeps `captureMode: "full-document"` honest.
        if (Math.ceil(box.height) + kOverflowTolerancePx < measured.contentRowsHeightPx) {
          throw new RenderFailed(request.docId,
            `the capture is ${Math.ceil(box.height)}px tall but the document's tiles are ` +
            `${measured.contentRowsHeightPx}px, so it would be a clipped capture recorded as a ` +
            "full-document one", contextOf());
        }

        // A page screenshot clipped to the iframe's box, in page coordinates — never
        // `element.screenshot()`. The whole contract is on `ElementLike`; the pixel check below
        // proves the clip really was in view when the capture happened.
        const bytes = Buffer.from(await withinDeadline(
          page.screenshot({
            type: "png",
            clip: {
              x: box.x + pageOffset.leftPx, y: box.y + pageOffset.topPx,
              width: box.width, height: box.height
            },
            captureBeyondViewport: false
          }), request.docId,
          "capturing the iframe", deadline, contextOf));
        checkEncodedSize(request.docId, bytes, limits);
        // Decoded here as well as when the envelope is written: a screenshot that is not a PNG means
        // the capture path itself is broken, and that is worth saying at the point it happened.
        const pngInfo = readPngInfo(bytes, `${request.docId} screenshot`);
        // And the pixels really cover the box the capture was clipped to. The measured-height check
        // above cannot catch a viewport cut: a frame grown by a late `updateHeight` grows `box`
        // right along with it, and both pass while the PNG comes back short — see
        // kCaptureShortfallTolerancePx.
        if (pngInfo.widthPx + kCaptureShortfallTolerancePx < Math.floor(box.width) ||
            pngInfo.heightPx + kCaptureShortfallTolerancePx < Math.floor(box.height)) {
          throw new RenderFailed(request.docId,
            `the capture came back ${pngInfo.widthPx}×${pngInfo.heightPx}px for a ` +
            `${Math.round(box.width)}×${Math.round(box.height)}px clip: the clip was cut to the ` +
            "viewport, and storing it would record a truncated image as a full-document capture",
            contextOf());
        }

        return {
          images: [{ bytes, url: null, tileId: null, purpose: "full-document" }],
          diagnostics: await diagnosticsOf()
        };
      } catch (error) {
        // Evidence is attached to *any* failure, not only to a RenderFailed. A navigation error, a
        // size-limit rejection or a raw protocol error is exactly when the console output and a
        // picture of the page are most wanted.
        const context = error instanceof RenderFailed ? error.context : contextOf();
        if (!context.screenshot) {
          try {
            // Best effort, and never allowed to replace the real error: a page too broken to render
            // is often too broken to screenshot.
            context.screenshot = Buffer.from(await page.screenshot({ type: "png" }));
          } catch {
            // Nothing to add; the error itself still stands.
          }
        }
        if (!(error instanceof RenderFailed) && error instanceof Error) {
          (error as Error & { context?: RenderFailed["context"] }).context = context;
        }
        throw error;
      } finally {
        // The served page holds the whole document. Dropped here rather than at `close()`, so the
        // server does not accumulate every document in the corpus for the length of the run.
        forgetPage();
        await page.close();
      }
    }
  };
}
