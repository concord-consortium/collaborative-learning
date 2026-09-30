// Generation budgets and runtime limits for the unit-summary pipeline, shared by the digest,
// prior-knowledge, approach, and overview steps. Character-based output limits (per field, and the total
// budget) live in shared/unit-summary-types.ts, since Save-time validation in the authoring panel
// needs them too.

// Above this many characters, a problem's own Markdown is chunked and the chunk digests combined
// in a further call. Expected to trigger rarely.
export const UNIT_SUMMARY_DIGEST_INPUT_BUDGET_CHARS = 40_000;

// The most calls in flight at once. The digest step applies it to its own pool; every step after
// it -- approach, prior knowledge in either mode, and the overview -- shares one limiter set to
// this, so the steps running side by side cannot exceed it between them.
export const UNIT_SUMMARY_CONCURRENCY_LIMIT = 8;

// Per-call deadline, passed to the OpenAI client's own per-request timeout so an actual hung
// connection is aborted rather than left to the transport's own (much longer) default.
export const UNIT_SUMMARY_CALL_TIMEOUT_MS = 90_000;

// 2 retries -- 3 attempts total -- only for a retryable failure (429 / 5xx / timeout), never for a
// validation failure (e.g. an over-length response), which fails immediately instead. Derived from
// the backoff array's length, not a separate number, so the two can never drift apart -- raising
// the retry count with no backoff to match it would otherwise mean sleep(undefined) between
// attempts, i.e. an immediate burst against a rate-limited endpoint instead of a backoff.
export const UNIT_SUMMARY_RETRY_BACKOFF_MS = [2_000, 8_000];
export const UNIT_SUMMARY_RETRY_COUNT = UNIT_SUMMARY_RETRY_BACKOFF_MS.length;

// The runtime backstop for the whole generation route (all steps together), well inside the
// 540-second 1st-gen function timeout so the author gets a clean error, not a platform timeout.
export const UNIT_SUMMARY_OVERALL_DEADLINE_MS = 420_000;

// Prefix-mode prior knowledge is quadratic in problem count (call i reads i digests), so above
// this many problems the prior-knowledge step switches to rolling mode (linear, but sequential).
export const UNIT_SUMMARY_MODE_SWITCH_PROBLEM_COUNT = 40;

// Checked before any model call: a unit above either limit is rejected up front, with a clear
// error and no spend.
//
// Worst case (every field at its max) must fit UNIT_SUMMARY_TOTAL_BUDGET_CHARS, or that separate,
// later check could reject a summary only after every model call for it has already run; see
// unit-summary-config.test.ts, which enforces this directly.
//
// These bound input, not running time. Above UNIT_SUMMARY_MODE_SWITCH_PROBLEM_COUNT the
// prior-knowledge calls each wait for the one before, so depth grows with the problem count: 47
// rounds at 41 problems, 61 at 54 (unit-summary-generate.test.ts). Fitting
// UNIT_SUMMARY_OVERALL_DEADLINE_MS at 41 problems needs calls averaging under about 9 seconds,
// and the 540-second function timeout in index.ts caps any larger deadline at about 11. One timed
// generation averaged 15.6 seconds a call, so a unit that size is expected to spend minutes and
// then fail. Nothing authored is near 41; making such a unit work needs that chain shortened
// rather than a higher limit.
export const UNIT_SUMMARY_HARD_MAX_PROBLEMS = 54;
export const UNIT_SUMMARY_HARD_MAX_AGGREGATE_INPUT_CHARS = 3_000_000;

// Whether a problem's content fits in a single model call. The digest step, the approach step and
// the size estimate all branch on this and have to agree, so it is written once. Takes a length
// rather than an AssembledProblem to keep this file free of imports.
export function fitsOneCall(markdownLength: number): boolean {
  return markdownLength <= UNIT_SUMMARY_DIGEST_INPUT_BUDGET_CHARS;
}
