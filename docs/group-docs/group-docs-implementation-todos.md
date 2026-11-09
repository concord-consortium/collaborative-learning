# Group Documents: Implementation TODOs

Internal code issues identified in CLUE's group-document infrastructure — primarily in [src/models/history/firestore-history-manager-concurrent.ts](../../src/models/history/firestore-history-manager-concurrent.ts). Each item lists its location and a proposed fix.

**Caveat: [GD-19: Transaction-Free History](group-docs-plan.md#gd-19-transaction-free-history) will substantially rewrite this manager.** Don't try to map these TODOs one-by-one to whether GD-19 fixes them — the rewrite reshapes enough of the surrounding code that some issues will disappear, some will land in a different place, and new ones will emerge. The right time to re-examine each item is during GD-19 implementation. Until then, fix in the legacy code only if a concrete user-visible failure forces our hand. This file is referenced from [GD-22: Reliability and Robustness](group-docs-plan.md#gd-22-reliability-and-robustness) in the plan.

## Race Condition in Initial History Load

Location: `firestore-history-manager-concurrent.ts` constructor

When loading a group document, the system fetches the `lastHistoryEntry` to determine which history entries to skip (since they're already applied to the initially loaded document content). This approach is error-prone because:
- A new history entry might be added after fetching the document content but before fetching the last history entry
- Network delays might cause the document fetch to happen after the history entry fetch

**Proposed fix**: Include all applied history entry IDs in the document content written to Firebase Realtime Database, then only apply history entries not in this list.

## Error Handling for Metadata Document

Location: `firestore-history-manager-concurrent.ts:uploadQueuedHistoryEntries()`

The code awaits `environmentAndMetadataDocReadyPromise` inside a try/finally that resets `uploadInProgress`. This prevents the upload queue from stalling on errors, but creates a different problem: if the promise rejects, it will throw on every subsequent call (rejected promises throw each time they're awaited). This creates an endless cycle of silent failures as new history entries keep getting queued.

**Needed improvements**:
1. Track when this has permanently failed and stop retrying
2. Show the user that sync is broken

## Migration for Existing Documents

Location: `firestore-history-manager-concurrent.ts:uploadQueuedHistoryEntries()`

If there's no `lastHistoryEntry` in the metadata (for documents created before this feature), the code would need to scan existing history entries to find the last one. This can't be done in a Firestore transaction, so it would need to happen before starting the transaction. This migration wouldn't be safe if multiple clients are writing history simultaneously.

Current plan: Only use this for new group documents; some lost history for existing group documents is acceptable.

## Unhandled Promise in Recursive Upload Call

Location: `firestore-history-manager-concurrent.ts:uploadQueuedHistoryEntries()`

The recursive call to `this.uploadQueuedHistoryEntries()` at the end of `uploadQueuedHistoryEntries()` is not awaited or error-handled. If this async call throws, it will result in an unhandled promise rejection. Consider adding `.catch()` for error logging, though `await` would change the fire-and-forget behavior which is intentional.

## Timer Not Tracked in resumeUploadsAfterDelay

Location: `firestore-history-manager-concurrent.ts:resumeUploadsAfterDelay()`

The `setTimeout` call doesn't store or cancel previous timers. Multiple calls could schedule multiple timeouts, potentially resuming uploads at unexpected times. This is low priority since it's primarily used for debugging/testing, but storing the timeout ID and clearing it before scheduling a new one would make it more robust.

## Remote Entries That Fail to Apply Stay in History

Location: `firestore-history-manager-concurrent.ts:doApplyHistoryEntries()`

Each delivered entry is added to local history with `addHistoryEntryAfterApplying` before any of its patches are applied. The patches of the whole batch are then combined into one `applyPatch` per tree. If that throws partway, the patches before the failing one stay in the content, since MST doesn't roll back a failed action, and the rest never apply. Every entry in the batch stays in local history as if it had applied, and nothing records which one failed. `finishApplyingPatchesFromManager` is skipped, and `expectedRemoteHead` isn't advanced.

What follows:
- Later deliveries skip entries already in local history, so the failed ones are never retried. Newer entries that build on them are applied over content missing their changes, and either fail too or land on the wrong state.
- Until an apply succeeds, every upload transaction sees a head other than `expectedRemoteHead` and aborts. A member editing alone, with nobody else writing, never gets another delivery, so their later edits stay only in memory.
- The tree keeps `applyingManagerPatches` set, so its tiles don't resync with shared-model changes until the next apply finishes.
- The session stops being exact, so this client stops saving content. If the failing entry is in the chain, every member that loads the document fails on it, and no member saves content again.

The failure is logged as `HISTORY_REMOTE_APPLY_FAILED`, which shows how often it happens.

**Needed**: GD-19 should decide what happens to a delivered entry that fails to apply, and to the entries built on it. One direction is to apply and add entries one at a time, recording only those that applied, and to skip or quarantine a failing entry. The [background entries design](background-entries-design.md) already skips a failing patch in a background entry, and treats any apply failure in a user entry as a bug.

## Test Coverage Gaps

Primarily in:
- `firestore-history-manager.ts`
- `firestore-history-manager-concurrent.ts`
- `document-metadata-model.ts`
