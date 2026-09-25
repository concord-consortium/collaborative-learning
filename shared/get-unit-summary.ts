// Fetches a unit's published content.json (always the main branch -- see the v1 limitation below)
// and returns its authored aiUnitSummary alongside the live problem list walked from that same
// fetch, so a server-side AI consumer (Ideas, Teacher Summary) can run the same unitSummarySlice
// prefix check the client-side consumers do.
//
// v1 limitation: this always fetches main. A class running on a branch-preview deploy whose
// curriculum differs from main still resolves to main's content.json here, and the prefix check
// cannot detect that mismatch -- both the summary and the structure it's checked against come
// from the same (main) fetch, so the check only proves internal consistency, not that main is the
// curriculum the student's class actually loaded. Accepted for v1: production classes run on
// main; branch previews are development/QA use. See docs/unit-configuration.md.
import {mainBranchUnitJsonUrl} from "./unit-url";
import {ILiveProblem} from "./unit-summary-slice";
import {IUnitSummary} from "./unit-summary-types";

export interface IUnitSummaryFetchResult {
  summary?: IUnitSummary;
  liveProblems: ILiveProblem[];
}

// A unit evaluated repeatedly in a short window (Ideas runs per evaluation, not per unit) doesn't
// need to refetch content.json every time -- it changes rarely relative to how often this runs.
const kResultTtlMs = 10 * 60 * 1000; // 10 minutes
// Shorter than a success: a bad or unpublished unit code should recover once the underlying
// problem is fixed, not stay broken for a full 10 minutes, but it also must not refetch on every
// single evaluation while it's broken.
const kFailureTtlMs = 60 * 1000; // 1 minute

const kFetchTimeoutMs = 10 * 1000;

interface ICacheEntry {
  result: IUnitSummaryFetchResult | undefined;
  cachedAt: number;
}

const cache = new Map<string, ICacheEntry>();
// A container running with concurrency > 1 can receive several calls for the same unit before the
// first fetch resolves (e.g. a burst of Ideas evaluations for one class). Without this, each of
// those calls would see nothing in `cache` yet and independently re-fetch the same content.json.
const inflight = new Map<string, Promise<IUnitSummaryFetchResult | undefined>>();

function cacheEntryIsFresh(entry: ICacheEntry): boolean {
  const ttl = entry.result === undefined ? kFailureTtlMs : kResultTtlMs;
  return Date.now() - entry.cachedAt < ttl;
}

async function fetchUnitSummary(unit: string): Promise<IUnitSummaryFetchResult | undefined> {
  const url = mainBranchUnitJsonUrl(unit);

  let response: Response;
  try {
    response = await fetch(url, {signal: AbortSignal.timeout(kFetchTimeoutMs)});
  } catch (error) {
    console.error(`getUnitSummary: failed to fetch ${url}`, error);
    return undefined;
  }
  if (!response.ok) {
    console.error(`getUnitSummary: ${url} returned ${response.status}`);
    return undefined;
  }

  let content: {investigations?: unknown; config?: {aiUnitSummary?: IUnitSummary}};
  try {
    content = await response.json() as typeof content;
  } catch (error) {
    console.error(`getUnitSummary: ${url} did not return valid JSON`, error);
    return undefined;
  }
  if (!Array.isArray(content.investigations)) {
    console.error(`getUnitSummary: ${url} is missing investigations`);
    return undefined;
  }

  const liveProblems: ILiveProblem[] = content.investigations.reduce(
    (acc: ILiveProblem[], investigation: {ordinal: unknown; problems?: {ordinal: unknown; title: unknown}[]}) => {
      for (const problem of investigation.problems ?? []) {
        // Matches the assembler's own problem.title ?? "" (assemble-unit.ts): a missing title
        // must walk to "", not the string "undefined", or a problem with no authored title would
        // disagree with the manifest and fail the prefix check closed for no real reason.
        acc.push({ordinal: `${investigation.ordinal}.${problem.ordinal}`, title: String(problem.title ?? "")});
      }
      return acc;
    },
    []
  );

  return {summary: content.config?.aiUnitSummary, liveProblems};
}

/**
 * Returns undefined -- send nothing -- on any failure: network error or timeout, non-2xx, invalid
 * JSON, or a shape that doesn't look like a unit (missing investigations). Never a partial result.
 *
 * Module-scope cache keyed by unit code; see kResultTtlMs/kFailureTtlMs.
 *
 * @param {string} unit the unit code as stamped on the document/class (may be a legacy alias;
 * resolved to its canonical code via unitCodeMap before fetching)
 */
export async function getUnitSummary(unit: string): Promise<IUnitSummaryFetchResult | undefined> {
  const cached = cache.get(unit);
  if (cached && cacheEntryIsFresh(cached)) {
    return cached.result;
  }
  let pending = inflight.get(unit);
  if (!pending) {
    pending = fetchUnitSummary(unit).then((result) => {
      cache.set(unit, {result, cachedAt: Date.now()});
      return result;
    }).finally(() => inflight.delete(unit));
    inflight.set(unit, pending);
  }
  return pending;
}
