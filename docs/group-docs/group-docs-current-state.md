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

Two users in the same group ended up working on completely separate group documents rather than a shared one. The suspicion is that two group documents got created — possibly due to a race during document provisioning — and each user opened a different one.

Not yet investigated. Unknowns: steps to reproduce, the provisioning code path involved, whether this happens reliably, and whether it's recoverable once it has occurred.

# Implementation TODOs

Moved to [group-docs-implementation-todos.md](group-docs-implementation-todos.md) — a developer-facing list of unfinished items in the legacy concurrent history manager.
