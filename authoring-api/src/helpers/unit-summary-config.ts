// Generation budgets and runtime limits for the unit-summary pipeline, shared by the digest,
// prior-knowledge, and overview steps. Starting values from docs/plans/CLUE-685-checklist.md's
// decision table; the early (step 2.4) and release-gate (step 2.7) benchmarks may adjust them.
// Character-based output limits (per field, and the total budget) live in
// shared/unit-summary-types.ts, since Save-time validation in the authoring panel needs them too.

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
// validation failure (e.g. an over-length response), which fails immediately instead.
export const UNIT_SUMMARY_RETRY_COUNT = 2;
export const UNIT_SUMMARY_RETRY_BACKOFF_MS = [2_000, 8_000];

// The runtime backstop for the whole generation route (all steps together), well inside the
// 540-second 1st-gen function timeout so the author gets a clean error, not a platform timeout.
export const UNIT_SUMMARY_OVERALL_DEADLINE_MS = 420_000;
