import {mapWithConcurrency} from "./concurrency";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return {promise, resolve};
}

describe("mapWithConcurrency", () => {
  it("preserves each result at its original index regardless of completion order", async () => {
    const order = [30, 10, 20];
    const result = await mapWithConcurrency(order, 3, async (ms) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return ms;
    });
    expect(result).toEqual([30, 10, 20]);
  });

  it("never runs more than `limit` calls at once", async () => {
    const items = [1, 2, 3, 4, 5, 6];
    let inFlight = 0;
    let maxInFlight = 0;
    await mapWithConcurrency(items, 2, async (item) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return item;
    });
    expect(maxInFlight).toBeLessThanOrEqual(2);
  });

  it("runs every item even when the limit exceeds the item count", async () => {
    const items = [1, 2];
    const result = await mapWithConcurrency(items, 10, async (item) => item * 2);
    expect(result).toEqual([2, 4]);
  });

  it("rejects if any call rejects", async () => {
    const items = [1, 2, 3];
    await expect(mapWithConcurrency(items, 2, async (item) => {
      if (item === 2) throw new Error("boom");
      return item;
    })).rejects.toThrow("boom");
  });

  it("starts a new item as soon as a slot frees up, not only when the whole current batch finishes", async () => {
    // A batching (rather than pooled) implementation would wait for BOTH of the first two items
    // before starting a third. Proven here with deferred promises rather than real timers, so it
    // can't flake under a busy event loop: item 3 must start while item 1 is still pending, driven
    // purely by item 2 finishing.
    const started: number[] = [];
    const slow = deferred<void>();
    const fast = deferred<void>();
    const p = mapWithConcurrency([1, 2, 3], 2, async (item) => {
      started.push(item);
      if (item === 1) await slow.promise;
      if (item === 2) await fast.promise;
    });

    // Let the pool start both items 1 and 2 -- both slots are now held.
    await Promise.resolve();
    await Promise.resolve();
    expect(started).toEqual([1, 2]);

    // Freeing item 2's slot starts item 3, even though item 1 (from the same "batch" as item 2)
    // is still pending.
    fast.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(started).toEqual([1, 2, 3]);

    slow.resolve();
    await p;
  });

  it("does not start work eagerly beyond the limit while a slot is unavailable", async () => {
    const started: number[] = [];
    const first = deferred<void>();
    const p = mapWithConcurrency([1, 2, 3], 1, async (item) => {
      started.push(item);
      if (item === 1) await first.promise;
    });
    // Only the first item should have started while the single slot is held.
    await Promise.resolve();
    await Promise.resolve();
    expect(started).toEqual([1]);
    first.resolve();
    await p;
    expect(started).toEqual([1, 2, 3]);
  });
});
