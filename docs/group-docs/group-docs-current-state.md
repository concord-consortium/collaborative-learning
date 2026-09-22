# Summary

CLUE supports group documents that multiple users can edit at the same time. Concurrent edits at disjoint scopes (different tiles, different shared models) merge cleanly; edits that overlap on the same scope cause one user's pending entries to roll back. Several known limitations remain — see [test-scripts/](test-scripts/) for catalogued issues with reproduction steps, and [group-docs-plan.md](group-docs-plan.md) for forward-looking work.

## Known severe issues

The two test-script docs catalog every observed issue, including minor and untested ones. Below are the items confirmed severe today — crashes, user-visible inconsistency between collaborators, or data loss in active edits.

### Crashes

- **Diagram tile crashes on concurrent variable delete.** [shared-variables.md script 2](test-scripts/shared-variables.md) — [CLUE-512](https://concord-consortium.atlassian.net/browse/CLUE-512)
- **Undo-after-remote-tile-deletion throws `PatchApplicationError`.** [tile-lifecycle.md § Tile deletion while editing](test-scripts/tile-lifecycle.md)

### User-visible inconsistency between collaborators

- **Color applied to wrong drawing object after concurrent object delete.** [drawing-tile.md § Color applied to wrong object](test-scripts/drawing-tile.md) — [CLUE-507](https://concord-consortium.atlassian.net/browse/CLUE-507)
- **Cell value lands in wrong table column after concurrent column delete.** [table-tile.md § Cell editing in deleted column](test-scripts/table-tile.md) — [CLUE-506](https://concord-consortium.atlassian.net/browse/CLUE-506)
- **Graph series blanks silently on concurrent attribute delete.** [shared-dataset.md § Cross-scope reference drift](test-scripts/shared-dataset.md) — [CLUE-514](https://concord-consortium.atlassian.net/browse/CLUE-514)

### Data loss in active edits

When a remote change arrives mid-interaction, several tiles lose uncommitted work (GD-11 territory).

- **Table cell focus and uncommitted text lost on remote update.** [table-tile.md § Cell focus lost on remote update](test-scripts/table-tile.md)
- **Text tile typed characters lost; cursor jumps backward.** [text-tile.md § Text typed during remote update lost](test-scripts/text-tile.md)
- **Geometry dialog input lost on remote update.** [geometry-tile.md § Dialog input lost](test-scripts/geometry-tile.md)
- **Expression keystroke lost on snapshot sync.** [expression-tile.md § Keystroke lost during snapshot sync](test-scripts/expression-tile.md)

## How It Works

Group documents use `FirestoreHistoryManagerConcurrent` (in `src/models/history/firestore-history-manager-concurrent.ts`) which extends `FirestoreHistoryManager`. The key differences are:

1. **Concurrent uploads**: Uses a queue (`completedHistoryEntryQueue`) to batch history entries and uploads them using Firestore transactions to safely manage `lastHistoryEntry` metadata when multiple users write simultaneously.
2. **Remote sync**: Listens for remote history entries and applies them to the local document via `syncRemoteFirestoreHistory()` and `applyHistoryEntries()`.
3. **Fork detection and partial rollback**: When the upload transaction detects another client has appended ahead of the local head, or when a remote entry arrives with a `previousEntryId` that doesn't match the local head, both routes funnel through `detectAndResolveFork`. That method partitions each entry's patches into scope kinds (`tile:<id>`, `shared:<id>`, `doc`) using [src/models/history/entry-scopes.ts](../../src/models/history/entry-scopes.ts), walks local uncommitted entries oldest-first, and rolls back the first one whose scope intersects the incoming remote scopes (plus any later local entries). Earlier non-conflicting local entries survive.
4. **Pause/resume**: Supports pausing uploads temporarily (used for testing concurrent scenarios).

The system stores `lastHistoryEntry` (index and id) in the document metadata to track the most recent history entry, allowing safe concurrent writes without querying the history collection.

# Other issues

## Duplicate Group Documents

Two users in the same group ended up working on completely separate group documents rather than a shared one. The suspicion was that two group documents got created — possibly due to a race during document provisioning — and each user opened a different one.

Diagnosed and fixed on this branch, in `resolveCanonicalDocument`/`resolveCanonicalDocumentUncached` ([src/lib/db.ts](../../src/lib/db.ts)). The legacy-backfill path claimed the canonical pointer in a transaction but then returned its own local candidate's key unconditionally, so a client whose claim lost (or whose transaction failed) kept the pre-pointer duplicate its query happened to surface while the other client used the pointer's document — two clients, two documents, one group.

Now every path converges on the slot's key:

- Both the backfill and the create-then-claim paths return the transaction's winning key, and a failed transaction re-reads the pointer rather than assuming the local candidate won.
- Divergence is logged (`console.warn`) with the slot, the pointer's key, and the local candidate's key. A losing *legacy* duplicate is left in place because it may hold student work; a losing just-minted document is deleted as an orphan.
- Concurrent resolves of the same slot within one client share a single in-flight resolution, so the several call sites that can fire around login no longer race each other into create-then-delete churn.

Pre-existing duplicates are not migrated: once the slot names one of them, everyone converges on that one, and the other keeps whatever work it holds.

# Implementation TODOs

Moved to [group-docs-implementation-todos.md](group-docs-implementation-todos.md) — a developer-facing list of unfinished items in the legacy concurrent history manager.
