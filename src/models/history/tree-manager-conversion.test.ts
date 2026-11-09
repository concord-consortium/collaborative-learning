import fs from "fs";
import path from "path";
import { cloneDeep } from "lodash";
import { applySnapshot, getSnapshot, IJsonPatch, Instance, types } from "mobx-state-tree";
import { ITileProps } from "src/components/tiles/tile-component";
import { SharedModel } from "../shared/shared-model";
import { registerSharedModelInfo } from "../shared/shared-model-registry";
import { TileContentModel } from "../tiles/tile-content";
import { registerTileComponentInfo } from "../tiles/tile-component-info";
import { registerTileContentInfo } from "../tiles/tile-content-info";
import { createDocumentModel, DocumentModelType } from "../document/document";
import { DocumentContentModel } from "../document/document-content";
import { ProblemDocument } from "../document/document-types";
import { HistoryEntry, HistoryEntrySnapshot, TreePatchRecordSnapshot } from "./history";
import { JsonHistoryCopy } from "./json-history-copy";
import { toJsonValue } from "./json-patch";
import { IStoredEntry, rebuildBackAndForth } from "./dumb-rebuild-test-utils";
import { CDocument, TreeManager } from "./tree-manager";
import { expectEntryToBeComplete } from "./undo-store-test-utils";
import {
  kVersionedTestSharedModelType, kVersionedTestTileType, VersionedTestTileType, versionedTestTileSchema
} from "./schema-conversion-test-types";

const TestTile = TileContentModel
  .named("TestTile")
  .props({
    type: "TestTile",
    text: types.maybe(types.string),
    nope: types.frozen<any>()
  });
interface TestTileType extends Instance<typeof TestTile> {}

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

const TestSharedModel = SharedModel
  .named("TestSharedModel")
  .props({
    type: "TestSharedModel",
    value: types.maybe(types.string)
  });

registerSharedModelInfo({
  type: "TestSharedModel",
  modelClass: TestSharedModel,
  hasName: false
});

const kTreeId = "doc1";
const t1Path = "/content/tileMap/t1";
const kFixturePath = path.join(__dirname, "fixtures", "conversion-chain.json");

let entryCount = 0;
function makeEntry(records: TreePatchRecordSnapshot[]): HistoryEntrySnapshot {
  return {
    id: `old-${++entryCount}`, created: Date.now(), tree: kTreeId, model: "Test", action: "/oldAction",
    undoable: true, state: "complete", triggeringBatchIds: [], records
  };
}

// The patches are listed in the order they are applied; each inverse undoes the patch at the
// same index.
function makeRecord(patches: IJsonPatch[], inversePatches: IJsonPatch[]): TreePatchRecordSnapshot {
  return { tree: kTreeId, action: "/oldAction", patches, inversePatches };
}

const replace = (patchPath: string, value: unknown): IJsonPatch => ({ op: "replace", path: patchPath, value });
const replaceRecord = (patchPath: string, from: unknown, to: unknown) =>
  makeRecord([replace(patchPath, to)], [replace(patchPath, from)]);
const addItemRecord = (tilePath: string, index: number, value: string) => makeRecord(
  [{ op: "add", path: `${tilePath}/content/items/${index}`, value: { value } }],
  [{ op: "remove", path: `${tilePath}/content/items/${index}` }]);

const oldTile = (id: string, text: string, items: string[] = []) => ({
  id, content: { type: kVersionedTestTileType, text, items: items.map(value => ({ value })) }
});

/**
 * Creates a document from old content, gives it old history ending at that content, then makes
 * an edit, which records the load entry and the edit. The document ends at the last entry.
 */
async function setupConvertedDocument(content: any, oldEntries: HistoryEntrySnapshot[]) {
  const document = createDocumentModel({ uid: "1", type: ProblemDocument, key: kTreeId, content });
  const manager = document.treeManagerAPI as Instance<typeof TreeManager>;
  manager.setChangeDocument(CDocument.create({ history: oldEntries }));
  manager.setNumHistoryEntriesApplied(oldEntries.length);
  document.treeMonitor!.enableMonitoring();
  getTile(document, "t1").setLabel("x");
  await expectEntryToBeComplete(manager, oldEntries.length + 2);
  const endPosition = manager.document.history.length;
  manager.setNumHistoryEntriesApplied(endPosition);
  const endJson: any = toJsonValue(getSnapshot(document));

  // A fresh copy moved straight from the end state, to compare with the manager's copy, which got
  // there step by step.
  const replay = (position: number) => {
    const replayCopy = new JsonHistoryCopy(kTreeId, cloneDeep(endJson), endPosition);
    replayCopy.moveTo(manager.document.history, position);
    return replayCopy;
  };
  const copyJson = (modelPath: string): any => manager.jsonHistoryCopy!.getJson(modelPath);
  return { document, manager, endJson, endPosition, replay, copyJson };
}

function getTile(document: DocumentModelType, id: string) {
  return document.content!.tileMap.get(id)!.content as VersionedTestTileType;
}

function expectTileToMatchConvertedJson(tile: VersionedTestTileType, json: any) {
  const converted: any = versionedTestTileSchema.convertSnapshot(cloneDeep(json));
  expect(tile.label).toBe(converted.content.label);
  expect(tile.items.map(item => item.value)).toEqual(converted.content.items.map((item: any) => item.value));
}

// t1 goes from text "a" with no items to text "c" with one item over three old entries.
const t1OldEntries = () => [
  makeEntry([replaceRecord(`${t1Path}/content/text`, "a", "b")]),
  makeEntry([replaceRecord(`${t1Path}/content/text`, "b", "c")]),
  makeEntry([addItemRecord(t1Path, 0, "a")])
];
const t1Content = () => ({ tileMap: { t1: oldTile("t1", "c", ["a"]) } });

describe("playback across a load entry", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("crosses the load entry backward and forward", async () => {
    const { document, manager, endJson, replay, copyJson } =
      await setupConvertedDocument(t1Content(), t1OldEntries());
    expect(getTile(document, "t1").label).toBe("x");

    const visits = [4, 3, 2, 1, 0, 5];
    const labels = ["c", "c", "c", "b", "a", "x"];
    for (const [i, position] of visits.entries()) {
      await manager.goToHistoryEntryPosition(position);
      expect(manager.numHistoryEventsApplied).toBe(position);
      expect(manager.jsonHistoryCopy!.position).toBe(position);
      expect(getTile(document, "t1").label).toBe(labels[i]);
      expect(copyJson(t1Path)).toEqual(replay(position).getJson(t1Path));
    }
    expect(manager.historyPlaybackFailures).toEqual([]);

    const endIds = endJson.content.tileMap.t1.content.items.map((item: any) => item.id);
    expect(getTile(document, "t1").items.map(item => item.id)).toEqual(endIds);
  });

  it("each MST tile equals its JSON converted, ids aside", async () => {
    const { document, manager, copyJson } = await setupConvertedDocument(t1Content(), t1OldEntries());

    for (const position of [3, 2, 1, 0, 1, 2, 3]) {
      await manager.goToHistoryEntryPosition(position);
      expectTileToMatchConvertedJson(getTile(document, "t1"), copyJson(t1Path));
    }
    expect(manager.historyPlaybackFailures).toEqual([]);
  });

  it("replaces an old tile once per move even when its patches are interleaved", async () => {
    const t2TextPath = "/content/tileMap/t2/content/text";
    const oldEntries = [
      // One record mixes t1, t2 and t1 patches.
      makeEntry([makeRecord(
        [replace(`${t1Path}/content/text`, "b"), replace(t2TextPath, "q"),
          { op: "add", path: `${t1Path}/content/items/0`, value: { value: "a" } }],
        [replace(`${t1Path}/content/text`, "a"), replace(t2TextPath, "p"),
          { op: "remove", path: `${t1Path}/content/items/0` }])]),
      // Two records split t1's patches.
      makeEntry([replaceRecord(`${t1Path}/content/text`, "b", "c"), addItemRecord(t1Path, 1, "z")])
    ];
    const content = {
      tileMap: { t1: oldTile("t1", "c", ["a", "z"]), t2: { id: "t2", content: { type: "TestTile", text: "q" } } }
    };
    const { document, manager, copyJson } = await setupConvertedDocument(content, oldEntries);
    const t2 = document.content!.tileMap.get("t2")!.content as TestTileType;
    const convertSpy = jest.spyOn(versionedTestTileSchema, "convertSnapshot");

    // Every move ends in the old region, so each one converts t1 exactly once.
    for (const [position, t2Text] of [[2, "q"], [1, "q"], [0, "p"], [2, "q"], [1, "q"]] as const) {
      convertSpy.mockClear();
      await manager.goToHistoryEntryPosition(position);
      expect(convertSpy).toHaveBeenCalledTimes(1);
      expect(t2.text).toBe(t2Text);
      expectTileToMatchConvertedJson(getTile(document, "t1"), copyJson(t1Path));
    }
    expect(manager.historyPlaybackFailures).toEqual([]);
  });

  it("keeps shared model references to replaced tiles", async () => {
    const t3Path = "/content/tileMap/t3";
    const tilesPath = "/content/sharedModelMap/sm1/tiles";
    const oldEntries = [
      makeEntry([replaceRecord(`${t1Path}/content/text`, "a", "c")]),
      // t3 is added and attached to sm1 in the same record.
      makeEntry([makeRecord(
        [{ op: "add", path: t3Path, value: oldTile("t3", "n") }, { op: "add", path: `${tilesPath}/1`, value: "t3" }],
        [{ op: "remove", path: t3Path }, { op: "remove", path: `${tilesPath}/1` }])])
    ];
    const content = {
      tileMap: { t1: oldTile("t1", "c"), t3: oldTile("t3", "n") },
      sharedModelMap: { sm1: { sharedModel: { id: "sm1", type: "TestSharedModel" }, tiles: ["t1", "t3"] } }
    };
    const { document, manager, copyJson } = await setupConvertedDocument(content, oldEntries);
    const sharedModelTileIds = () => document.content!.sharedModelMap.get("sm1")!.tiles.map(tile => tile.id);

    for (const position of [1, 0, 2, 4]) {
      await manager.goToHistoryEntryPosition(position);
      expect(sharedModelTileIds()).toEqual(copyJson("/content/sharedModelMap/sm1").tiles);
    }
    expect(sharedModelTileIds()).toEqual(["t1", "t3"]);
    expect(getTile(document, "t3").label).toBe("n");
    expect(manager.historyPlaybackFailures).toEqual([]);
  });

  it("converts shared models through the same path", async () => {
    const valPath = "/content/sharedModelMap/sm2/sharedModel/val";
    const oldEntries = [makeEntry([replaceRecord(valPath, "w", "x")])];
    const content = {
      ...t1Content(),
      sharedModelMap: { sm2: { sharedModel: { id: "sm2", type: kVersionedTestSharedModelType, val: "x" }, tiles: [] } }
    };
    const { document, manager } = await setupConvertedDocument(content, oldEntries);
    const sharedValue = () => (document.content!.sharedModelMap.get("sm2")!.sharedModel as any).value;

    for (const [position, value] of [[0, "w"], [1, "x"], [0, "w"], [3, "x"]] as const) {
      await manager.goToHistoryEntryPosition(position);
      expect(sharedValue()).toBe(value);
    }
    expect(manager.historyPlaybackFailures).toEqual([]);
  });

  it("finds an old tile that is absent at both ends of a move from the move's patches", async () => {
    const t3Path = "/content/tileMap/t3";
    const oldEntries = [
      makeEntry([makeRecord([{ op: "add", path: t3Path, value: oldTile("t3", "m") }],
        [{ op: "remove", path: t3Path }])]),
      // MST rejects an old item, which has no id.
      makeEntry([addItemRecord(t3Path, 0, "a")]),
      makeEntry([makeRecord([{ op: "remove", path: t3Path }],
        [{ op: "add", path: t3Path, value: oldTile("t3", "m", ["a"]) }])])
    ];
    const { document, manager } = await setupConvertedDocument(t1Content(), oldEntries);

    // t3 is added, edited and removed inside each move, and no move after the first crosses the load
    // entry, so only the patches' values show that t3 is old.
    for (const position of [3, 0, 3]) {
      await manager.goToHistoryEntryPosition(position);
      expect(manager.numHistoryEventsApplied).toBe(position);
      expect(document.content!.tileMap.has("t3")).toBe(false);
    }
    expect(manager.historyPlaybackFailures).toEqual([]);
  });

  it("applies the patches of a tile its converter declines to MST, without replacing it", async () => {
    const t3Path = "/content/tileMap/t3";
    // The test tile's converter doesn't know version 3, so it declines this tile.
    const newerTile = { id: "t3", content: { type: kVersionedTestTileType, version: "3", label: "q", items: [] } };
    const oldEntries = [
      makeEntry([replaceRecord(`${t1Path}/content/text`, "a", "c")]),
      makeEntry([replaceRecord(`${t3Path}/content/label`, "p", "q")])
    ];
    const { document, manager, endPosition } =
      await setupConvertedDocument({ tileMap: { t1: oldTile("t1", "c"), t3: newerTile } }, oldEntries);

    // Record what each move hands the document's tree.
    const tree = manager.trees[kTreeId];
    const applied: { patches: readonly IJsonPatch[]; modelReplacements: readonly IJsonPatch[] }[] = [];
    manager.trees[kTreeId] = new Proxy(tree, {
      get(target, prop) {
        if (prop !== "applyPatchesFromManager") return (target as any)[prop];
        return (entryId: string, exchangeId: string, patches: readonly IJsonPatch[],
            modelReplacements?: readonly IJsonPatch[]) => {
          applied.push({ patches, modelReplacements: modelReplacements ?? [] });
          return target.applyPatchesFromManager(entryId, exchangeId, patches, modelReplacements);
        };
      }
    });

    for (const [position, label] of [[1, "p"], [endPosition, "q"]] as const) {
      applied.length = 0;
      await manager.goToHistoryEntryPosition(position);
      expect(getTile(document, "t3").label).toBe(label);
      expect(getTile(document, "t3").version).toBe("3");
      expect(applied.flatMap(a => a.patches)).toContainEqual(replace(`${t3Path}/content/label`, label));
      expect(applied.flatMap(a => a.modelReplacements).map(replacement => replacement.path)).toEqual([t1Path]);
    }
    expect(manager.historyPlaybackFailures).toEqual([]);
  });

  it("stops with the failure banner when an old entry doesn't apply to the JSON copy", async () => {
    const badPath = `${t1Path}/content/missing/deep`;
    const oldEntries = [
      makeEntry([replaceRecord(`${t1Path}/content/text`, "a", "b")]),
      makeEntry([replaceRecord(badPath, "old", "new")]),
      makeEntry([replaceRecord(`${t1Path}/content/text`, "b", "c")])
    ];
    const { document, manager } = await setupConvertedDocument(t1Content(), oldEntries);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);

    await manager.goToHistoryEntryPosition(0);

    expect(manager.numHistoryEventsApplied).toBe(2);
    expect(manager.jsonHistoryCopy!.position).toBe(2);
    expect(getTile(document, "t1").label).toBe("b");
    expect(manager.historyPlaybackFailures.map(f => [f.historyIndex, f.direction])).toEqual([[1, "undo"]]);

    // Trying again, the copy doesn't move at all, so no tree is touched.
    const tree = manager.trees[kTreeId];
    const startApplying = jest.fn();
    manager.trees[kTreeId] = new Proxy(tree, {
      get(target, prop) {
        if (prop !== "startApplyingPatchesFromManager") return (target as any)[prop];
        return (entryId: string, exchangeId: string) => {
          startApplying();
          return target.startApplyingPatchesFromManager(entryId, exchangeId);
        };
      }
    });
    await manager.goToHistoryEntryPosition(0);
    expect(manager.numHistoryEventsApplied).toBe(2);
    expect(startApplying).not.toHaveBeenCalled();
  });

  it("stops with the failure banner when a conversion throws", async () => {
    const oldEntries = [
      makeEntry([replaceRecord(`${t1Path}/content/text`, "THROW", "b")]),
      makeEntry([replaceRecord(`${t1Path}/content/text`, "b", "c")])
    ];
    const { document, manager } = await setupConvertedDocument(t1Content(), oldEntries);
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    await manager.goToHistoryEntryPosition(0);

    expect(manager.numHistoryEventsApplied).toBe(4);
    expect(manager.jsonHistoryCopy!.position).toBe(4);
    expect(getTile(document, "t1").label).toBe("x");
    expect(manager.historyPlaybackFailures.map(f => [f.historyIndex, f.direction])).toEqual([[3, "undo"]]);

    // A move that doesn't reach the throwing position still works.
    await manager.goToHistoryEntryPosition(1);
    expect(manager.numHistoryEventsApplied).toBe(1);
    expect(getTile(document, "t1").label).toBe("b");
  });

  it("stops playback when the JSON copy can't get back to where the trees are", async () => {
    const oldEntries = [
      makeEntry([replaceRecord(`${t1Path}/content/text`, "THROW", "b")]),
      // Undoing this entry applies, but redoing it doesn't: its patch's parent doesn't exist.
      makeEntry([makeRecord([replace("/content/tileMap/t2/content/missing/x", 1)],
        [replace("/content/tileMap/t2/content/text", "p")])]),
      makeEntry([replaceRecord(`${t1Path}/content/text`, "b", "c")])
    ];
    const content = {
      tileMap: { ...t1Content().tileMap, t2: { id: "t2", content: { type: "TestTile", text: "q" } } }
    };
    const { document, manager, endPosition } = await setupConvertedDocument(content, oldEntries);
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    // The conversion of t1 at position 0 throws, so the copy goes back to the end, and stops
    // before redoing entry 1.
    await manager.goToHistoryEntryPosition(0);

    expect(manager.numHistoryEventsApplied).toBe(endPosition);
    expect(manager.jsonHistoryCopy!.position).toBe(1);
    expect(manager.jsonCopyOutOfStep).toBe(true);
    expect(manager.historyPlaybackFailures.map(f => [f.historyIndex, f.direction]))
      .toEqual([[1, "redo"], [endPosition - 1, "undo"]]);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(
      "The playback JSON copy stopped at history position 1 instead of going back to " +
      `${endPosition}, so playback has stopped`));

    // No later move happens.
    await manager.goToHistoryEntryPosition(endPosition - 1);
    expect(manager.numHistoryEventsApplied).toBe(endPosition);
    expect(manager.jsonHistoryCopy!.position).toBe(1);
    expect(getTile(document, "t1").label).toBe("x");
  });

  it("stops playback when the JSON copy can't get back to a rollback's stop position", async () => {
    const oldEntries = [
      // Undoing this entry applies to the copy, but redoing it doesn't: its patch's parent doesn't
      // exist.
      makeEntry([makeRecord([replace(`${t1Path}/content/missing/x`, 1)],
        [replace(`${t1Path}/content/text`, "a")])]),
      makeEntry([replaceRecord("/content/tileMap/t2/content/nope/deep", 1, 2)]),
      makeEntry([replaceRecord(`${t1Path}/content/text`, "b", "c")])
    ];
    const content = {
      tileMap: { ...t1Content().tileMap, t2: { id: "t2", content: { type: "TestTile", nope: { deep: 2 } } } }
    };
    const { document, manager } = await setupConvertedDocument(content, oldEntries);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    // MST stops at 2, where `nope` is frozen. The copy reached 0 and can't redo entry 0.
    await manager.goToHistoryEntryPosition(0);

    expect(manager.numHistoryEventsApplied).toBe(2);
    expect(manager.jsonHistoryCopy!.position).toBe(0);
    expect(manager.jsonCopyOutOfStep).toBe(true);
    expect(manager.historyPlaybackFailures.map(f => [f.historyIndex, f.direction]))
      .toEqual([[0, "redo"], [1, "undo"]]);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining(
      "The playback JSON copy stopped at history position 0 instead of going back to 2"));
    // The old tile's model replacement holds its state at the copy's position.
    expect(getTile(document, "t1").label).toBe("a");
  });

  it("rolls back a current tile's MST failure and replaces old tiles at the stop", async () => {
    const oldEntries = [
      makeEntry([replaceRecord(`${t1Path}/content/text`, "a", "b")]),
      // `nope` is frozen, so MST can't apply a patch inside it, while the JSON copy can.
      makeEntry([replaceRecord("/content/tileMap/t2/content/nope/deep", 1, 2)]),
      makeEntry([replaceRecord(`${t1Path}/content/text`, "b", "c")])
    ];
    const content = {
      tileMap: { ...t1Content().tileMap, t2: { id: "t2", content: { type: "TestTile", nope: { deep: 2 } } } }
    };
    const { document, manager, copyJson } = await setupConvertedDocument(content, oldEntries);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);

    await manager.goToHistoryEntryPosition(0);

    expect(manager.numHistoryEventsApplied).toBe(2);
    expect(manager.jsonHistoryCopy!.position).toBe(2);
    expect(manager.historyPlaybackFailures.map(f => [f.historyIndex, f.direction])).toEqual([[1, "undo"]]);
    expect(getTile(document, "t1").label).toBe("b");
    expectTileToMatchConvertedJson(getTile(document, "t1"), copyJson(t1Path));
  });

  it("rolls back to where the move started when the rollback's conversion throws", async () => {
    const oldEntries = [
      makeEntry([replaceRecord(`${t1Path}/content/text`, "a", "THROW")]),
      makeEntry([replaceRecord("/content/tileMap/t2/content/nope/deep", 1, 2)]),
      makeEntry([replaceRecord(`${t1Path}/content/text`, "THROW", "c")])
    ];
    const content = {
      tileMap: { ...t1Content().tileMap, t2: { id: "t2", content: { type: "TestTile", nope: { deep: 2 } } } }
    };
    const { document, manager, endPosition, copyJson } = await setupConvertedDocument(content, oldEntries);
    const t2 = document.content!.tileMap.get("t2")!.content as TestTileType;
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    // MST stops the move at 2, where t1's text is "THROW", so its rollback can't be built.
    await manager.goToHistoryEntryPosition(0);

    expect(manager.numHistoryEventsApplied).toBe(endPosition);
    expect(manager.jsonHistoryCopy!.position).toBe(endPosition);
    expect(manager.historyPlaybackFailures.map(f => [f.historyIndex, f.direction])).toEqual([[1, "undo"]]);
    expect(getTile(document, "t1").label).toBe("x");
    expect(copyJson(t1Path).content.label).toBe("x");
    expect(t2.nope).toEqual({ deep: 2 });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Rollback of tree 'doc1' to history position 2 could not be built: cannot convert"));
    expect(warnSpy).not.toHaveBeenCalledWith("Trees may be in an inconsistent state.");
  });

  it("rolls back the move when MST rejects an old tile's model replacement", async () => {
    const t2TextPath = "/content/tileMap/t2/content/text";
    const oldEntries = [
      makeEntry([replaceRecord(`${t1Path}/content/text`, "a", "b")]),
      makeEntry([replaceRecord(t2TextPath, "p", "q")]),
      makeEntry([replaceRecord(`${t1Path}/content/text`, "b", "c")])
    ];
    const content = {
      tileMap: { ...t1Content().tileMap, t2: { id: "t2", content: { type: "TestTile", text: "q" } } }
    };
    const { document, manager, endPosition, copyJson } = await setupConvertedDocument(content, oldEntries);
    const t2 = document.content!.tileMap.get("t2")!.content as TestTileType;
    // The conversion of t1 at position 0 gives content that MST rejects.
    const convertSnapshot = versionedTestTileSchema.convertSnapshot;
    jest.spyOn(versionedTestTileSchema, "convertSnapshot").mockImplementation((tile: any) => {
      const converted: any = convertSnapshot(tile);
      return tile.content.text === "a" ? { ...converted, content: { ...converted.content, items: "bad" } } : converted;
    });
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    await manager.goToHistoryEntryPosition(0);

    expect(manager.numHistoryEventsApplied).toBe(endPosition);
    expect(manager.jsonHistoryCopy!.position).toBe(endPosition);
    expect(manager.historyPlaybackFailures.map(f => [f.historyIndex, f.direction]))
      .toEqual([[endPosition - 1, "undo"]]);
    expect(t2.text).toBe("q");
    expect(getTile(document, "t1").label).toBe("x");
    expectTileToMatchConvertedJson(getTile(document, "t1"), copyJson(t1Path));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Replacing a model failed"));

    // A move that doesn't reach the rejected position still works.
    await manager.goToHistoryEntryPosition(1);
    expect(manager.numHistoryEventsApplied).toBe(1);
    expect(t2.text).toBe("p");
    expect(getTile(document, "t1").label).toBe("b");
  });

  it("rolls back a partly applied entry that adds an old tile when a forward move fails", async () => {
    const t3Path = "/content/tileMap/t3";
    const oldEntries = [
      makeEntry([replaceRecord(`${t1Path}/content/text`, "a", "b")]),
      // MST can undo this entry but not redo it: `nope` is frozen, so the second patch fails after
      // the old tile t3 is added.
      makeEntry([makeRecord(
        [{ op: "add", path: t3Path, value: oldTile("t3", "m") },
          replace("/content/tileMap/t2/content/nope/deep", 2)],
        [{ op: "remove", path: t3Path }, replace("/content/tileMap/t2/content/text", "p")])]),
      makeEntry([replaceRecord(`${t1Path}/content/text`, "b", "c")])
    ];
    const content = {
      tileMap: {
        ...t1Content().tileMap, t3: oldTile("t3", "m"),
        t2: { id: "t2", content: { type: "TestTile", text: "q", nope: { deep: 2 } } }
      }
    };
    const { document, manager, endPosition, copyJson } = await setupConvertedDocument(content, oldEntries);
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await manager.goToHistoryEntryPosition(0);
    expect(manager.numHistoryEventsApplied).toBe(0);

    await manager.goToHistoryEntryPosition(endPosition);

    expect(manager.numHistoryEventsApplied).toBe(1);
    expect(manager.jsonHistoryCopy!.position).toBe(1);
    expect(manager.historyPlaybackFailures.map(f => [f.historyIndex, f.direction])).toEqual([[1, "redo"]]);
    expect(document.content!.tileMap.has("t3")).toBe(false);
    expect(getTile(document, "t1").label).toBe("b");
    expectTileToMatchConvertedJson(getTile(document, "t1"), copyJson(t1Path));
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining("inconsistent state"));
  });

  it("rolls back every entry of a forward move when MST rejects an old tile's model replacement", async () => {
    const t3Path = "/content/tileMap/t3";
    const t4Path = "/content/tileMap/t4";
    const oldEntries = [
      makeEntry([makeRecord([{ op: "add", path: t3Path, value: oldTile("t3", "m") }],
        [{ op: "remove", path: t3Path }])]),
      makeEntry([replaceRecord(`${t1Path}/content/text`, "a", "b")]),
      makeEntry([makeRecord([{ op: "remove", path: t4Path }],
        [{ op: "add", path: t4Path, value: oldTile("t4", "n", ["a"]) }])]),
      makeEntry([replaceRecord(`${t1Path}/content/text`, "b", "c")])
    ];
    const content = { tileMap: { ...t1Content().tileMap, t3: oldTile("t3", "m") } };
    const { document, manager, copyJson } = await setupConvertedDocument(content, oldEntries);
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    await manager.goToHistoryEntryPosition(0);
    expect(manager.numHistoryEventsApplied).toBe(0);
    expect(document.content!.tileMap.has("t4")).toBe(true);

    // The conversion of t1 at position 4 gives content that MST rejects, so the move rolls back to
    // 0, undoing t3's whole-tile add and t4's whole-tile remove.
    const convertSnapshot = versionedTestTileSchema.convertSnapshot;
    jest.spyOn(versionedTestTileSchema, "convertSnapshot").mockImplementation((tile: any) => {
      const converted: any = convertSnapshot(tile);
      return tile.content.text === "c" ? { ...converted, content: { ...converted.content, items: "bad" } } : converted;
    });
    await manager.goToHistoryEntryPosition(4);

    expect(manager.numHistoryEventsApplied).toBe(0);
    expect(manager.jsonHistoryCopy!.position).toBe(0);
    expect(manager.historyPlaybackFailures.map(f => [f.historyIndex, f.direction])).toEqual([[0, "redo"]]);
    expect(document.content!.tileMap.has("t3")).toBe(false);
    expectTileToMatchConvertedJson(getTile(document, "t4"), copyJson(t4Path));
    expect(getTile(document, "t1").label).toBe("a");
    expectTileToMatchConvertedJson(getTile(document, "t1"), copyJson(t1Path));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Replacing a model failed"));
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining("inconsistent state"));
  });

  it("never builds a JSON copy for a history without a load entry", async () => {
    const tilePath = "/content/tileMap/t1/content/text";
    const docContent = DocumentContentModel.create({
      sharedModelMap: { sm1: { sharedModel: { id: "sm1", type: "TestSharedModel" }, tiles: ["t1"] } },
      tileMap: { t1: { id: "t1", content: { type: "TestTile", text: "c" } } }
    } as any);
    const document = createDocumentModel({ uid: "1", type: ProblemDocument, key: kTreeId, content: docContent as any });
    const manager = document.treeManagerAPI as Instance<typeof TreeManager>;
    manager.setChangeDocument(CDocument.create({ history: [
      makeEntry([replaceRecord(tilePath, "a", "b")]),
      makeEntry([replaceRecord(tilePath, "b", "c")])
    ] }));
    manager.setNumHistoryEntriesApplied(2);
    const tile = docContent.tileMap.get("t1")!.content as TestTileType;

    for (const [position, text] of [[0, "a"], [1, "b"], [2, "c"]] as const) {
      await manager.goToHistoryEntryPosition(position);
      expect(tile.text).toBe(text);
    }
    expect(manager.needsJsonCopy).toBe(false);
    expect(manager.jsonHistoryCopy).toBeUndefined();
  });

  it("scans a shorter or replaced history again for a load entry", () => {
    const document = createDocumentModel({ uid: "1", type: ProblemDocument, key: kTreeId, content: t1Content() });
    const manager = document.treeManagerAPI as Instance<typeof TreeManager>;
    const plainEntry = () => makeEntry([replaceRecord(`${t1Path}/content/text`, "a", "b")]);
    const loadEntry: HistoryEntrySnapshot = { ...makeEntry([]), isLoadEntry: true };

    manager.setChangeDocument(CDocument.create({ history: [plainEntry(), plainEntry()] }));
    expect(manager.needsJsonCopy).toBe(false);
    applySnapshot(manager.document, { history: [loadEntry] });
    expect(manager.needsJsonCopy).toBe(true);
    manager.setChangeDocument(CDocument.create({ history: [plainEntry(), plainEntry(), plainEntry()] }));
    expect(manager.needsJsonCopy).toBe(false);
  });
});

describe("playback with a local load entry", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * A playback document made the way the canvas makes one: a snapshot of a live document that
   * converted old stored content, which hands over its pending load entry. The history is what
   * Firestore holds, which doesn't include that entry.
   */
  function setupPlaybackOfOldContent(content: any, history: HistoryEntrySnapshot[]) {
    const liveDocument = createDocumentModel({ uid: "1", type: ProblemDocument, key: kTreeId, content });
    const liveManager = liveDocument.treeManagerAPI as Instance<typeof TreeManager>;
    expect(liveManager.pendingLoadEntry).toBeDefined();
    const document = createDocumentModel(getSnapshot(liveDocument));
    const manager = document.treeManagerAPI as Instance<typeof TreeManager>;
    manager.setLocalLoadEntry(liveManager.pendingLoadEntry);
    manager.setChangeDocument(CDocument.create({ history }));
    manager.setNumHistoryEntriesApplied(history.length);
    return { document, manager };
  }

  it("plays back the stored history, with the JSON copy starting at the stored content", async () => {
    const { document, manager } = setupPlaybackOfOldContent(t1Content(), t1OldEntries());

    for (const [position, label] of [[1, "b"], [0, "a"], [3, "c"]] as const) {
      await manager.goToHistoryEntryPosition(position);
      expect(getTile(document, "t1").label).toBe(label);
    }
    expect(manager.jsonHistoryCopy!.getJson(`${t1Path}/content/text`)).toBe("c");
    expect(manager.document.history).toHaveLength(3);
    expect(manager.historyPlaybackFailures).toEqual([]);
  });

  it("plays back a student's load entry and edit that arrive after the hand-off", async () => {
    const oldEntries = t1OldEntries();
    const { document, manager } = setupPlaybackOfOldContent(t1Content(), oldEntries);
    const student = await setupConvertedDocument(t1Content(), oldEntries);
    applySnapshot(manager.document, { history: getSnapshot(student.manager.document.history) });

    for (const [position, label] of [[5, "x"], [0, "a"], [5, "x"]] as const) {
      await manager.goToHistoryEntryPosition(position);
      expect(getTile(document, "t1").label).toBe(label);
    }
    const studentItemIds = getTile(student.document, "t1").items.map(item => item.id);
    expect(getTile(document, "t1").items.map(item => item.id)).toEqual(studentItemIds);
    expect(manager.historyPlaybackFailures).toEqual([]);
  });

  it("plays back old-format entries that arrive after the hand-off", async () => {
    const oldEntries = t1OldEntries();
    const { document, manager } = setupPlaybackOfOldContent(t1Content(), oldEntries);
    // A student on a release from before the conversion edits the old content.
    const oldReleaseEdit = makeEntry([replaceRecord(`${t1Path}/content/text`, "c", "d")]);
    applySnapshot(manager.document, { history: [...oldEntries, oldReleaseEdit] });

    for (const [position, label] of [[4, "d"], [0, "a"], [4, "d"]] as const) {
      await manager.goToHistoryEntryPosition(position);
      expect(getTile(document, "t1").label).toBe(label);
    }
    expect(manager.historyPlaybackFailures).toEqual([]);
  });

  it("doesn't undo a local load entry that the history already holds before the start", async () => {
    const { document, manager, replay, copyJson } = await setupConvertedDocument(t1Content(), t1OldEntries());
    // The owner's entry was handed over while pending, and uploaded before playback started.
    manager.setLocalLoadEntry(getSnapshot(manager.document.history[3]));

    for (const [position, label] of [[4, "c"], [0, "a"], [5, "x"]] as const) {
      await manager.goToHistoryEntryPosition(position);
      expect(getTile(document, "t1").label).toBe(label);
      expect(copyJson(t1Path)).toEqual(replay(position).getJson(t1Path));
    }
    expect(manager.historyPlaybackFailures).toEqual([]);
  });
});

describe("conversion-chain fixture", () => {
  (process.env.WRITE_CONVERSION_FIXTURE ? it : it.skip)("writes the conversion-chain fixture", async () => {
    const { document, manager } = await setupConvertedDocument(t1Content(), t1OldEntries());
    const fixture = {
      endDocument: toJsonValue(getSnapshot(document)),
      entries: toJsonValue(getSnapshot(manager.document.history))
    };
    fs.writeFileSync(kFixturePath, `${JSON.stringify(fixture, null, 2)}\n`);
  });
});

describe("dumb rebuild of a chain recorded by the current code", () => {
  // t1 gains four items, three of them deleted, which the conversion drops. Without validation,
  // fast-json-patch appends an add past the end of an array, so it takes three dropped items for
  // inverse patches in the wrong order to give a different array.
  const deletedItemRecord = (index: number, value: string) => makeRecord(
    [{ op: "add", path: `${t1Path}/content/items/${index}`, value: { value, deleted: true } }],
    [{ op: "remove", path: `${t1Path}/content/items/${index}` }]);
  const oldEntries = () => [
    makeEntry([replaceRecord(`${t1Path}/content/text`, "a", "c")]),
    makeEntry([addItemRecord(t1Path, 0, "a")]),
    makeEntry([deletedItemRecord(1, "b"), deletedItemRecord(2, "c"), deletedItemRecord(3, "d")])
  ];
  const storedTile = () => ({
    id: "t1", content: { type: kVersionedTestTileType, text: "c",
      items: [{ value: "a" }, ...["b", "c", "d"].map(value => ({ value, deleted: true }))] }
  });

  it("rebuilds every position with a plain JSON patch library, across a conversion that shortens an array",
      async () => {
    const { manager, endJson } = await setupConvertedDocument({ tileMap: { t1: storedTile() } }, oldEntries());
    const entries: IStoredEntry[] = JSON.parse(JSON.stringify(getSnapshot(manager.document.history)));
    const loadEntryIndex = entries.findIndex(entry => entry.isLoadEntry);
    expect(loadEntryIndex).toBe(3);
    expect(endJson.content.tileMap.t1.content.items).toHaveLength(1);

    const { positions, end } = rebuildBackAndForth(endJson, entries);
    expect(positions[0].content.tileMap.t1).toEqual(oldTile("t1", "a"));
    expect(positions[loadEntryIndex].content.tileMap.t1).toEqual(storedTile());
    expect(positions[loadEntryIndex + 1].content.tileMap.t1.content.version).toBe("2");
    expect(end).toEqual(endJson);
  });
});

describe("applying the entries a load is missing to converted content", () => {
  function loadStoredContent(content: any) {
    const document = createDocumentModel({ uid: "1", type: ProblemDocument, key: kTreeId, content });
    const manager = document.treeManagerAPI as Instance<typeof TreeManager>;
    return { document, manager };
  }

  // The stored JSON a document's pending load entry turns into its content.
  function storedJsonOf(document: DocumentModelType, manager: Instance<typeof TreeManager>) {
    const json: any = toJsonValue(getSnapshot(document));
    const copy = new JsonHistoryCopy(kTreeId, json, 1);
    copy.moveTo([HistoryEntry.create(manager.pendingLoadEntry!)], 0);
    return copy.getJson(t1Path);
  }

  it("applies old-format entries to the stored models, then converts the result", async () => {
    const { document, manager } = loadStoredContent({ tileMap: { t1: oldTile("t1", "a") } });
    const loadedEntry = manager.pendingLoadEntry;
    expect(loadedEntry).toBeDefined();

    const result = await manager.applyEntriesAtLoad(t1OldEntries());

    expect(result).toEqual({ applied: 3 });
    const tile = getTile(document, "t1");
    expect(tile.label).toBe("c");
    expect(tile.items.map(item => item.value)).toEqual(["a"]);
    expect(manager.pendingLoadEntry).not.toBe(loadedEntry);
    expect(storedJsonOf(document, manager)).toEqual(oldTile("t1", "c", ["a"]));
  });

  it("applies a load entry among them, and the current-format entries after it", async () => {
    const stored = { tileMap: { t1: oldTile("t1", "a", ["a"]) } };
    // An earlier session converted the stored content, uploaded the load entry and an edit, and
    // closed before its content save.
    const earlier = await setupConvertedDocument(cloneDeep(stored), []);
    const gap: HistoryEntrySnapshot[] = toJsonValue(getSnapshot(earlier.manager.document.history));
    expect(gap.map(entry => !!entry.isLoadEntry)).toEqual([true, false]);
    const { document, manager } = loadStoredContent(cloneDeep(stored));

    const result = await manager.applyEntriesAtLoad(gap);

    expect(result).toEqual({ applied: 2 });
    expect(manager.pendingLoadEntry).toBeUndefined();
    expect(toJsonValue(getSnapshot(document.content!))).toEqual(earlier.endJson.content);
  });

  it("stops at an entry that doesn't apply, keeping the entries before it", async () => {
    const { document, manager } = loadStoredContent({ tileMap: { t1: oldTile("t1", "a") } });
    const [first] = t1OldEntries();
    const failing = makeEntry([replaceRecord(`${t1Path}/content/missing/text`, "a", "b")]);

    const result = await manager.applyEntriesAtLoad([first, failing]);

    expect(result).toEqual({ applied: 1, error: expect.any(String) });
    expect(getTile(document, "t1").label).toBe("b");
    expect(storedJsonOf(document, manager)).toEqual(oldTile("t1", "b"));
  });

  it("leaves the content as loaded when no entry applies", async () => {
    const { document, manager } = loadStoredContent({ tileMap: { t1: oldTile("t1", "a") } });
    const loadedEntry = manager.pendingLoadEntry;
    const failing = makeEntry([replaceRecord(`${t1Path}/content/missing/text`, "a", "b")]);

    const result = await manager.applyEntriesAtLoad([failing]);

    expect(result).toEqual({ applied: 0, error: expect.any(String) });
    expect(getTile(document, "t1").label).toBe("a");
    expect(manager.pendingLoadEntry).toBe(loadedEntry);
  });
});
