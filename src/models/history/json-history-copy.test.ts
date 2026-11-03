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
import { buildLoadEntry } from "./schema-conversion";

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
    const entry = HistoryEntry.create(buildLoadEntry(kTreeId, [
      { path: "/content/tileMap/t1/content", before, after }
    ]));
    const copy = new JsonHistoryCopy(
      kTreeId, { content: { tileMap: { t1: { id: "t1", content: cloneDeep(after) } } } }, 1);

    expect(copy.moveTo([entry], 0)).toEqual({ position: 0 });
    expect(copy.getJson("/content/tileMap/t1/content")).toEqual(before);
    expect(copy.moveTo([entry], 1)).toEqual({ position: 1 });
    expect(copy.getJson("/content/tileMap/t1/content")).toEqual(after);
  });

  it("getJson resolves escaped paths and returns undefined for unresolved ones", () => {
    const copy = new JsonHistoryCopy(kTreeId, { "a/b": { "c~d": [10, 20] } }, 0);
    expect(copy.getJson("/a~1b/c~0d/1")).toBe(20);
    expect(copy.getJson("/a~1b/missing/x")).toBeUndefined();
    expect(copy.getJson("/a~1b/c~0d/1/deeper")).toBeUndefined();
  });
});
