# Merge Independent Forks — Design

**Jira**: CLUE-316
**Planning context**: part of GD-9 in `docs/group-docs/group-docs-plan.md` (planning worktree)
**Builds on**: GD-6 / CLUE-485 (receive-side and send-side fork detection + rollback)

## Summary

Today, any fork detected by `FirestoreHistoryManagerConcurrent` rolls back *all* local uncommitted history entries via `rollbackLocalEntries`. This story replaces the all-or-nothing rollback with a partial merge: when the local and remote entries touch independent scopes, local entries are preserved and remote entries are applied on top. Only the conflicting local entries (and anything after them) are rolled back.

Scopes are partitioned into three kinds — individual tiles (`tile:<id>`), individual shared models (`shared:<id>`), and a single catch-all `doc` bucket (rowMap, rowOrder, document name, metadata, anything not inside `tileMap`/`sharedModelMap`). Two scope sets conflict iff they intersect.

The merge decision logic lives in a new pure module so it can be reused later by the group-doc undo/redo path, which needs the same "can I apply this entry given what has happened since?" primitive.

## Scope

**In scope:**
- Merge forks where local uncommitted entries and incoming remote entries touch disjoint scopes.
- Partial rollback: walk local entries oldest-first; first conflict triggers rollback of that entry and every later local entry.
- Preserve local wall-clock history order in `document.history` (local entries stay in place; remote entries are appended after them). The eventual Firestore chain order differs — that's acceptable because the history scrubber only operates on synced remote entries today.
- Retrigger upload after a successful merge so surviving local entries get committed with the new `previousEntryId`.

**Out of scope (future work):**
- Tile-level or shared-model-level internal merging (GD-10 territory).
- Finer-grained `doc` scope — e.g., per-row or per-rowOrder-index. Two concurrent tile additions will conflict at `doc` and one side's addition will be rolled back. This is intentional for now and matches the spec ("when both users change something at the document level, we don't merge").
- Tile/shared-model-type-aware merge decisions (delegating to tile implementations).
- Automated E2E tests (Cypress/Playwright) exercising the manual reproduction scripts. See Follow-up Work.

## Architecture

### New module: `src/models/history/entry-scopes.ts`

A pure module — no MST, no Firestore. It takes `HistoryEntrySnapshot` values (or a minimal subset) and returns scope information.

```ts
export type EntryScope =
  | { kind: "tile"; id: string }
  | { kind: "shared"; id: string }
  | { kind: "doc" };

// "tile:<id>" | "shared:<id>" | "doc"
export type EntryScopeKey = string;

// Derive a scope from a JSON patch path. Paths matched:
//   /content/tileMap/<id>             -> tile:<id>
//   /content/tileMap/<id>/<anything>  -> tile:<id>
//   /content/sharedModelMap/<id>      -> shared:<id>
//   /content/sharedModelMap/<id>/...  -> shared:<id>
//   everything else                   -> doc
export function scopeKeyForPatchPath(path: string): EntryScopeKey;

// Union of scope keys touched by all patches in all records of an entry.
// Looks at both do-patches and inverse-patches.
export function getEntryScopeKeys(entry: HistoryEntrySnapshot): Set<EntryScopeKey>;

// True iff the two sets share at least one scope key.
export function scopeSetsConflict(a: Set<EntryScopeKey>, b: Set<EntryScopeKey>): boolean;

// Fork-merge primitive. Walks local entries oldest-first, tracking the
// union of remote scopes. Returns the count to keep and the count to
// rollback. rollback starts at the first local entry whose scopes
// conflict with the remote union; everything after that entry is also
// rolled back so later local entries don't depend on state that was
// just reversed.
export function partitionLocalEntriesForMerge(
  localEntries: HistoryEntrySnapshot[],
  remoteEntries: HistoryEntrySnapshot[]
): { keepCount: number; rollbackCount: number };
```

A future undo/redo path consumes `getEntryScopeKeys` + `scopeSetsConflict` directly against whatever "remote entries since" set it wants to compare; it does not need `partitionLocalEntriesForMerge`.

### Integration into `detectAndResolveFork`

`detectAndResolveFork` in `src/models/history/firestore-history-manager-concurrent.ts` currently finds the fork point and calls `rollbackLocalEntries(localUncommittedCount)`. It's replaced with:

```
if newWrapperDocs is empty: return
if first incoming previousEntryId == localHeadId: return  (not forked)

headIndex = expectedRemoteHead
  ? history.findIndex(e => e.id === expectedRemoteHead)
  : -1
localUncommitted = history.slice(headIndex + 1)
incomingSnapshots = newWrapperDocs.map(w => w.entry)

{ rollbackCount } = partitionLocalEntriesForMerge(
  localUncommitted.map(e => getSnapshot(e)),
  incomingSnapshots
)

if rollbackCount > 0:
  await rollbackLocalEntries(rollbackCount)
```

Everything after that — `doApplyHistoryEntries`'s normal flow — handles applying the remote patches on top of whatever local entries remain, appending the remote entries to `document.history` with `addHistoryEntryAfterApplying`, and advancing `expectedRemoteHead`. No changes needed there.

### Retriggering upload after merge

GD-6 currently does not re-trigger uploads from `doApplyHistoryEntries` because after a full rollback the queue is empty. With partial merge, the queue can still contain surviving local entries whose `previousEntryId` now needs to chain off the new remote head.

Add a single line at the end of `doApplyHistoryEntries` (guarded by `completedHistoryEntryQueue.length > 0`) that calls `this.uploadQueuedHistoryEntries()`. It's a no-op when the queue is empty, so existing behavior is preserved.

Note on correctness: `rollbackLocalEntries` already filters rolled-back entries out of `completedHistoryEntryQueue` by id, so the retriggered upload only carries the kept entries.

### History ordering

After a merge, `document.history` has the shape `[..., committed, kept_local, remote]`. This matches the wall-clock order in which entries were applied locally — it does *not* match the eventual Firestore chain order (`[..., committed, remote, kept_local]`). Chosen deliberately for debuggability: the history viewer shows local and remote entries side-by-side, and matching the application order makes it easier to diagnose issues. The history scrubber only operates on entries synced from remote, not on local uncommitted entries, so the divergence doesn't cause replay problems.

## Data Flow

### Receive-side fork

1. Remote listener delivers `newWrapperDocs`.
2. `syncRemoteFirestoreHistory` → `applyHistoryEntries` → `doApplyHistoryEntries`.
3. `doApplyHistoryEntries` skips already-applied entries and calls `detectAndResolveFork`.
4. `detectAndResolveFork`: run scope-based merge decision, rollback conflicting local entries (and later ones), leave kept local entries in place.
5. Back in `doApplyHistoryEntries`: apply remote patches, append remote entries to `document.history`, advance `expectedRemoteHead`.
6. If queue is non-empty, trigger upload.

### Send-side fork

1. Upload transaction aborts with `RemoteHeadChangedError` (existing behavior).
2. Queue stays intact, uploads don't retry (existing behavior).
3. Firestore listener delivers the unknown remote entries shortly after.
4. Receive-side path (above) runs — same merge decision, same rollback/keep behavior.
5. Upload retriggers at the end of `doApplyHistoryEntries`, this time with the new remote head.

## Known Theoretical Error Cases

### Accepted lost-work cases (document stays consistent)

These are not bugs — they're the result of the spec's "rollback when both touch doc-level" rule. The document remains consistent; one user just loses their work.

- **Tile-add vs layout edit.** User A adds a tile (`tile:<new>` + `doc` via rowMap), user B drags a tile to reorder (`doc`). `doc` intersects → A's addition is rolled back.
- **Concurrent tile adds.** Both users add a tile. Both touch `doc` via rowMap → one side is rolled back.

Finer-grained `doc` partitioning (e.g., per-row) could eliminate both cases in a future story.

### Inconsistency risks (may cause crashes or bad state)

These are the cases to watch for. Scope-by-top-level-map treats them as mergeable, but the merged state may be semantically inconsistent. Documented so the team can observe in practice and decide whether any warrant GD-10/GD-11 work.

- **Cross-scope reference drift.** User A edits a tile that references an object by id inside a shared model (drawing variable chips, graph attribute references, etc.). User B deletes the referenced object. Scopes `tile:X` vs `shared:S` — merge. The tile is left holding a stale reference.
- **Schema-assumption drift.** User A sets column formatting on a table tile assuming the column's current type. User B changes the column's type in the shared dataset. Disjoint scopes → merge. Tile renders against a type its settings weren't built for.
- **Computed-state drift.** User A adjusts a graph's axis bounds based on current dataset values. User B modifies rows in the shared dataset. Disjoint scopes → merge. Graph's stored bounds may no longer fit the data.
- **Stale shared-model snapshots in tile state.** Tiles that cache derived values (selection, pagination, summaries) inside their own tile state may hold stale copies if the shared model mutates underneath. Tiles' normal resync path handles many but not all.

Pre-existing issues under GD-6's rollback (table column delete, drawing object delete) are not addressed here and will continue to affect users regardless of merge behavior.

## Testing

### Unit tests: `entry-scopes.test.ts`

- `scopeKeyForPatchPath` for each path shape: tile content, tile entry (add/remove), shared model content, shared model entry (add/remove), rowMap, rowOrder, doc name, metadata, root, empty path.
- `getEntryScopeKeys` across entries with multiple records and multiple patches per record (covering both `patches` and `inversePatches`).
- `scopeSetsConflict` for disjoint, overlapping, and empty sets.
- `partitionLocalEntriesForMerge`: no conflict, conflict at first local entry, conflict at Nth triggers rollback N..end, empty local, empty remote, conflict at `doc` scope, conflict at `tile:<id>` scope, conflict at `shared:<id>` scope.

### Integration tests: `firestore-history-manager-concurrent.test.ts`

Extend existing fork-detection patterns. The current test at `firestore-history-manager-concurrent.test.ts:229` covers "all local rolled back". Add:

- **Receive-side disjoint-scope merge.** Local edit on tile X, remote edit on tile Y → both survive, remote appended after local in `document.history`.
- **Receive-side partial merge.** Local entries `[tile X, tile Y, tile X]`, remote touches tile Y → keep `[tile X]`, rollback `[tile Y, tile X]`, then apply remote.
- **Send-side recovery.** Upload aborts with `RemoteHeadChangedError`, listener delivers remote entries, merge succeeds, upload retriggers, surviving local entry gets uploaded with `previousEntryId` = new remote head.
- **`doc`-scope conflict.** Two concurrent tile adds → falls through to rollback one side (verifying the existing behavior is preserved when scopes do conflict).

### Manual reproduction scripts

A new doc `docs/group-docs/clue-316-manual-test-scripts.md` (in this branch, not the planning worktree) capturing pause/resume scripts for each of the inconsistency-risk cases. Format per script: setup steps, action sequence using the history-view debug panel, expected mergeable outcome, what "bad state" would look like. These scripts are inputs for triage — they tell us which of the theoretical cases actually misbehave in practice.

## Follow-up Work

- **Automated E2E tests** for both the CLUE-316 scripts and the pre-existing GD-6 pause/resume scripts. Cypress is already wired up, but running concurrent-editing scenarios deterministically needs: reliable Firebase-emulator setup for group docs, two browser contexts (or driving pause/resume from Cypress), and per-tile rendering assertions. Per-tile rendering is really GD-11 territory, so a single follow-up story covering E2E automation for the full group-doc scenario set seems right.
- **Tighten tile-vs-shared-model checking.** If the inconsistency-risk cases 1–3 above show up often enough in practice, a follow-up story could treat "user A edited tile X, user B edited shared model S, and tile X uses shared model S" as a conflict instead of a merge. This pulls tile→shared-model dependency information into the conflict check (via each tile's declared shared models). It trades more rollback ("lost work") for fewer inconsistent-state bugs.
- **Finer-grained `doc` scope** if the concurrent-tile-add and tile-add-vs-layout-edit rollback rates prove annoying in practice.
- **Tile/shared-model-type delegation** once there's a concrete need (e.g., drawing tile declaring "my object-property changes are safe even alongside concurrent object adds").
