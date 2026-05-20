# Group Documents: Completed Work

Completed group-document work, in the order it landed. For where things stand today as a user or tester, see [group-docs-current-state.md](group-docs-current-state.md). For planned work, see [group-docs-plan.md](group-docs-plan.md). Original stories for GD-1 through GD-5 live in [group-docs-brainstorm.md](group-docs-brainstorm.md#breaking-down-the-work-for-full-document-clobbering).

## GD-1: Basic group-document UI

Open a group document on the right side of CLUE; create a Firebase/Firestore location for group documents; add a new document type so the rest of the system can treat it differently. Members' writes overwrite each other and remote changes are not visible — deliberately unsafe foundation work that subsequent stories build on.

## GD-2: Read/write mode with Firestore listener

Open the group document in a mode that monitors history entries from Firestore and applies remote entries to the local document model the same way an undo applies patches, including the shared-model update code. Concurrent-edit handling is left to GD-5/GD-6. Implementation: `FirestoreHistoryManagerConcurrent` in [src/models/history/firestore-history-manager-concurrent.ts](../../src/models/history/firestore-history-manager-concurrent.ts).

## GD-3: Pause/resume debug controls

A button/hotkey that pauses upload of history entries to Firebase and resumes on demand. With pause active, two clients can manufacture the conflict scenarios needed to verify subsequent stories. Used throughout the manual reproduction scripts in [test-scripts/](test-scripts/).

## GD-4: History viewer

Developer-facing panel showing the list of history entries with the user who made each change. Replaces console-only inspection. Distinct from the user-facing **history scrubber** (the playback slider students see), which is a separate UI; the viewer is for inspecting and debugging the entry stream during development. Foundation for later end-user features (history-aware undo, scrubber improvements, etc.).

## GD-5: Firestore-transaction-based history writes — split

Originally one story covering both transaction infrastructure for safe history append *and* fork detection/rollback. Landed in two pieces:

- **Transaction infrastructure** as **CLUE-376**: `metadata.lastHistoryEntry`, `previousEntryId` chaining, Firestore transactions in `uploadQueuedHistoryEntries()`. After this story two clients no longer clobber each other's history-tail metadata, but local entries that lost the race were not yet rolled back — the chain would just chain off whatever remote head it found.
- **Fork detection and rollback** became **GD-6** (below).
- **Conflict merging**, originally envisioned as GD-5's future-work tail, became **GD-9 and GD-10** in the planned-work doc.

## GD-6: Corruption Prevention (PR #2835 / CLUE-485)

Client-side fork detection and rollback in two places that share a single codepath.

**Receive-side fork detection.** When a remote entry arrives whose `previousEntryId` doesn't match the local head, the client reverses its local uncommitted entries (using their undo patches) back to the fork point, drops them from the upload queue, and applies the remote entries.

**Send-side fork detection.** The upload transaction in `uploadQueuedHistoryEntries()` reads `metadata.lastHistoryEntry` on each attempt. If that id doesn't match what the client expected (i.e., another client has committed entries this one doesn't yet know about), the transaction aborts rather than chaining queued local entries onto a stale head. Once aborted, the Firestore listener delivers the unknown remote entries and the receive-side handler drains the queue via the shared rollback path.

**Shared codepath.** Both entry points route through a single rollback method, `detectAndResolveFork`. This is the extension point GD-9 plugged into; future merging work (GD-10, GD-14) extends it further.

After GD-6, the document and history are no longer corrupted by concurrent edits — but any conflict rolls back *all* of one user's local changes, which GD-9 then addressed.

## GD-9: Document-Level Merging (PR #2838 / CLUE-316)

Replaces the all-or-nothing rollback from GD-6 with a partial merge based on disjoint scopes.

Each entry's patches are partitioned into three scope kinds:
- `tile:<id>` — changes inside one tile's `tileMap` entry
- `shared:<id>` — changes inside one shared model's `sharedModelMap` entry
- `doc` — a single bucket covering `rowMap`, `rowOrder`, `annotations` (sparrows), document name, metadata, and anything outside `tileMap`/`sharedModelMap`

On fork detection, local uncommitted entries are walked oldest-first. The first entry whose scope set intersects any incoming remote entry's scope set triggers rollback of that entry and every later local entry. Earlier non-conflicting local entries survive and the remote entries are applied on top.

The scope module ([entry-scopes.ts](../../src/models/history/entry-scopes.ts)) is pure — no MST, no Firestore — so future undo/redo can reuse the "can I apply this entry given what has happened since?" primitive.

Two changes touching the same tile (even at disjoint sub-paths) still conflict — that's GD-14's territory in the plan. Two changes both touching the `doc` bucket still conflict — that's GD-15's territory.

Design and out-of-scope items: [merge-independent-forks-design.md](../superpowers/specs/2026-04-22-merge-independent-forks-design.md).

## CLUE-483: UI Disruption Testing

Tested whether transient UI disruptions from concurrent editing are tolerable in practice. Reframed the [requires active interaction] cases catalogued in [test-scripts/](test-scripts/) to be exercised by one person across two browser sessions using GD-3's pause/resume (5-second resume delay), and split each Result row into Expected vs. Actual.

Initial findings:

- **Table**: dragged row disappears if the other user deletes it
- **Text**: cursor/selection jumps back by the character count of insertions before the cursor; uncommitted typing is lost on remote update
- **Expression**: uncommitted keystrokes lost on remote update; cursor jumps to a different location
- **Drawing**: object selection survives. Mid-drag survives most changes, but deleting the dragged object deletes underneath the cursor with console warnings
- **Geometry**: dialog closes out from under the user on remote change; point drag cancels and snaps back

Outcome: real disruption exists in several tiles, but not at a level that justifies the cost of tile locking (GD-8). The path forward is per-tile hardening (GD-11) as those tiles surface concrete user pain, with GD-8 held in reserve.
