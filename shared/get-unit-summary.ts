// Fetches a unit's published content.json and returns its authored aiUnitSummary alongside the
// live problem list walked from that same fetch, so a server-side AI consumer (Ideas, Teacher
// Summary) can run the same unitSummarySlice prefix check the client-side consumers do.
//
// Always fetches the main branch, even for a class on a branch-preview deploy -- see
// docs/unit-summary-consumers.md for why that's accepted.
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

  let content: unknown;
  try {
    content = await response.json();
  } catch (error) {
    console.error(`getUnitSummary: ${url} did not return valid JSON`, error);
    return undefined;
  }

  // content is a remote payload; parseContent throws on any shape we didn't anticipate (a null
  // entry, a wrong-typed field), caught here so it fails closed like every check above.
  try {
    return parseContent(content);
  } catch (error) {
    console.error(`getUnitSummary: ${url} does not match the expected unit shape`, error);
    return undefined;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return (typeof value === "object" && value !== null) ? value as Record<string, unknown> : undefined;
}

function parseContent(content: unknown): IUnitSummaryFetchResult {
  const record = asRecord(content);
  if (!record) throw new Error("top-level content is not an object");

  const investigations = record.investigations;
  if (!Array.isArray(investigations)) throw new Error("investigations is not an array");

  const liveProblems: ILiveProblem[] = [];
  for (const investigation of investigations) {
    const investigationRecord = asRecord(investigation);
    if (!investigationRecord) throw new Error("an investigation is not an object");

    const problems = investigationRecord.problems;
    if (problems !== undefined && !Array.isArray(problems)) {
      throw new Error("an investigation's problems is not an array");
    }

    for (const problem of problems ?? []) {
      const problemRecord = asRecord(problem);
      if (!problemRecord) throw new Error("a problem is not an object");
      // Matches the assembler's problem.title ?? "" (assemble-unit.ts): a missing title must
      // become "", not the string "undefined", or an untitled problem would disagree with the
      // manifest and fail the prefix check for no reason.
      liveProblems.push({
        ordinal: `${investigationRecord.ordinal}.${problemRecord.ordinal}`,
        title: String(problemRecord.title ?? ""),
      });
    }
  }

  const config = asRecord(record.config);
  return {summary: config?.aiUnitSummary as IUnitSummary | undefined, liveProblems};
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
    pending = fetchUnitSummary(unit)
      // Backstop: fetchUnitSummary should never reject, but if it did, this keeps the failure
      // cached like any other rather than rejecting past callers that don't try/catch it.
      .catch((error) => {
        console.error(`getUnitSummary: unexpected failure fetching ${unit}`, error);
        return undefined;
      })
      .then((result) => {
        cache.set(unit, {result, cachedAt: Date.now()});
        return result;
      }).finally(() => inflight.delete(unit));
    inflight.set(unit, pending);
  }
  return pending;
}
