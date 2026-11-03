import { nanoid } from "nanoid";
import { cloneDeep } from "lodash";
import { getSnapshot, Instance, types } from "mobx-state-tree";
import { ITileProps } from "src/components/tiles/tile-component";
import { TileContentModel } from "../tiles/tile-content";
import { registerTileComponentInfo } from "../tiles/tile-component-info";
import { registerTileContentInfo } from "../tiles/tile-content-info";
import { DocumentContentModel } from "../document/document-content";
import { createDocumentModel } from "../document/document";
import { ProblemDocument } from "../document/document-types";
import { CDocument, TreeManager } from "./tree-manager";
import { HistoryEntry, HistoryEntrySnapshot } from "./history";
import { JsonHistoryCopy } from "./json-history-copy";
import { toJsonValue } from "./json-patch";
import { buildConversionEntry } from "./schema-conversion";

const TestTile = TileContentModel
  .named("TestTile")
  .props({
    type: "TestTile",
    flag: types.maybe(types.boolean),
    actionText: types.maybe(types.string)
  })
  .actions(self => ({
    setFlag(flag: boolean) { self.flag = flag; },
    setActionText(value: string) { self.actionText = value; }
  }));

registerTileContentInfo({
  type: "TestTile",
  modelClass: TestTile,
  defaultContent() { return TestTile.create(); }
});
registerTileComponentInfo({
  type: "TestTile",
  Component: (() => { throw new Error("Component not implemented."); }) as React.FC<ITileProps>,
  tileEltClass: "test-tile"
});

const kTreeId = "test";
const kPrefix = "/content/tileMap/t1/content";

function makeEntry(
  patches: { path: string; value: unknown }[], inversePatches: { path: string; value: unknown }[]
): HistoryEntrySnapshot {
  const toPatches = (list: { path: string; value: unknown }[]) =>
    list.map(({ path, value }) => ({ op: "replace" as const, path, value }));
  return {
    id: nanoid(), created: Date.now(), tree: kTreeId, model: "TestTile", action: `${kPrefix}/setActionText`,
    undoable: true, state: "complete", triggeringBatchIds: [],
    records: [{
      tree: kTreeId, action: `${kPrefix}/setActionText`,
      patches: toPatches(patches), inversePatches: toPatches(inversePatches)
    }]
  };
}

const setFlagEntry = () => makeEntry(
  [{ path: `${kPrefix}/flag`, value: true }], [{ path: `${kPrefix}/flag`, value: undefined }]);
const setTextEntry = (from: string | undefined, to: string) => makeEntry(
  [{ path: `${kPrefix}/actionText`, value: to }], [{ path: `${kPrefix}/actionText`, value: from }]);

function setupDocument() {
  const docContent = DocumentContentModel.create({
    tileMap: { t1: { id: "t1", content: { type: "TestTile" } } }
  } as any);
  const docModel = createDocumentModel({
    uid: "1", type: ProblemDocument, key: kTreeId, content: docContent as any
  });
  docModel.treeMonitor!.enableMonitoring();
  const tileContent = docContent.tileMap.get("t1")!.content as Instance<typeof TestTile>;
  const manager = docModel.treeManagerAPI as Instance<typeof TreeManager>;
  return { docModel, tileContent, manager };
}

describe("JsonHistoryCopy", () => {
  it("matches MST replay", async () => {
    const { docModel, tileContent, manager } = setupDocument();
    const snapshots = [
      setFlagEntry(), setTextEntry(undefined, "action 1"), setTextEntry("action 1", "action 2"),
      setTextEntry("action 2", "action 3"), setTextEntry("action 3", "action 4")
    ];
    const history = snapshots.map(snapshot => HistoryEntry.create(cloneDeep(snapshot)));
    manager.setChangeDocument(CDocument.create({ history: snapshots }));
    await manager.replayHistoryToTrees();
    manager.setNumHistoryEntriesApplied(5);

    const copy = new JsonHistoryCopy(kTreeId, toJsonValue(getSnapshot(docModel)) as object, 5);
    for (const target of [3, 0, 5, 2]) {
      const result = copy.moveTo(history, target);
      await manager.goToHistoryEntryPosition(target);
      expect(result).toEqual({ position: target });
      expect(copy.position).toBe(target);
      expect(copy.getJson(`${kPrefix}`)).toEqual(toJsonValue(getSnapshot(tileContent)));
    }
  });

  describe("with an entry that doesn't apply", () => {
    // Redo fails on its first patch. Undo applies the flag patch, then fails on the second.
    const badEntry = () => HistoryEntry.create(makeEntry(
      [{ path: "/content/tileMap/NOPE/x", value: 1 }, { path: `${kPrefix}/flag`, value: true }],
      [{ path: "/content/tileMap/NOPE/x", value: 0 }, { path: `${kPrefix}/flag`, value: undefined }]
    ));
    const startJson = () => ({
      content: { tileMap: { t1: { id: "t1", content: { type: "TestTile", flag: true, actionText: "two" } } } }
    });

    it("stops before an entry that doesn't apply, leaving it unapplied", () => {
      const history = [
        HistoryEntry.create(setTextEntry(undefined, "one")), badEntry(),
        HistoryEntry.create(setTextEntry("one", "two"))
      ];
      const copy = new JsonHistoryCopy(kTreeId, startJson(), 3);
      const result = copy.moveTo(history, 0);
      expect(result.position).toBe(2);
      expect(result.failure).toEqual({ historyIndex: 1, direction: "undo", message: expect.any(String) });
      expect(copy.position).toBe(2);
      // action2 was undone, and the partly applied bad entry was rolled back
      const expected = startJson();
      (expected.content.tileMap.t1.content as any).actionText = "one";
      expect(copy.getJson("")).toEqual(expected);
    });

    it("stops going forward at the failing entry", () => {
      const history = [HistoryEntry.create(setTextEntry(undefined, "one")), badEntry()];
      const start = startJson();
      (start.content.tileMap.t1.content as any).actionText = "one";
      const copy = new JsonHistoryCopy(kTreeId, cloneDeep(start), 1);
      const result = copy.moveTo(history, 2);
      expect(result.position).toBe(1);
      expect(result.failure).toEqual({ historyIndex: 1, direction: "redo", message: expect.any(String) });
      expect(copy.getJson("")).toEqual(start);
    });
  });

  it("applies conversion entries in both directions", () => {
    const before = { type: "VersionedTestTile", text: "c" };
    const after = { type: "VersionedTestTile", version: "2", label: "c" };
    const entry = HistoryEntry.create(buildConversionEntry(kTreeId, [
      { path: "/content/tileMap/t1/content", before, after }
    ]));
    const copy = new JsonHistoryCopy(
      kTreeId, { content: { tileMap: { t1: { id: "t1", content: cloneDeep(after) } } } }, 1);

    expect(copy.moveTo([entry], 0)).toEqual({ position: 0 });
    expect(copy.getJson("/content/tileMap/t1/content")).toEqual(before);
    expect(copy.moveTo([entry], 1)).toEqual({ position: 1 });
    expect(copy.getJson("/content/tileMap/t1/content")).toEqual(after);
  });

  describe("with a virtual conversion", () => {
    const t1Path = "/content/tileMap/t1";
    // Two v1 entries, then a conversion history never recorded at position 2, then a v2 entry.
    const history = () => [
      HistoryEntry.create(makeEntry(
        [{ path: `${kPrefix}/text`, value: "b" }], [{ path: `${kPrefix}/text`, value: "a" }])),
      HistoryEntry.create(makeEntry(
        [{ path: `${kPrefix}/text`, value: "c" }], [{ path: `${kPrefix}/text`, value: "b" }])),
      HistoryEntry.create(makeEntry(
        [{ path: `${kPrefix}/label`, value: "d" }], [{ path: `${kPrefix}/label`, value: "c" }]))
    ];
    const v1Tile = (text: string) => ({ id: "t1", content: { type: "VersionedTestTile", text } });
    const endJson = () => ({
      content: { tileMap: { t1: { id: "t1", content: { type: "VersionedTestTile", version: "2", label: "d" } } } }
    });

    it("applies a virtual conversion's inverse when crossing it backward and its forward patches " +
        "when crossing it forward", () => {
      const entries = history();
      const copy = new JsonHistoryCopy(kTreeId, endJson(), 3);
      copy.setVirtualConversions([{ path: t1Path, position: 2, oldJson: v1Tile("c") }]);
      expect(copy.oldestReachablePosition).toBe(0);

      expect(copy.moveTo(entries, 0)).toEqual({ position: 0 });
      expect(copy.getJson(t1Path)).toEqual(v1Tile("a"));
      expect(copy.moveTo(entries, 1)).toEqual({ position: 1 });
      expect(copy.getJson(t1Path)).toEqual(v1Tile("b"));

      // Handing over the same conversion again keeps the patches computed for it.
      copy.setVirtualConversions([{ path: t1Path, position: 2, oldJson: v1Tile("c") }]);
      expect(copy.moveTo(entries, 2)).toEqual({ position: 2 });
      expect(copy.getJson(t1Path)).toEqual(
        { id: "t1", content: { type: "VersionedTestTile", version: "2", label: "c" } });
      expect(copy.moveTo(entries, 3)).toEqual({ position: 3 });
      expect(copy.getJson("")).toEqual(endJson());
    });

    it("stops at a virtual conversion without old JSON", () => {
      const entries = history();
      const copy = new JsonHistoryCopy(kTreeId, endJson(), 3);
      copy.setVirtualConversions([{ path: t1Path, position: 2, oldJson: undefined }]);
      expect(copy.oldestReachablePosition).toBe(2);

      expect(copy.moveTo(entries, 0)).toEqual({ position: 2, unavailable: true });
      expect(copy.position).toBe(2);
      expect(copy.getJson(t1Path)).toEqual(
        { id: "t1", content: { type: "VersionedTestTile", version: "2", label: "c" } });
      // A move that ends at the boundary doesn't cross it.
      expect(copy.moveTo(entries, 3)).toEqual({ position: 3 });
      expect(copy.moveTo(entries, 2)).toEqual({ position: 2 });
    });

    it("stays converted when the entry before a virtual conversion doesn't undo", () => {
      const entries = history();
      entries[1] = HistoryEntry.create(makeEntry(
        [{ path: "/content/tileMap/NOPE/x", value: 1 }], [{ path: "/content/tileMap/NOPE/x", value: 0 }]));
      const copy = new JsonHistoryCopy(kTreeId, endJson(), 3);
      copy.setVirtualConversions([{ path: t1Path, position: 2, oldJson: v1Tile("c") }]);

      expect(copy.moveTo(entries, 0)).toMatchObject({ position: 2, failure: { historyIndex: 1 } });
      expect(copy.getJson(t1Path)).toEqual(
        { id: "t1", content: { type: "VersionedTestTile", version: "2", label: "c" } });
    });

    it("stops at a virtual conversion whose model isn't in the copy", () => {
      const entries = history();
      const copy = new JsonHistoryCopy(kTreeId, endJson(), 3);
      copy.setVirtualConversions([{ path: "/content/tileMap/t9", position: 2, oldJson: v1Tile("c") }]);

      expect(copy.moveTo(entries, 0)).toEqual({ position: 2, unavailable: true });
      expect(copy.oldestReachablePosition).toBe(2);
    });
  });

  it("getJson resolves escaped paths and returns undefined for unresolved ones", () => {
    const copy = new JsonHistoryCopy(kTreeId, { "a/b": { "c~d": [10, 20] } }, 0);
    expect(copy.getJson("/a~1b/c~0d/1")).toBe(20);
    expect(copy.getJson("/a~1b/missing/x")).toBeUndefined();
    expect(copy.getJson("/a~1b/c~0d/1/deeper")).toBeUndefined();
  });
});
