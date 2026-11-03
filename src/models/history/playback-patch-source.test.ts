import { nanoid } from "nanoid";
import { cloneDeep } from "lodash";
import { IJsonPatch } from "mobx-state-tree";
import { ITileProps } from "src/components/tiles/tile-component";
import { TileContentModel } from "../tiles/tile-content";
import { registerTileComponentInfo } from "../tiles/tile-component-info";
import { registerTileContentInfo } from "../tiles/tile-content-info";
import { HistoryEntry, HistoryOperation } from "./history";
import { JsonHistoryCopy } from "./json-history-copy";
import {
  collectModelPaths, createOldModelPatchSource, defaultPatchSource, hasOldValue
} from "./playback-patch-source";
import { versionedTestTileSchema } from "./schema-conversion-test-types";

const PlainTestTile = TileContentModel.named("PlaybackTestTile").props({ type: "PlaybackTestTile" });
registerTileContentInfo({
  type: "PlaybackTestTile", modelClass: PlainTestTile, defaultContent: () => PlainTestTile.create()
});
registerTileComponentInfo({
  type: "PlaybackTestTile",
  Component: (() => { throw new Error("Component not implemented."); }) as React.FC<ITileProps>,
  tileEltClass: "playback-test-tile"
});

const kTreeId = "tree1";
const oldTile = (id: string, text = "hello") =>
  ({ id, content: { type: "VersionedTestTile", text, items: [{ value: "a" }] } });
const currentTile = (id: string) => ({ id, content: { type: "PlaybackTestTile" } });

type PatchSpec = Partial<IJsonPatch> & { path: string };
function makeEntry(patches: PatchSpec[], inversePatches: PatchSpec[] = [], isConversion = false) {
  const toPatches = (list: PatchSpec[]) => list.map(p => ({ op: "replace" as const, ...p }));
  return HistoryEntry.create({
    id: nanoid(), created: Date.now(), tree: kTreeId, model: "DocumentContent", action: "/test",
    undoable: true, isConversion, state: "complete", triggeringBatchIds: [],
    records: [{ tree: kTreeId, action: "/test", patches: toPatches(patches), inversePatches: toPatches(inversePatches) }]
  } as any);
}

const makeCopy = (content: object, position = 1) =>
  new JsonHistoryCopy(kTreeId, { content: cloneDeep(content) }, position);

describe("createOldModelPatchSource", () => {
  const t1Path = "/content/tileMap/t1";
  const t1Text = (value: string) => ({ path: `${t1Path}/content/text`, value });

  it("drops patches inside an old tile and keeps current tiles' patches in order", () => {
    const copy = makeCopy({ tileMap: { t1: oldTile("t1"), t2: currentTile("t2") } });
    const t2Flag = { path: "/content/tileMap/t2/content/flag", value: true };
    const entry = makeEntry([t1Text("a"), t2Flag, t1Text("b")]);
    const source = createOldModelPatchSource({ copy, treeId: kTreeId, oldPaths: new Set([t1Path]) });

    expect(source.getPatches(entry, kTreeId, HistoryOperation.Redo)).toEqual([{ op: "replace", ...t2Flag }]);
    const loads = source.getLoads(kTreeId);
    expect(loads).toHaveLength(1);
    expect(loads[0]).toMatchObject({ op: "replace", path: t1Path });
    expect((loads[0].value as any).content.version).toBe("2");
  });

  it("delegates other trees and conversion entries", () => {
    const copy = makeCopy({ tileMap: { t1: oldTile("t1") } });
    const entry = makeEntry([t1Text("a")]);
    const conversion = makeEntry([t1Text("a")], [], true);
    const source = createOldModelPatchSource({ copy, treeId: "other", oldPaths: new Set([t1Path]) });
    expect(source.getPatches(entry, kTreeId, HistoryOperation.Redo))
      .toEqual(defaultPatchSource.getPatches(entry, kTreeId, HistoryOperation.Redo));
    expect(source.getLoads(kTreeId)).toEqual([]);
    const ownSource = createOldModelPatchSource({ copy, treeId: kTreeId, oldPaths: new Set([t1Path]) });
    expect(ownSource.getPatches(conversion, kTreeId, HistoryOperation.Redo)).toEqual([]);
  });

  it("converts an add of a whole old tile using its state at the target", () => {
    const copy = makeCopy({ tileMap: { t1: oldTile("t1", "at target") } });
    const entry = makeEntry([{ op: "add", path: t1Path, value: oldTile("t1", "at add") }]);
    const source = createOldModelPatchSource({ copy, treeId: kTreeId, oldPaths: new Set([t1Path]) });

    const [add] = source.getPatches(entry, kTreeId, HistoryOperation.Redo);
    const [load] = source.getLoads(kTreeId);
    expect((add.value as any).content.label).toBe("at target");
    expect(add.value).toEqual(load.value);
    expect(add.value).toBe(load.value);
  });

  it("never shares nested objects with the JSON copy", () => {
    const shared = { ...oldTile("t1"), extra: { nested: { a: 1 } } };
    const copy = makeCopy({ tileMap: { t1: shared, t2: { id: "t2", extra: { nested: { a: 2 } }, content: {
      type: "VersionedTestTile", version: "2", label: "x", items: [] } } } });
    const source = createOldModelPatchSource({
      copy, treeId: kTreeId, oldPaths: new Set([t1Path, "/content/tileMap/t2"])
    });
    const loads = source.getLoads(kTreeId);
    loads.forEach(load => {
      const copyValue: any = copy.getJson(load.path);
      expect((load.value as any).extra.nested).toEqual(copyValue.extra.nested);
      expect((load.value as any).extra.nested).not.toBe(copyValue.extra.nested);
    });
  });

  it("keeps a remove of an old tile", () => {
    const copy = makeCopy({ tileMap: {} });
    const entry = makeEntry([{ op: "remove", path: t1Path }]);
    const source = createOldModelPatchSource({ copy, treeId: kTreeId, oldPaths: new Set([t1Path]) });
    expect(source.getPatches(entry, kTreeId, HistoryOperation.Redo)).toEqual([{ op: "remove", path: t1Path }]);
    expect(source.getLoads(kTreeId)).toEqual([]);
  });

  it("converts each old tile once per position", () => {
    const copy = makeCopy({ tileMap: { t1: oldTile("t1") } });
    const entry = makeEntry([{ op: "add", path: t1Path, value: oldTile("t1") }]);
    const source = createOldModelPatchSource({ copy, treeId: kTreeId, oldPaths: new Set([t1Path]) });
    const spy = jest.spyOn(versionedTestTileSchema, "convertSnapshot");
    try {
      source.getPatches(entry, kTreeId, HistoryOperation.Redo);
      source.getLoads(kTreeId);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it("converts old models inside an ancestor patch", () => {
    const sm = { id: "sm1", type: "VersionedTestSharedModel", val: "x" };
    const copy = makeCopy({ tileMap: {} });
    const oldPaths = new Set([t1Path, "/content/sharedModelMap/sm1/sharedModel"]);
    const source = createOldModelPatchSource({ copy, treeId: kTreeId, oldPaths });

    const replaceTileMap = makeEntry([{ path: "/content/tileMap", value: { t1: oldTile("t1") } }]);
    const [tileMapPatch] = source.getPatches(replaceTileMap, kTreeId, HistoryOperation.Redo);
    expect((tileMapPatch.value as any).t1.content.version).toBe("2");

    const addShared = makeEntry([{ op: "add", path: "/content/sharedModelMap/sm1", value: { sharedModel: sm, tiles: ["t1"] } }]);
    const [sharedPatch] = source.getPatches(addShared, kTreeId, HistoryOperation.Redo);
    expect((sharedPatch.value as any).sharedModel).toEqual(
      { id: "sm1", type: "VersionedTestSharedModel", version: "2", value: "x" });
    expect((sharedPatch.value as any).tiles).toEqual(["t1"]);
  });

  it("handles an old tile absent at both ends", () => {
    const t3Path = "/content/tileMap/t3";
    const copy = makeCopy({ tileMap: {} });
    const entries = [
      makeEntry([{ op: "add", path: t3Path, value: oldTile("t3") }], [{ op: "remove", path: t3Path }]),
      makeEntry([{ op: "remove", path: t3Path }], [{ op: "add", path: t3Path, value: oldTile("t3") }])
    ];
    const source = createOldModelPatchSource({ copy, treeId: kTreeId, oldPaths: new Set([t3Path]) });

    const [add] = source.getPatches(entries[0], kTreeId, HistoryOperation.Redo);
    expect((add.value as any).content.version).toBe("2");
    expect(source.getPatches(entries[1], kTreeId, HistoryOperation.Redo)).toEqual([{ op: "remove", path: t3Path }]);
    expect(source.getLoads(kTreeId)).toEqual([]);
  });

  it("treats an unregistered tile type as current", () => {
    const unknown = { id: "u1", content: { type: "NoSuchTile" } };
    const copy = makeCopy({ tileMap: { u1: unknown } });
    const entry = makeEntry([{ path: "/content/tileMap/u1/content/x", value: 1 }]);
    const entries = [entry];
    const oldPaths = new Set<string>();
    [...collectModelPaths(entries, kTreeId)].forEach(path => {
      if (hasOldValue(entries, kTreeId, path)) oldPaths.add(path);
    });
    expect(oldPaths.size).toBe(0);
    const source = createOldModelPatchSource({ copy, treeId: kTreeId, oldPaths });
    expect(source.getPatches(entry, kTreeId, HistoryOperation.Redo)).toHaveLength(1);
    expect(source.getLoads(kTreeId)).toEqual([]);
  });
});

describe("collectModelPaths", () => {
  it("finds tiles inside ancestor patch values", () => {
    const entries = [
      makeEntry([{ path: "/content/tileMap/t0/content/flag", value: true }]),
      makeEntry([{ path: "/content/tileMap", value: { t1: oldTile("t1") } }]),
      makeEntry([], [{ op: "add", path: "/content", value: {
        tileMap: { t2: currentTile("t2") },
        sharedModelMap: { sm1: { sharedModel: { id: "sm1", type: "VersionedTestSharedModel" }, tiles: [] } }
      } }]),
      makeEntry([{ path: "/content/rowMap/r1/height", value: 3 }])
    ];
    expect([...collectModelPaths(entries, kTreeId)].sort()).toEqual([
      "/content/sharedModelMap/sm1/sharedModel", "/content/tileMap/t0", "/content/tileMap/t1", "/content/tileMap/t2"
    ]);
  });
});

describe("hasOldValue", () => {
  it("detects an old add value", () => {
    const t1Path = "/content/tileMap/t1";
    const oldAdd = [makeEntry([{ op: "add", path: t1Path, value: oldTile("t1") }])];
    const currentAdd = [makeEntry([{ op: "add", path: t1Path, value: currentTile("t1") }])];
    const oldInTileMap = [makeEntry([{ path: "/content/tileMap", value: { t1: oldTile("t1") } }])];
    expect(hasOldValue(oldAdd, kTreeId, t1Path)).toBe(true);
    expect(hasOldValue(oldInTileMap, kTreeId, t1Path)).toBe(true);
    expect(hasOldValue(currentAdd, kTreeId, t1Path)).toBe(false);
    expect(hasOldValue(oldAdd, kTreeId, "/content/tileMap/t9")).toBe(false);
  });
});
