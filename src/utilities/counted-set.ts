/**
 * A set that counts how many times each item was added. An item stays in the set until it has been
 * deleted as many times as it was added.
 */
export class CountedSet<T> {
  private counts = new Map<T, number>();

  add(item: T) {
    this.counts.set(item, (this.counts.get(item) ?? 0) + 1);
  }

  /** Returns whether the item was in the set. */
  delete(item: T) {
    const count = this.counts.get(item);
    if (count === undefined) return false;
    if (count > 1) {
      this.counts.set(item, count - 1);
    } else {
      this.counts.delete(item);
    }
    return true;
  }

  has(item: T) {
    return this.counts.has(item);
  }
}
