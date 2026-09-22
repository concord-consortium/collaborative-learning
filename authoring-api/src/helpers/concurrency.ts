// A small worker-pool map: runs `fn` over `items` with at most `limit` calls in flight at once,
// preserving each result at its original index regardless of completion order. Used instead of a
// dependency like p-limit because the unit-summary pipeline is the only caller so far and the
// need is this one primitive.
export async function mapWithConcurrency<T, R>(
  items: T[], limit: number, fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index], index);
    }
  }

  const workerCount = Math.max(0, Math.min(limit, items.length));
  await Promise.all(Array.from({length: workerCount}, () => worker()));
  return results;
}
