import { getEntryScopeKeys, scopeKeyForPatchPath, scopeSetsConflict } from "./entry-scopes";
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
