// Shared retry wrapper for every unit-summary OpenAI call (digest, prior-knowledge, overview).
// Retries only a transient failure -- 429, 5xx, or a timeout -- using the SDK's own typed error
// classes rather than guessing at status codes. Anything else, including a validation failure our
// own code raises after a successful response (e.g. an over-length digest), is a plain Error and
// so is never retryable: it rejects on the first attempt.
import {APIConnectionTimeoutError, InternalServerError, RateLimitError} from "openai";
import {UNIT_SUMMARY_RETRY_BACKOFF_MS, UNIT_SUMMARY_RETRY_COUNT} from "./unit-summary-config";

function isRetryableError(error: unknown): boolean {
  return error instanceof RateLimitError ||
    error instanceof InternalServerError ||
    error instanceof APIConnectionTimeoutError;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callWithRetry<T>(call: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await call();
    } catch (error) {
      const attemptsLeft = attempt < UNIT_SUMMARY_RETRY_COUNT;
      if (!isRetryableError(error) || !attemptsLeft) {
        throw error;
      }
      await sleep(UNIT_SUMMARY_RETRY_BACKOFF_MS[attempt]);
    }
  }
}
