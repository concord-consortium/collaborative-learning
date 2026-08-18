/**
 * Run expansion, OpenAI calls, concurrency, retries, resume, and the JSONL writer.
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import OpenAI, { APIConnectionError } from "openai";
import { VERSION as kOpenAiSdkVersion } from "openai/version";
import type { IAiPrompt, RelatedSummary } from "../../../shared/ai-analysis-messages.js";
import {
  CorpusPaths, readJsonFile, readManifest, readRepresentation, representationIsFresh, representationPath
} from "./corpus.js";
import { CacheEntry, ResponseCache } from "./cache.js";
import {
  CostCeilingExceeded, CostLedger, estimateImageTokens, kRetries, priceTokens, worstCaseUsd
} from "./cost.js";
import {
  HarnessRequest, buildImageRequest, buildRequest, chatCompletionParams, requestKeyFor, responseFormatFor
} from "./messages.js";
import { getTextVariant } from "./represent-text.js";
import {
  dataUrlFor, imageRepresentationIsUsable, imageRepresentationPath, readImageEnvelope, resolveImageFile,
  sha256Bytes, singleImageOf
} from "./represent-image.js";
import { readPngHeader } from "./png.js";
import { createHash } from "node:crypto";
import { git } from "./files.js";
import { kDefaultRenderLimits, redirectDowngradeReason } from "./backends/types.js";
import { renderBackendIdentity } from "./backends/index.js";
import {
  ExperimentFile, ExperimentRun, ManifestDocument, ModelPricing, RepresentationDescriptor,
  ResponseOriginMeta, ResultRow, RunMeta, effectiveModality, kResultSchemaVersion, kSchemaVersion,
  validatePromptFile, validateResultRow
} from "./schemas.js";

/**
 * Enough of the file to read the IHDR chunk; the rest is hashed and discarded.
 *
 * The hosted-image check is deliberately header-only. It never has the whole file in memory — the
 * body streams past and only these leading bytes are kept — so it cannot run the truncation check
 * that `readPngInfo` does. It does not need to: a body that stops early produces a different
 * sha256, and the sha256 comparison below is the check that actually matters here.
 */
const kPngHeaderBytes = 64;

export const kDefaultModel = "gpt-4o-mini";
export const kDefaultConcurrency = 4;

// ---------------------------------------------------------------------------
// Run metadata
// ---------------------------------------------------------------------------

export function currentRunMeta(now: Date = new Date()): RunMeta {
  const status = git(["status", "--porcelain"]);
  return {
    date: now.toISOString(),
    openaiSdkVersion: kOpenAiSdkVersion,
    gitCommit: git(["rev-parse", "HEAD"]),
    gitDirty: status === null ? false : status.length > 0
  };
}

// ---------------------------------------------------------------------------
// Task expansion
// ---------------------------------------------------------------------------

export interface RunTask {
  docId: string;
  runId: string;
  run: ExperimentRun;
  /** The modality this row is grouped under — the override when there is one. */
  modality: ManifestDocument["computedModality"];
  /** What the classifier said, recorded so a report can show where a human overrode it. */
  computedModality: ManifestDocument["computedModality"];
  promptName: string;
  promptSha256: string;
  aiPrompt: IAiPrompt;
  /**
   * Builds the request this task will send, on demand.
   *
   * A function rather than the request itself, because for a locally captured image the request
   * holds the picture: a 4 MB PNG becomes a ~5.5 MB base64 data URL, and one of those per task meant
   * an entire corpus's pixels sat in memory from `buildTasks` until the run ended — around 275 MB
   * for 25 documents across two image runs, before the first call went out. The request is now built
   * once here for the key and the cost reservation, released, and built again at dispatch.
   */
  makeRequest: () => HarnessRequest;
  requestKey: string;
  worstCaseUsd: number;
  /**
   * How many retries `worstCaseUsd` was reserved for. Carried on the task rather than read
   * independently by the run loop: the two used to be separate reads of `options.retries`, with
   * nothing tying them together, so a caller passing `retries: 5` to `buildTasks` and not to
   * `runTasks` would reserve for three attempts and dispatch six. The invariant that makes
   * `--max-cost` a bound is now code rather than convention.
   */
  retries: number;
  /** What this row will record about where its input came from. */
  representation: RepresentationDescriptor;
  /** The image-token share of the input estimate; 0 for a text run. */
  imageTokensEstimated: number;
  /**
   * Hosted images this task's request points at, each with the sha256 the envelope recorded for it.
   * A local capture sends its bytes inline and has none. `run` checks these still serve exactly
   * those pixels before it spends anything on the task.
   */
  hostedImages: { url: string; sha256: string }[];
}

export interface BuildTasksOptions {
  corpusPaths: CorpusPaths;
  experiment: ExperimentFile;
  promptsDir: string;
  pricing: ModelPricing;
  model?: string;
  retries?: number;
}

export interface BuildTasksResult {
  tasks: RunTask[];
  documents: ManifestDocument[];
}

/**
 * Expands (runs × documents) into concrete requests. `plan` and `run` both go through here, so the
 * cost they compute comes from exactly the same requests.
 */
export function buildTasks(options: BuildTasksOptions): BuildTasksResult {
  const { corpusPaths: paths, experiment, promptsDir, pricing } = options;
  const model = options.model ?? kDefaultModel;
  // Resolved once, stamped on every task, and read back per task when dispatching.
  const retries = options.retries ?? kRetries;
  const manifest = readManifest(paths);
  const prompts = new Map<string, { aiPrompt: IAiPrompt; sha256: string }>();

  const loadPrompt = (name: string) => {
    const cached = prompts.get(name);
    if (cached) return cached;
    const file = path.join(promptsDir, `${name}.json`);
    const promptFile = validatePromptFile(readJsonFile(file), file);
    const entry = { aiPrompt: promptFile.aiPrompt as IAiPrompt, sha256: promptFile.provenance.aiPromptSha256 };
    prompts.set(name, entry);
    return entry;
  };

  const generationSettings = { max_completion_tokens: pricing.maxOutputTokens };

  /** Everything a text-only run needs for one document. */
  const textInput = (run: ExperimentRun, document: ManifestDocument, aiPrompt: IAiPrompt) => {
    const variant = getTextVariant(run.textVariant!);
    const file = representationPath(paths, variant.id, document.id);
    if (!fs.existsSync(file)) {
      throw new Error(`Missing representation ${file}. Run: harness.ts represent --corpus ${manifest.name} ` +
        `--variants ${variant.id}`);
    }
    const envelope = readRepresentation(file);
    if (!representationIsFresh(envelope, {
      docId: document.id,
      variantId: variant.id,
      contentSha256: document.contentSha256,
      variantVersion: variant.variantVersion
    })) {
      throw new Error(`Stale or mismatched representation ${file} (it reports docId ` +
        `"${envelope.docId}" / variant "${envelope.variantId}" at version ${envelope.variantVersion}). ` +
        `Run: harness.ts represent --corpus ${manifest.name} --variants ${variant.id}`);
    }
    const makeRequest = () => buildRequest({
      model,
      aiPrompt,
      message: run.message,
      markdown: envelope.markdown,
      relatedSummaries: document.relatedSummaries as unknown as RelatedSummary[],
      generationSettings
    });
    const representation: RepresentationDescriptor = {
      kind: "text",
      variantId: variant.id,
      variantVersion: variant.variantVersion,
      sourceContentSha256: envelope.sourceContentSha256
    };
    return { makeRequest, representation, hostedImages: [] as { url: string; sha256: string }[] };
  };

  /** Everything an image-only run needs for one document. */
  const imageInput = (run: ExperimentRun, document: ManifestDocument, aiPrompt: IAiPrompt) => {
    const modeId = run.imageMode!;
    const backend = renderBackendIdentity(modeId);
    const file = imageRepresentationPath(paths, modeId, document.id);
    if (!fs.existsSync(file)) {
      throw new Error(`Missing image representation ${file}. Run: harness.ts render --corpus ` +
        `${manifest.name} --mode ${modeId}`);
    }
    const envelope = readImageEnvelope(file);
    const usable = imageRepresentationIsUsable(envelope, {
      docId: document.id,
      modeId,
      backendId: backend.backendId,
      backendVersion: backend.backendVersion,
      contentSha256: document.contentSha256
    }, file);
    if (!usable.fresh) {
      throw new Error(`Stale or damaged image representation ${file}:\n  ${usable.reasons.join("\n  ")}\n` +
        `Run: harness.ts render --corpus ${manifest.name} --mode ${modeId} --refresh`);
    }

    // Exactly one image, never the first of several — see singleImageOf.
    const image = singleImageOf(envelope, file);
    // The path is resolved now — it is a check, and a stale envelope should fail here rather than
    // at dispatch — but the bytes are read only when the request is actually built.
    const imageFile = image.url ? null : resolveImageFile(file, image);
    const makeRequest = () => buildImageRequest({
      model,
      aiPrompt,
      message: run.message,
      // A hosted render sends the URL production sends; a local capture sends its bytes inline, the
      // way production's categorizeDocument() does with a local file.
      imageUrl: image.url ?? dataUrlFor(fs.readFileSync(imageFile!)),
      accounting: { sha256: image.sha256, widthPx: image.widthPx, heightPx: image.heightPx },
      generationSettings
    });
    const representation: RepresentationDescriptor = {
      kind: "image",
      modeId,
      backendId: envelope.backendId,
      backendVersion: envelope.backendVersion,
      renderTarget: envelope.renderTarget,
      sourceContentSha256: envelope.sourceContentSha256,
      imageSha256s: envelope.images.map((entry) => entry.sha256)
    };
    return {
      makeRequest,
      representation,
      hostedImages: image.url ? [{ url: image.url, sha256: image.sha256 }] : []
    };
  };

  const tasks: RunTask[] = [];
  for (const run of experiment.runs) {
    const { aiPrompt, sha256 } = loadPrompt(run.prompt);
    for (const document of manifest.documents) {
      const { makeRequest, representation, hostedImages } = run.message === "text-only"
        ? textInput(run, document, aiPrompt)
        : imageInput(run, document, aiPrompt);
      // Built once for the key and the reservation, then released. Holding on to it is what put a
      // whole corpus of base64-encoded pixels in memory before the first call went out.
      const request = makeRequest();
      const imageTokensEstimated = request.inputAccounting.images
        .reduce((total, image) => total + estimateImageTokens(image, pricing.imageTokens), 0);
      tasks.push({
        docId: document.id,
        runId: run.id,
        run,
        modality: effectiveModality(document),
        computedModality: document.computedModality,
        promptName: run.prompt,
        promptSha256: sha256,
        aiPrompt,
        makeRequest,
        requestKey: requestKeyFor(request),
        worstCaseUsd: worstCaseUsd(request, pricing, retries),
        retries,
        representation,
        imageTokensEstimated,
        hostedImages
      });
    }
  }
  return { tasks, documents: manifest.documents };
}

// ---------------------------------------------------------------------------
// JSONL writer
// ---------------------------------------------------------------------------

/**
 * Every completion goes through one writer. Writes are serialized on a promise chain and each row is
 * appended (and flushed) on its own, so concurrent tasks cannot interleave and a crash leaves whole
 * rows or nothing.
 */
export class JsonlWriter {
  private queue: Promise<void> = Promise.resolve();
  private firstFailure: unknown;

  constructor(private readonly file: string) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }

  write(row: unknown): Promise<void> {
    const line = `${JSON.stringify(row)}\n`;
    const append = this.queue.then(() => fsp.appendFile(this.file, line, "utf8"));
    // The stored queue swallows failures so one bad append cannot poison the chain: without this, a
    // rejected head makes every later write — including the error row explaining the failure — reject
    // with the same stale error. The first failure is remembered and rethrown by close().
    this.queue = append.catch((error) => {
      if (this.firstFailure === undefined) this.firstFailure = error;
    });
    return append;
  }

  async close(): Promise<void> {
    await this.queue;
    if (this.firstFailure !== undefined) throw this.firstFailure;
  }
}

export function readResultRows(file: string): ResultRow[] {
  // A missing file means "nothing has run yet", which is exactly what resume needs on a fresh
  // --output. Callers for which a missing file is a mistake — `report` — check before calling.
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line, index) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch (error) {
        throw new Error(`${file}: line ${index + 1} is not valid JSON (${(error as Error).message})`);
      }
      return validateResultRow(parsed, `${file}:${index + 1}`);
    });
}

// ---------------------------------------------------------------------------
// Completions
// ---------------------------------------------------------------------------

export interface CompletionResult {
  parsed: unknown | null;
  refusal: string | null;
  raw: unknown;
  usage: { promptTokens: number; completionTokens: number };
  originMeta: ResponseOriginMeta;
  /** The choice's finish_reason, passed through so an unparsed response can say why. */
  finish_reason?: string | null;
}

export interface CompletionRequest {
  request: HarnessRequest;
  aiPrompt: IAiPrompt;
}

export type CreateCompletion = (request: CompletionRequest) => Promise<CompletionResult>;

/** The real backend. Deliberately the same call shape production makes, plus the completion cap. */
export function openAiCompletion(apiKey: string): CreateCompletion {
  // The harness owns retries: it reserves cost for (1 + kRetries) attempts before dispatching, so the
  // SDK retrying on top of that (its default maxRetries is 2) could bill up to three times what was
  // reserved and quietly break the --max-cost bound. The timeout keeps a hung request from parking a
  // reservation forever.
  const client = new OpenAI({ apiKey, maxRetries: 0, timeout: 120_000 });
  return async ({ request, aiPrompt }) => {
    const responseFormat = responseFormatFor(aiPrompt);
    // `create`, not `parse`. `parse` throws LengthFinishReasonError (and its content-filter sibling)
    // from inside `parseChatCompletion` *before* it returns, whenever a choice's finish_reason is
    // `length` or `content_filter`. Every request here sets max_completion_tokens, so hitting the cap
    // is the likeliest way to get an unusable response — and with `parse` the throw landed in the
    // retry loop's catch, producing an error row with no usage, no cost and no finish_reason. The
    // response was billed; the row said nothing about it.
    //
    // Production parity is untouched, because parity is a property of the *request*, and the request
    // is identical: `parse` is `create` plus a throwing parse step, which is done below instead.
    //
    // Only `apiRequest` is ever sent. `inputAccounting` travels beside it, for the cost model and the
    // cache key, and must not leak into the payload.
    const completion: any = await client.chat.completions.create({
      ...chatCompletionParams(request),
      response_format: responseFormat
    } as any);
    const choice = completion.choices?.[0];
    const message = choice?.message ?? {};
    // The same parse the SDK would have run, but only where it can succeed. A truncated or
    // filtered completion falls through with `parsed: null`, which the run loop already handles as
    // an "unparsed" error — and now that row carries what the call cost.
    let parsed: unknown = null;
    const unusableFinish = choice?.finish_reason === "length" || choice?.finish_reason === "content_filter";
    if (!unusableFinish && typeof message.content === "string" && message.refusal == null) {
      try {
        parsed = responseFormat.$parseRaw(message.content);
      } catch {
        // Malformed JSON against a strict schema. Same outcome as a truncation: an unparsed row that
        // still records its usage, rather than an error that loses it.
        parsed = null;
      }
    }
    return {
      parsed,
      refusal: message.refusal ?? null,
      finish_reason: choice?.finish_reason ?? null,
      raw: completion,
      usage: {
        promptTokens: completion.usage?.prompt_tokens ?? 0,
        completionTokens: completion.usage?.completion_tokens ?? 0
      },
      originMeta: {
        date: new Date().toISOString(),
        modelReturned: completion.model ?? null,
        systemFingerprint: completion.system_fingerprint ?? null
      }
    };
  };
}

const kTransientCodes =
  ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "EPIPE", "ENOTFOUND"];

/**
 * 429, 5xx and network failures are worth another try; nothing else is.
 *
 * The `APIConnectionError` check has to come first, and cannot be replaced by the checks below it.
 * The SDK wraps every network-level failure — DNS, socket reset, and this file's own 120s timeout —
 * in `APIConnectionError` or `APIConnectionTimeoutError`, and those report `name: "Error"`,
 * `status: undefined` and `code: undefined`, with the original code buried on `.cause`. Since
 * `openAiCompletion` sets `maxRetries: 0` precisely so the harness owns retries, missing them meant
 * a connection blip produced one attempt and an error row rather than the two retries it should get
 * for.
 */
export function isTransientError(error: unknown): boolean {
  if (error instanceof APIConnectionError) return true;
  const status = (error as any)?.status ?? (error as any)?.response?.status;
  // 408 request timeout and 409 conflict join 429 and 5xx: the SDK's own retry policy covered these,
  // and `openAiCompletion` sets maxRetries: 0, so the harness's policy has to.
  if (typeof status === "number") return [408, 409, 429].includes(status) || status >= 500;
  // The wrapped cause as well as the top level: a raw Node error reaching here would carry `code`
  // itself, but an SDK-wrapped one carries it one level down.
  const code = (error as any)?.code ?? (error as any)?.cause?.code;
  return typeof code === "string" && kTransientCodes.includes(code);
}

// ---------------------------------------------------------------------------
// The run loop
// ---------------------------------------------------------------------------

/**
 * Resume identity for one (document, run) outcome.
 *
 * It spans the corpus and the experiment definition as well as the request: without them, two
 * corpora sharing a document id — or the same experiment edited between runs — would resume each
 * other's rows, because the requestKey covers the request but not which corpus or experiment
 * produced it.
 *
 * Exported so `run`'s `--no-cache` / `--refresh-cache` guard can ask the same question the run loop
 * asks, rather than a looser one that happened to agree most of the time.
 */
export function resumeKeyFor(row: {
  corpus: string; experimentSha256: string; docId: string; runId: string; requestKey: string | null;
}): string {
  return `${row.corpus}\u0001${row.experimentSha256}\u0001${row.docId}\u0001${row.runId}\u0001${row.requestKey}`;
}

/**
 * A name for an error that actually distinguishes one failure from another.
 *
 * `(error as any).name` was always "Error": no SDK error class assigns `name`, so a rate limit, a
 * bad request, a connection timeout and a truncated completion all recorded the same thing and the
 * field told a reader nothing. The constructor name does the job, and the HTTP status goes with it
 * where there is one.
 */
export function errorTypeOf(error: unknown): string {
  const constructorName = (error as any)?.constructor?.name;
  const base = typeof constructorName === "string" && constructorName.length > 0
    ? constructorName
    : (error as any)?.name ?? "Error";
  const status = (error as any)?.status ?? (error as any)?.response?.status;
  return typeof status === "number" ? `${base}(${status})` : base;
}

export interface RunOptions {
  corpus: string;
  experiment: ExperimentFile;
  experimentSha256: string;
  tasks: RunTask[];
  outputFile: string;
  ledger: CostLedger;
  cache: ResponseCache;
  pricing: ModelPricing;
  runMeta: RunMeta;
  createCompletion: CreateCompletion;
  concurrency?: number;
  // No `retries` here on purpose. It lives on each RunTask, stamped by `buildTasks` when the
  // reservation was computed, so the attempts dispatched and the attempts paid for cannot disagree.
  // An option here would be silently ignored — the same trap in a new place.
  /** Overridden in tests so retries do not actually sleep. */
  sleep?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
  /**
   * Confirms a hosted image still serves the pixels that were evaluated, returning null when it does
   * and a reason when it does not. Overridden in tests; defaults to a real bounded download. Only
   * ever called for tasks that point at one, so a local-capture or text run touches no network.
   */
  checkHostedImage?: HostedImageCheck;
}

/**
 * A hosted render's URL is stored in the envelope and never rotates on its own, because reuse-if-fresh
 * skips the Shutterbug call entirely. What happens in practice is that it quietly stops resolving
 * while the envelope still looks perfectly valid — and the run then fails partway through, after
 * money has been spent on the tasks that went first. Checking costs one HEAD request per distinct
 * URL and turns that into a clear instruction before anything is dispatched.
 */
export type HostedImageCheck = (url: string, expectedSha256: string) => Promise<string | null>;

/**
 * Downloads a hosted image and confirms it is still the picture that was evaluated — returning null
 * when it is, or a reason when it is not.
 *
 * Reachability is not enough. The request key, the cache entry and the row's provenance all use the
 * sha256 captured when the image was rendered; if the URL later serves different pixels, a HEAD check
 * passes, the model analyses the new image, and the answer is filed under the old hash. That would
 * quietly break the one thing the cache key is supposed to guarantee.
 *
 * The body is hashed as it arrives and abandoned the moment it passes the encoded-size limit renders
 * use, so a URL that has started serving something enormous fails instead of being read into memory.
 */
export function hostedImageCheck(
  timeoutMs = 30_000, maxBytes = kDefaultRenderLimits.maxEncodedBytes
): HostedImageCheck {
  return async (url: string, expectedSha256: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { redirect: "follow", signal: controller.signal });
      if (!response.ok) return `HTTP ${response.status} ${response.statusText}`;
      // Redirects are followed, so the URL that answered need not be the one that was checked. This
      // is where a redirect to plain http, or to an address on this machine, is caught.
      const downgraded = redirectDowngradeReason(url, response.url || url);
      if (downgraded) return downgraded;
      const contentType = response.headers?.get?.("content-type") ?? null;
      if (contentType && !contentType.toLowerCase().startsWith("image/png")) {
        return `served content-type "${contentType}", not image/png`;
      }
      const declared = Number(response.headers?.get?.("content-length") ?? NaN);
      if (Number.isFinite(declared) && declared > maxBytes) {
        return `declares ${declared} bytes, over the ${maxBytes} limit`;
      }
      // Iterated rather than buffered: `arrayBuffer()` reads the whole body first, so a response
      // with no declared length would be pulled into memory in full before the limit was noticed.
      const body = response.body as unknown as AsyncIterable<Uint8Array> | null;
      if (!body) return "the response had no readable body";
      const digest = createHash("sha256");
      const head: Buffer[] = [];
      let headBytes = 0;
      let total = 0;
      let overLimit = false;
      try {
        for await (const chunk of body) {
          total += chunk.byteLength;
          if (total > maxBytes) {
            overLimit = true;
            // Releases the socket rather than draining a body we have already rejected. It also
            // makes the read throw, which is why this loop has its own catch: the outer one would
            // report a deliberate abort as a timeout.
            controller.abort();
            break;
          }
          digest.update(chunk);
          // Only the header is kept, for the PNG check; the rest is hashed and dropped.
          if (headBytes < kPngHeaderBytes) {
            head.push(Buffer.from(chunk));
            headBytes += chunk.byteLength;
          }
        }
      } catch (error) {
        if (!overLimit) throw error;
      }
      if (overLimit) return `is over the ${maxBytes} limit`;
      try {
        readPngHeader(Buffer.concat(head), url);
      } catch (error) {
        return (error as Error).message;
      }
      const actual = digest.digest("hex");
      return actual === expectedSha256
        ? null
        : `now serves different pixels (sha256 ${actual}, expected ${expectedSha256})`;
    } catch (error) {
      return controller.signal.aborted ? `timed out after ${timeoutMs}ms` : (error as Error).message;
    } finally {
      clearTimeout(timer);
    }
  };
}

/**
 * `Promise.all` with a cap on how many run at once, preserving input order in the result.
 *
 * Used where the work is unbounded in size as well as in count — every item is a download — so
 * "start them all and wait" is not a neutral choice.
 */
async function mapWithConcurrency<T, R>(
  items: T[], concurrency: number, run: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await run(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, worker));
  return results;
}

export class HostedImageUnusable extends Error {
  constructor(public readonly failures: { docId: string; runId: string; url: string; reason: string }[]) {
    const listed = failures.slice(0, 5)
      .map((failure) => `  ${failure.docId} (${failure.runId}): ${failure.url}\n    ${failure.reason}`)
      .join("\n");
    super(`${failures.length} hosted image(s) can no longer be evaluated as rendered:\n${listed}` +
      `${failures.length > 5 ? `\n  …and ${failures.length - 5} more` : ""}\n` +
      "Hosted renders expire, and a fresh envelope will not re-request one. Re-render with " +
      "`harness.ts render --mode <mode> --refresh`. Nothing was dispatched.");
    this.name = "HostedImageUnusable";
  }
}

export interface RunSummary {
  written: number;
  resumed: number;
  cacheHits: number;
  /** Requests actually dispatched, counting every retry — not tasks completed. */
  apiCalls: number;
  stoppedOnCeiling: boolean;
  reservedPeakUsd: number;
  incurredUsd: number;
  /** How far *incurred* spend ended up past `--max-cost`, or 0. Usually 0 even when the run stopped. */
  overshootUsd: number;
  /**
   * How far the committed total — settled spend plus outstanding reservations — ended up past the
   * ceiling. This is what `hasExceededCeiling` trips on, and it can be non-zero while `overshootUsd`
   * is 0, which is the ordinary case for a run that stopped early.
   */
  committedOvershootUsd: number;
  /** Tasks that were never dispatched because the run stopped. 0 when everything ran. */
  notDispatched: number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function runTasks(options: RunOptions): Promise<RunSummary> {
  const {
    corpus, experiment, experimentSha256, tasks, outputFile, ledger, cache, pricing, runMeta, createCompletion
  } = options;
  const concurrency = options.concurrency ?? kDefaultConcurrency;
  const sleep = options.sleep ?? defaultSleep;
  const log = options.log ?? (() => undefined);

  // Resume: an existing row for this (docId, runId) blocks a rerun only when its requestKey matches,
  // so a changed document, prompt, representation, experiment or generation setting re-runs. Error
  // rows never block a rerun.
  // Resume identity also spans the corpus and the experiment definition. Without them, two corpora
  // sharing a document id (or the same experiment edited between runs) would resume each other's
  // rows: the requestKey covers the request, but not which corpus or experiment produced it.
  const completed = new Set<string>();
  for (const row of readResultRows(outputFile)) {
    if (row.status === "error" || row.requestKey === null) continue;
    completed.add(resumeKeyFor(row));
  }

  const writer = new JsonlWriter(outputFile);
  const summary: RunSummary = {
    written: 0, resumed: 0, cacheHits: 0, apiCalls: 0, stoppedOnCeiling: false, reservedPeakUsd: 0,
    incurredUsd: 0, overshootUsd: 0, committedOvershootUsd: 0, notDispatched: 0
  };

  const taskResumeKey = (task: RunTask) =>
    resumeKeyFor({ corpus, experimentSha256, docId: task.docId, runId: task.runId, requestKey: task.requestKey });
  const pending = tasks.filter((task) => {
    if (completed.has(taskResumeKey(task))) {
      summary.resumed += 1;
      return false;
    }
    return true;
  });

  // Before anything is dispatched, and only for tasks that actually point at a hosted image. A
  // cache hit would not need the URL, but it is checked all the same: a run that half-succeeds on
  // cached rows and then fails on the rest is worse to reason about than one that refuses up front.
  const hostedImages = new Map(pending.flatMap((task) =>
    task.hostedImages.map((image) => [`${image.url}\u0001${image.sha256}`, image] as const)));
  if (hostedImages.size > 0) {
    const check = options.checkHostedImage ?? hostedImageCheck();
    // At the run loop's own concurrency rather than all at once. Each download is allowed up to
    // 20 MB, so a 25-document corpus checked with `Promise.all` could have half a gigabyte in
    // flight and 25 simultaneous connections to one host.
    const reasons = new Map(await mapWithConcurrency([...hostedImages], concurrency,
      async ([key, image]) => [key, await check(image.url, image.sha256)] as const));
    const failures = pending.flatMap((task) => task.hostedImages
      .map((image) => ({ image, reason: reasons.get(`${image.url}\u0001${image.sha256}`) }))
      .filter((checked) => checked.reason != null)
      .map((checked) => ({
        docId: task.docId, runId: task.runId, url: checked.image.url, reason: checked.reason!
      })));
    if (failures.length > 0) throw new HostedImageUnusable(failures);
    log(`Verified ${hostedImages.size} hosted image(s) still serve the pixels that were rendered.`);
  }

  const common = (task: RunTask) => ({
    schemaVersion: kResultSchemaVersion,
    experiment: experiment.name,
    experimentSha256,
    runId: task.runId,
    corpus,
    docId: task.docId,
    modality: task.modality,
    computedModality: task.computedModality,
    message: task.run.message,
    representation: task.representation,
    // Only on rows that actually sent a picture, so the report's image column never shows a number
    // belonging to nothing.
    ...(task.representation.kind === "image"
      ? { promptImageTokensEstimated: task.imageTokensEstimated }
      : {}),
    prompt: { name: task.promptName, sha256: task.promptSha256 },
    requestKey: task.requestKey,
    runMeta
  });

  const rowFromResponse = (
    task: RunTask, entry: CacheEntry, source: "api" | "cache", incurredThisRunUsd: number
  ): ResultRow => {
    const modeledUsd = priceTokens(entry.usage.promptTokens, entry.usage.completionTokens, pricing);
    const usage = { ...entry.usage, source };
    const cost = { modeledUsd, incurredThisRunUsd };
    if (entry.status === "refusal") {
      return {
        ...common(task),
        status: "refusal",
        refusal: entry.refusal ?? "",
        usage,
        cost,
        responseOriginMeta: entry.responseOriginMeta
      };
    }
    return {
      ...common(task),
      status: "success",
      response: { parsed: entry.parsed ?? null, raw: entry.raw },
      usage,
      cost,
      responseOriginMeta: entry.responseOriginMeta
    };
  };

  let stopped = false;
  let next = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      if (stopped) return;
      const index = next++;
      // Checked before the ceiling, not after. The other way round, the worker that wrote the final
      // row came back for one more turn, found the ledger over its ceiling and set stoppedOnCeiling
      // — so a run that completed every task still reported stopping early.
      if (index >= pending.length) return;
      if (ledger.hasExceededCeiling) {
        stopped = true;
        summary.stoppedOnCeiling = true;
        // Worded from incurred spend, because that is what "spend" means to a reader. The ledger
        // trips on the committed total (settled plus outstanding reservations), which is the right
        // thing to stop on but is not money out of the door.
        log(`Spend has reached the --max-cost ceiling: $${ledger.incurredUsd.toFixed(4)} incurred ` +
          `against a $${ledger.maxCostUsd.toFixed(4)} ceiling, with $${ledger.committedUsd.toFixed(4)} ` +
          "committed once outstanding reservations are counted. No further requests were dispatched.");
        return;
      }
      const task = pending[index];

      const cached = cache.get(task.requestKey);
      if (cached) {
        // A cache hit reserves nothing and costs nothing this run.
        summary.cacheHits += 1;
        await writer.write(rowFromResponse(task, cached, "cache", 0));
        summary.written += 1;
        continue;
      }

      let reservation;
      try {
        reservation = ledger.reserve(task.worstCaseUsd);
      } catch (error) {
        if (error instanceof CostCeilingExceeded) {
          stopped = true;
          summary.stoppedOnCeiling = true;
          log(error.message);
          return;
        }
        throw error;
      }

      // From the task, so the number of attempts dispatched is the number the reservation paid for.
      const retries = task.retries;
      let attempts = 0;
      let lastError: unknown;
      let result: CompletionResult | undefined;
      // Built here, at dispatch, and dropped when this task finishes — see `makeRequest`. Every
      // attempt sends the same request, so it is built once per task rather than once per attempt.
      const request = task.makeRequest();
      while (attempts <= retries) {
        attempts += 1;
        try {
          // Counted here, per dispatch: a request that succeeds on its third try made three calls,
          // and one that exhausts its retries made three and reported none.
          summary.apiCalls += 1;
          result = await createCompletion({ request, aiPrompt: task.aiPrompt });
          break;
        } catch (error) {
          lastError = error;
          if (!isTransientError(error) || attempts > retries) break;
          await sleep(250 * 2 ** (attempts - 1));
        }
      }

      if (!result) {
        // The request went out, so the provider may have billed for it even though nothing usable
        // came back. It is charged one attempt's share of the reservation per attempt dispatched —
        // the whole reservation when every attempt was used — which is honest in the direction that
        // matters: a long run of failures must not look free. Errors are never cached.
        ledger.settleFailedAttempt(reservation, attempts, 1 + retries);
        await writer.write({
          ...common(task),
          status: "error",
          error: {
            // The constructor name, not `.name`: no SDK error class assigns `name`, so a 429, a
            // 400, a timeout and a truncation all recorded "Error" and the field distinguished
            // nothing. The status goes in too, where there is one.
            type: errorTypeOf(lastError),
            message: (lastError as Error)?.message ?? String(lastError),
            attempts
          }
        } satisfies ResultRow);
        summary.written += 1;
        continue;
      }

      // The call happened, so the money is spent whatever the response turned out to be — and any
      // earlier attempts that failed on the way here were dispatched too, so they are charged on the
      // same basis the all-failed path uses rather than being written off.
      const incurredThisRunUsd = priceTokens(result.usage.promptTokens, result.usage.completionTokens, pricing);
      ledger.settleAfterFailedAttempts(reservation, incurredThisRunUsd, attempts - 1, 1 + retries);

      if (result.parsed == null && result.refusal == null) {
        // A response with neither a parsed object nor a refusal is a failure, the same way production
        // treats it ("No response from AI" in on-analysis-document-imaged.ts). It is not cached: the
        // usual cause is a truncated or malformed completion, which a rerun may well get past.
        const reason = result.finish_reason ? `finish_reason: ${result.finish_reason}` : "no finish_reason reported";
        await writer.write({
          ...common(task),
          status: "error",
          error: {
            type: "unparsed",
            message: `The model returned neither a parsed response nor a refusal (${reason}).`,
            attempts
          },
          // The API answered and billed for it, so the row carries what it cost. Without this the
          // report understates spend by exactly the unparsed responses.
          usage: { ...result.usage, source: "api" },
          cost: { modeledUsd: incurredThisRunUsd, incurredThisRunUsd },
          responseOriginMeta: result.originMeta
        } satisfies ResultRow);
        summary.written += 1;
        continue;
      }

      const entry: CacheEntry = {
        schemaVersion: kSchemaVersion,
        key: task.requestKey,
        status: result.refusal ? "refusal" : "success",
        parsed: result.parsed ?? undefined,
        raw: result.raw,
        refusal: result.refusal ?? undefined,
        usage: result.usage,
        responseOriginMeta: result.originMeta
      };
      // Successes *and* refusals are cached, so a rerun does not re-spend on a deterministic refusal.
      cache.put(entry);
      await writer.write(rowFromResponse(task, entry, "api", incurredThisRunUsd));
      summary.written += 1;
    }
  };

  // allSettled rather than all: Promise.all rejects on the first worker failure and would skip
  // writer.close(), abandoning rows already queued. Every worker is drained first, the writer is
  // closed in the finally, and only then is the first failure rethrown.
  const outcomes = await Promise.allSettled(
    Array.from({ length: Math.max(1, concurrency) }, () => worker()));
  try {
    const failure = outcomes.find((outcome) => outcome.status === "rejected");
    if (failure) throw (failure as PromiseRejectedResult).reason;
  } finally {
    await writer.close();
  }

  summary.reservedPeakUsd = ledger.reservedPeakUsd;
  summary.incurredUsd = ledger.incurredUsd;
  summary.overshootUsd = Math.max(0, ledger.incurredUsd - ledger.maxCostUsd);
  summary.committedOvershootUsd = ledger.overshootUsd;
  // Counted from what is left rather than tracked as we go, so it is right however the run ended.
  // `written` already includes cache hits — a hit writes a row — so subtracting `cacheHits` as well
  // double-counted them, under-reporting the skipped work and, with enough hits, driving this to 0
  // and suppressing the "stopped early" message for a run that really did stop.
  summary.notDispatched = Math.max(0, pending.length - summary.written);
  return summary;
}
