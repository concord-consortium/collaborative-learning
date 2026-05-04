# Transaction-Free History Sync Design

**Status**: Early draft — partial design, several open questions remain
**Date**: 2026-04-28
**Author**: Scott Cytacki (with Claude)
**Related**: [group-docs-plan.md](group-docs-plan.md), [group-docs-current-state.md](group-docs-current-state.md), [background-entries-design.md](background-entries-design.md), [settled-state-doc-saves-design.md](settled-state-doc-saves-design.md), GD-6 / CLUE-485, CLUE-379

**Prerequisite**: [settled-state-doc-saves-design.md](settled-state-doc-saves-design.md) — this design assumes the saved doc reflects canonical state at a known canonical position. Today's code does not guarantee that; the prerequisite design lands the invariant.

## Summary

The current group-document upload path (`firestore-history-manager-concurrent.ts`) wraps every history entry write in a Firestore transaction that reads, validates, and updates a single `metadata.lastHistoryEntry` field. This is a write-rate choke point: every concurrent writer competes on the same metadata document. Even one user typing fast can starve other users' uploads. DataFlow at 1–20 Hz makes this untenable, and the background-entries design ([2026-04-27](background-entries-design.md)) flags "transaction hogging on the user channel" as an explicit unresolved dependency.

This document proposes replacing the transaction-based linear chain with a **multi-parent Directed Acyclic Graph (DAG)** of history entries. Entries are appended to Firestore without per-document coordination; concurrent writers don't compete; conflict detection and resolution move entirely to the client. The model is similar in spirit to Git: each entry records the set of "tips" the writer's view contained at write time; canonical order is determined globally by `(serverTimestamp, id)`; conflicts are detected by scope overlap between an entry and the canonical entries its writer didn't see.

This is a draft. The big shape is settled (multi-parent + canonical timestamp + scope-based conflict detection + `reverted` flag on losers), but several pieces are sketched, not fully designed. See § Open questions.

## Goals

1. Remove the per-document write-rate choke point so multiple users can edit without serializing through one transaction.
2. Simplify or unblock the background-entries design — the open problem § "Transaction hogging on the user channel" depends on this.
3. Preserve GD-6's corruption-prevention guarantee: concurrent edits never produce broken document state.
4. Keep history meaningful — replays, scrubber, history view, and late-joiner loads still produce a coherent record.
5. Reuse existing GD-6 machinery where possible (`partitionLocalEntriesForMerge`, `rollbackLocalEntries`, `buildRevertEntrySnapshot`).

## Non-goals

- Eliminating all latency between writers and watchers. Firestore listener delivery still bounds visibility.
- Preserving a literal linear chain in storage. The on-server form becomes a DAG; clients linearize at apply time.
- Resolving conflicts at the patch level (CRDT / OT). Scope-overlap remains the conflict-detection unit, same as GD-6.
- Designing tile locking or the per-tile work of GD-8/GD-9/GD-10/GD-11.
- Migrating existing group documents. New documents on the new path only; existing ones keep the transaction model unless explicitly migrated.

## Background

### The choke point

The current `uploadQueuedHistoryEntries` does, per upload:

1. `runTransaction` against the metadata document
2. Read `metadata.lastHistoryEntry`
3. Validate against the local `expectedRemoteHead` (send-side fork detection — abort if mismatch)
4. Write each queued entry with chained `previousEntryId`
5. Update `metadata.lastHistoryEntry` to the new tail

Every write from every client funnels through step 1's read on the same metadata document. Firestore transactions on a single document support roughly one sustained write per second under contention — and under contention they retry, multiplying the cost. With one user emitting entries at high rate (typing, or DataFlow ticks) every other user's transactions thrash trying to get a clean read.

The receive-side already has the machinery to recover from forks: `detectAndResolveFork` checks the upload queue for entries with overlapping scope to incoming and rolls them back via `rollbackLocalEntries` if they conflict. The transaction's job is purely to serialize writes and keep the on-server chain linear; it does not add safety beyond what receive-side detection provides — except for the case the new design has to address: *what happens when the conflicting local entries have already been uploaded.*

### Why we want a DAG, not just "drop the transaction"

Dropping the transaction without other changes would let two writers commit entries with the same `previousEntryId`, producing a fork on the server. The receive-side rollback assumes a writer's local entries are still in the queue (not on the server) when the conflict is detected. That assumption breaks once entries are append-only.

A DAG model frames the new shape directly: entries can branch and merge; the canonical state is computed by clients applying entries in a deterministic order; the on-server data is genuinely tree-shaped, not pretending to be linear.

## Concept

### What changes vs. today

| | Today (GD-6) | This design |
|---|---|---|
| Entry parent field | Single `previousEntryId` | Multi-parent: set of parent ids |
| Server enforcement | Transaction validates head, atomic chain update | None — append-only collection |
| Canonical order | Implicit via `previousEntryId` chain | Explicit via `(serverTimestamp, id)` |
| Send-side fork detection | `expectedRemoteHead` mismatch aborts transaction | None — concurrent writes succeed |
| Receive-side concurrent set | Local upload queue | Applied entries (canonical + uncommitted local) minus e's seen-set |
| Uncommitted local entries | Local upload queue | Local entries without a serverTimestamp. `pendingLocal` |
| In-flight remote held | N/A — transaction prevents overlap | `pendingDecision` until canonical position of locals is known |
| Loser handling | Local rollback (entry never reached server) | Local rollback + `reverted` flag written to loser entry |

### Multi-parent

The **writer's view** is the set of history entries the writer has applied to its local model at the time it produces a new entry. The **frontier** of the view is its set of *tips* — entries in the view that no other entry in the view lists as a parent. Equivalently, tips are entries on the leading edge of the view, with nothing chained on top of them. If you draw the view as a DAG with `parents` as backward arrows, tips are the nodes with no incoming arrows. There is at most one tip per client in the writer's view.

A new entry's `parents` is a copy of the frontier at write time. Once the entry is created, the frontier collapses to that single new entry: it becomes the only tip, since it points back at all previous tips.

Most of the time, the writer's view is linear (frontier of one — the last applied entry), and `parents` is a singleton equivalent to today's `previousEntryId`. After the writer merges siblings into its view (e.g., applies a non-conflicting concurrent remote on top of its own latest local), the frontier has multiple tips, and the next new entry's `parents` lists all of them.

Applying remote entries to the local model does not itself create a new entry — it just updates the frontier. An entry with multiple `parents` (a "merge entry") is only created when the writer generates a new entry from a local change.

Walking back transitively through `parents` gives the writer's full seen-set at write time. This is what the conflict-detection algorithm needs — see § Conflict detection.

### Canonical order

Every entry stamps `serverTimestamp()` on write. Canonical order is the lexicographic pair `(serverTimestamp, id)` (id tiebreaks identical-timestamp ties). All clients agree on this ordering and use it for conflict resolution.

The actual apply order on each client may diverge from canonical — non-conflicting patches commute, so a client can apply entries as they arrive without rewinding. Canonical order only forces re-application when scopes overlap and a winner has to be chosen.

`previousEntryId` chains are no longer the source of canonical order. The writer's recorded `parents` represent *intent*: "these are the tips I'd seen." Whether the writer's intent matches canonical reality is what conflict detection checks.

### Conflict detection (scope-based, vs. concurrent set)

For each entry `e` being applied:

1. `seenByWriter(e)` = transitive closure of `e.parents` via the `parents` field. Conceptually: walk back from each parent, following `parents` references. The resulting set is every entry the writer's view contained when `e` was written.
2. `concurrent(e)` = entries currently applied to the local state that are NOT in `seenByWriter(e)`. This includes both canonical entries (with serverTimestamps) and in-flight local entries (`pendingLocal`, awaiting their serverTimestamp echoes). The defining property is "applied locally but not seen by `e`'s writer," not canonical position.
3. For each entry `c` in `concurrent(e)`: if `c.scope` overlaps `e.scope`, then `e` and `c` are in conflict.

Scope overlap is the same path-based check used by master today. Each tile and shared model is a scope, and all other changes are given a "doc" scope.

For conflicts where the canonical order is fully known (both entries have serverTimestamps), the winner is the one with lower `(timestamp, id)`. For conflicts involving an in-flight local, the canonical order is not yet known; the conflict is held in `pendingDecision` until the local commits (see § Receive-side state machine).

**Implementation note**: a literal walk of all of `e`'s ancestors and all applied entries is expensive for long-lived documents. The likely implementation walks back from `e`'s tips and from the current frontier in parallel, stopping when both walks reach common ancestors. Entries beyond those ancestors are in both `seenByWriter(e)` and the applied state, so they don't need to be enumerated. With multi-parent on either side, "common ancestors" may be a set of entries rather than a single node, requiring the walk to advance multiple tips in parallel.

### Conflict resolution

When `e` and `c` conflict:

- **Winner**: the one with lower `(serverTimestamp, id)`.
- **Loser**: effects are reverted from local state, and the loser's Firestore document is updated with `reverted: true`.

The flag persists the conflict-resolution decision in the data, so:

- **Late joiners and replayers** read the flag from the loser entry and skip applying its patches without re-running detection over the full history.
- **Future algorithm changes** (e.g., GD-10's finer-grained scope analysis) don't retroactively rewrite history — the reverted flag freezes the resolution at decision time. Replays under a new algorithm trust pre-existing flags as authoritative, only running the current algorithm on entries that don't yet have a flag.
- **Live clients** that detect the conflict reach a consistent state immediately by reverting locally; the flag-write is a separate, idempotent persistence step.

An observing user can be using the history scrubber. In this case they aren't just looking at the document state. So the history scrubber needs to also run the same conflict resolution algorithm. This way the history scrubber won't blindly apply conflicting entries that have been uploaded but not reverted yet. The scrubber can ignore and remove reverted entries. The scrubber could also show markers where these entries would fall.

Multiple clients can detect the same conflict and each write the flag; writes are idempotent (same value), so Firestore last-write-wins gives a consistent result.

### Non-conflicting concurrent entries (merge)

If `e` and `c` are concurrent (`c` is in `concurrent(e)`) but their scopes don't overlap, both apply normally — no rollback, no revert. The receive-side merge for scope-disjoint cases is already implemented via `partitionLocalEntriesForMerge`. This design extends the same analysis to apply against "all applied entries" rather than just upload-queue entries; finer-grained merging within shared models (GD-10) and individual tiles remains future work.

### In-flight window

There is a window between when a writer locally produces an entry and when its `serverTimestamp` is assigned by Firestore at commit. During this window, the writer's local state has the entry "applied," but no other client has seen it (it isn't on the server yet) and the local writer doesn't know its eventual canonical position.

If during this window a remote entry arrives that conflicts in scope with the in-flight local entry, the winner can't be determined — the loser is whoever has the lower timestamp, but the local entry's timestamp doesn't exist yet.

The receive-side handles this by **deferring the conflict decision**, not the apply: non-conflicting incoming entries continue to apply; the specific conflicting incoming entry sits in `pendingDecision` until the in-flight local's commit echo arrives. Then both timestamps are known and the winner is determined deterministically.

The alternative is to optimistically revert the local entry and apply the incoming remote entry. However since the local entry is already applied and we don't know the winner, it seems better to wait rather than possibly having to revert more than once. To be clear we can't just apply the conflicting entry, without reverting the local one. That can create an invalid MST tree or semantically invalid state that tiles can't handle.

## Detailed design

### Entry shape

```ts
type HistoryEntry = {
  id: string;                  // client-generated UUID
  parents: string[];           // ids of tips in writer's view at write time
  patches: IJsonPatch[];       // forward patches
  inversePatches: IJsonPatch[]; // for revert
  serverTimestamp: Timestamp;  // assigned by Firestore on commit
  uid: string;                 // user id
  // ... existing HistoryEntry fields (action, records, etc.)
}
```

The existing `HistoryEntry` model already has most of these. The new field is `parents` (replacing `previousEntryId`).

An entry's *scope* (the set of MST paths its patches touch) is needed for conflict detection but is fully derivable from the patches, so it is not stored in Firestore. Today's `getEntryScopeKeys` in [`src/models/history/entry-scopes.ts`](../../../src/models/history/entry-scopes.ts) computes scope keys from a `HistoryEntrySnapshot`; the new design reuses it. If profiling later shows recomputation is hot, caching scope on the in-memory entry (computed lazily on first access) is a straightforward local-only optimization — no protocol change.

### Receive-side state machine

The receive side maintains:

- **`canonical`**: ordered list of entries with serverTimestamps, by `(serverTimestamp, id)`. Each entry has a decision status (winner / loser / pending).
- **`pendingLocal`**: local entries written but without a serverTimestamp echo yet.
- **`pendingDecision`**: stamped remote entries whose winner/loser status is blocked on a `pendingLocal`. Indexed by entry id; tracks the dependency.
- **`frontier`**: the writer's-view frontier (defined in § Multi-parent). New local entries record this as their `parents`.
- **`appliedState`**: the current document state — patches from `pendingLocal` and from non-deferred canonical entries, applied as the state machine processes them. May transiently include losers, which are reverted when their conflicts resolve.

#### Events

**1. Local user creates entry `e`**
- `e.parents = frontier`
- Compute `e.scope` from patches.
- Apply `e.patches` to `appliedState` (optimistic).
- Add `e` to `pendingLocal`. Update `frontier = {e}` (e absorbed all prior tips into its parents).

**2. Listener delivers remote entry `r` with `serverTimestamp T_r`**
- `seenByWriter(r) = ` transitive closure of `r.parents`.
- `concurrent(r) = ` applied entries (canonical + `pendingLocal`) not in `seenByWriter(r)`.
- `conflicts(r) = ` entries in `concurrent(r)` whose scope overlaps `r.scope`. Split into:
  - `pendingConflicts(r)` — entries from `pendingLocal` (canonical position not yet known).
  - `resolvableConflicts(r)` — canonical entries (timestamps known).
- **If `pendingConflicts(r)` is non-empty**: defer. Add `r` to `pendingDecision`, recording the blocking pendingLocals. Do NOT apply `r`. Other non-conflicting remotes continue to flow.
- **Else if `resolvableConflicts(r)` is non-empty**:
  - Winner = lowest `(timestamp, id)`.
  - If `r` wins: revert losers' patches from `appliedState`; apply `r`; write `reverted: true` to each loser's Firestore document. Idempotent across clients.
  - If `r` loses: don't apply `r`; mark as loser locally; write `reverted: true` to `r`'s Firestore document. Idempotent across clients.
- **Else (no conflicts)**: insert `r` into canonical, apply `r.patches` to `appliedState`. Update `frontier`.

**3. Local entry `l` receives its serverTimestamp echo**
- Move `l` from `pendingLocal` to `canonical` at `(T_l, l.id)`.
- For each entry in `pendingDecision` waiting on `l`, re-evaluate: with `T_l` now known, the decision becomes determinate. Apply, revert, or trigger cascade (event 4) as needed.

(All conflicts involving `l` were caught when remotes arrived in event 2 and parked in `pendingDecision`. If `T_l` reorders `l` ahead of non-conflicting remotes already applied, no `appliedState` change is needed — non-conflicting patches commute, so the apply order doesn't affect state.)

**4. Cascade — a previously-applied entry `x` becomes a loser**
- Revert `x.patches` from `appliedState` (no-op if `x` is already reverted).
- Walk forward through canonical: any entry whose `parents` transitively include `x` AND whose scope overlaps `x.scope` may also be invalidated. Revert those too (recursively).
- Entries that depended on `x` only by canonical-order adjacency but whose scope doesn't overlap stay valid (they commute with `x`).

#### Idempotency

The state machine treats entry status (applied / reverted / loser / `pendingDecision`) as a per-entry *fact*, not as an action that can fire repeatedly. Operations that change status are idempotent:

- **Multiple `pendingDecision` entries pointing at the same local**: if `l` was in `pendingLocal` and several incoming remotes each conflicted with it, each landed in `pendingDecision`. When `l`'s echo arrives, the resolutions process in canonical order. The first to determine `l` is the loser reverts `l`'s patches and writes `reverted: true`. Subsequent resolutions observe `l` is already a loser and skip the revert.
- **Cascade re-entry**: cascade reverts walking forward through canonical may encounter entries already reverted by an earlier cascade pass. These are skipped.
- **Concurrent multi-client reverts**: multiple clients independently detecting the same conflict each issue `reverted: true`; writes carry the same value, so Firestore last-write-wins gives a consistent result.

This is what makes the algorithm robust to event ordering, network delivery quirks, and re-runs (e.g., during initial document load).

#### Frontier maintenance

The frontier is updated as events occur:

- **On local entry creation**: `frontier ← {e}`. The new entry's `parents` captured the old frontier; the entry itself is now the only tip.
- **On remote apply**: if `r` was applied without conflict, `frontier ← (frontier ∪ {r}) \ seenByWriter(r)`. The remote may have absorbed some of our tips into its own ancestry; those are no longer tips.
- **On revert / cascade**: when a tip becomes a loser, it leaves the frontier; its parents may re-emerge as tips if no other tip descends from them.

Maintaining this correctly under concurrent events is fiddly. Worth a small abstraction; details in § Open questions.

### Per-client upload serialization

To preserve monotonic serverTimestamps within a client's own entries, each client serializes its uploads: send entry `e_n`, wait for the commit echo, then send `e_{n+1}`. This is per-client serialization (not cross-client) — A's queue does not contend with B's queue. The current upload queue already has this shape, just within a transaction; the new design keeps the queue but drops the transaction.

This is necessary because Firestore does not guarantee write order across separate non-transactional writes from the same client. Without serialization, `e_2` could commit before `e_1` and end up canonically earlier — breaking the invariant that an entry's `parents` reference entries with strictly earlier canonical position.

Local entries continue to apply optimistically — the user does not wait for upload. Only the upload itself is serialized, in the background.

**Future optimization: batching.** If per-client serialization becomes a throughput bottleneck, multiple queued entries can be uploaded as a Firestore batch. All entries in a batch commit atomically and share a single `serverTimestamp`, so the canonical ordering needs a tiebreaker that preserves intra-batch order. Two viable variants:

- **Sortable entry ids** (e.g., ULID / KSUID): canonical order stays `(serverTimestamp, id)`; the id itself encodes batch order, so a UUID would have to be replaced with a sortable scheme.
- **Explicit batch fields**: canonical order becomes `(serverTimestamp, batchId, entryBatchIndex)`, where `batchId` is a unique id (like `entryId` is today) and `entryBatchIndex` is the entry's position within the batch.

Either preserves intra-batch order; the conflict-detection algorithm and DAG semantics are unaffected. The same approach applies if same-client serial uploads ever produce same-timestamp ties due to Firestore's timestamp resolution being coarser than expected — use the technique at the client-session level instead of the batch level.

### Local revert entries

When a conflict resolves with `l` as the loser, the canonical resolution is encoded by the `reverted: true` flag on `l`'s Firestore document (see § Conflict resolution). The flag is what other clients consume; no separate revert entry is uploaded.

Locally, today's behavior is preserved: when reverting `l`'s patches from `appliedState`, the client also constructs a revert entry via `buildRevertEntrySnapshot` and appends it to local history via `addRevertEntryAfterApplying`. The revert entry is never uploaded — it's a record kept on the local client only, useful for:

- Inspecting history during debugging to see what happened during a session.
- Local replay tools that walk the local history.

Other clients don't need these local revert entries; they read the `reverted` flag and skip applying the loser's patches.

### Initial document load

When a client opens a document, it:

1. Loads the document content from RTDB (existing behavior). The envelope's `tips` (multi-id frontier) marks the canonical position the saved doc reflects.
2. Loads canonical entries from Firestore that come after the saved tips, ordered by `serverTimestamp`.
3. For each entry in canonical order: applies via the receive-side state machine (treating each as a delivered remote).

The saved-doc invariant — established by the [settled-state-doc-saves prerequisite](settled-state-doc-saves-design.md) — is that the doc reflects canonical state at the recorded `tips`. Without that invariant, late-comer loads can diverge from canonical (see § Why the prerequisite is needed below).

Performance concern: for a long-lived document with many entries between saved tips and current head, this is O(N) work on every open; needs measurement. Mitigations are out of scope here (see settled-state-doc-saves design).

### Why the prerequisite is needed

Without the saved-doc-reflects-canonical invariant, the following anomaly is possible:

- B locally writes b1 with parent P. b1 is the loser in a conflict with a1 (T_a1 < T_b1).
- Before B's listener delivers a1, B saves the doc (today's code saves on every model change). Saved-doc state = P + b1.
- B's tab closes before the conflict resolves locally.
- D opens the document. D loads saved-doc state P + b1, but canonical state is P + a1 (b1 lost).
- D doesn't know b1 is in the loaded state. D applies canonical entries since saved tips and reaches some inconsistent state.

The settled-state-doc-saves design ensures B doesn't save the doc while b1 is in flight or unresolved; the saved doc only ever reflects canonical state. With that invariant, D's load is correct.

## Open questions

### Apply ordering: ties at `serverTimestamp`

The receive-side state machine assumes `seenByWriter(e)` is computable when `e` arrives — i.e., `e`'s parents are already applied locally. With per-client serial uploads (this design's requirement) and Firestore listener delivery ordered by `serverTimestamp`, this property holds: an entry `e` cannot be delivered before any entry it lists in `parents`, because every parent committed earlier (it was applied locally on the writer before `e` was authored) and therefore has a strictly earlier `serverTimestamp`.

The residual concern is **timestamp ties**. Two writes that commit within `serverTimestamp`'s resolution window — possible at high write rates from a single client, or unavoidable if the future batching optimization is introduced and a batch shares one timestamp — fall back to the `(timestamp, id)` tiebreaker. With client-generated UUIDs as ids, that tiebreaker has no relationship to authoring order, so a writer's later entry could end up ordered before its earlier one, even when the earlier one is in the later one's `parents`.

Two paths to fix when this becomes practical (both mentioned above in § Per-client upload serialization as the batching solution):

- **Sortable ids** (ULID / KSUID): the id encodes authoring order; canonical order stays `(serverTimestamp, id)` and the tiebreak preserves intent.
- **Per-session sequence field**: extend canonical order to `(serverTimestamp, sessionId, sequenceNumber)`; same effect, different shape.

The same fix would apply to plain timestamp-resolution ties at the client-session level if measurement shows them. Not required at MVP; flagged here so the implementation plan can decide whether to land sortable ids early as a precaution.

### Frontier maintenance details

The frontier rules above are sketched, not formalized. Concrete cases that need worked examples:
- Two non-conflicting remotes arrive; how does the frontier evolve?
- A remote arrives that absorbs only some of our tips (e.g., its parents include one local tip but not another)?
- Cascade reverts a tip — which earlier entries re-emerge as tips?

A small Frontier data structure with explicit invariants and unit tests is probably the right way to nail this down.

### Cascade depth and stability horizon

In pathological cases (a long-offline writer rejoining and conflicting with stuff from minutes ago), cascades can reach back arbitrarily far through the history. We probably want a **stability horizon**: entries past some age threshold are considered immune to retroactive invalidation; a late writer whose entry would conflict with settled history must rebase or accept their work being dropped.

Open: what's the right threshold? How do we communicate to the late writer that their work was rejected? Does this need to be configurable per-document?

### Coordinating reverted-flag writes

The `reverted` flag on a loser entry is written by any client that detects the conflict and resolves it. Multiple clients may write the flag concurrently; the value is identical (`true`), so writes are idempotent and Firestore last-write-wins gives a consistent result.

Open details:

- **Listener delivery oddities**: is there any case where a `reverted` flag update on an existing entry produces unexpected listener behavior (re-delivery of the entry, snapshot ordering, etc.)? Worth verifying with a small test.
- **Self-healing for unwritten flags**: if no client is online to detect a conflict (e.g., both writers disconnect immediately after producing conflicting entries), the flag is never written initially. The next client to load runs detection during initial-load processing and writes the flag then. So missing flags self-heal as long as some client eventually loads with the receive-side state machine.

#### Why `revertedBy` was dropped

We considered storing the winner's id alongside the flag (e.g., `revertedBy: <winnerId>`) for history-view UI and debugging traceability. We dropped it because a single loser can lose to multiple winners simultaneously (any canonical entry with overlapping scope and a lower `(timestamp, id)`), and there isn't a single canonical "the winner" without a deterministic tiebreaker rule. Combined with the in-flight window — where a client might write `revertedBy` based on what it sees, then later observe a different conflicting entry it would prefer — making `revertedBy` reliably idempotent across clients required either deferring the write until a stable state or accepting eventual-consistency churn. Pure `reverted: true` is unambiguously idempotent, so we kept that and dropped the rest.

The history-view / debugging use case can be served by computing the relevant winner on demand: given a loser entry, run conflict detection over its concurrent set, find the lowest-`(timestamp, id)` entry with overlapping scope, and that's the answer to display. Cheap per-entry; no need to persist. If profiling later shows this compute path is hot enough to matter, caching is straightforward.

### Patch validity after cascade

Reverting a cascade involves combining inverse patches from multiple entries. The combined sequence must leave the document in a valid MST tree. The current `rollbackLocalEntries` builds this for the local-queue case; extending to deeper cascades is mechanical but needs careful testing.

If a cascade revert produces an invalid MST tree (e.g., a reference points at a node that's been removed and then concurrently re-added in a different position), what's the recovery? Probably: bail out of the cascade, log, and surface to the user. But this is a place where the design is not yet robust.

### Migration from existing group documents

Existing documents have `previousEntryId` chains and `metadata.lastHistoryEntry`. New documents would use `parents` and not need the metadata field. Mixed coexistence is awkward. Probably:
- Existing documents stay on the transaction model; users migrate by creating new documents.
- A flag in document metadata indicates which model applies.
- Long-term, a one-time migration converts existing chains to multi-parent (`parents = [previousEntryId]`).

### Interaction with the background channel

Resolved: the [background-entries design](background-entries-design.md) was rewritten on 2026-04-30 to assume this design as a prerequisite. Background entries are now ordinary entries in this DAG with a `background: true` flag, plus a small set of behavioral deltas (asymmetric conflict resolution favoring user entries, undo exclusion, scrubber skip-by-default, producer notification on revert). No separate channel, collection, or causality-token mechanism — `parents` already encodes producer-to-user causality.

The receive-side state machine here serves both flavors. The conflict-resolution step needs one extension: when comparing a user entry and a background entry with overlapping scope, the user entry wins regardless of `(serverTimestamp, id)`. Same-flavor conflicts use the standard rule.

One open issue this surfaces: the receive-side state machine should defer applying an entry until its `parents` are present locally, otherwise out-of-order delivery of same-runner ticks misfires conflict detection. That's an existing gap in this design (not introduced by background entries), but tick-rate makes it routine rather than hypothetical. Tracked under § Open questions.

## Relation to existing work

- **GD-9** — this design *requires* the merge-on-non-conflict path that GD-9 added. The scope-overlap check is the merge/rollback decision; the same code path serves both.
- **GD-10 (Shared Model Merging)** — would refine the scope-based conflict-decision rule to recognize finer-grained non-conflicts within shared models. The receive-side state machine is unchanged; only the conflict-detection logic evolves.
- **GD-11 (Tile Hardening)** — independent.
- **CLUE-379 (background channel design)** — depends on this design. Some of CLUE-379's complexity was motivated by transaction hogging on the user channel that this design eliminates; that complexity may be reducible once this lands.

## What's next

This design is incomplete — the open questions section is substantial and several pieces will need detailed working-out before this can become an implementation plan. Suggested next steps before writing a plan:

1. Formalize the Frontier data structure with invariants and worked examples.
2. Decide on the stability horizon model.
3. Confirm Firestore's listener-snapshot consistency assumption (snapshots include all writes with `serverTimestamp ≤ T`) holds at the scale we care about — relied on by the receive-side state machine.
4. Decide on the migration strategy for existing documents — at minimum, the metadata flag and coexistence rules.
5. Walk through 5–10 concrete multi-client scenarios end-to-end to validate the receive-side machine catches all cases.

After these, the design should be tight enough to derive an implementation plan from.
