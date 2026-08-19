/**
 * What a render backend is, and the bounds every one of them is held to.
 *
 * A backend produces bytes. It does not decide where they are stored, what the envelope says, or
 * whether an existing render may be reused — `represent-image.ts` and the `render` command own that.
 * Keeping the split means the Shutterbug backends can be tested with a fake `fetch` and the
 * puppeteer backend with a fake browser, with no file system or network in either case.
 */
import { createHash } from "node:crypto";
import { ImagePurpose, RenderTarget } from "../schemas.js";

export interface RenderRequest {
  docId: string;
  /** The document content, as an object. */
  content: unknown;
}

export interface RenderedImage {
  bytes: Buffer;
  /** The hosted URL this came from, for a network backend; `null` for a local capture. */
  url: string | null;
  tileId: string | null;
  purpose: ImagePurpose;
}

/**
 * Whether a backend needs the network *for the harness's own request*.
 *
 * `local` rather than `offline` on purpose: a locally captured render still loads a CLUE page, and
 * that page may pull fonts, images or other assets from elsewhere. If offline operation ever becomes
 * a guarantee, the backend has to intercept and reject non-localhost requests, and a test has to
 * assert it.
 */
export type BackendKind = "local" | "network";

/**
 * What the backend could see while rendering, beyond the pixels.
 *
 * This is what makes a render *verified* rather than merely produced. An unregistered tile type is
 * the case that matters: CLUE does not log an error for one, it substitutes an `Unknown` content
 * model and draws it with the placeholder component — a perfectly valid PNG of the wrong thing. The
 * count of those, and the text the page actually displayed, are the only way to tell.
 *
 * Every field is `null` when the backend cannot observe it. A hosted service renders somewhere else
 * and can report nothing.
 */
export interface RenderDiagnostics {
  /** The height CLUE reported for the document. */
  reportedHeightPx: number | null;
  /** Tiles drawn by the placeholder component — an unregistered type, or a real Placeholder tile. */
  unknownTiles: number | null;
  totalTiles: number | null;
  /** The rendered text, so a fixture's distinctive marker can be checked for. */
  documentText: string | null;
  /** Console warnings that were not fatal. Console *errors* fail the document instead. */
  consoleWarnings: string[];
}

export const kUnobservedDiagnostics: RenderDiagnostics = {
  reportedHeightPx: null,
  unknownTiles: null,
  totalTiles: null,
  documentText: null,
  consoleWarnings: []
};

export interface RenderOutcome {
  images: RenderedImage[];
  diagnostics: RenderDiagnostics;
}

export interface RenderBackend {
  /** The `--mode` value. Also the directory image envelopes are filed under. */
  modeId: string;
  /** Which renderer does the work: `puppeteer` or `shutterbug`. */
  backendId: string;
  /** Bumped whenever this backend's output would change for the same input. */
  backendVersion: number;
  kind: BackendKind;
  /** One line for `plan` and the README: what has to be true before this mode can run. */
  prerequisites: string;
  /** What this backend renders against. Recorded in the envelope and compared for freshness. */
  renderTarget: RenderTarget;
  /** Called once per run, before any document. */
  open?(): Promise<void>;
  /** Called once per run, always, even when documents failed. */
  close?(): Promise<void>;
  render(request: RenderRequest): Promise<RenderOutcome>;
}

/**
 * Bounds on a single capture. A very long document can exceed Chromium's own screenshot limits or
 * produce a payload nobody wants to pay for, and the failure mode without these is a silently
 * clipped image recorded as a full-document capture.
 *
 * `maxEncodedBytes` starts well under the provider's per-request allowance: 20 MB of PNG is already
 * far more screenshot than any document should need.
 */
export interface RenderLimits {
  maxHeightPx: number;
  maxPixels: number;
  maxEncodedBytes: number;
}

/**
 * Applied by every mode. The local backend checks the page before capturing; the Shutterbug modes
 * check the configured height before uploading and the decoded PNG's dimensions after downloading —
 * a tall, flat screenshot compresses to very little, so the byte limit alone catches nothing.
 */
export const kDefaultRenderLimits: RenderLimits = {
  maxHeightPx: 20_000,
  maxPixels: 40_000_000,
  maxEncodedBytes: 20 * 1024 * 1024
};

export class RenderLimitExceeded extends Error {
  constructor(public readonly docId: string, detail: string) {
    super(`${docId}: ${detail}. No envelope was written. Raise the mode's limits deliberately if ` +
      "this document really is meant to be this large.");
    this.name = "RenderLimitExceeded";
  }
}

/**
 * Checked *before* a capture where the numbers are known in advance (the page height), and again
 * after, on the encoded bytes. Failing the document is the point: a clipped capture must never be
 * recorded as `captureMode: "full-document"`.
 */
export function checkCaptureSize(
  docId: string, widthPx: number, heightPx: number, limits: RenderLimits
): void {
  if (heightPx > limits.maxHeightPx) {
    throw new RenderLimitExceeded(docId,
      `the rendered page is ${heightPx}px tall, over the ${limits.maxHeightPx}px limit`);
  }
  const pixels = widthPx * heightPx;
  if (pixels > limits.maxPixels) {
    throw new RenderLimitExceeded(docId,
      `the capture would be ${widthPx}×${heightPx} = ${pixels} pixels, over the ${limits.maxPixels} limit`);
  }
}

/**
 * Reads a response body under a byte limit, hashing as it goes.
 *
 * `await response.arrayBuffer()` reads the whole body before anything can check its size, so a
 * chunked response — or one that understates its length — is in memory before the guard runs. This
 * stops at the limit instead, and returns the sha256 so callers do not have to keep a second copy
 * of the bytes to hash them.
 */
export async function readBodyWithin(
  response: Response, maxBytes: number
): Promise<{ bytes: Buffer; sha256: string } | { overLimit: true }> {
  const body = response.body as unknown as AsyncIterable<Uint8Array> | null;
  if (!body) {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > maxBytes) return { overLimit: true };
    return { bytes, sha256: createHash("sha256").update(bytes).digest("hex") };
  }
  const digest = createHash("sha256");
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of body) {
    total += chunk.byteLength;
    if (total > maxBytes) return { overLimit: true };
    digest.update(chunk);
    chunks.push(Buffer.from(chunk));
  }
  return { bytes: Buffer.concat(chunks), sha256: digest.digest("hex") };
}

// Re-exported so the modules that reach for these through `backends/types.js` keep working; they
// are defined in urls.ts so that schemas.ts can use them without importing this module, which
// imports schemas.ts itself.
export { isPublicHttpsUrl, redirectDowngradeReason } from "../urls.js";

export function checkEncodedSize(docId: string, bytes: Buffer, limits: RenderLimits): void {
  if (bytes.length > limits.maxEncodedBytes) {
    throw new RenderLimitExceeded(docId,
      `the encoded image is ${bytes.length} bytes, over the ${limits.maxEncodedBytes} limit`);
  }
}
