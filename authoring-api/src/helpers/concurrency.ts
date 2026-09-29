// A small worker-pool map: runs `fn` over `items` with at most `limit` calls in flight at once,
// preserving each result at its original index regardless of completion order. Used instead of a
// dependency like p-limit because the unit-summary pipeline is the only caller so far and the
// need is this one primitive.
//
// Given a `limiter`, that is the real bound and `limit` is only how many workers this one map
// may contribute. Two maps running side by side each with limit 8 put 16 calls in flight; the
// same two sharing a limiter of 8 put 8.
export async function mapWithConcurrency<T, R>(
  items: T[], limit: number, fn: (item: T, index: number) => Promise<R>, limiter?: ConcurrencyLimiter
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      const call = () => fn(items[index], index);
      results[index] = limiter ? await limiter.run(call) : await call();
    }
  }

  const workerCount = Math.max(0, Math.min(limit, items.length));
  await Promise.all(Array.from({length: workerCount}, () => worker()));
  return results;
}

// A bound shared by callers that would otherwise each hold their own pool. A step's own limit
// says how much of the budget it may ask for; the limiter is what the budget actually is.
export interface ConcurrencyLimiter {
  run<T>(fn: () => Promise<T>): Promise<T>;
}

export function createConcurrencyLimiter(limit: number): ConcurrencyLimiter {
  let active = 0;
  const waiting: (() => void)[] = [];

  return {
    async run<T>(fn: () => Promise<T>): Promise<T> {
      // A loop, not a single wait: a woken caller re-checks rather than assuming the slot it was
      // woken for is still free, since another caller can take it first.
      while (active >= limit) {
        await new Promise<void>((resolve) => waiting.push(resolve));
      }
      active++;
      try {
        return await fn();
      } finally {
        active--;
        waiting.shift()?.();
      }
    },
  };
}
