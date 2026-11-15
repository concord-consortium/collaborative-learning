import { IFirestoreHistoryEntryDoc } from "./history-firestore";

/** The most entries a load will fetch and apply to catch a saved content up to Firestore. */
export const kCatchUpMaxEntries = 200;

export type CatchUpPlan =
  | { kind: "none" }
  | { kind: "unmarked" }
  | { kind: "fetch"; afterIndex: number }
  | { kind: "too-large"; gap: number };

/**
 * Decide how to bring saved content up to the last history entry in Firestore. The saved entry's
 * index is known only from the envelope's exactThrough. Without it the envelope's id can be older
 * than what its content holds, so content behind Firestore is "unmarked" and isn't caught up.
 */
export function planCatchUp(saved: { id?: string; index?: number },
    last: { id: string | null; index: number }): CatchUpPlan {
  if (!saved.id || last.id == null || saved.id === last.id) return { kind: "none" };
  if (saved.index === undefined) return { kind: "unmarked" };
  if (last.index <= saved.index) return { kind: "none" };
  const gap = last.index - saved.index;
  if (gap > kCatchUpMaxEntries) return { kind: "too-large", gap };
  return { kind: "fetch", afterIndex: saved.index };
}

/**
 * Take the leading entries that form an unbroken chain after the saved entry: each has
 * the next index, a previousEntryId naming the entry before it, and an entry to apply.
 * `complete` is false when the chain broke before the end of `docs`.
 */
export function takeContiguousEntries(docs: IFirestoreHistoryEntryDoc[], savedId: string, savedIndex: number)
    : { entries: IFirestoreHistoryEntryDoc[]; complete: boolean } {
  const entries: IFirestoreHistoryEntryDoc[] = [];
  let previousId = savedId;
  let expectedIndex = savedIndex + 1;
  for (const doc of docs) {
    if (doc.index !== expectedIndex || doc.previousEntryId !== previousId || !doc.entry) {
      return { entries, complete: false };
    }
    entries.push(doc);
    previousId = doc.id;
    expectedIndex++;
  }
  return { entries, complete: true };
}
