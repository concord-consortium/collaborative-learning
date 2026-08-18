/**
 * The two Shutterbug modes: the production-parity baseline and the parameterized one.
 *
 * `shutterbug-production-current` matches production's request envelope — the production endpoint,
 * the `branch/shutterbug-support` CLUE URL, `unit=mods`, `height: 1500`, and no `fullPage` — and
 * renders against production's target, clipping included. It is not byte-for-byte production: the
 * page inside the request body comes from the generator this file shares with the other modes,
 * which escapes the document rather than interpolating it raw and guards a zero `updateHeight`. The
 * README lists every difference under "differences from production's HTML". A snapshot test pins
 * what this mode posts, so it cannot drift while the other modes evolve.
 *
 * It is a **baseline**, not a recommendation: improvements go into `shutterbug-parameterized`,
 * which is the shape the eventual production fix will take.
 *
 * Note that `scripts/shutterbug.ts` is *not* a production baseline, whatever the harness plan says:
 * it posts `height: 500, fullPage: true` and omits the unit.
 */
import { RenderTarget } from "../schemas.js";
import { NotAPngError, readPngInfo } from "../png.js";
import { generateRenderHtml } from "./render-html.js";
import {
  RenderBackend, RenderLimitExceeded, RenderLimits, RenderOutcome, RenderRequest, checkCaptureSize,
  isPublicHttpsUrl, kDefaultRenderLimits, kUnobservedDiagnostics, readBodyWithin,
  redirectDowngradeReason
} from "./types.js";

/** Exactly what production uses today. Changing any of these changes what "parity" means. */
export const kProductionClueUrl = "https://collaborative-learning.concord.org/branch/shutterbug-support";
export const kProductionUnit = "mods";
export const kProductionShutterbugUrl = "https://api.concord.org/shutterbug-production";
export const kProductionCaptureHeightPx = 1500;
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
}

export const kShutterbugBackendVersion = 1;

const kDefaultRequestTimeoutMs = 60_000;
const kDefaultDownloadTimeoutMs = 60_000;
const kDefaultRetries = 2;

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
 * `fullPage` is deliberately absent: production does not send it, so parity does not either.
 */
export function shutterbugRequestBody(
  content: unknown, options: { clueUrl: string; unit: string; captureHeightPx: number }
): { content: string; height: number } {
  return {
    content: generateRenderHtml({ content, clueUrl: options.clueUrl, unit: options.unit }),
    height: options.captureHeightPx
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
    retries = kDefaultRetries
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
  // Checked once, at construction, against the height the mode is configured with: an unreasonable
  // --capture-height should be refused before any student work is posted anywhere, not after.
  if (captureHeightPx > limits.maxHeightPx || viewportWidthPx * captureHeightPx > limits.maxPixels) {
    throw new RenderLimitExceeded(`--mode ${modeId}`,
      `a ${viewportWidthPx}×${captureHeightPx} capture exceeds the configured limits ` +
      `(max ${limits.maxHeightPx}px tall, ${limits.maxPixels} pixels)`);
  }

  const renderTarget: RenderTarget = {
    clueUrl,
    unit,
    clueRevision,
    shutterbugUrl,
    viewportWidthPx,
    // Shutterbug is given a fixed height and clips to it. Recording this as a full-document capture
    // would be a lie the freshness check could never catch.
    captureMode: "fixed-height",
    captureHeightPx
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
              { method: "POST", body: JSON.stringify(body), signal });
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
    checkCaptureSize(docId, info.widthPx, info.heightPx, limits);
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
      const url = await post(request.docId,
        shutterbugRequestBody(request.content, { clueUrl, unit, captureHeightPx }));
      const bytes = await download(request.docId, url);
      // The hosted URL is kept beside the downloaded copy: it is what production sends to the model,
      // and it is what `run` has to check is still resolving before it spends anything.
      return {
        images: [{ bytes, url, tileId: null, purpose: "full-document" }],
        // The render happened on someone else's browser, so there is nothing to report about it.
        diagnostics: { ...kUnobservedDiagnostics }
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
    captureHeightPx: kProductionCaptureHeightPx,
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
}

/** The same transport with everything configurable — what the production fix will look like. */
export function shutterbugParameterized(options: ParameterizedOptions = {}): RenderBackend {
  return shutterbugBackend({
    modeId: "shutterbug-parameterized",
    clueUrl: options.clueUrl ?? kProductionClueUrl,
    unit: options.unit ?? kProductionUnit,
    shutterbugUrl: options.shutterbugUrl ?? kStagingShutterbugUrl,
    captureHeightPx: options.captureHeightPx ?? kProductionCaptureHeightPx,
    clueRevision: options.clueRevision ?? null,
    fetchImpl: options.fetchImpl,
    limits: options.limits,
    sleep: options.sleep
  });
}
