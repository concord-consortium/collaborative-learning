# Group Documents Plan

Forward-looking plan for group documents. For completed work (GD-1 through GD-6, GD-9), see [group-docs-completed-work.md](group-docs-completed-work.md). For where things stand today as a user or tester, see [group-docs-current-state.md](group-docs-current-state.md).

## Work Areas

| Label | Name | Description |
|---|---|---|
| **GD-7** | Undo Bugs | Discovery complete (CLUE-484); individual fixes tracked as CLUE-505, 506, 507, 508, 510 |
| **GD-8** | Tile Locking | Lock tiles so only one user can edit at a time (held in reserve; not on the current path) |
| **GD-10** | Shared Model Merging | Merge non-conflicting changes within shared models |
| **GD-11** | Tile Hardening | Per-tile fixes to preserve transient UI state and tolerate stale shared-model references after remote updates |
| **GD-12** | Debug Re-render Controls | Hotkeys to force-recreate components for a tile or the whole document to isolate render bugs from model bugs |
| **GD-13** | Auto-Revert Stress Mode | Dev mode that automatically reverts the last change (sync, fixed delay, or random delay) to surface race conditions without needing a second user |
| **GD-14** | Intra-Tile Merging | Merge concurrent changes within a single tile's non-shared content when they touch disjoint sub-paths (analog of GD-10 for tile content rather than shared models) |
| **GD-15** | Finer-grained `doc` scope | Split GD-9's single `doc` scope bucket so concurrent tile-adds and unrelated layout edits don't conflict |
| **GD-16** | E2E Test Framework | Add Playwright support so tests can drive two browser windows with independent focus state, enabling automated tests for concurrent-editing UI issues |
| **GD-17** | Type-Aware Merge Delegation | Common mechanism for tiles, shared models, and the document level to register conflict-detection / merge functions. Foundation for GD-10, GD-14, GD-15 |
| **GD-18** | Settled-State Document Saves | Save the doc only when the receive-side state machine is settled, so saved content reflects canonical state at a known position. Reduces multi-writer save thrash. Prerequisite for GD-19 |
| **GD-19** | Transaction-Free History | Replace the per-document Firestore transaction with a multi-parent DAG of history entries, removing the write-rate choke point and moving conflict detection client-side |
| **GD-20** | Background Entries (DataFlow) | Make tick-rate producer changes (dataflow) ordinary history entries with a `background` flag plus runner lock, asymmetric conflict resolution, producer notification, and skip-by-default scrubber/undo. Unblocks DataFlow in group docs |
| **GD-21** | Collaborative Text-Tile Editing | Replace the text tile's single serialized string field with a fine-grained representation so edits produce small targeted patches instead of full-text replacements. Reduces history size today; prerequisite for text-tile collaborative merging via GD-14/GD-17; carries enough intent for a Slate-aware applier to preserve cursor/selection on remote updates |
| **GD-22** | Reliability and Robustness | Fix silent-failure / unhandled-rejection edge cases in `firestore-history-manager-concurrent.ts`. Likely subsumed by GD-19; only fix in legacy code if forced |
| **GD-23** | Tile shared-model hash decoupling | Explore removing the `updateHash`/`createHash` properties on tiles that change when their shared models change — they create implicit cross-scope conflicts we previously decided not to add. Best after GD-16 (automated tests) |
| **GD-24** | Opt-in coupled scopes (held in reserve) | Per-(tile type, shared-model type) coupling that adds an extra `shared:<id>` scope to tile entries — turns currently-disjoint cross-scope edits into conflicts for known-risky pairs. Alternative to GD-11's tolerate-stale-refs approach. Speculative |
| **CLUE-517** | Undo/Redo | Make undo/redo work correctly in collaborative documents (deferred). First concrete symptom: undo errors silently when remote changes invalidate local entries |

## UI Disruption Testing

Initial pass complete — see [completed-work § CLUE-483](group-docs-completed-work.md#clue-483-ui-disruption-testing). Findings drive GD-11 prioritization; GD-8 stays in reserve.

## Order of Work

Items at the same level can be done in parallel or in either order. Indented items depend on the item above them.

1. **GD-7: Undo Bugs** — independent, can be done anytime
2. **GD-17: Type-Aware Merge Delegation** — builds on the merged GD-9
   - **GD-10: Shared Model Merging** — depends on GD-17
     - **GD-14: Intra-Tile Merging** — depends on GD-10 (text tile additionally requires GD-21)
   - **GD-15: Finer-grained `doc` scope** — uses GD-17 for cases beyond simple per-id splits (only if practical pain emerges)
3. **GD-11: Tile Hardening** (as needed, after the merging work areas)
4. **GD-18: Settled-State Document Saves** — independent prerequisite chain for DataFlow support
   - **GD-19: Transaction-Free History** — depends on GD-18
     - **GD-20: Background Entries (DataFlow)** — depends on GD-19
5. **GD-21: Collaborative Text-Tile Editing** — independent; sibling enabler for text-tile collaborative editing alongside GD-14/GD-17
6. **GD-22: Reliability and Robustness** — independent; likely subsumed by GD-19, only land in legacy code if forced before then
7. **GD-23: Tile shared-model hash decoupling** — independent; best after GD-16 lands so regressions can be caught automatically

### GD-7: Undo Bugs

Bugs where model changes via patch application don't update the tile UI. These affect both single-user undo and group documents. Discovery and decomposition done under [CLUE-484](https://concord-consortium.atlassian.net/browse/CLUE-484); individual bugs are now tracked as separate stories. See [group-docs-jira-mapping.md § GD-7](group-docs-jira-mapping.md#gd-7-undo-bugs) for the current list and status.

### GD-17: Type-Aware Merge Delegation

GD-9 detects conflicts using static scope rules (path prefix → scope kind). GD-10, GD-14, and GD-15 each need finer-grained, type-aware decisions at their respective levels — shared models, tile non-shared content, and the document bucket. A list of allowed sub-paths is unlikely to be expressive enough for the cases each one needs to handle.

The shape we expect: tiles, shared model types, and the document level register one or more functions the merge codepath calls when scopes look like they'd conflict. Each function decides whether the local and remote patches actually conflict, and if not, specifies how to merge them. Types that don't register stay on the default scope rule (no behavior change).

Design TBD. This GD slot exists so GD-10, GD-14, and GD-15 can refer to a single name for the shared mechanism rather than each one redesigning it.

Depends on GD-9.

### GD-10: Shared Model Merging

Support concurrent changes to shared models when they don't actually conflict. For example:
- Two users editing different cells in a shared dataset
- One user editing a variable while another user adds a new variable
- One user rescaling a graph while another edits data in the linked table

True conflicts (e.g., one user deleting an object another user is referencing) still need to be detected and one side rolled back.

Builds on GD-17: each shared model type registers its conflict-detection / merge function with the framework.

**Limitation until [GD-23](#gd-23-tile-shared-model-hash-decoupling) lands.** GD-10 by itself doesn't unblock the obvious case of "two users editing different cells in the same table at the same time." Each cell edit produces a `tile:<table>` patch (via the table's `updateHash`) on top of the shared-dataset patch, so concurrent cell edits collide on the tile scope and one side gets rolled back. GD-23 removes that incidental tile-hash patch; with GD-10 + GD-23 together the disjoint-cell case actually merges.

Note: the merging/conflict-detection code introduced here is expected to be reused for undo/redo once that is picked up again. See "CLUE-517: Undo/Redo (deferred)" below.

### GD-14: Intra-Tile Merging

Today, two users editing the same tile at the same time will revert each other's changes — even when the edits touch disjoint sub-paths and could merge cleanly. GD-9 treats each tile as a single `tile:<id>` scope, so two users adding different objects to the same drawing tile, or one user editing one node while another tweaks an unrelated node in the same dataflow tile, both lose work to this rule.

GD-10 does the analogous work for shared models. GD-14 applies GD-17's delegation mechanism at the tile level: each tile type that wants intra-tile merging registers a conflict-detection / merge function — e.g., a drawing tile declaring "object-property edits in different objects don't conflict." Tiles that don't register stay on the default per-tile scope rule (no behavior change).

Secondary case: this is also the prerequisite for cross-client split-producer dataflow deployments described in the [background-entries design](background-entries-design.md) (sensor on client A, engine on client B, both writing to the same tile at disjoint sub-paths). That scenario is unlikely to drive prioritization on its own, but it shares the same machinery. Single-client split-producer doesn't need GD-14 — both producers run in the same MST process and don't have concurrent-write overlap.

Depends on GD-10 (and transitively on GD-17, which provides the delegation framework).

### GD-15: Finer-grained `doc` scope

GD-9 treats all changes outside `tileMap`/`sharedModelMap` as a single `doc` scope: `rowMap`, `rowOrder`, `annotations`, document name, metadata. Two concurrent tile-adds, or a tile-add concurrent with a row-reorder, or two concurrent annotation (sparrow) adds, all conflict and one side gets rolled back even though the changes are independent.

Splitting `doc` into finer scopes would let more concurrent edits merge cleanly. Natural candidates:
- `annotation:<id>` — the `annotations` map has the same per-id structure as `tileMap` and `sharedModelMap`, so adding it as its own scope kind is a small, mechanical extension of the existing logic.
- Per-row keys in `rowMap`, per-index in `rowOrder`, individual metadata keys — these are more involved and only worth doing if practical pain emerges.

The simple per-id splits (annotations) are mechanical extensions of the static scope rule and depend only on GD-9. The more involved cases (per-row, per-index, per-metadata-key) likely use GD-17's delegation mechanism since the merge logic isn't readily expressible as path-prefix rules alone. The merge-independent-forks design intentionally left finer-grained `doc` work out until concrete examples justified the complexity.

Simple cases depend on GD-9 only; complex cases additionally need GD-17.

### GD-11: Tile Hardening (as needed)

Per-tile work in two categories. Both are done only where testing finds it matters.

**Transient UI state.** For tiles where remote updates disrupt the user's in-progress interaction too frequently or severely, preserve transient state across those updates. Options include saving/restoring focus, deferring updates during active interaction, or other tile-specific solutions. See `group-docs-tile-resilience-research.md` for per-tile risk analysis and [test-scripts/](test-scripts/) for concrete issues.

**Stale shared-model references.** GD-9's scope-based merge intentionally allows a tile-side change and a shared-model change to merge cleanly even when the tile references something the shared-model change just deleted. (Adding shared-model dependency tracking to the conflict check would prevent the drift but cost more rollback than the drift is worth — see [GD-24](#gd-24-opt-in-coupled-scopes-held-in-reserve) for an alternative narrow-scope version of that tradeoff held in reserve.) Instead, tiles need to tolerate stale references at read time. The recipe depends on the MST type the tile uses:

- **`types.reference`** (e.g., the diagram tile's `DQNode.variable`): the next read throws and crashes the tile. Switch to `types.safeReference` or `types.maybe(types.reference)` so reads return `undefined`, then handle that gracefully (prune, fallback, blank). See [CLUE-512](https://concord-consortium.atlassian.net/browse/CLUE-512).
- **`types.string` holding an id** (e.g., drawing's `variableId`, graph's `attributeID`): MST never resolves these, so the failure mode is whatever the tile's lookup code does with a missing id. Audit each lookup site and ensure missing-id handling is well-defined. See [CLUE-513](https://concord-consortium.atlassian.net/browse/CLUE-513) and [CLUE-514](https://concord-consortium.atlassian.net/browse/CLUE-514).
- **`types.safeReference` / `types.maybe(types.reference)`**: already returns `undefined` at read time; the remaining work is confirming the tile handles `undefined` correctly downstream.

Reproduction scripts and observed behavior for each case live in [test-scripts/shared-variables.md](test-scripts/shared-variables.md) and [test-scripts/shared-dataset.md](test-scripts/shared-dataset.md).

### GD-18: Settled-State Document Saves

Today every CLUE client saves the full document state to RTDB on every local change *and* on remote changes that get applied. That produces multi-writer save thrash (N editors → ~N RTDB writes per edit) and lets the saved doc briefly reflect non-canonical state during fork-rollback. GD-18 changes the save trigger to "settled state" — no pending local entries, no pending conflict decisions, all visible canonical entries processed — so the saved doc always reflects canonical state at a known canonical position.

Design: [settled-state-doc-saves-design.md](settled-state-doc-saves-design.md). Status: design complete, ready for implementation plan.

Independent of the merging work; can be done in parallel. Prerequisite for GD-19.

### GD-19: Transaction-Free History

Replace the current Firestore-transaction-based history append with a multi-parent DAG. Today every history entry write wraps a transaction that competes for `metadata.lastHistoryEntry`, which is a write-rate choke point even for ordinary edits and untenable for tick-rate producers. The DAG model lets concurrent writers append without per-document coordination; canonical order is determined globally by `(serverTimestamp, id)`; conflict detection and resolution move entirely to the client.

Design: [transaction-free-history-design.md](transaction-free-history-design.md). Status: early draft — partial design, several open questions remain.

Depends on GD-18 (the design assumes saved-doc-reflects-canonical-state). Prerequisite for GD-20.

### GD-20: Background Entries (DataFlow)

Make group documents containing a dataflow tile usable while the tile is running. Tick-rate producer changes become ordinary history entries with a `background: true` flag, plus a producer-side runner lock (one runner per producer source), asymmetric conflict resolution favoring user entries, a producer notification hook on revert, skip-by-default scrubber/undo behavior, and a separate `producedAt` timestamp for replay fidelity. Dataflow is the first consumer; landing it together gives a concrete case to test the framework against.

Design: [background-entries-design.md](background-entries-design.md). Status: draft for review.

Depends on GD-19.

### GD-21: Collaborative Text-Tile Editing

Replace the text tile's single serialized string field with a fine-grained representation, and apply remote patches directly to Slate's editor state so the local user's cursor and selection are preserved. Today's whole-string patches inflate history, make merging impossible, and force a full Slate re-sync on every remote update.

Design and approach trade-offs: [collaborative-text-tile-editing-design.md](collaborative-text-tile-editing-design.md). Status: no concrete design yet.

Independent of the merging chain. Can be done anytime. Sibling enabler of GD-17 — without GD-21 the text tile has no useful sub-paths to merge over, so GD-14 for the text tile is gated on this.

### GD-24: Opt-in coupled scopes (held in reserve)

Alternative architectural approach to the same tile-references-shared-model problem GD-11's "Stale shared-model references" addresses. Where GD-11 says "let stale references happen and have tiles tolerate them," this proposal says "for known-risky tile↔shared-model pairs, declare them coupled so concurrent shared-model deletes conflict with tile edits and one side rolls back."

Full design and motivating examples: [group-docs-coupled-scopes.md](group-docs-coupled-scopes.md).

We previously chose GD-11's tolerance approach because the rollback cost of dependency tracking was too high in the general case. GD-24 narrows that cost by scoping the coupling to just the known-risky type pairs, which preserves clean merge for everything else. Worth keeping as a fallback if tile-side tolerance proves too painful in practice.

Builds on [GD-17](#gd-17-type-aware-merge-delegation). Unlikely to ship; here as design history and a possible future direction.

### GD-8: Tile Locking (held in reserve)

Not on the current path. UI disruption testing has not surfaced enough cases to justify the implementation cost; per-tile hardening (GD-11) is the lighter-weight first response. This is the design we'd return to if disruptions ever prove too severe to absorb tile-by-tile.

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

### GD-23: Tile shared-model hash decoupling

Some tiles store `updateHash` / `createHash` properties that change as the user edits the tile or its shared models. These were introduced under [CLUE-235](https://concord-consortium.atlassian.net/browse/CLUE-235) to support **research analytics** — researchers needed a way to tell whether a tile had been edited (vs. just copied from curriculum or another user's document). The shared-model handling specifically: editing a cell in a table marks the table itself as "edited," because from a research perspective that tile *was* edited even though the underlying patch lands on the shared dataset.

In a group document the side effect is significant: a remote shared-model edit produces a patch on the tile used to edit the shared model (via its hash), so what *would* be a clean disjoint-scope merge (`shared:<X>` vs an unrelated `tile:<Y>` edit) becomes a `tile:<Y>` overlap and one user's pending entries roll back. This is a partial implementation of the tile↔shared-model dependency-tracking conflict surface we explicitly chose not to add in GD-11's "Stale shared-model references" section — except we got it accidentally via these hashes, with some of the extra rollback cost that decision avoided.

Independent of the conflict surface, the hashes also add noise to patches and history — every shared-model edit produces an extra tile-hash patch alongside the actual content change.

Plan:
1. **Explore.** Remove the hash updates and see what breaks. The hashes were added to solve a real research-analytics need, so any replacement has to preserve the ability to tell whether a tile (including via its shared-model edits) has been touched.
2. **If safe to drop entirely**, remove them.
3. **If we need to preserve the analytics signal**, find an equivalent that doesn't show up as a tile-scope patch in history. Options include computing edit-status from history rather than storing it on the tile, storing it in a non-MST or non-patched location, or recording it in a separate analytics document.

Best done after [GD-16: E2E Test Framework](#gd-16-e2e-test-framework) lands so we can verify regression coverage automatically.

### GD-22: Reliability and Robustness

Hardening the existing infrastructure to prevent silent failures and data loss in edge cases. Specific items, locations, and proposed fixes live in [group-docs-implementation-todos.md](group-docs-implementation-todos.md). Highlights:

- Race condition in initial history load (explicitly deferred by GD-6)
- Error handling when metadata promise rejects (silent infinite failure loop)
- Unhandled promise in recursive upload

Document drift detection between full document content and history was addressed by GD-6 via the RTDB envelope's `lastHistoryEntryId` field.

**Caveat: likely subsumed by GD-19.** All items live in `firestore-history-manager-concurrent.ts`, which the transaction-free history rewrite substantially replaces. Worth fixing in the legacy code only if a concrete user-visible failure forces our hand before GD-19 lands.

## Supporting Dev Tooling

Small, targeted dev tools that make debugging and testing the group-doc work easier. Can be done in parallel.

### GD-12: Debug Re-render Controls

Add hotkeys (or toolbar buttons) to re-render a single tile and to re-render the whole document. "Re-render" here means recreating all React components for that scope so they drop any component state.

**Why**: when something looks broken, it's hard to tell whether the problem is in the document/model state or in how the component is rendering it. If a forced re-render makes the problem go away, the model state is fine and the bug is in the component. Volatile state in the model and global state are deliberately left alone — keeping them intact helps isolate the component layer from the data layer.

### GD-13: Auto-Revert Stress Mode

A dev mode that, whenever a change is committed locally, automatically reverts the most recent change. This simulates the race conditions that come up when two users' edits land on top of each other, without requiring a second human to test with.

**Why**: while testing GD-6, the text tile showed problems when edits were rapidly reverted. The symptoms suggest race conditions in either the model-level rollback or the way the tile keeps its internal state sync'd with the model state. Reproducing these today requires two people, which slows iteration. Many tiles likely have similar problems.

Reversion timing should be configurable:
- Synchronous (as close as possible)
- Fixed ms delay
- Random ms delay

Each timing mode exposes different race windows.

### GD-16: E2E Test Framework

Group-doc bugs frequently involve focus, cursor, and typing-state interactions across two windows. Cypress runs one window at a time, which makes deterministic two-user scenarios hard. Playwright supports multiple browser contexts in a single test, each with its own focus state, so tests can drive both clients simultaneously and assert on per-window UI state.

Once the framework is in place, the manual reproduction scripts in [test-scripts/](test-scripts/) and the GD-3 pause/resume scripts can be automated. Many of those scripts need active interaction in one window while a remote change arrives, which is exactly what multi-context Playwright testing enables.

Independent of the merging work; can be done in parallel.

## CLUE-517: Undo/Redo (deferred)

Tracked as [CLUE-517](https://concord-consortium.atlassian.net/browse/CLUE-517). Undo/redo in group documents was deliberately punted when this work was proposed, and for now that's still the right call. But it should be kept in mind as we design GD-10, GD-14, GD-15, and GD-17; more progress may change the call later.

Today, undo/redo assumes each patch is being applied to the document state it was recorded against. In a collaborative world that assumption breaks: the document can be changed by someone else between when an entry is recorded and when the local user undoes or redoes it, and those remote changes aren't in the local undo/redo stack. CLUE-517's first concrete symptom: user A edits a text tile, user B deletes the tile, user A's undo button silently errors.

A pragmatic interim approach (CLUE-517's framing): invalidate the user's undo entries when a remote change touches the same scope, rather than trying to apply drifted patches.

A more complete version requires the same judgment GD-10 and GD-17 need for rollback: given an entry's patches and action, can we safely apply them against the current document state, or do they conflict with changes from other users? When we pick that up, we should be able to reuse the merging and conflict-detection code from the merged GD-9 and from GD-10, GD-17 rather than build a second implementation.

**Design implication**: keep the merge code introduced by GD-10 and GD-17 factored so it can be reused by a future undo/redo implementation — the decision of whether a given patch set can be safely applied should not be entangled with the rollback-specific code path.
