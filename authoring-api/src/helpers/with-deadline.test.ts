import {withDeadline} from "./with-deadline";

describe("withDeadline", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("resolves with the wrapped promise's result when it finishes before the deadline", async () => {
    const result = await withDeadline(async () => "ok", 1000, "timed out");
    expect(result).toBe("ok");
  });

  it("rejects with the wrapped promise's own error when it fails before the deadline", async () => {
    await expect(withDeadline(async () => {
      throw new Error("boom");
    }, 1000, "timed out"))
      .rejects.toThrow("boom");
  });

  it("rejects with the given message once the deadline elapses", async () => {
    const never = new Promise<string>(() => {/* never resolves */});
    const resultPromise = withDeadline(() => never, 1000, "generation exceeded its deadline");
    const assertion = expect(resultPromise).rejects.toThrow("generation exceeded its deadline");
    await jest.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it("clears its timer on success, so it does not keep the process alive or fire later", async () => {
    await withDeadline(async () => "ok", 1000, "timed out");
    expect(jest.getTimerCount()).toBe(0);
  });
});
