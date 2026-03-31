# Group Documents Plan

This document outlines the remaining work areas for group documents after the initial implementation (GD-1 through GD-4, plus partial GD-5). See `group-docs-current-state.md` for where things stand today.

## Immediate: UI Disruption Testing

This can start now, before any other work is done. The goal is to determine whether the transient UI disruptions from concurrent editing are tolerable in practice.

The current group document implementation already applies remote changes to tiles in edit mode. Two users editing the same group document can use the pause/resume debug tools (GD-3) to force conflicts and observe the impact. The key question: when a remote change arrives while a user is actively interacting with a tile, is the disruption (lost focus, reset selection, interrupted drag) something users can live with, or is it a blocker?

See `group-docs-potential-ui-issues.md` for specific issues to test, each marked with whether it requires active interaction or can be tested with single-user undo.

**The outcome of this testing determines which plan to follow:**

---

## Plan A: Disruptions Are Tolerable

If testing shows that transient UI disruptions are acceptable for most tiles, the path is simpler — no tile locking needed.

### A1. Fix Undo Rendering Bugs

Fix cases where model changes via patch application don't update the tile UI. These are bugs that affect both single-user undo and group documents. They're typically low effort to fix (e.g., the table attribute name issue is a one-line change from `triggerRowChange()` to `triggerColumnChange()`). See `group-docs-potential-ui-issues.md` for undo-testable issues.

### A2. Finish GD-5: Fork Detection and Rollback

The transaction infrastructure is in place (`lastHistoryEntry` metadata, `previousEntryId` chaining, Firestore transactions in `uploadQueuedHistoryEntries()`). What remains is client-side fork detection and rollback: when a remote entry arrives whose `previousEntryId` doesn't match the local head, the client should reverse its local uncommitted entries (using their undo patches) back to the fork point, then apply the remote entries.

After this step, the document and history should never be corrupted by concurrent edits. However, any conflict will roll back all of one user's local changes, which may be disruptive.

### A3. Smarter Conflict Merging

After GD-5, any conflict rolls back all local changes. Smarter merging would reduce how much work gets "clobbered":

- **Document level**: Changes to different tiles (that don't share a model) can be merged instead of rolling back. For example, adding a new tile shouldn't affect someone editing an existing tile.
- **Tile + shared model level**: If two tiles are being changed and they don't share a model, merge the changes.

### A4. Shared Model Conflict Resolution

Support concurrent changes to shared models when they don't actually conflict. For example:
- Two users editing different cells in a shared dataset
- One user editing a variable while another user adds a new variable
- One user rescaling a graph while another edits data in the linked table

True conflicts (e.g., one user deleting an object another user is referencing) still need to be detected and one side rolled back.

### A5. Per-Tile UI Hardening (as needed)

For specific tiles where testing showed the disruption is too frequent or severe, harden those tiles to preserve transient state across remote updates. This is done per-tile, only where needed. Options include saving/restoring focus, deferring updates during active interaction, or other tile-specific solutions. See `group-docs-tile-resilience-research.md` for per-tile risk analysis and `group-docs-potential-ui-issues.md` for concrete issues.

---

## Plan B: Disruptions Are Not Tolerable

If testing shows that transient UI disruptions make group documents unusable for key tiles, tile locking is needed as an intermediate step.

### B1. Fix Undo Rendering Bugs

Same as A1 — these are bugs regardless of which plan we follow.

### B2. Finish GD-5: Fork Detection and Rollback

Same as A2.

### B3. Tile Locking

Add the ability to "lock" a tile so only one user can edit it at a time. Other users see a read-only view of the tile that updates as the editing user makes changes. This prevents concurrent edits to a tile's own state and avoids the transient UI disruptions.

#### Open questions

- **Lock lifecycle**: Explicit (user clicks "edit" / "done editing") or implicit (detected from focus/interaction)? Implicit is nicer UX but harder — need to detect when a user has stopped editing, handle tab closes/disconnects, and deal with stale locks from crashed sessions.
- **Lock storage and communication**: Locks need to be communicated to other clients in near-real-time. Firebase Realtime Database could work since it has presence/disconnect features that could help with stale lock cleanup.
- **Read-only appearance per tile**: Some tiles already have a clean read-only mode, others might not. The transition from "I was editing" to "someone else grabbed the lock" needs handling — does uncommitted work get lost, or saved first?

#### Tile locking and shared models

Tile locking prevents concurrent edits to a tile's own state, but shared model changes from other tiles can still arrive. Tiles already handle shared model changes in edit mode (this is how undo works), so the rendering will be correct. The remaining question is whether the transient UI disruption from shared model updates is tolerable when the tile is locked. If not, options include:

- **Lock the shared model too**: Broad — locking SharedVariables would disable variable editing across many tiles.
- **Defer shared model updates in locked tiles**: Queue updates and apply when the user finishes editing.
- **Per-tile hardening**: Preserve transient state across shared model updates for specific tiles.

### B4. Smarter Conflict Merging

Same as A3, but with tile locking in place, most tile-level conflicts are prevented. The remaining merging work is primarily at the document level.

### B5. Shared Model Conflict Resolution

Same as A4.

### B6. Per-Tile UI Hardening + Remove Locks

For tiles where we want to allow true concurrent editing without locks, harden those tiles to handle remote updates gracefully. This allows removing locks on specific tiles incrementally.

---

## Shared Models Reference

There are 5 shared models in CLUE. The table below shows every tile and which shared models it uses:

| Tile | SharedDataSet | SharedCaseMetadata | SharedVariables | SharedProgramData | SharedSeismogram |
|---|---|---|---|---|---|
| AI | | | | | |
| Bar Graph | x | | | | |
| Data Card | x | | | | |
| Dataflow | x | | x | x | |
| Diagram Viewer | | | x | | |
| Drawing | | | indirect | | |
| Expression | | | | | |
| Geometry | x | | | | |
| Graph | x | x | x | | |
| iframe Interactive | | | | | |
| Image | | | | | |
| Numberline | | | | | |
| Question | | | | | |
| Simulator | | | x | x | |
| Starter | | | | | |
| Table | x | | | | |
| Text | | | indirect | | |
| Timeline | | | | | x |
| Wave Runner | | | | | x |

Drawing has a variable toolbar button and a stub `updateAfterSharedModelChanges` but doesn't directly import SharedVariables. Text delegates shared model changes to text plugins. Both interact with SharedVariables indirectly through the shared model manager.

**SharedDataSet** and **SharedVariables** are the most problematic because they thread across many tiles. SharedVariables is especially tricky: variables can be added to text, diagram, and drawing tiles at any time, and then edited from any of those tiles. SharedCaseMetadata is tightly coupled with Graph and SharedDataSet so it can likely be handled alongside SharedDataSet.

## Parallel Tracks

These areas can be worked on alongside either plan:

### Reliability and Robustness

Hardening the existing infrastructure to prevent silent failures and data loss in edge cases. These are documented as Implementation TODOs in `group-docs-current-state.md`:

- Race condition in initial history load
- Error handling when metadata promise rejects (silent infinite failure loop)
- Document drift detection (no checkpointing between full document content and history)
- Unhandled promise in recursive upload

### DataFlow Simulation

DataFlow generates history entries on every simulation tick. Two users with DataFlow running will produce constant conflicting entries. This needs a fundamentally different approach — likely excluding simulation tick state from history, or batching/throttling it. This is a blocker for using group documents with DataFlow tiles.
