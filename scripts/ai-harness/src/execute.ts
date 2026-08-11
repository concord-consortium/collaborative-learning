/**
 * Run expansion, OpenAI calls, concurrency, retries, resume, and the JSONL writer.
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import OpenAI from "openai";
import { VERSION as kOpenAiSdkVersion } from "openai/version";
import type { IAiPrompt, RelatedSummary } from "../../../shared/ai-analysis-messages.js";
import {
  CorpusPaths, harnessRoot, readJsonFile, readManifest, readRepresentation, representationIsFresh,
  representationPath
} from "./corpus.js";
import { CacheEntry, ResponseCache } from "./cache.js";
import { CostCeilingExceeded, CostLedger, kRetries, priceTokens, worstCaseUsd } from "./cost.js";
import { HarnessRequest, buildRequest, requestKeyFor, responseFormatFor } from "./messages.js";
import { getTextVariant } from "./represent-text.js";
import {
  ExperimentFile, ExperimentRun, ManifestDocument, ModelPricing, ResponseOriginMeta, ResultRow, RunMeta,
  effectiveModality, kSchemaVersion, validatePromptFile, validateResultRow
} from "./schemas.js";

export const kDefaultModel = "gpt-4o-mini";
export const kDefaultConcurrency = 4;

// ---------------------------------------------------------------------------
// Run metadata
// ---------------------------------------------------------------------------

function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, { cwd: harnessRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .trim();
  } catch {
    return null;
  }
}

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
  modality: ManifestDocument["computedModality"];
  promptName: string;
  promptSha256: string;
  aiPrompt: IAiPrompt;
  request: HarnessRequest;
  requestKey: string;
  worstCaseUsd: number;
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

  const tasks: RunTask[] = [];
  for (const run of experiment.runs) {
    const variant = getTextVariant(run.textVariant);
    const { aiPrompt, sha256 } = loadPrompt(run.prompt);
    for (const document of manifest.documents) {
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

      const relatedSummaries = document.relatedSummaries as unknown as RelatedSummary[];
      const request = buildRequest({
        model,
        aiPrompt,
        message: run.message,
        markdown: envelope.markdown,
        relatedSummaries,
        generationSettings: { max_completion_tokens: pricing.maxOutputTokens }
      });
      tasks.push({
        docId: document.id,
        runId: run.id,
        run,
        modality: effectiveModality(document),
        promptName: run.prompt,
        promptSha256: sha256,
        aiPrompt,
        request,
        requestKey: requestKeyFor(request),
        worstCaseUsd: worstCaseUsd(request, pricing, options.retries)
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
    const completion: any = await client.chat.completions.parse({
      model: request.model,
      messages: request.messages,
      response_format: responseFormatFor(aiPrompt),
      max_completion_tokens: request.generationSettings.max_completion_tokens
    });
    const choice = completion.choices?.[0];
    const message = choice?.message ?? {};
    return {
      parsed: message.parsed ?? null,
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

/** 429, 5xx and network failures are worth another try; nothing else is. */
export function isTransientError(error: unknown): boolean {
  const status = (error as any)?.status ?? (error as any)?.response?.status;
  // 408 request timeout and 409 conflict join 429 and 5xx: the SDK's own retry policy covered these,
  // and A1 turned that off, so the harness's policy has to.
  if (typeof status === "number") return [408, 409, 429].includes(status) || status >= 500;
  const code = (error as any)?.code;
  return typeof code === "string" &&
    ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EAI_AGAIN", "EPIPE", "ENOTFOUND"].includes(code);
}

// ---------------------------------------------------------------------------
// The run loop
// ---------------------------------------------------------------------------

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
  retries?: number;
  /** Overridden in tests so retries do not actually sleep. */
  sleep?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
}

export interface RunSummary {
  written: number;
  resumed: number;
  cacheHits: number;
  apiCalls: number;
  stoppedOnCeiling: boolean;
  reservedPeakUsd: number;
  incurredUsd: number;
  /** How far actual spend ended up past `--max-cost`, or 0. See the README on the enforced bound. */
  overshootUsd: number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function runTasks(options: RunOptions): Promise<RunSummary> {
  const {
    corpus, experiment, experimentSha256, tasks, outputFile, ledger, cache, pricing, runMeta, createCompletion
  } = options;
  const concurrency = options.concurrency ?? kDefaultConcurrency;
  const retries = options.retries ?? kRetries;
  const sleep = options.sleep ?? defaultSleep;
  const log = options.log ?? (() => undefined);

  // Resume: an existing row for this (docId, runId) blocks a rerun only when its requestKey matches,
  // so a changed document, prompt, representation, experiment or generation setting re-runs. Error
  // rows never block a rerun.
  // Resume identity also spans the corpus and the experiment definition. Without them, two corpora
  // sharing a document id (or the same experiment edited between runs) would resume each other's
  // rows: the requestKey covers the request, but not which corpus or experiment produced it.
  const resumeKey = (row: { corpus: string; experimentSha256: string; docId: string; runId: string;
    requestKey: string | null }) =>
    `${row.corpus}\u0001${row.experimentSha256}\u0001${row.docId}\u0001${row.runId}\u0001${row.requestKey}`;
  const completed = new Set<string>();
  for (const row of readResultRows(outputFile)) {
    if (row.status === "error" || row.requestKey === null) continue;
    completed.add(resumeKey(row));
  }

  const writer = new JsonlWriter(outputFile);
  const summary: RunSummary = {
    written: 0, resumed: 0, cacheHits: 0, apiCalls: 0, stoppedOnCeiling: false, reservedPeakUsd: 0,
    incurredUsd: 0, overshootUsd: 0
  };

  const taskResumeKey = (task: RunTask) =>
    resumeKey({ corpus, experimentSha256, docId: task.docId, runId: task.runId, requestKey: task.requestKey });
  const pending = tasks.filter((task) => {
    if (completed.has(taskResumeKey(task))) {
      summary.resumed += 1;
      return false;
    }
    return true;
  });

  const common = (task: RunTask) => ({
    schemaVersion: kSchemaVersion,
    experiment: experiment.name,
    experimentSha256,
    runId: task.runId,
    corpus,
    docId: task.docId,
    modality: task.modality,
    message: task.run.message,
    textVariant: task.run.textVariant,
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
      if (ledger.hasExceededCeiling) {
        stopped = true;
        summary.stoppedOnCeiling = true;
        log(`Actual spend has passed the --max-cost ceiling by $${ledger.overshootUsd.toFixed(4)}; ` +
          "no further requests were dispatched.");
        return;
      }
      const index = next++;
      if (index >= pending.length) return;
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

      let attempts = 0;
      let lastError: unknown;
      let result: CompletionResult | undefined;
      while (attempts <= retries) {
        attempts += 1;
        try {
          result = await createCompletion({ request: task.request, aiPrompt: task.aiPrompt });
          break;
        } catch (error) {
          lastError = error;
          if (!isTransientError(error) || attempts > retries) break;
          await sleep(250 * 2 ** (attempts - 1));
        }
      }

      if (!result) {
        // The request went out, so the provider may have billed for it even though nothing usable
        // came back. Charging its single-attempt share is honest in the direction that matters: a
        // long run of failures must not look free. Errors are never cached.
        ledger.settleFailedAttempt(reservation, attempts, 1 + retries);
        await writer.write({
          ...common(task),
          status: "error",
          error: {
            type: (lastError as any)?.name ?? "Error",
            message: (lastError as Error)?.message ?? String(lastError),
            attempts
          }
        } satisfies ResultRow);
        summary.written += 1;
        continue;
      }

      summary.apiCalls += 1;
      // The call happened, so the money is spent whatever the response turned out to be.
      const incurredThisRunUsd = priceTokens(result.usage.promptTokens, result.usage.completionTokens, pricing);
      ledger.settle(reservation, incurredThisRunUsd);

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
  summary.overshootUsd = ledger.overshootUsd;
  return summary;
}
