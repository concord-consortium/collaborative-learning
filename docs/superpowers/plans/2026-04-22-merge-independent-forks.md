# Merge Independent Forks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace GD-6's all-or-nothing fork rollback with a partial merge that preserves local uncommitted entries when their scopes don't overlap with incoming remote entries.

**Architecture:** A pure `entry-scopes` module derives a scope key (`tile:<id>`, `shared:<id>`, or `doc`) for each JSON-patch path. `detectAndResolveFork` in `FirestoreHistoryManagerConcurrent` uses this to decide how many local entries to roll back (oldest-first walk, first conflict triggers rollback of that entry and all later ones). Remote entries then apply on top of whatever survives. The existing rollback path and tests remain unchanged for the all-conflict case.

**Tech Stack:** TypeScript, MobX State Tree (`@concord-consortium/mobx-state-tree`), Jest.

**Spec:** `docs/superpowers/specs/2026-04-22-merge-independent-forks-design.md`

---

## File Structure

**Created:**
- `src/models/history/entry-scopes.ts` — pure module. Exports `scopeKeyForPatchPath`, `getEntryScopeKeys`, `scopeSetsConflict`, `partitionLocalEntriesForMerge`, and types.
- `src/models/history/entry-scopes.test.ts` — unit tests for the pure module.
- `docs/group-docs/clue-316-manual-test-scripts.md` — pause/resume scripts for manual reproduction of the inconsistency-risk cases documented in the spec.

**Modified:**
- `src/models/history/firestore-history-manager-concurrent.ts` — replace `detectAndResolveFork` body to call `partitionLocalEntriesForMerge`; add one-line upload retrigger at end of `doApplyHistoryEntries`.
- `src/models/history/firestore-history-manager-concurrent.test.ts` — add a new `DocMergeTestTree` fixture (representing CLUE document structure with `content.tileMap` and `content.sharedModelMap`) and new tests for receive-side merge, partial merge, doc-scope conflict, and send-side recovery.

**Reference for context (do not modify):**
- `src/models/history/history.ts` — defines `HistoryEntrySnapshot` and `TreePatchRecord`.
- `src/models/history/history-firestore.ts` — defines `IFirestoreHistoryEntryDoc`.

---

## Task 1: Create `entry-scopes` module with `scopeKeyForPatchPath`

Derive a scope key from a JSON-patch path string.

**Files:**
- Create: `src/models/history/entry-scopes.ts`
- Create: `src/models/history/entry-scopes.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/models/history/entry-scopes.test.ts`:

```typescript
import { scopeKeyForPatchPath } from "./entry-scopes";

describe("scopeKeyForPatchPath", () => {
  it("returns tile:<id> for a patch targeting tile content", () => {
    expect(scopeKeyForPatchPath("/content/tileMap/tileA/content/value")).toBe("tile:tileA");
  });

  it("returns tile:<id> for a patch that adds or removes the whole tile entry", () => {
    expect(scopeKeyForPatchPath("/content/tileMap/tileA")).toBe("tile:tileA");
  });

  it("returns shared:<id> for a patch targeting shared model content", () => {
    expect(scopeKeyForPatchPath("/content/sharedModelMap/sm1/sharedModel/value")).toBe("shared:sm1");
  });

  it("returns shared:<id> for a patch that adds or removes the whole shared model entry", () => {
    expect(scopeKeyForPatchPath("/content/sharedModelMap/sm1")).toBe("shared:sm1");
  });

  it("returns doc for rowMap paths", () => {
    expect(scopeKeyForPatchPath("/content/rowMap/row1/tiles")).toBe("doc");
  });

  it("returns doc for rowOrder paths", () => {
    expect(scopeKeyForPatchPath("/content/rowOrder/0")).toBe("doc");
  });

  it("returns doc for paths outside /content", () => {
    expect(scopeKeyForPatchPath("/metadata/title")).toBe("doc");
  });

  it("returns doc for the root path", () => {
    expect(scopeKeyForPatchPath("")).toBe("doc");
    expect(scopeKeyForPatchPath("/")).toBe("doc");
  });

  it("returns doc for /content paths that don't match tileMap or sharedModelMap", () => {
    expect(scopeKeyForPatchPath("/content/name")).toBe("doc");
  });

  it("handles tile ids that contain dashes, letters, and numbers", () => {
    expect(scopeKeyForPatchPath("/content/tileMap/ABC-123_xyz/content")).toBe("tile:ABC-123_xyz");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/models/history/entry-scopes.test.ts`
Expected: FAIL — "Cannot find module './entry-scopes'" or similar.

- [ ] **Step 3: Write minimal implementation**

Create `src/models/history/entry-scopes.ts`:

```typescript
export type EntryScope =
  | { kind: "tile"; id: string }
  | { kind: "shared"; id: string }
  | { kind: "doc" };

export type EntryScopeKey = string;

const TILE_MAP_RE = /^\/content\/tileMap\/([^/]+)(\/|$)/;
const SHARED_MAP_RE = /^\/content\/sharedModelMap\/([^/]+)(\/|$)/;

export function scopeKeyForPatchPath(path: string): EntryScopeKey {
  const tileMatch = TILE_MAP_RE.exec(path);
  if (tileMatch) return `tile:${tileMatch[1]}`;
  const sharedMatch = SHARED_MAP_RE.exec(path);
  if (sharedMatch) return `shared:${sharedMatch[1]}`;
  return "doc";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/models/history/entry-scopes.test.ts`
Expected: PASS — all 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/models/history/entry-scopes.ts src/models/history/entry-scopes.test.ts
git commit -m "CLUE-316 Add scopeKeyForPatchPath to entry-scopes module"
```

---

## Task 2: Add `getEntryScopeKeys`

Walk all records and patches in a history-entry snapshot, collecting the set of scope keys touched.

**Files:**
- Modify: `src/models/history/entry-scopes.ts`
- Modify: `src/models/history/entry-scopes.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/models/history/entry-scopes.test.ts`:

1. Replace the existing `import { scopeKeyForPatchPath } from "./entry-scopes";` line with:

```typescript
import { getEntryScopeKeys, scopeKeyForPatchPath } from "./entry-scopes";
import { HistoryEntrySnapshot } from "./history";
import { IJsonPatch } from "mobx-state-tree";
```

2. Append the following helper and tests below the existing `describe("scopeKeyForPatchPath", ...)` block:

```typescript
function makeEntry(
  recordsPatches: Array<{ patches: IJsonPatch[]; inversePatches: IJsonPatch[] }>
): HistoryEntrySnapshot {
  return {
    id: "E1",
    tree: "main",
    model: "TestModel",
    action: "/test",
    undoable: true,
    state: "complete",
    records: recordsPatches.map(({ patches, inversePatches }) => ({
      tree: "main",
      action: "/test",
      patches,
      inversePatches,
    })),
  };
}

describe("getEntryScopeKeys", () => {
  it("returns a set with scope keys for all patches in a single record", () => {
    const entry = makeEntry([{
      patches: [
        { op: "replace", path: "/content/tileMap/A/content/color", value: "red" },
        { op: "replace", path: "/content/tileMap/B/content/color", value: "blue" },
      ],
      inversePatches: [
        { op: "replace", path: "/content/tileMap/A/content/color", value: "white" },
        { op: "replace", path: "/content/tileMap/B/content/color", value: "white" },
      ],
    }]);

    const scopes = getEntryScopeKeys(entry);
    expect(Array.from(scopes).sort()).toEqual(["tile:A", "tile:B"]);
  });

  it("unions scopes across multiple records", () => {
    const entry = makeEntry([
      {
        patches: [{ op: "replace", path: "/content/tileMap/A/content", value: 1 }],
        inversePatches: [{ op: "replace", path: "/content/tileMap/A/content", value: 0 }],
      },
      {
        patches: [{ op: "replace", path: "/content/sharedModelMap/S/value", value: "x" }],
        inversePatches: [{ op: "replace", path: "/content/sharedModelMap/S/value", value: "y" }],
      },
    ]);

    const scopes = getEntryScopeKeys(entry);
    expect(Array.from(scopes).sort()).toEqual(["shared:S", "tile:A"]);
  });

  it("includes doc scope when any patch targets document-level state", () => {
    const entry = makeEntry([{
      patches: [
        { op: "add", path: "/content/tileMap/newTile", value: { id: "newTile" } },
        { op: "add", path: "/content/rowMap/newTile", value: {} },
      ],
      inversePatches: [
        { op: "remove", path: "/content/tileMap/newTile" },
        { op: "remove", path: "/content/rowMap/newTile" },
      ],
    }]);

    const scopes = getEntryScopeKeys(entry);
    expect(Array.from(scopes).sort()).toEqual(["doc", "tile:newTile"]);
  });

  it("returns an empty set for an entry with no records", () => {
    const entry = makeEntry([]);
    expect(getEntryScopeKeys(entry).size).toBe(0);
  });

  it("collects scopes from both patches and inversePatches", () => {
    // A patch that adds to the tileMap has path /content/tileMap/<id>,
    // but its inverse (remove) has the same path. If an inverse patch
    // ever referred to a different path, we still need to see it.
    const entry = makeEntry([{
      patches: [{ op: "add", path: "/content/tileMap/A", value: {} }],
      inversePatches: [{ op: "remove", path: "/content/tileMap/B" }],
    }]);
    const scopes = getEntryScopeKeys(entry);
    expect(Array.from(scopes).sort()).toEqual(["tile:A", "tile:B"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/models/history/entry-scopes.test.ts`
Expected: FAIL — `getEntryScopeKeys is not a function` (and existing tests from Task 1 still PASS).

- [ ] **Step 3: Write implementation**

Add to `src/models/history/entry-scopes.ts`:

```typescript
import { HistoryEntrySnapshot } from "./history";

export function getEntryScopeKeys(entry: HistoryEntrySnapshot): Set<EntryScopeKey> {
  const scopes = new Set<EntryScopeKey>();
  const records = entry.records ?? [];
  for (const record of records) {
    const patches = record.patches ?? [];
    for (const patch of patches) {
      scopes.add(scopeKeyForPatchPath(patch.path));
    }
    const inversePatches = record.inversePatches ?? [];
    for (const patch of inversePatches) {
      scopes.add(scopeKeyForPatchPath(patch.path));
    }
  }
  return scopes;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/models/history/entry-scopes.test.ts`
Expected: PASS — all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/models/history/entry-scopes.ts src/models/history/entry-scopes.test.ts
git commit -m "CLUE-316 Add getEntryScopeKeys"
```

---

## Task 3: Add `scopeSetsConflict`

Return true iff two scope sets share at least one key.

**Files:**
- Modify: `src/models/history/entry-scopes.ts`
- Modify: `src/models/history/entry-scopes.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/models/history/entry-scopes.test.ts`:

1. Expand the `./entry-scopes` import to add `scopeSetsConflict`:

```typescript
import { getEntryScopeKeys, scopeKeyForPatchPath, scopeSetsConflict } from "./entry-scopes";
```

2. Append the following `describe` block at the bottom of the file:

```typescript
describe("scopeSetsConflict", () => {
  it("returns false for two disjoint sets", () => {
    const a = new Set(["tile:A"]);
    const b = new Set(["tile:B", "shared:S"]);
    expect(scopeSetsConflict(a, b)).toBe(false);
  });

  it("returns true when the sets share a tile scope", () => {
    const a = new Set(["tile:A", "doc"]);
    const b = new Set(["tile:A"]);
    expect(scopeSetsConflict(a, b)).toBe(true);
  });

  it("returns true when the sets share the doc scope", () => {
    const a = new Set(["tile:A", "doc"]);
    const b = new Set(["tile:B", "doc"]);
    expect(scopeSetsConflict(a, b)).toBe(true);
  });

  it("returns false when either set is empty", () => {
    expect(scopeSetsConflict(new Set(), new Set(["tile:A"]))).toBe(false);
    expect(scopeSetsConflict(new Set(["tile:A"]), new Set())).toBe(false);
    expect(scopeSetsConflict(new Set(), new Set())).toBe(false);
  });

  it("iterates the smaller set for efficiency", () => {
    // Behavioral check only: large and small sets with known overlap.
    const big = new Set(Array.from({ length: 1000 }, (_, i) => `tile:t${i}`));
    const small = new Set(["tile:t500"]);
    expect(scopeSetsConflict(big, small)).toBe(true);
    expect(scopeSetsConflict(small, big)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/models/history/entry-scopes.test.ts`
Expected: FAIL — `scopeSetsConflict is not a function` (earlier tests still PASS).

- [ ] **Step 3: Write implementation**

Add to `src/models/history/entry-scopes.ts`:

```typescript
export function scopeSetsConflict(
  a: Set<EntryScopeKey>,
  b: Set<EntryScopeKey>
): boolean {
  const [smaller, larger] = a.size <= b.size ? [a, b] : [b, a];
  for (const key of smaller) {
    if (larger.has(key)) return true;
  }
  return false;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/models/history/entry-scopes.test.ts`
Expected: PASS — all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/models/history/entry-scopes.ts src/models/history/entry-scopes.test.ts
git commit -m "CLUE-316 Add scopeSetsConflict"
```

---

## Task 4: Add `partitionLocalEntriesForMerge`

The core merge-decision primitive: given local uncommitted entries (oldest-first) and incoming remote entries, return how many local entries can be kept and how many must be rolled back.

**Files:**
- Modify: `src/models/history/entry-scopes.ts`
- Modify: `src/models/history/entry-scopes.test.ts`

- [ ] **Step 1: Write the failing tests**

In `src/models/history/entry-scopes.test.ts`:

1. Expand the `./entry-scopes` import to add `partitionLocalEntriesForMerge`:

```typescript
import {
  getEntryScopeKeys,
  partitionLocalEntriesForMerge,
  scopeKeyForPatchPath,
  scopeSetsConflict,
} from "./entry-scopes";
```

2. Append the following helpers and `describe` block at the bottom of the file (reusing `makeEntry` from Task 2):

```typescript
function entryOnTile(tileId: string): HistoryEntrySnapshot {
  return makeEntry([{
    patches: [{ op: "replace", path: `/content/tileMap/${tileId}/content/value`, value: 1 }],
    inversePatches: [{ op: "replace", path: `/content/tileMap/${tileId}/content/value`, value: 0 }],
  }]);
}

function entryOnDoc(): HistoryEntrySnapshot {
  return makeEntry([{
    patches: [{ op: "replace", path: "/content/rowMap/r1/height", value: 200 }],
    inversePatches: [{ op: "replace", path: "/content/rowMap/r1/height", value: 100 }],
  }]);
}

describe("partitionLocalEntriesForMerge", () => {
  it("keeps all local entries when scopes are fully disjoint", () => {
    const local = [entryOnTile("A"), entryOnTile("B")];
    const remote = [entryOnTile("C")];
    expect(partitionLocalEntriesForMerge(local, remote))
      .toEqual({ keepCount: 2, rollbackCount: 0 });
  });

  it("rolls back all local entries when the very first one conflicts", () => {
    const local = [entryOnTile("A"), entryOnTile("B")];
    const remote = [entryOnTile("A")];
    expect(partitionLocalEntriesForMerge(local, remote))
      .toEqual({ keepCount: 0, rollbackCount: 2 });
  });

  it("keeps entries before the first conflict and rolls back everything after", () => {
    // L1 tile A, L2 tile B, L3 tile A. Remote touches tile B.
    // L1 keeps (disjoint), L2 conflicts (tile B intersects), so
    // L2 and L3 roll back — even though L3 alone (tile A) wouldn't
    // conflict with remote.
    const local = [entryOnTile("A"), entryOnTile("B"), entryOnTile("A")];
    const remote = [entryOnTile("B")];
    expect(partitionLocalEntriesForMerge(local, remote))
      .toEqual({ keepCount: 1, rollbackCount: 2 });
  });

  it("unions scopes across all remote entries", () => {
    // Remote has two entries touching tile B and tile C respectively.
    // Local L1 on tile A is fine. L2 on tile C conflicts.
    const local = [entryOnTile("A"), entryOnTile("C")];
    const remote = [entryOnTile("B"), entryOnTile("C")];
    expect(partitionLocalEntriesForMerge(local, remote))
      .toEqual({ keepCount: 1, rollbackCount: 1 });
  });

  it("treats doc-scope overlap as a conflict", () => {
    const local = [entryOnDoc()];
    const remote = [entryOnDoc()];
    expect(partitionLocalEntriesForMerge(local, remote))
      .toEqual({ keepCount: 0, rollbackCount: 1 });
  });

  it("returns zero counts for empty local", () => {
    expect(partitionLocalEntriesForMerge([], [entryOnTile("A")]))
      .toEqual({ keepCount: 0, rollbackCount: 0 });
  });

  it("keeps all local when remote is empty (no conflict possible)", () => {
    const local = [entryOnTile("A"), entryOnTile("B")];
    expect(partitionLocalEntriesForMerge(local, []))
      .toEqual({ keepCount: 2, rollbackCount: 0 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/models/history/entry-scopes.test.ts`
Expected: FAIL — `partitionLocalEntriesForMerge is not a function` (earlier tests still PASS).

- [ ] **Step 3: Write implementation**

Add to `src/models/history/entry-scopes.ts`:

```typescript
export function partitionLocalEntriesForMerge(
  localEntries: HistoryEntrySnapshot[],
  remoteEntries: HistoryEntrySnapshot[]
): { keepCount: number; rollbackCount: number } {
  const remoteScopes = new Set<EntryScopeKey>();
  for (const entry of remoteEntries) {
    for (const key of getEntryScopeKeys(entry)) {
      remoteScopes.add(key);
    }
  }

  for (let i = 0; i < localEntries.length; i++) {
    const localScopes = getEntryScopeKeys(localEntries[i]);
    if (scopeSetsConflict(localScopes, remoteScopes)) {
      return { keepCount: i, rollbackCount: localEntries.length - i };
    }
  }
  return { keepCount: localEntries.length, rollbackCount: 0 };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/models/history/entry-scopes.test.ts`
Expected: PASS — all tests pass.

- [ ] **Step 5: Typecheck and lint**

Run: `npm run check:types`
Expected: no errors.
Run: `npm run lint -- src/models/history/entry-scopes.ts src/models/history/entry-scopes.test.ts`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/models/history/entry-scopes.ts src/models/history/entry-scopes.test.ts
git commit -m "CLUE-316 Add partitionLocalEntriesForMerge"
```

---

## Task 5: Integrate `partitionLocalEntriesForMerge` into `detectAndResolveFork`

Replace the current "always roll back all local entries" body with a scope-based partial rollback. Existing behavior is preserved for conflicts (two same-scope entries still fully roll back); new behavior emerges when scopes are disjoint.

**Files:**
- Modify: `src/models/history/firestore-history-manager-concurrent.ts` (function `detectAndResolveFork`, lines 424–443)
- Modify: `src/models/history/firestore-history-manager-concurrent.test.ts` (add fixture + new test)

- [ ] **Step 1: Add the `DocMergeTestTree` fixture**

At the top of `src/models/history/firestore-history-manager-concurrent.test.ts`, add after the existing `ArrayTestTree` definition (around line 64):

```typescript
// A second test tree that matches the shape CLUE's document-content
// uses, so we can drive patches with paths like
// /content/tileMap/<id>/content/value and exercise the scope-based
// merge logic in detectAndResolveFork. ArrayTestTree stays in place
// for the earlier tests that predate the merge work.
const DocMergeTile = types.model("DocMergeTile", {
  id: types.identifier,
  content: types.model({
    value: types.optional(types.string, "initial"),
  }),
});
const DocMergeShared = types.model("DocMergeShared", {
  id: types.identifier,
  value: types.optional(types.string, "initial"),
});
const DocMergeTestTree = types.model("DocMergeTestTree", {
  key: types.string,
  uid: types.string,
  content: types.model({
    tileMap: types.map(DocMergeTile),
    sharedModelMap: types.map(DocMergeShared),
    docName: types.optional(types.string, ""),
  }),
})
.volatile(self => ({
  applyingManagerPatches: false,
  metadata: {} as any,
}))
.views(self => ({
  get treeId(): string { return self.key; },
}))
.actions(self => ({
  startApplyingPatchesFromManager(_h: string, _e: string) {
    self.applyingManagerPatches = true;
    return Promise.resolve();
  },
  applyPatchesFromManager(_h: string, _e: string, patchesToApply: readonly IJsonPatch[]) {
    applyPatch(self, patchesToApply as IJsonPatch[]);
    return Promise.resolve();
  },
  finishApplyingPatchesFromManager(_h: string, _e: string) {
    self.applyingManagerPatches = false;
    return Promise.resolve();
  },
  applySharedModelSnapshotFromManager(_h: string, _e: string, _s: any) {
    return Promise.resolve();
  },
}));

async function setupDocMergeManager(firestoreOpts: FirestoreMockOptions = {}) {
  const treeId = "main";
  const manager = TreeManager.create({ document: {}, undoStore: {} });
  const tree = DocMergeTestTree.create({
    key: treeId,
    uid: "test-user",
    content: { tileMap: {}, sharedModelMap: {}, docName: "" },
  });
  manager.setMainDocument(tree as any);
  const { firestore, capture } = makeFirestoreMock(firestoreOpts);
  const historyManager = new FirestoreHistoryManagerConcurrent({
    firestore,
    userContextProvider: makeUserContextProviderMock(),
    treeManager: manager,
    uploadLocalHistory: true,
    syncRemoteHistory: false,
  });
  await historyManager.environmentAndMetadataDocReadyPromise;
  await historyManager.getInitialLastHistoryEntry();
  return { manager, tree, historyManager, treeId, firestoreCapture: capture };
}
```

- [ ] **Step 2: Write a failing test for disjoint-scope merge**

Still in `src/models/history/firestore-history-manager-concurrent.test.ts`, add a new `describe` block below the existing `describe("applyHistoryEntries — receive-side fork", ...)`:

```typescript
describe("applyHistoryEntries — receive-side merge", () => {
  it("keeps a local entry when its scope is disjoint from the incoming remote entry's scope", async () => {
    // Seed expectedRemoteHead to "r0".
    getLastHistoryEntry.mockResolvedValue({ id: "r0", index: 0 });
    const { manager, tree, historyManager } = await setupDocMergeManager();
    expect(historyManager.expectedRemoteHead).toBe("r0");

    // Prepare the tree with tiles A and B (these were presumed to
    // exist at the fork point "r0").
    applyPatch(tree, [
      { op: "add", path: "/content/tileMap/A", value: { id: "A", content: { value: "initial" } } },
      { op: "add", path: "/content/tileMap/B", value: { id: "B", content: { value: "initial" } } },
    ]);

    // Local entry L1: user A set tile A's value to "alpha".
    const l1Patches: IJsonPatch[] = [{ op: "replace", path: "/content/tileMap/A/content/value", value: "alpha" }];
    const l1Inverse: IJsonPatch[] = [{ op: "replace", path: "/content/tileMap/A/content/value", value: "initial" }];
    applyPatch(tree, l1Patches);
    const l1Snapshot = makeEntrySnapshot("L1", "main", l1Patches, l1Inverse);
    const l1Entry = HistoryEntry.create(l1Snapshot);
    manager.addHistoryEntryAfterApplying(l1Entry);
    historyManager.completedHistoryEntryQueue.push(l1Entry);

    expect(tree.content.tileMap.get("A")?.content.value).toBe("alpha");

    // Remote entry R1 from user B: set tile B's value to "beta".
    // previousEntryId = "r0", which matches expectedRemoteHead but
    // NOT our local head (L1) — forked.
    const r1Patches: IJsonPatch[] = [{ op: "replace", path: "/content/tileMap/B/content/value", value: "beta" }];
    const r1Inverse: IJsonPatch[] = [{ op: "replace", path: "/content/tileMap/B/content/value", value: "initial" }];
    const r1Snapshot = makeEntrySnapshot("R1", "main", r1Patches, r1Inverse);
    const r1wrap = makeWrapperDoc(1, "r0", r1Snapshot);

    await historyManager.applyHistoryEntries([r1wrap]);

    // Post-merge expectations:
    // 1. L1 NOT rolled back — tile A still holds "alpha".
    // 2. R1 applied on top — tile B now holds "beta".
    // 3. Local history order preserved: L1 stays in place, R1
    //    appended after it (spec section "History ordering").
    // 4. L1 remains in the upload queue — it still needs to be
    //    committed, now chaining off R1.
    // 5. expectedRemoteHead advanced to R1.
    expect(tree.content.tileMap.get("A")?.content.value).toBe("alpha");
    expect(tree.content.tileMap.get("B")?.content.value).toBe("beta");
    expect(manager.document.history.map(e => e.id)).toEqual(["L1", "R1"]);
    expect(historyManager.completedHistoryEntryQueue.map(e => e.id)).toEqual(["L1"]);
    expect(historyManager.expectedRemoteHead).toBe("R1");
  });
});
```

- [ ] **Step 3: Run the new test to verify it fails**

Run: `npm test -- src/models/history/firestore-history-manager-concurrent.test.ts -t "keeps a local entry when its scope is disjoint"`
Expected: FAIL — under current behavior L1 is rolled back, so `tree.content.tileMap.get("A")?.content.value` is `"initial"` rather than `"alpha"`, and `manager.document.history.map(e => e.id)` is `["R1"]` rather than `["L1", "R1"]`.

- [ ] **Step 4: Refactor `detectAndResolveFork` to use the partition function**

In `src/models/history/firestore-history-manager-concurrent.ts`:

Near the top with the other imports, add:

```typescript
import { partitionLocalEntriesForMerge } from "./entry-scopes";
```

And add to the existing MST import (which already has `getSnapshot`):

*Check the existing `import { getSnapshot, Instance, IJsonPatch } from "mobx-state-tree";` — no new imports needed from MST since `getSnapshot` is already imported.*

Replace the body of `detectAndResolveFork` (lines 424–443) with:

```typescript
  async detectAndResolveFork(newWrapperDocs: IFirestoreHistoryEntryDoc[]): Promise<void> {
    if (newWrapperDocs.length === 0) return;

    const history = this.treeManager.document.history;
    const localHeadId = history.length > 0 ? history[history.length - 1].id : null;
    const firstIncomingPrev = newWrapperDocs[0].previousEntryId ?? null;

    if (firstIncomingPrev === localHeadId) {
      // Not forked — the incoming stream continues from our head.
      return;
    }

    // Forked. Everything after expectedRemoteHead in our local
    // history is local-uncommitted. Decide which of those entries
    // can be kept alongside the incoming remote entries based on
    // scope disjointness, and which must be rolled back.
    const headIndex = this.expectedRemoteHead
      ? history.findIndex(e => e.id === this.expectedRemoteHead)
      : -1;
    const localUncommitted = history.slice(headIndex + 1);
    const localSnapshots = localUncommitted.map(e => getSnapshot(e));
    const incomingSnapshots = newWrapperDocs.map(w => w.entry);

    const { rollbackCount } =
      partitionLocalEntriesForMerge(localSnapshots, incomingSnapshots);

    if (rollbackCount > 0) {
      await this.rollbackLocalEntries(rollbackCount);
    }
  }
```

- [ ] **Step 5: Run the new test and all existing tests to verify they pass**

Run: `npm test -- src/models/history/firestore-history-manager-concurrent.test.ts`
Expected: PASS — the new disjoint-scope test passes, and all existing tests (including the full-rollback test at line 229) still pass because patches with `/items/...` paths map to `doc` scope on both sides, which still conflicts and produces the same full-rollback behavior.

- [ ] **Step 6: Typecheck**

Run: `npm run check:types`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/models/history/firestore-history-manager-concurrent.ts \
        src/models/history/firestore-history-manager-concurrent.test.ts
git commit -m "CLUE-316 Use partitionLocalEntriesForMerge in detectAndResolveFork"
```

---

## Task 6: Re-trigger upload after a successful merge

After partial merge, the upload queue still contains surviving local entries — but no code path re-triggers `uploadQueuedHistoryEntries`. Add that retrigger at the end of `doApplyHistoryEntries`, and add a test that exercises the send-side recovery path.

**Files:**
- Modify: `src/models/history/firestore-history-manager-concurrent.ts` (end of `doApplyHistoryEntries`, around line 573)
- Modify: `src/models/history/firestore-history-manager-concurrent.test.ts`

- [ ] **Step 1: Write a failing test for send-side recovery via merge**

Add to `src/models/history/firestore-history-manager-concurrent.test.ts` in the existing `describe("applyHistoryEntries — receive-side merge", ...)` block (or a new `describe("applyHistoryEntries — send-side recovery via merge", ...)`):

```typescript
describe("applyHistoryEntries — upload retrigger after merge", () => {
  it("uploads the surviving local entry with the new remote head as previousEntryId", async () => {
    getLastHistoryEntry.mockResolvedValue({ id: "r0", index: 0 });
    const { manager, tree, historyManager, firestoreCapture } = await setupDocMergeManager({
      // The transaction sees R1 as the head, matching expectedRemoteHead
      // after the merge advances it.
      txMetadataLastHistoryEntry: { id: "R1", index: 1 },
    });

    applyPatch(tree, [
      { op: "add", path: "/content/tileMap/A", value: { id: "A", content: { value: "initial" } } },
      { op: "add", path: "/content/tileMap/B", value: { id: "B", content: { value: "initial" } } },
    ]);

    // Queue local L1 on tile A.
    const l1Patches: IJsonPatch[] = [{ op: "replace", path: "/content/tileMap/A/content/value", value: "alpha" }];
    const l1Inverse: IJsonPatch[] = [{ op: "replace", path: "/content/tileMap/A/content/value", value: "initial" }];
    applyPatch(tree, l1Patches);
    const l1Snapshot = makeEntrySnapshot("L1", "main", l1Patches, l1Inverse);
    const l1Entry = HistoryEntry.create(l1Snapshot);
    manager.addHistoryEntryAfterApplying(l1Entry);
    historyManager.completedHistoryEntryQueue.push(l1Entry);

    // Make environmentAndMetadataDocReadyPromise resolve immediately
    // so the transaction body actually runs inside the retrigger.
    historyManager.environmentAndMetadataDocReadyPromise = Promise.resolve();

    // Incoming R1 on tile B, forked off "r0".
    const r1Snapshot = makeEntrySnapshot(
      "R1", "main",
      [{ op: "replace", path: "/content/tileMap/B/content/value", value: "beta" }],
      [{ op: "replace", path: "/content/tileMap/B/content/value", value: "initial" }],
    );
    const r1wrap = makeWrapperDoc(1, "r0", r1Snapshot);

    await historyManager.applyHistoryEntries([r1wrap]);
    // Flush microtasks so the retriggered upload can run.
    for (let i = 0; i < 10; i++) await Promise.resolve();

    // L1 was uploaded by the retrigger:
    // - its transaction.set call carries previousEntryId = "R1"
    // - completedHistoryEntryQueue is drained
    // - expectedRemoteHead is now L1
    expect(firestoreCapture.transactionSetCalls.length).toBe(1);
    expect(firestoreCapture.transactionSetCalls[0].data.previousEntryId).toBe("R1");
    expect(historyManager.completedHistoryEntryQueue.map(e => e.id)).toEqual([]);
    expect(historyManager.expectedRemoteHead).toBe("L1");
  });
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run: `npm test -- src/models/history/firestore-history-manager-concurrent.test.ts -t "uploads the surviving local entry"`
Expected: FAIL — no transaction.set calls are made because nothing retriggers the upload after the merge. `firestoreCapture.transactionSetCalls.length` is `0`.

- [ ] **Step 3: Add the upload retrigger**

In `src/models/history/firestore-history-manager-concurrent.ts`, at the very end of the `doApplyHistoryEntries` method (after line 573, after the `setExpectedRemoteHead` call), add:

```typescript
    // If any local entries survived as uncommitted queue items, they
    // now need to be re-uploaded with the newly advanced remote head
    // as their previousEntryId. Full-rollback cases cleared the
    // queue, so this is a no-op in the non-merge path.
    if (this.completedHistoryEntryQueue.length > 0) {
      this.uploadQueuedHistoryEntries();
    }
```

- [ ] **Step 4: Run the new test and all existing tests to verify they pass**

Run: `npm test -- src/models/history/firestore-history-manager-concurrent.test.ts`
Expected: PASS — all tests, including the new retrigger test.

- [ ] **Step 5: Typecheck**

Run: `npm run check:types`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/models/history/firestore-history-manager-concurrent.ts \
        src/models/history/firestore-history-manager-concurrent.test.ts
git commit -m "CLUE-316 Retrigger upload after merge so surviving local entries commit"
```

---

## Task 7: Add integration tests for partial merge and `doc`-scope conflict

The core merge behavior is already covered by Task 5. Add two more tests: one verifying that a conflict at entry N in the middle of the local queue rolls back N and everything after, and one verifying that a `doc`-scope conflict falls back to full rollback (i.e., the old GD-6 behavior is preserved when scopes do overlap).

**Files:**
- Modify: `src/models/history/firestore-history-manager-concurrent.test.ts`

- [ ] **Step 1: Write the partial-merge test**

Add inside `describe("applyHistoryEntries — receive-side merge", ...)`:

```typescript
it("rolls back from the first conflicting local entry onward, keeping earlier ones", async () => {
  getLastHistoryEntry.mockResolvedValue({ id: "r0", index: 0 });
  const { manager, tree, historyManager } = await setupDocMergeManager();

  applyPatch(tree, [
    { op: "add", path: "/content/tileMap/A", value: { id: "A", content: { value: "initial" } } },
    { op: "add", path: "/content/tileMap/B", value: { id: "B", content: { value: "initial" } } },
  ]);

  // L1: tile A ("alpha"). L2: tile B ("beta-local"). L3: tile A ("alpha2").
  // Remote R1: tile B. Expectation: keep L1; roll back L2 and L3.
  const mkEntry = (id: string, tileId: string, value: string, prevValue: string) => {
    const patches: IJsonPatch[] = [{ op: "replace", path: `/content/tileMap/${tileId}/content/value`, value }];
    const inverse: IJsonPatch[] = [{ op: "replace", path: `/content/tileMap/${tileId}/content/value`, value: prevValue }];
    applyPatch(tree, patches);
    const snapshot = makeEntrySnapshot(id, "main", patches, inverse);
    const entry = HistoryEntry.create(snapshot);
    manager.addHistoryEntryAfterApplying(entry);
    historyManager.completedHistoryEntryQueue.push(entry);
    return entry;
  };

  mkEntry("L1", "A", "alpha", "initial");
  mkEntry("L2", "B", "beta-local", "initial");
  mkEntry("L3", "A", "alpha2", "alpha");

  expect(tree.content.tileMap.get("A")?.content.value).toBe("alpha2");
  expect(tree.content.tileMap.get("B")?.content.value).toBe("beta-local");

  const r1Snapshot = makeEntrySnapshot(
    "R1", "main",
    [{ op: "replace", path: "/content/tileMap/B/content/value", value: "beta-remote" }],
    [{ op: "replace", path: "/content/tileMap/B/content/value", value: "initial" }],
  );
  const r1wrap = makeWrapperDoc(1, "r0", r1Snapshot);

  await historyManager.applyHistoryEntries([r1wrap]);

  // L1 kept: tile A reverts to "alpha" (since L3 was rolled back).
  // L2 and L3 rolled back: tile B goes to "initial", then R1 sets it
  // to "beta-remote".
  expect(tree.content.tileMap.get("A")?.content.value).toBe("alpha");
  expect(tree.content.tileMap.get("B")?.content.value).toBe("beta-remote");
  expect(manager.document.history.map(e => e.id)).toEqual(["L1", "R1"]);
  expect(historyManager.completedHistoryEntryQueue.map(e => e.id)).toEqual(["L1"]);
  expect(historyManager.expectedRemoteHead).toBe("R1");
});
```

- [ ] **Step 2: Write the doc-scope-conflict test**

Add inside the same `describe`:

```typescript
it("falls back to full rollback when local and remote both touch the doc scope", async () => {
  getLastHistoryEntry.mockResolvedValue({ id: "r0", index: 0 });
  const { manager, tree, historyManager } = await setupDocMergeManager();

  // Local entry L1 touches document-level state (docName).
  const l1Patches: IJsonPatch[] = [{ op: "replace", path: "/content/docName", value: "local-name" }];
  const l1Inverse: IJsonPatch[] = [{ op: "replace", path: "/content/docName", value: "" }];
  applyPatch(tree, l1Patches);
  const l1Snapshot = makeEntrySnapshot("L1", "main", l1Patches, l1Inverse);
  const l1Entry = HistoryEntry.create(l1Snapshot);
  manager.addHistoryEntryAfterApplying(l1Entry);
  historyManager.completedHistoryEntryQueue.push(l1Entry);

  // Remote R1 also touches doc-level state (different field still
  // maps to doc scope).
  const r1Snapshot = makeEntrySnapshot(
    "R1", "main",
    [{ op: "replace", path: "/content/docName", value: "remote-name" }],
    [{ op: "replace", path: "/content/docName", value: "" }],
  );
  const r1wrap = makeWrapperDoc(1, "r0", r1Snapshot);

  await historyManager.applyHistoryEntries([r1wrap]);

  // L1 rolled back; R1 applied.
  expect(tree.content.docName).toBe("remote-name");
  expect(manager.document.history.map(e => e.id)).toEqual(["R1"]);
  expect(historyManager.completedHistoryEntryQueue.map(e => e.id)).toEqual([]);
  expect(historyManager.expectedRemoteHead).toBe("R1");
});
```

- [ ] **Step 3: Run all tests in the file to verify they pass**

Run: `npm test -- src/models/history/firestore-history-manager-concurrent.test.ts`
Expected: PASS — all tests including the two new ones.

- [ ] **Step 4: Lint**

Run: `npm run lint -- src/models/history/firestore-history-manager-concurrent.test.ts`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/models/history/firestore-history-manager-concurrent.test.ts
git commit -m "CLUE-316 Add tests for partial merge and doc-scope conflict"
```

---

## Task 8: Write the manual reproduction scripts doc

These are pause/resume scripts the team can run against the history-view debug panel to observe whether each of the inconsistency-risk cases from the spec produces visible misbehavior in practice.

**Files:**
- Create: `docs/group-docs/clue-316-manual-test-scripts.md`

- [ ] **Step 1: Create the doc**

Create `docs/group-docs/clue-316-manual-test-scripts.md` with the following content:

```markdown
# CLUE-316 Manual Test Scripts

Pause/resume scripts to exercise the inconsistency-risk cases documented in
`docs/superpowers/specs/2026-04-22-merge-independent-forks-design.md`. All scripts
use two CLUE clients (two browser profiles or two incognito windows) opened to the
same group document, and the pause/resume upload controls in the history-view debug
panel (GD-3).

For each script, "expected outcome" describes what the scope-based merge *should*
produce. "Bad-state signal" describes what misbehavior would look like if the
merged state is inconsistent — this is what we're watching for.

## 1. Cross-scope reference drift (drawing → variable)

**Setup:** Group document with a drawing tile and a text tile that share variables
(shared variables shared model). Text tile has a variable V1. Drawing tile is empty.

**Script:**
1. Pause user A's uploads.
2. User A: in the drawing tile, insert a reference to variable V1.
3. User B: in the text tile, delete variable V1.
4. Resume user A's uploads.

**Expected outcome (merge):** Drawing tile's reference addition is preserved (it
touches `tile:<drawing>`), text tile's variable deletion is preserved (it touches
`shared:<SharedVariables>` and `tile:<text>`). Scopes are disjoint.

**Bad-state signal:** Drawing tile throws when rendering (unresolved reference),
or shows an empty/placeholder variable that should not exist.

## 2. Cross-scope reference drift (graph → dataset attribute)

**Setup:** Group document with a table tile and a linked graph tile.

**Script:**
1. Pause user A's uploads.
2. User A: in the graph tile, assign a different attribute to the Y axis.
3. User B: in the table tile (or via the dataset), delete the attribute user A
   is about to target.
4. Resume user A's uploads.

**Expected outcome (merge):** Graph tile change and shared dataset change are on
disjoint scopes (`tile:<graph>` vs `shared:<dataset>`). Merge proceeds.

**Bad-state signal:** Graph throws an exception rendering an axis bound to a
missing attribute id, or silently draws nothing.

## 3. Schema-assumption drift (table column type)

**Setup:** Group document with a table tile; one column currently typed as number.

**Script:**
1. Pause user A's uploads.
2. User A: set a cell-level formatting or tile-level setting that assumes the
   numeric type.
3. User B: change the column's type to string in the shared dataset.
4. Resume user A's uploads.

**Expected outcome (merge):** Tile formatting change (`tile:<table>`) and dataset
type change (`shared:<dataset>`) are disjoint. Merge proceeds.

**Bad-state signal:** Table renders cells with the numeric formatting applied to
string values, or throws when formatting.

## 4. Computed-state drift (graph axis bounds vs dataset rows)

**Setup:** Group document with a table tile and a linked graph tile.

**Script:**
1. Pause user A's uploads.
2. User A: adjust the graph's axis bounds to fit the current dataset.
3. User B: add rows to the dataset that fall well outside those bounds.
4. Resume user A's uploads.

**Expected outcome (merge):** Graph tile change (`tile:<graph>`) and dataset row
change (`shared:<dataset>`) are disjoint. Merge proceeds.

**Bad-state signal:** Graph axis bounds clip new data points silently; this is
more of a "stale state" than a crash — note whether it confuses users rather than
breaks the app.

## 5. Stale shared-model snapshot in tile state (data card selection)

**Setup:** Group document with a data-card tile.

**Script:**
1. Pause user A's uploads.
2. User A: interact with the data card to change its selected case / pagination
   state (anything cached on the tile model, not in the shared dataset).
3. User B: delete or reorder cases in the shared dataset.
4. Resume user A's uploads.

**Expected outcome (merge):** Disjoint scopes, merge proceeds.

**Bad-state signal:** Data card shows a case that no longer exists, jumps to an
unexpected case, or throws when rendering the selection.

## Reporting

For each script, record in the PR or follow-up ticket:
- Did the bad-state signal appear?
- Is the resulting document recoverable by refreshing / reopening?
- Does the browser console show an exception?

Scripts where the bad-state signal appears are candidates for GD-10 or GD-11
follow-up work. Scripts where nothing bad happens in practice validate that the
scope-based merge is safe enough for this feature.
```

- [ ] **Step 2: Commit**

```bash
git add docs/group-docs/clue-316-manual-test-scripts.md
git commit -m "CLUE-316 Add manual test scripts for inconsistency-risk cases"
```

---

## Final verification

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all existing tests continue to pass along with the new ones.

- [ ] **Step 2: Typecheck and lint**

Run: `npm run check:types`
Expected: no errors.
Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Review the branch**

Run: `git log --oneline HEAD ^master` (or compare against the branch this was cut from)
Expected: one commit per task (8 new commits), each in the `CLUE-316 ...` style.

If all three checks pass, the feature is ready for PR. The PR description should
reference the design doc (`docs/superpowers/specs/2026-04-22-merge-independent-forks-design.md`)
and call out the "known theoretical error cases" section so reviewers know what's
intentionally not handled.
