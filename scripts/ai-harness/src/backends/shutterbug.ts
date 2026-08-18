/**
 * The two Shutterbug modes: the production-parity baseline and the parameterized one.
 *
 * `shutterbug-production-current` reproduces today's production request exactly — the production
 * endpoint, the `branch/shutterbug-support` CLUE URL, `unit=mods`, `height: 1500`, and no
 * `fullPage`. Bug for bug, clipping included. A snapshot test pins it so it cannot drift while the
 * other modes evolve. It is a **baseline**, not a recommendation: improvements go into
 * `shutterbug-parameterized`, which is the shape the eventual production fix will take.
 *
 * Note that `scripts/shutterbug.ts` is *not* a production baseline, whatever the harness plan says:
 * it posts `height: 500, fullPage: true` and omits the unit.
 */
import { RenderTarget } from "../schemas.js";
import { NotAPngError, readPngInfo } from "../png.js";
import { generateRenderHtml } from "./render-html.js";
import {
  RenderBackend, RenderLimitExceeded, RenderLimits, RenderOutcome, RenderRequest, checkCaptureSize,
  checkEncodedSize, kDefaultRenderLimits, kUnobservedDiagnostics
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

export class ShutterbugError extends Error {
  constructor(docId: string, detail: string) {
    super(`${docId}: ${detail}`);
    this.name = "ShutterbugError";
  }
}

function isRetriableStatus(status: number): boolean {
  return status >= 500 || status === 429;
}

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
  if (!/^https?:\/\//.test(shutterbugUrl)) {
    throw new Error(`--shutterbug-url must be an http(s) URL, got "${shutterbugUrl}"`);
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
        const response = await withTimeout(requestTimeoutMs, "the Shutterbug request", (signal) =>
          fetchImpl(shutterbugUrl, { method: "POST", body: JSON.stringify(body), signal }));
        if (!response.ok) {
          const error = new ShutterbugError(docId,
            `Shutterbug answered ${response.status} ${response.statusText}`);
          if (isRetriableStatus(response.status) && attempt < retries) {
            lastError = error;
            await sleep(500 * 2 ** attempt);
            continue;
          }
          throw error;
        }
        let json: unknown;
        try {
          json = await response.json();
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
    const response = await withTimeout(downloadTimeoutMs, `the download of ${url}`, (signal) =>
      fetchImpl(url, { redirect: "follow", signal }));
    if (!response.ok) {
      throw new ShutterbugError(docId, `downloading ${url} answered ${response.status} ${response.statusText}`);
    }
    const contentType = response.headers?.get?.("content-type") ?? null;
    if (contentType && !contentType.toLowerCase().startsWith("image/png")) {
      throw new ShutterbugError(docId, `${url} served content-type "${contentType}", not image/png`);
    }
    const declaredLength = Number(response.headers?.get?.("content-length") ?? NaN);
    if (Number.isFinite(declaredLength) && declaredLength > limits.maxEncodedBytes) {
      throw new ShutterbugError(docId,
        `${url} declares ${declaredLength} bytes, over the ${limits.maxEncodedBytes} limit`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    checkEncodedSize(docId, bytes, limits);
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
