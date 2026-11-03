import { getSnapshot, Instance } from "mobx-state-tree";
import { cloneDeep } from "lodash";
import { createDocumentModel } from "../document/document";
import { DocumentContentModel } from "../document/document-content";
import { ProblemDocument } from "../document/document-types";
import { HistoryEntry, HistoryOperation } from "./history";
import { applyJsonPatches, toJsonValue } from "./json-patch";
import { TreeManager } from "./tree-manager";
import { expectEntryToBeComplete } from "./undo-store-test-utils";
import { VersionedTestTileType, kVersionedTestTileType } from "./schema-conversion-test-types";

const oldTileJson = () => ({
  id: "t1", content: { type: kVersionedTestTileType, text: "c", items: [{ value: "a" }] }
});
const oldContent = () => ({ tileMap: { t1: oldTileJson() } });

function makeDocument(content: any, extra: Record<string, any> = {}) {
  const document = createDocumentModel({
    uid: "1", type: ProblemDocument, key: "doc1", content, ...extra
  });
  const manager = document.treeManagerAPI as Instance<typeof TreeManager>;
  return { document, manager };
}

describe("conversion entry", () => {
  it("converts an old tile at load and keeps a pending conversion entry", () => {
    const { document, manager } = makeDocument(oldContent());
    const tile = document.content!.tileMap.get("t1")!.content as VersionedTestTileType;
    expect(tile.version).toBe("2");
    expect(tile.label).toBe("c");
    const entry = manager.pendingConversionEntry!;
    expect(entry).toBeDefined();
    expect(entry.isConversion).toBe(true);
    expect(entry.background).toBe(true);
    expect(entry.undoable).toBe(false);
    expect(manager.document.history.length).toBe(0);
  });

  it("conversion entry patches round-trip between the stored JSON and the MST snapshot", () => {
    const { document, manager } = makeDocument(oldContent());
    const entry = HistoryEntry.create(manager.pendingConversionEntry!);
    const docJson: any = toJsonValue(getSnapshot(document));
    const converted = cloneDeep(docJson);

    applyJsonPatches(docJson, entry.records[0].getPatches(HistoryOperation.Undo));
    expect(docJson.content.tileMap.t1).toEqual(oldTileJson());

    applyJsonPatches(docJson, entry.records[0].getPatches(HistoryOperation.Redo));
    expect(docJson).toEqual(converted);
  });

  it("records nothing when no tile is old", () => {
    const { manager } = makeDocument({
      tileMap: { t1: { id: "t1", content: { type: "VersionedTestTile", version: "2", label: "x" } } }
    });
    expect(manager.pendingConversionEntry).toBeUndefined();
  });

  it("records nothing for a group document", () => {
    const { document, manager } = makeDocument(oldContent(), { concurrent: true });
    const tile = document.content!.tileMap.get("t1")!.content as VersionedTestTileType;
    expect(tile.version).toBe("2");
    expect(manager.pendingConversionEntry).toBeUndefined();
  });

  it("records nothing when content is an MST instance", () => {
    const content = DocumentContentModel.create(oldContent() as any);
    const { manager } = makeDocument(content);
    expect(manager.pendingConversionEntry).toBeUndefined();
  });

  it("includes converted shared models in the same entry", () => {
    const { manager } = makeDocument({
      ...oldContent(),
      sharedModelMap: {
        sm1: { sharedModel: { id: "sm1", type: "VersionedTestSharedModel", val: "x" }, tiles: [] }
      }
    });
    const patches = manager.pendingConversionEntry!.records![0].patches!;
    expect(manager.pendingConversionEntry!.records!.length).toBe(1);
    expect(patches.some(p => p.path.startsWith("/content/sharedModelMap/sm1/sharedModel/"))).toBe(true);
    expect(patches.some(p => p.path.startsWith("/content/tileMap/t1/"))).toBe(true);
  });

  it("flushes the conversion entry before the first local entry, outside the undo stack", async () => {
    const { document, manager } = makeDocument(oldContent());
    const historyManager = { onHistoryEntryCompleted: jest.fn() };
    manager.setHistoryManager(historyManager);
    document.treeMonitor!.enableMonitoring();
    const tile = document.content!.tileMap.get("t1")!.content as VersionedTestTileType;

    tile.setLabel("x");
    await expectEntryToBeComplete(manager, 2);

    expect(manager.document.history.map(e => e.isConversion)).toEqual([true, undefined]);
    expect(historyManager.onHistoryEntryCompleted.mock.calls.map(c => c[2])).toEqual([0, 1]);
    expect(manager.undoStore.undoLevels).toBe(1);
    expect(manager.pendingConversionEntry).toBeUndefined();
  });
});
