import {
  getEntryScopeKeys,
  partitionLocalEntriesForMerge,
  scopeKeyForPatchPath,
  scopeSetsConflict,
} from "./entry-scopes";
import { HistoryEntrySnapshot } from "./history";
import { IJsonPatch } from "mobx-state-tree";

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
