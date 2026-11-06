import fs from "fs";
import path from "path";
import { getSnapshot, IJsonPatch, Instance } from "mobx-state-tree";
import { createDocumentModel, DocumentModelType } from "../document/document";
import { ProblemDocument } from "../document/document-types";
import { HistoryEntrySnapshot, TreePatchRecordSnapshot } from "./history";
import { toJsonValue } from "./json-patch";
import { IStoredEntry, rebuildBackAndForth } from "./dumb-rebuild-test-utils";
import { CDocument, TreeManager } from "./tree-manager";
import { expectEntryToBeComplete } from "./undo-store-test-utils";
import { kVersionedTestTileType, VersionedTestTileType } from "./schema-conversion-test-types";

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
  return { document, manager, endJson };
}

function getTile(document: DocumentModelType, id: string) {
  return document.content!.tileMap.get(id)!.content as VersionedTestTileType;
}

// t1 goes from text "a" with no items to text "c" with one item over three old entries.
const t1OldEntries = () => [
  makeEntry([replaceRecord(`${t1Path}/content/text`, "a", "b")]),
  makeEntry([replaceRecord(`${t1Path}/content/text`, "b", "c")]),
  makeEntry([addItemRecord(t1Path, 0, "a")])
];
const t1Content = () => ({ tileMap: { t1: oldTile("t1", "c", ["a"]) } });

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
