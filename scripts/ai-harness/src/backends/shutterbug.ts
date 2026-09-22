/**
 * The two Shutterbug modes: the production-parity baseline and the parameterized one.
 *
 * `shutterbug-production-current` matches production's request envelope — the production endpoint,
 * the released build's `authoring-iframe/index.html` page, `unit=mods`, `height: 500`, and
 * `fullPage: true` — and renders against production's target, floor and ceiling included.
 * Production renders each document with the unit from its Firestore metadata and uses `mods` only
 * as the fallback; the harness corpus has no such metadata, so this mode renders everything with
 * the fallback. It is not byte-for-byte production: the page inside the request body comes from
 * the generator this file shares with the other modes, which escapes the document rather than
 * interpolating it raw and guards a zero `updateHeight`. The README lists every difference under
 * "differences from production's HTML". A snapshot test pins what this mode posts, so it cannot
 * drift while the other modes evolve.
 *
 * It is a **baseline**, not a recommendation: improvements go into `shutterbug-parameterized`,
 * which is the shape the eventual production fix will take.
 *
 * Note that `scripts/shutterbug.ts` is *not* a production baseline, whatever the harness plan says:
 * it targets staging by default, and nothing pins its request the way a snapshot test pins this
 * mode's.
 */
import { RenderTarget } from "../schemas.js";
import { NotAPngError, readPngInfo } from "../png.js";
import { generateRenderHtml, kMaxFrameHeightPx } from "../../../../shared/render-page.js";
import {
  RenderBackend, RenderLimitExceeded, RenderLimits, RenderOutcome, RenderRequest, checkCaptureSize,
  isPublicHttpsUrl, isShutterbugImageHost, kDefaultRenderLimits, kUnobservedDiagnostics,
  readBodyWithin, redirectDowngradeReason
} from "./types.js";

/** Exactly what production uses today. Changing any of these changes what "parity" means. */
export const kProductionClueUrl = "https://collaborative-learning.concord.org/authoring-iframe/index.html";
/** Production's fallback unit, used when a document's metadata has no usable unit code. */
export const kProductionUnit = "mods";
export const kProductionShutterbugUrl = "https://api.concord.org/shutterbug-production";
/**
 * The default capture height for the modes that clip at a fixed height rather than go full-page.
 * What production used to send — kept so `--capture-height`'s absence still means something on
 * them, not because it matches production today; see `kProductionViewportHeightPx` for that.
 */
export const kDefaultCaptureHeightPx = 1500;
/** The viewport production's `fullPage: true` request sends. Only a viewport — the frame ceiling
 * in `shared/render-page.ts` is what actually bounds the capture. */
export const kProductionViewportHeightPx = 500;
export const kStagingShutterbugUrl = "https://api.concord.org/shutterbug-staging";

/** Production's iframe is 100% wide inside Shutterbug's own page; this is what it works out to. */
export const kShutterbugViewportWidthPx = 1000;

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** https anywhere, http only on loopback. */
export function isAcceptableShutterbugUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol === "https:") return true;
  // `URL.hostname` brackets IPv6 addresses, so the bare `::1` form never appears here.
  return url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
}

export interface ShutterbugOptions {
  modeId: string;
  clueUrl: string;
  unit: string;
  shutterbugUrl: string;
  captureHeightPx: number;
  /** The CLUE build being rendered, when it can be established. Recorded, and part of freshness. */
  clueRevision: string | null;
  viewportWidthPx?: number;
  limits?: RenderLimits;
  /** Injected by tests. Defaults to the global `fetch`. */
  fetchImpl?: FetchLike;
  requestTimeoutMs?: number;
  downloadTimeoutMs?: number;
  retries?: number;
  sleep?: (ms: number) => Promise<void>;
  /**
   * Post `fullPage: true`: Shutterbug captures the whole iframe instead of clipping it at
   * `captureHeightPx`, which becomes only the starting viewport. The page itself then bounds the
   * capture, via `maxFrameHeightPx`.
   */
  fullPage?: boolean;
  /** The ceiling `shared/render-page.ts` clamps the frame to. Only meaningful with `fullPage`. */
  maxFrameHeightPx?: number;
}

export const kShutterbugBackendVersion = 1;

const kDefaultRequestTimeoutMs = 60_000;
const kDefaultDownloadTimeoutMs = 60_000;
const kDefaultRetries = 2;

/**
 * A correctly clamped full-page capture still comes back a little taller than the ceiling: the
 * clamp bounds the iframe, but Shutterbug's own screenshot is of the whole outer page, chrome
 * included, and that chrome adds a small amount on top (observed a few pixels through the real
 * service; a raw unwrapped page can add more — up to Chromium's default 8px body margin on each
 * side). Without this, a document that lands exactly at the ceiling — the case the ceiling exists
 * to handle — fails every time instead of succeeding with a clipped capture.
 */
const kFullPageOverflowTolerancePx = 16;

/**
 * How much of Shutterbug's reply will be read.
 *
 * It answers with a small JSON object holding one URL. Anything approaching this is a service that
 * has gone wrong — an HTML error page from a proxy, say — and reading it in full would be paying
 * unbounded memory for a body that is going to be rejected either way.
 */
const kMaxResponseBytes = 1024 * 1024;

export class ShutterbugError extends Error {
  constructor(docId: string, detail: string) {
    super(`${docId}: ${detail}`);
    this.name = "ShutterbugError";
  }
}

function isRetriableStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

/** What one attempt at the Shutterbug POST came back with, once its body has been read. */
type PostAnswer =
  | { failed: { status: number; statusText: string } }
  | { redirected: { status: number; location: string | null } }
  | { overLimit: true }
  | { text: string };

async function withTimeout<T>(
  timeoutMs: number, what: string, run: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) throw new Error(`${what} timed out after ${timeoutMs}ms`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The request body production posts. Kept as its own function so the parity snapshot test can assert
 * the exact bytes without going anywhere near the network.
 *
 * `height` is only Puppeteer's starting viewport; with `fullPage: true` it captures the whole
 * iframe regardless, and the page itself bounds that capture via `maxHeightPx`.
 */
export function shutterbugRequestBody(
  content: unknown,
  options: { clueUrl: string; unit: string; captureHeightPx: number; fullPage?: boolean; maxHeightPx?: number }
): { content: string; height: number; fullPage?: true } {
  return {
    content: generateRenderHtml({
      content, clueUrl: options.clueUrl, unit: options.unit, maxHeightPx: options.maxHeightPx
    }),
    height: options.captureHeightPx,
    ...(options.fullPage ? { fullPage: true as const } : {})
  };
}

/**
 * A backend whose every step has a defined failure. `.png` on the end of a URL is not evidence of
 * PNG bytes, a 200 is not evidence of a usable body, and a service that returns HTML where JSON was
 * promised must stop the document rather than have that discovered after money has been spent.
 */
export function shutterbugBackend(options: ShutterbugOptions): RenderBackend {
  const {
    modeId, clueUrl, unit, shutterbugUrl, captureHeightPx, clueRevision,
    viewportWidthPx = kShutterbugViewportWidthPx,
    limits = kDefaultRenderLimits,
    requestTimeoutMs = kDefaultRequestTimeoutMs,
    downloadTimeoutMs = kDefaultDownloadTimeoutMs,
    retries = kDefaultRetries,
    fullPage = false,
    maxFrameHeightPx = kMaxFrameHeightPx
  } = options;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const fetchImpl: FetchLike = options.fetchImpl ?? ((url, init) => fetch(url, init));

  // Inferring the endpoint from anything would eventually post student work at the wrong service.
  // Plaintext is refused off-loopback: this posts the whole document, and the harness treats
  // document content as sensitive everywhere it flows. A local Shutterbug over http is still fine.
  if (!isAcceptableShutterbugUrl(shutterbugUrl)) {
    throw new Error(`--shutterbug-url must be an https URL, or http on loopback for a local ` +
      `Shutterbug; got "${shutterbugUrl}". The whole document is posted to it.`);
  }
  // A ceiling only bounds a full-page capture; without `fullPage` it has nothing to bound and
  // would be silently ignored rather than applied, which `--max-frame-height` cannot look like it
  // is doing from the CLI.
  if (options.maxFrameHeightPx !== undefined && !fullPage) {
    throw new Error(`--max-frame-height requires --full-page (--mode ${modeId})`);
  }
  // With `fullPage`, `captureHeightPx` is only the starting viewport and bounds nothing; the
  // page's own ceiling does, so that is what construction checks against.
  const effectiveHeightPx = fullPage ? maxFrameHeightPx : captureHeightPx;
  // A full-page capture floors at the viewport — it never shrinks below it — so a viewport taller
  // than the ceiling would defeat the ceiling silently: construction would pass, the document
  // would post for real, and only the post-download check would catch it, after the upload.
  if (fullPage && captureHeightPx > maxFrameHeightPx) {
    throw new RenderLimitExceeded(`--mode ${modeId}`,
      `--capture-height ${captureHeightPx} exceeds --max-frame-height ${maxFrameHeightPx}; the ` +
      "viewport would floor every capture above the ceiling it is meant to enforce");
  }
  // Checked once, at construction, against the height the mode is configured with: an unreasonable
  // --capture-height (or --max-frame-height) should be refused before any student work is posted
  // anywhere, not after.
  if (effectiveHeightPx > limits.maxHeightPx || viewportWidthPx * effectiveHeightPx > limits.maxPixels) {
    throw new RenderLimitExceeded(`--mode ${modeId}`,
      `a ${viewportWidthPx}×${effectiveHeightPx} capture exceeds the configured limits ` +
      `(max ${limits.maxHeightPx}px tall, ${limits.maxPixels} pixels)`);
  }

  const renderTarget: RenderTarget = {
    clueUrl,
    unit,
    clueRevision,
    shutterbugUrl,
    viewportWidthPx,
    // Fixed height clips at that height; full-page clips at the page's own ceiling. Recording
    // either as full-document would be a lie the freshness check could never catch.
    //
    // Known gap: in full-page mode this records the ceiling, not `captureHeightPx` (the viewport)
    // — nothing here records the viewport at all. Two full-page runs that differ only in
    // --capture-height therefore compare as the same target, and `render` reuses a stale capture
    // instead of noticing the viewport changed. Use --refresh when varying --capture-height.
    captureMode: fullPage ? "full-page" : "fixed-height",
    captureHeightPx: effectiveHeightPx
  };

  const post = async (docId: string, body: unknown): Promise<string> => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        // No `content-type` header, deliberately. Production (on-analysis-document-pending.ts) and
        // scripts/shutterbug.ts both post a bare string body, so fetch labels it
        // `text/plain;charset=UTF-8` — and reproducing production's request exactly is the whole
        // point of the parity mode. Setting `application/json` here would look tidier and would
        // stop this being what production sends.
        // Reading the body is inside the timeout too, and bounded. `fetchImpl` resolves as soon as
        // the headers arrive, so a stalled or endless body read outside it had no bound at all —
        // not in time, and not in size. `download()` has always done it this way; this is the same
        // rule applied to the request that precedes it.
        const answer = await withTimeout<PostAnswer>(requestTimeoutMs, "the Shutterbug request",
          async (signal) => {
            const response = await fetchImpl(shutterbugUrl,
              { method: "POST", body: JSON.stringify(body), redirect: "manual", signal });
            // A 3xx is not `ok`, so it is read here, before the branch below reduces it to a status
            // code with no destination in it.
            if (response.status >= 300 && response.status < 400) {
              return {
                redirected: {
                  status: response.status,
                  location: response.headers?.get?.("location") ?? null
                }
              };
            }
            if (!response.ok) {
              return { failed: { status: response.status, statusText: response.statusText } };
            }
            const read = await readBodyWithin(response, kMaxResponseBytes);
            return "overLimit" in read ? { overLimit: true } : { text: read.bytes.toString("utf8") };
          });
        if ("failed" in answer) {
          const error = new ShutterbugError(docId,
            `Shutterbug answered ${answer.failed.status} ${answer.failed.statusText}`);
          if (isRetriableStatus(answer.failed.status) && attempt < retries) {
            lastError = error;
            await sleep(500 * 2 ** attempt);
            continue;
          }
          throw error;
        }
        if ("redirected" in answer) {
          // `redirect: "manual"` on the request is what makes this preventable rather than merely
          // observable: on a 307 or 308 fetch re-sends the POST body, so a followed redirect has
          // already delivered the document by the time anything could inspect where it went.
          throw new ShutterbugError(docId,
            `Shutterbug answered ${answer.redirected.status} redirecting to ` +
            `${answer.redirected.location ?? "an unnamed location"}. The document is not sent on ` +
            "to a redirect target; point --shutterbug-url at the new address if the endpoint has " +
            "moved.");
        }
        if ("overLimit" in answer) {
          throw new ShutterbugError(docId,
            `Shutterbug's response is over the ${kMaxResponseBytes} byte limit, so it is not the ` +
            "small JSON object this expects");
        }
        let json: unknown;
        try {
          json = JSON.parse(answer.text);
        } catch (error) {
          throw new ShutterbugError(docId,
            `Shutterbug's response was not JSON (${(error as Error).message})`);
        }
        const url = (json as { url?: unknown })?.url;
        if (typeof url !== "string" || url.length === 0) {
          throw new ShutterbugError(docId,
            `Shutterbug returned ${JSON.stringify(json)}, which has no "url" string`);
        }
        // Student work went up; the picture of it comes back over TLS or not at all.
        if (!url.startsWith("https:")) {
          throw new ShutterbugError(docId, `Shutterbug returned a non-https image URL (${url})`);
        }
        // And from somewhere the harness could plausibly be told to fetch. Establishing this here is
        // also what gives `download` a public https URL to compare its final response URL against.
        if (!isPublicHttpsUrl(url)) {
          throw new ShutterbugError(docId,
            `Shutterbug returned an image URL on a loopback or private host (${url})`);
        }
        // A host that merely looks public can still resolve to a private address when it is
        // actually fetched, which isPublicHttpsUrl cannot see (see its doc comment). Pinning the
        // resolved address before fetching is the real fix and is not done here yet; this is a
        // cheap stopgap that works only because Shutterbug's real host is known.
        if (!isShutterbugImageHost(url)) {
          throw new ShutterbugError(docId, `Shutterbug returned an image URL on an unexpected host (${url})`);
        }
        return url;
      } catch (error) {
        lastError = error;
        // A network-level failure is worth another try; a bad body is not.
        if (error instanceof ShutterbugError || attempt >= retries) throw error;
        await sleep(500 * 2 ** attempt);
      }
    }
    throw lastError;
  };

  const download = async (docId: string, url: string): Promise<Buffer> => {
    // The whole download, body included, is inside one timeout. Bounding only the fetch left a
    // stalled body able to hang indefinitely once the headers had arrived.
    return withTimeout(downloadTimeoutMs, `the download of ${url}`, async (signal) => {
    const response = await fetchImpl(url, { redirect: "follow", signal });
    if (!response.ok) {
      throw new ShutterbugError(docId, `downloading ${url} answered ${response.status} ${response.statusText}`);
    }
    // Redirects are followed, so the URL that answered is not necessarily the one that was asked
    // for: this is where a redirect to plain http, or to an address on this machine, is caught.
    // `post` has already established that `url` itself is a public https URL.
    const downgraded = redirectDowngradeReason(url, response.url || url);
    if (downgraded) throw new ShutterbugError(docId, `${url} ${downgraded}`);
    const contentType = response.headers?.get?.("content-type") ?? null;
    if (contentType && !contentType.toLowerCase().startsWith("image/png")) {
      throw new ShutterbugError(docId, `${url} served content-type "${contentType}", not image/png`);
    }
    const declaredLength = Number(response.headers?.get?.("content-length") ?? NaN);
    if (Number.isFinite(declaredLength) && declaredLength > limits.maxEncodedBytes) {
      throw new ShutterbugError(docId,
        `${url} declares ${declaredLength} bytes, over the ${limits.maxEncodedBytes} limit`);
    }
    const read = await readBodyWithin(response, limits.maxEncodedBytes);
    if ("overLimit" in read) {
      throw new ShutterbugError(docId,
        `${url} is over the ${limits.maxEncodedBytes} byte limit`);
    }
    const { bytes } = read;
    let info;
    try {
      info = readPngInfo(bytes, url);
    } catch (error) {
      throw new ShutterbugError(docId, error instanceof NotAPngError
        ? error.message
        : `${url} could not be decoded (${(error as Error).message})`);
    }
    // The bytes being small enough says nothing about the image being reasonable — a tall, flat
    // screenshot compresses to very little. The dimensions are checked on what actually arrived.
    // In full-page mode the check is against the mode's own ceiling (plus its known overflow
    // tolerance), not the global default: taller than that means the page's clamp failed.
    checkCaptureSize(docId, info.widthPx, info.heightPx,
      fullPage ? { ...limits, maxHeightPx: maxFrameHeightPx + kFullPageOverflowTolerancePx } : limits);
    return bytes;
    });
  };

  return {
    modeId,
    backendId: "shutterbug",
    backendVersion: kShutterbugBackendVersion,
    kind: "network",
    prerequisites: `network access to ${shutterbugUrl} and ${clueUrl}; no OpenAI key`,
    renderTarget,
    async render(request: RenderRequest): Promise<RenderOutcome> {
      // A mode with a per-document height is handed one per request; every other mode uses the
      // height it was configured with. Checked here as well as at construction, because a measured
      // height is only known once the document has been rendered locally.
      const heightPx = request.captureHeightPx ?? captureHeightPx;
      if (request.captureHeightPx !== undefined) {
        if (!Number.isInteger(heightPx) || heightPx <= 0) {
          throw new ShutterbugError(request.docId,
            `was given a capture height of ${JSON.stringify(request.captureHeightPx)}, which is not ` +
            "a positive whole number of pixels");
        }
        checkCaptureSize(request.docId, viewportWidthPx, heightPx, limits);
      }
      // Without `fullPage`, the frame still must not be capped at the shared ceiling: a
      // fixed-height or accurate-height capture relies on the frame growing to fill (or exceed)
      // its own configured viewport, which can be taller than kMaxFrameHeightPx on purpose. Capped
      // there anyway, the frame would stop growing at 4000px while Shutterbug still screenshotted
      // the full viewport, leaving the rest of the picture blank. `limits.maxHeightPx` is the
      // ceiling this mode already enforces post-download, so the frame is allowed to grow up to
      // the same bound rather than a smaller, unrelated one.
      const url = await post(request.docId,
        shutterbugRequestBody(request.content, {
          clueUrl, unit, captureHeightPx: heightPx,
          fullPage, maxHeightPx: fullPage ? maxFrameHeightPx : limits.maxHeightPx
        }));
      const bytes = await download(request.docId, url);
      // The hosted URL is kept beside the downloaded copy: it is what production sends to the model,
      // and it is what `run` has to check is still resolving before it spends anything.
      return {
        images: [{ bytes, url, tileId: null, purpose: "full-document" }],
        // The render happened on someone else's browser, so there is nothing to report about it.
        diagnostics: { ...kUnobservedDiagnostics },
        // Recorded per document when the height was, so freshness compares against the height this
        // picture was actually taken at rather than the mode's nominal one.
        ...(request.captureHeightPx === undefined
          ? {}
          : { renderTarget: { ...renderTarget, captureHeightPx: heightPx } })
      };
    }
  };
}

export interface ProductionParityOptions {
  clueRevision?: string | null;
  fetchImpl?: FetchLike;
  limits?: RenderLimits;
  sleep?: (ms: number) => Promise<void>;
}

/** The frozen baseline. Every value is a constant; nothing about it is configurable on purpose. */
export function shutterbugProductionCurrent(options: ProductionParityOptions = {}): RenderBackend {
  return shutterbugBackend({
    modeId: "shutterbug-production-current",
    clueUrl: kProductionClueUrl,
    unit: kProductionUnit,
    shutterbugUrl: kProductionShutterbugUrl,
    // maxFrameHeightPx is left at its default, matching production.
    captureHeightPx: kProductionViewportHeightPx,
    fullPage: true,
    // A hosted branch build has no revision the harness can read, so this is recorded as unknown
    // unless a caller can say what it was — and `render` warns when it is null.
    clueRevision: options.clueRevision ?? null,
    fetchImpl: options.fetchImpl,
    limits: options.limits,
    sleep: options.sleep
  });
}

export interface ParameterizedOptions extends ProductionParityOptions {
  clueUrl?: string;
  unit?: string;
  shutterbugUrl?: string;
  captureHeightPx?: number;
  fullPage?: boolean;
  maxFrameHeightPx?: number;
}

/** The same transport with everything configurable — what the production fix will look like. */
export function shutterbugParameterized(options: ParameterizedOptions = {}): RenderBackend {
  return shutterbugBackend({
    modeId: "shutterbug-parameterized",
    clueUrl: options.clueUrl ?? kProductionClueUrl,
    unit: options.unit ?? kProductionUnit,
    shutterbugUrl: options.shutterbugUrl ?? kStagingShutterbugUrl,
    // With --full-page, this is only the starting viewport, and production's is 500px, not
    // kDefaultCaptureHeightPx (1500) — which is a fixed-height clip, meaningless once the page's
    // own ceiling is what actually bounds a full-page capture. Left at 1500 here, every full-page
    // capture under 1500px would come out padded to 1500px regardless of --capture-height being unset,
    // up to 3x taller than the ~500px production would actually send.
    captureHeightPx: options.captureHeightPx ??
      (options.fullPage ? kProductionViewportHeightPx : kDefaultCaptureHeightPx),
    clueRevision: options.clueRevision ?? null,
    fetchImpl: options.fetchImpl,
    limits: options.limits,
    sleep: options.sleep,
    fullPage: options.fullPage,
    maxFrameHeightPx: options.maxFrameHeightPx
  });
}

/**
 * The same transport again, but each document is captured at *its own* measured height.
 *
 * This is the prototype for a different fix than the one that shipped: each document at its own
 * exact measured height, rather than a full-page capture bounded by a shared ceiling
 * (`shutterbug-production-current`). Production used to post a hardcoded `height: 1500` for every
 * document, so a shorter one was padded and a taller one silently clipped — that's what the
 * ceiling approach fixed, not this one. This mode still measures what the exact-height
 * alternative would have bought, in case it's ever worth revisiting.
 *
 * The height itself comes from a previous local `puppeteer-full-height` render, which is the only
 * thing that knows how tall a document actually is. `render` reads it and hands it over per
 * document; nothing here knows the corpus exists.
 */
export function shutterbugAccurateHeight(options: ParameterizedOptions = {}): RenderBackend {
  return shutterbugBackend({
    modeId: "shutterbug-accurate-height",
    clueUrl: options.clueUrl ?? kProductionClueUrl,
    unit: options.unit ?? kProductionUnit,
    shutterbugUrl: options.shutterbugUrl ?? kStagingShutterbugUrl,
    // Only a fallback: every render is handed the document's measured height. Falls back to the
    // height production used to clip at, so a document with no measurement is no worse off than
    // that was, not better.
    captureHeightPx: options.captureHeightPx ?? kDefaultCaptureHeightPx,
    clueRevision: options.clueRevision ?? null,
    fetchImpl: options.fetchImpl,
    limits: options.limits,
    sleep: options.sleep
  });
}
