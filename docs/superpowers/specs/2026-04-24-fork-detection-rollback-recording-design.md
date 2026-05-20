# Fork Detection and Rollback Recording

**Status:** Design
**Ticket:** CLUE-316
**Follow-up to:** [2026-04-22-merge-independent-forks-design.md](./2026-04-22-merge-independent-forks-design.md)

## Problem

Two bugs in the scope-based fork-merge implementation, both surfaced by the manual test scripts in [docs/group-docs/test-scripts/](../../group-docs/test-scripts/) (originally drafted as `clue-316-manual-test-scripts.md`).

### 1. Fork detection skipped on subsequent batches

When remote entries arrive in multiple batches, `detectAndResolveFork` in [src/models/history/firestore-history-manager-concurrent.ts:426-455](../../../src/models/history/firestore-history-manager-concurrent.ts#L426-L455) short-circuits on every batch after the first:

1. Batch 1 arrives. Fork check fires, scope check finds no conflict, remote entries appended via `addHistoryEntryAfterApplying`. `expectedRemoteHead` advances to the tail of batch 1.
2. Local head is now the tail of batch 1 — pending local entries are still in history but positioned before the appended remote tail.
3. Batch 2 arrives with `firstIncomingPrev === localHeadId` (the batch 1 tail). Early-return triggers → `partitionLocalEntriesForMerge` is never called. Any conflict batch 2 has with pending local entries is silently missed.

Observed in script 5: the graph-axis scope conflict goes undetected because user B's two-entry logical operation splits across batches and the conflicting scope only appears in the second entry.

### 2. Rollback pops the wrong entries

`rollbackLocalEntries` assumes local-uncommitted entries sit at the tail of `document.history`. Once remote entries from batch 1 are appended on top of pending local entries, that invariant no longer holds — popping the tail would remove the remote entries, not the local ones we want to revert.

### 3. Rollbacks are not recorded

Under the current design, rolled-back entries simply vanish from history. There's no record that a rollback happened, what was rolled back, or what triggered it. This makes debugging flaky-network scenarios difficult and means the scrubber can't faithfully replay what actually occurred.

## Design

Treat the upload queue as the single source of truth for "local uncommitted." Make `document.history` an append-only, application-ordered record of every patch set ever applied to the local tree — including reverts.

### Core shape

- **`completedHistoryEntryQueue`** — local entries waiting to upload, in application order. Authoritative for "what is local-uncommitted."
- **`document.history`** — append-only sequence of applied entries, in the order they were applied locally. Includes local entries, remote entries, and revert entries. Never has entries removed.
- **Revert entries** — first-class `HistoryEntry` instances distinguished by an `isRevert` flag. Created when fork detection identifies a scope conflict between pending local entries and an incoming batch. Their forward patches undo the original; their inverse patches redo it.

### Fork detection

`detectAndResolveFork` is rewritten around the queue:

```ts
async detectAndResolveFork(newWrapperDocs: IFirestoreHistoryEntryDoc[]): Promise<void> {
  if (newWrapperDocs.length === 0) return;
  if (this.completedHistoryEntryQueue.length === 0) return;  // nothing local to check

  const localSnapshots = this.completedHistoryEntryQueue.map(e => getSnapshot(e));
  const incomingSnapshots = newWrapperDocs.map(w => w.entry);
  const incomingIds = newWrapperDocs.map(w => w.entry.id);

  const { rollbackCount } =
    partitionLocalEntriesForMerge(localSnapshots, incomingSnapshots);

  if (rollbackCount > 0) {
    await this.rollbackLocalEntries(rollbackCount, incomingIds);
  }
}
```

> **Post-implementation note (2026-04-27):** the `newWrapperDocs` argument
> was simplified during code review to `newEntrySnapshots: HistoryEntrySnapshot[]`.
> The function reads only `w.entry` and `w.entry.id` from each wrapper, so
> the wrapper layer was unnecessary inside this function. The wrapper shape
> is still used by `applyHistoryEntries` (matching what the Firestore listener
> delivers); `doApplyHistoryEntries` extracts entries once and passes
> snapshots to `detectAndResolveFork` from there on. The defensive
> `console.warn` for missing wrappers became unreachable after this and
> was removed.

The `firstIncomingPrev === localHeadId` early-return is removed entirely. It was a proxy for "nothing forked" that broke once remote entries landed on top of local ones. Replacing it with "queue is empty" fixes bug 1 directly.

`expectedRemoteHead` and `localHead` are no longer consulted here. The queue is enough.

### Rollback

`rollbackLocalEntries(count, triggeringBatchIds)`:

1. Take the last `count` entries from `completedHistoryEntryQueue` — these are the originals to revert, in application order.
2. Iterate them newest-first. For each original, build a revert entry (see below) and apply its forward patches through the standard tree-patch flow (`startApplyingPatchesFromManager` → `applyPatchesFromManager` → `finishApplyingPatchesFromManager`).
3. Append each revert entry to `document.history` via a new `addRevertEntryAfterApplying` (parallels `addHistoryEntryAfterApplying`: adds to history, does not enqueue for upload, does not register in the undo store).
4. Remove the original entry ids from `completedHistoryEntryQueue`.
5. Remove the original entry ids from `undoStore` (they are no longer undoable by the user — their effects have been reverted).

Phase 1 applies the reverts for efficiency by aggregating the forward patches into a single tree-apply call (the originals have disjoint scopes from everything between them, so order is safe). The separation into individual revert entries is about the data model, not the apply batching.

Originals are **not** removed from `document.history`. They stay where they are, followed later by their matching revert entries.

> **Post-implementation note (2026-04-29):** the proposed
> `addRevertEntryAfterApplying` action turned out to be byte-identical to
> the existing `addHistoryEntryAfterApplying`. Since `addHistoryEntryAfterApplying`
> already had the right semantics (push to history; no undoStore registration;
> no upload enqueue) and the call site's variable name already conveys "this
> is a revert," we kept just `addHistoryEntryAfterApplying` and dropped the
> new action. Its docstring was expanded to cover both call sites.

### Revert entry shape

Extend `HistoryEntry` with optional fields:

```ts
isRevert?: boolean;
revertsEntryId?: string;      // id of the original being reverted
triggeringBatchIds?: string[]; // ids of the incoming remote entries that caused this rollback
```

For phase 1, records are built by swapping and reversing patches on the original:

```ts
revert.records = [...original.records].reverse().map(r => ({
  tree: r.tree,
  action: r.action,
  patches:        [...r.inversePatches].reverse(),
  inversePatches: [...r.patches].reverse(),
}));
```

Given that `TreePatchRecord.getPatches` stores patches forward-ordered and reverses `inversePatches` at Undo time ([history.ts:11-18](../../../src/models/history/history.ts#L11-L18)), this shape makes:

- `revert.getPatches(Redo)` ≡ `original.getPatches(Undo)` — forward-apply of the revert undoes the original.
- `revert.getPatches(Undo)` ≡ `original.getPatches(Redo)` — scrubbing backward past the revert redoes the original.

### What stays the same

- `expectedRemoteHead` semantics unchanged. It tracks the last known remote chain head and gates the upload transaction.
- `addHistoryEntryAfterApplying` for remote entries unchanged.
- Upload queue logic unchanged. Queue entries (originals) that survive a partial rollback continue to be uploaded normally; the chain picks them up on next attempt with the advanced `expectedRemoteHead` as their `previousEntryId`.
- `partitionLocalEntriesForMerge` unchanged. The queue is already in application order, so its first-conflict-rolls-back-everything-after semantics remain correct.

### History viewer (minimal)

The viewer already renders individual entries for remote batches, so revert entries slot in naturally. Minimum changes:

- Distinguish revert entries by prefixing the entry label with `~` (e.g., `~Axis.setDomain`). Tilde reads as "not"/"inverse" and does not collide with characters used in existing entry labels.
- Show `revertsEntryId` as a reference to the original entry so a reviewer can pair them up.
- Show `triggeringBatchIds` (or a count with the ids available on hover/expand) to identify the incoming batch that caused the rollback.

No deeper interaction changes in this spec — linking, expanding, filtering are follow-ups.

## Phase 2 (deferred)

When CLUE eventually supports merging entries that modify the same scope, the swap-based construction of revert records becomes unsafe: the inverse patches may need to reflect state that was modified after the original was applied. Phase 2 will:

- Build revert entry records via normal MST recording at revert-time, so `inversePatches` capture the actual state diff.
- Split the apply into one start/apply/finish cycle per original so each recording produces its own entry.

The on-disk shape is identical to phase 1 (`isRevert`, `revertsEntryId`, `triggeringBatchIds`, `records`). Only the construction path changes. Consumers of `document.history` (scrubber, viewer, undo store) are unaffected by the phase-2 migration.

## Non-goals

- Same-scope merging (phase 2).
- Automatic re-apply of rolled-back local entries on the user's behalf. The user's work is gone from the current state; if they want it back they re-do it.
- Rich UI for revert entries beyond the minimal verification markers.
- Changes to upload chain, metadata doc, or Firestore transaction logic.

## Testing

Unit tests in [src/models/history/firestore-history-manager-concurrent.test.ts](../../../src/models/history/firestore-history-manager-concurrent.test.ts):

- Fork detection runs on a subsequent batch when the queue is non-empty, even if `firstIncomingPrev === localHeadId`.
- Fork detection early-returns when the queue is empty, regardless of head comparisons.
- Rollback creates one revert entry per rolled-back original, in newest-first order, appended at the current end of `document.history`.
- Rollback removes originals from the queue but leaves them in `document.history`.
- Rollback cleans the `undoStore` of rolled-back original ids and does not register the reverts.
- Applying `revert.getPatches(Redo)` produces state equivalent to undoing the original.
- Applying `revert.getPatches(Undo)` produces state equivalent to redoing the original (scrubber round-trip).
- Integration case: batch 1 disjoint + batch 2 conflicting drives rollback of the original local entries that survived batch 1.

Manual verification via script 5 in the manual-test-scripts doc: the axis-vs-row-add scenario should now show a rollback (revert entry for the pending axis edit) when the second batch with graph-scope conflict arrives.

## Open questions

None blocking. Items deferred explicitly above:

- User-facing surfacing of rolled-back work — e.g., a notification or panel that lets the user see and re-apply edits that were reverted due to a conflict. Deferred until we see how often rollbacks occur in real use.
- Phase 2 implementation details (covered when same-scope merging work begins).
