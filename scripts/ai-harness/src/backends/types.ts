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

/**
 * Whether a hosted image URL is one the harness will read bytes from.
 *
 * Both places that fetch a rendered image use `redirect: "follow"`, so the URL that was checked is
 * not necessarily the URL that answered: a hosted image can redirect to plain `http`, or to an
 * address on the machine running the harness. Asserting this against the *final* response URL is
 * what closes that — a silent downgrade or a landing on the private network fails instead of being
 * downloaded and stored as a student's document.
 *
 * A public hostname that resolves to a private address still passes; stopping that needs the
 * resolved address, which `fetch` does not expose. The check is on the URL, and says so.
 */
export function isPublicHttpsUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === "https:" && !isPrivateHost(url.hostname);
}

/**
 * Why a redirect must not be followed, or `null` when it is fine.
 *
 * The rule is that a redirect may not land somewhere less safe than the URL that was asked for. A
 * request to a public https URL has to end at a public https URL; an operator who deliberately
 * points the harness at a local server is not downgraded by ending up there, so that case is left
 * alone. Stating it as "no downgrade" rather than "https only" is what lets a local Shutterbug and
 * the tests' loopback servers keep working while the case that matters — a hosted image quietly
 * redirecting to plain http, or to an address on this machine — still fails.
 */
export function redirectDowngradeReason(requestedUrl: string, finalUrl: string): string | null {
  if (!isPublicHttpsUrl(requestedUrl) || isPublicHttpsUrl(finalUrl)) return null;
  return `redirected to ${finalUrl}, which is not a public https URL`;
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  // `URL.hostname` returns IPv6 addresses bracketed.
  if (host.startsWith("[")) {
    const address = host.slice(1, -1);
    // Loopback and the unspecified address, then unique-local (fc00::/7) and link-local (fe80::/10).
    if (address === "::1" || address === "::") return true;
    if (/^f[cd]/.test(address) || /^fe[89ab]/.test(address)) return true;
    // An IPv4-mapped address is still the IPv4 address it names. `URL` normalizes the dotted form
    // (`::ffff:127.0.0.1`) to hex groups (`::ffff:7f00:1`), so that is the form to read.
    const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(address);
    if (!mapped) return false;
    const high = parseInt(mapped[1], 16);
    const low = parseInt(mapped[2], 16);
    return isPrivateIpv4(`${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`);
  }
  return isPrivateIpv4(host);
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split(".");
  // Not four numbers: a name rather than an address, which this cannot judge.
  if (parts.length !== 4) return false;
  const octets = parts.map(Number);
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false;
  const [first, second] = octets;
  return first === 0 || first === 10 || first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    // Link-local, which on a cloud host is the instance metadata service.
    (first === 169 && second === 254);
}

export function checkEncodedSize(docId: string, bytes: Buffer, limits: RenderLimits): void {
  if (bytes.length > limits.maxEncodedBytes) {
    throw new RenderLimitExceeded(docId,
      `the encoded image is ${bytes.length} bytes, over the ${limits.maxEncodedBytes} limit`);
  }
}
