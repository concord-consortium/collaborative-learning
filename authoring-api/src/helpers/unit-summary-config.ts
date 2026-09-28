// Generation budgets and runtime limits for the unit-summary pipeline, shared by the digest,
// prior-knowledge, and overview steps. Character-based output limits (per field, and the total
// budget) live in shared/unit-summary-types.ts, since Save-time validation in the authoring panel
// needs them too.

// Above this many characters, a problem's own Markdown is chunked and the chunk digests combined
// in a further call. Expected to trigger rarely.
export const UNIT_SUMMARY_DIGEST_INPUT_BUDGET_CHARS = 40_000;

// Applies to digest calls and to prefix-mode prior-knowledge calls (rolling mode is sequential by
// definition, so this does not apply there).
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

// Checked before any model call. A unit at or under this problem count and estimated aggregate
// input is guaranteed to fit even in the cheaper rolling mode; above either, generation is
// rejected up front with a clear error instead of spending anything.
//
// Worst case (every field at its max) must fit UNIT_SUMMARY_TOTAL_BUDGET_CHARS, or that separate,
// later check could reject a summary only after every model call for it has already run; see
// unit-summary-config.test.ts, which enforces this directly.
export const UNIT_SUMMARY_HARD_MAX_PROBLEMS = 54;
export const UNIT_SUMMARY_HARD_MAX_AGGREGATE_INPUT_CHARS = 3_000_000;
