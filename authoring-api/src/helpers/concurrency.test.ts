import {createConcurrencyLimiter, mapWithConcurrency} from "./concurrency";

function tick(ms = 1): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Counts how many of `fn` are running at once across everything sharing the tracker.
function tracker() {
  const state = {inFlight: 0, peak: 0, completed: 0};
  return {
    state,
    work: async () => {
      state.inFlight++;
      state.peak = Math.max(state.peak, state.inFlight);
      await tick();
      state.inFlight--;
      state.completed++;
      return state.completed;
    },
  };
}

describe("createConcurrencyLimiter", () => {
  it("holds everything it is given to the limit, and completes all of it", async () => {
    const limiter = createConcurrencyLimiter(3);
    const {state, work} = tracker();
    await Promise.all(Array.from({length: 20}, () => limiter.run(work)));
    expect(state.peak).toBe(3);
    expect(state.completed).toBe(20);
  });

  it("frees the slot when a call throws, rather than losing it", async () => {
    const limiter = createConcurrencyLimiter(1);
    await expect(limiter.run(async () => {
      throw new Error("boom");
    })).rejects.toThrow("boom");
    // A lost slot would leave this waiting forever.
    expect(await limiter.run(async () => "after")).toBe("after");
  });

  // Two steps each holding their own pool of 8 would put 16 calls in flight.
  it("bounds two maps sharing it, where two separate pools would not", async () => {
    const shared = tracker();
    const limiter = createConcurrencyLimiter(8);
    const items = Array.from({length: 24}, (_, i) => i);
    await Promise.all([
      mapWithConcurrency(items, 8, shared.work, limiter),
      mapWithConcurrency(items, 8, shared.work, limiter),
    ]);
    expect(shared.state.peak).toBeLessThanOrEqual(8);
    expect(shared.state.completed).toBe(48);
  });

  it("without a limiter, the same two maps do exceed one pool's worth", async () => {
    const shared = tracker();
    const items = Array.from({length: 24}, (_, i) => i);
    await Promise.all([
      mapWithConcurrency(items, 8, shared.work),
      mapWithConcurrency(items, 8, shared.work),
    ]);
    expect(shared.state.peak).toBeGreaterThan(8);
  });
});

describe("mapWithConcurrency", () => {
  it("keeps each result at its own index regardless of completion order", async () => {
    const delays = [5, 1, 3];
    const results = await mapWithConcurrency(delays, 3, async (ms, i) => {
      await tick(ms);
      return `item ${i}`;
    });
    expect(results).toEqual(["item 0", "item 1", "item 2"]);
  });
});
