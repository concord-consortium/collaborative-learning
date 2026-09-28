import {APIConnectionTimeoutError, BadRequestError, InternalServerError, RateLimitError} from "openai";
import {callWithRetry} from "./unit-summary-retry";

describe("callWithRetry", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns the result on a first-try success without waiting", async () => {
    const call = jest.fn().mockResolvedValue("ok");
    await expect(callWithRetry(call)).resolves.toBe("ok");
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("retries a 429 with the decided 2s/8s backoff, then succeeds", async () => {
    const call = jest.fn()
      .mockRejectedValueOnce(new RateLimitError(429, {}, "rate limited", new Headers()))
      .mockRejectedValueOnce(new RateLimitError(429, {}, "rate limited", new Headers()))
      .mockResolvedValueOnce("ok");

    const resultPromise = callWithRetry(call);
    await jest.advanceTimersByTimeAsync(2_000);
    await jest.advanceTimersByTimeAsync(8_000);

    await expect(resultPromise).resolves.toBe("ok");
    expect(call).toHaveBeenCalledTimes(3);
  });

  it("retries a 5xx and a timeout the same way it retries a 429", async () => {
    for (const error of [
      new InternalServerError(500, {}, "server error", new Headers()),
      new APIConnectionTimeoutError(),
    ]) {
      const call = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce("ok");
      const resultPromise = callWithRetry(call);
      await jest.advanceTimersByTimeAsync(2_000);
      await expect(resultPromise).resolves.toBe("ok");
      expect(call).toHaveBeenCalledTimes(2);
    }
  });

  it("gives up after 2 retries (3 attempts) and rejects with the last error", async () => {
    const call = jest.fn().mockRejectedValue(new RateLimitError(429, {}, "rate limited", new Headers()));

    const resultPromise = callWithRetry(call);
    // Attach a rejection handler immediately so an intermediate rejected state (before fake timers
    // advance) is never "unhandled" for even one microtask.
    const assertion = expect(resultPromise).rejects.toThrow("429");
    await jest.advanceTimersByTimeAsync(2_000);
    await jest.advanceTimersByTimeAsync(8_000);
    await assertion;

    expect(call).toHaveBeenCalledTimes(3);
  });

  it("does not retry a non-retryable HTTP error (e.g. a 400)", async () => {
    const call = jest.fn().mockRejectedValue(new BadRequestError(400, {}, "bad request", new Headers()));
    await expect(callWithRetry(call)).rejects.toThrow("400");
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("does not retry a validation failure our own code raises after a successful response", async () => {
    const call = jest.fn().mockRejectedValue(new Error("digest exceeds 800 characters"));
    await expect(callWithRetry(call)).rejects.toThrow("digest exceeds 800 characters");
    expect(call).toHaveBeenCalledTimes(1);
  });
});
