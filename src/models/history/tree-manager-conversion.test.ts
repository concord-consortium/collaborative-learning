import fs from "fs";
import path from "path";
import { cloneDeep } from "lodash";
import { getSnapshot, IJsonPatch, Instance, types } from "mobx-state-tree";
import { ITileProps } from "src/components/tiles/tile-component";
import { SharedModel } from "../shared/shared-model";
import { registerSharedModelInfo } from "../shared/shared-model-registry";
import { TileContentModel } from "../tiles/tile-content";
import { registerTileComponentInfo } from "../tiles/tile-component-info";
import { registerTileContentInfo } from "../tiles/tile-content-info";
import { createDocumentModel, DocumentModelType } from "../document/document";
import { DocumentContentModel } from "../document/document-content";
import { ProblemDocument } from "../document/document-types";
import { HistoryEntrySnapshot, TreePatchRecordSnapshot } from "./history";
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

  // An independent replay of the stored entries from the end state.
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

describe("playback across a conversion entry", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("crosses the conversion entry backward and forward", async () => {
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

  it("loads an old tile once per move even when its patches are interleaved", async () => {
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

  it("keeps shared model references to loaded tiles", async () => {
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

  it("applies the patches of a tile its converter declines to MST, without loading it", async () => {
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
    const applied: { patches: readonly IJsonPatch[]; loads: readonly IJsonPatch[] }[] = [];
    manager.trees[kTreeId] = new Proxy(tree, {
      get(target, prop) {
        if (prop !== "applyPatchesFromManager") return (target as any)[prop];
        return (entryId: string, exchangeId: string, patches: readonly IJsonPatch[], loads?: readonly IJsonPatch[]) => {
          applied.push({ patches, loads: loads ?? [] });
          return target.applyPatchesFromManager(entryId, exchangeId, patches, loads);
        };
      }
    });

    for (const [position, label] of [[1, "p"], [endPosition, "q"]] as const) {
      applied.length = 0;
      await manager.goToHistoryEntryPosition(position);
      expect(getTile(document, "t3").label).toBe(label);
      expect(getTile(document, "t3").version).toBe("3");
      expect(applied.flatMap(a => a.patches)).toContainEqual(replace(`${t3Path}/content/label`, label));
      expect(applied.flatMap(a => a.loads).map(load => load.path)).toEqual([t1Path]);
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

  it("rolls back a current tile's MST failure and loads old tiles at the stop", async () => {
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

  it("records the failure when the rollback's conversion throws", async () => {
    const oldEntries = [
      makeEntry([replaceRecord(`${t1Path}/content/text`, "a", "THROW")]),
      makeEntry([replaceRecord("/content/tileMap/t2/content/nope/deep", 1, 2)]),
      makeEntry([replaceRecord(`${t1Path}/content/text`, "THROW", "c")])
    ];
    const content = {
      tileMap: { ...t1Content().tileMap, t2: { id: "t2", content: { type: "TestTile", nope: { deep: 2 } } } }
    };
    const { manager } = await setupConvertedDocument(content, oldEntries);
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    await manager.goToHistoryEntryPosition(0);

    expect(manager.numHistoryEventsApplied).toBe(2);
    expect(manager.jsonHistoryCopy!.position).toBe(2);
    expect(manager.historyPlaybackFailures.map(f => [f.historyIndex, f.direction])).toEqual([[1, "undo"]]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Rollback of tree 'doc1' failed: cannot convert"));
  });

  it("rolls back the move when MST rejects an old tile's load", async () => {
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
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Load application failed"));

    // A move that doesn't reach the rejected position still works.
    await manager.goToHistoryEntryPosition(1);
    expect(manager.numHistoryEventsApplied).toBe(1);
    expect(t2.text).toBe("p");
    expect(getTile(document, "t1").label).toBe("b");
  });

  it("never builds a JSON copy for a document without conversions", async () => {
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
