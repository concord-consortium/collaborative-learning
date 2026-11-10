import { getSnapshot, Instance } from "mobx-state-tree";
import { cloneDeep } from "lodash";
import { createDocumentModel } from "../document/document";
import { DocumentContentModel } from "../document/document-content";
import { ProblemDocument } from "../document/document-types";
import { HistoryEntry, HistoryOperation } from "./history";
import { applyJsonPatches, toJsonValue } from "./json-patch";
import * as schemaConversion from "./schema-conversion";
import { entryChangesContent, TreeManager } from "./tree-manager";
import { expectEntryToBeComplete } from "./undo-store-test-utils";
import {
  VersionedTestTileType, kVersionedTestTileType, versionedTestTileSchema
} from "./schema-conversion-test-types";

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

describe("load entry", () => {
  afterEach(() => jest.restoreAllMocks());

  it("converts an old tile at load and keeps a pending load entry", () => {
    const { document, manager } = makeDocument(oldContent());
    const tile = document.content!.tileMap.get("t1")!.content as VersionedTestTileType;
    expect(tile.version).toBe("2");
    expect(tile.label).toBe("c");
    const entry = manager.pendingLoadEntry!;
    expect(entry).toBeDefined();
    expect(entry.isLoadEntry).toBe(true);
    expect(entry.background).toBe(true);
    expect(entry.undoable).toBe(false);
    expect(manager.document.history.length).toBe(0);
  });

  it("load entry patches round-trip between the stored JSON and the MST snapshot", () => {
    const { document, manager } = makeDocument(oldContent());
    const entry = HistoryEntry.create(manager.pendingLoadEntry!);
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
    expect(manager.pendingLoadEntry).toBeUndefined();
  });

  it("records nothing for a concurrent document", () => {
    const { document, manager } = makeDocument(oldContent(), { concurrent: true });
    const tile = document.content!.tileMap.get("t1")!.content as VersionedTestTileType;
    expect(tile.version).toBe("2");
    expect(manager.pendingLoadEntry).toBeUndefined();
  });

  describe("a tile its converter declines", () => {
    // The test tile's converter doesn't know version 3, as an older release doesn't know a tile
    // saved by a newer one.
    const newerTileJson = () => ({
      id: "t3", content: { type: kVersionedTestTileType, version: "3", label: "n", items: [{ id: "i1", value: "a" }] }
    });
    const getNewerTile = (document: ReturnType<typeof makeDocument>["document"]) =>
      document.content!.tileMap.get("t3")!.content as VersionedTestTileType;

    it("records nothing and loads the stored JSON, at load and at every later load", async () => {
      const { document, manager } = makeDocument({ tileMap: { t3: newerTileJson() } });
      expect(manager.pendingLoadEntry).toBeUndefined();
      expect(toJsonValue(getSnapshot(getNewerTile(document)))).toEqual(newerTileJson().content);

      document.setContent({ tileMap: { t3: newerTileJson() } } as any);
      expect(manager.pendingLoadEntry).toBeUndefined();
      expect(toJsonValue(getSnapshot(getNewerTile(document)))).toEqual(newerTileJson().content);

      document.treeMonitor!.enableMonitoring();
      getNewerTile(document).setLabel("m");
      await expectEntryToBeComplete(manager, 1);
      expect(manager.document.history.map(e => e.isLoadEntry)).toEqual([undefined]);
      document.treeMonitor!.disableMonitoring();

      const reloaded = makeDocument(toJsonValue(getSnapshot(document.content!)));
      expect(reloaded.manager.pendingLoadEntry).toBeUndefined();
      expect(getNewerTile(reloaded.document).version).toBe("3");
      expect(getNewerTile(reloaded.document).label).toBe("m");
    });

    it("leaves it out of the entry for the tiles the converter accepts", () => {
      const { document, manager } = makeDocument({ tileMap: { ...oldContent().tileMap, t3: newerTileJson() } });
      const patches = manager.pendingLoadEntry!.records![0].patches!;
      expect(patches.length).toBeGreaterThan(0);
      expect(patches.every(p => p.path.startsWith("/content/tileMap/t1/"))).toBe(true);
      expect(getNewerTile(document).version).toBe("3");
    });
  });

  it("warns in development when a converter gives a version that isn't current, and still records it", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const convert = versionedTestTileSchema.convertSnapshot;
    jest.spyOn(versionedTestTileSchema, "convertSnapshot").mockImplementation((tile: any) => {
      const converted = convert(tile);
      return { ...converted, content: { ...converted.content, version: "9" } };
    });

    const { manager } = makeDocument(oldContent());

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/\/content\/tileMap\/t1\b.*"9".*"2"/);
    expect(manager.pendingLoadEntry).toBeDefined();
  });

  it("records nothing when content is an MST instance", () => {
    const content = DocumentContentModel.create(oldContent() as any);
    const convertSpy = jest.spyOn(schemaConversion, "convertContentJson");
    const { manager } = makeDocument(content);
    expect(convertSpy).not.toHaveBeenCalled();
    expect(manager.pendingLoadEntry).toBeUndefined();
  });

  it("includes converted shared models in the same entry", () => {
    const { manager } = makeDocument({
      ...oldContent(),
      sharedModelMap: {
        sm1: { sharedModel: { id: "sm1", type: "VersionedTestSharedModel", val: "x" }, tiles: [] }
      }
    });
    const patches = manager.pendingLoadEntry!.records![0].patches!;
    expect(manager.pendingLoadEntry!.records!.length).toBe(1);
    expect(patches.some(p => p.path.startsWith("/content/sharedModelMap/sm1/sharedModel/"))).toBe(true);
    expect(patches.some(p => p.path.startsWith("/content/tileMap/t1/"))).toBe(true);
  });

  describe("when the content is replaced", () => {
    const liveItemIds = (document: ReturnType<typeof makeDocument>["document"]) =>
      (document.content!.tileMap.get("t1")!.content as VersionedTestTileType).items.map(item => item.id);

    // The ids the pending entry's forward patches give when applied to the stored JSON.
    const entryItemIds = (manager: Instance<typeof TreeManager>, storedContent: any) => {
      const entry = HistoryEntry.create(manager.pendingLoadEntry!);
      const docJson: any = { content: cloneDeep(storedContent) };
      applyJsonPatches(docJson, entry.records[0].getPatches(HistoryOperation.Redo));
      return docJson.content.tileMap.t1.content.items.map((item: any) => item.id);
    };

    it("rebuilds the pending entry from old content so its patches give the live ids", () => {
      const { document, manager } = makeDocument(oldContent());

      document.setContent(oldContent() as any);

      expect(liveItemIds(document)).toHaveLength(1);
      expect(entryItemIds(manager, oldContent())).toEqual(liveItemIds(document));
      expect(manager.document.history.length).toBe(0);
    });

    it("builds a pending entry when old content replaces current content", () => {
      const { document, manager } = makeDocument({
        tileMap: { t1: { id: "t1", content: { type: "VersionedTestTile", version: "2", label: "x" } } }
      });
      expect(manager.pendingLoadEntry).toBeUndefined();

      document.setContent(oldContent() as any);

      expect(entryItemIds(manager, oldContent())).toEqual(liveItemIds(document));
    });

    it("clears the pending entry when the new content is current", () => {
      const { document, manager } = makeDocument(oldContent());
      expect(manager.pendingLoadEntry).toBeDefined();

      document.setContent({
        tileMap: { t1: { id: "t1", content: { type: "VersionedTestTile", version: "2", label: "y" } } }
      } as any);

      expect(manager.pendingLoadEntry).toBeUndefined();
      expect((document.content!.tileMap.get("t1")!.content as VersionedTestTileType).label).toBe("y");
    });

    it("records nothing for a concurrent document", () => {
      const { document, manager } = makeDocument(oldContent(), { concurrent: true });

      document.setContent(oldContent() as any);

      const tile = document.content!.tileMap.get("t1")!.content as VersionedTestTileType;
      expect(tile.version).toBe("2");
      expect(manager.pendingLoadEntry).toBeUndefined();
    });

    it("logs an error when old content replaces a monitored document's content, and not otherwise", () => {
      const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
      const { document } = makeDocument(oldContent());

      document.setContent(oldContent() as any);
      expect(consoleError).not.toHaveBeenCalled();

      document.treeMonitor!.enableMonitoring();
      document.setContent({
        tileMap: { t1: { id: "t1", content: { type: "VersionedTestTile", version: "2", label: "y" } } }
      } as any);
      expect(consoleError).not.toHaveBeenCalled();

      document.setContent(oldContent() as any);
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(consoleError.mock.calls[0][0]).toContain("doc1");
      document.treeMonitor!.disableMonitoring();
      consoleError.mockRestore();
    });

    it("leaves a flushed entry in the history", async () => {
      const { document, manager } = makeDocument(oldContent());
      document.treeMonitor!.enableMonitoring();
      const tile = document.content!.tileMap.get("t1")!.content as VersionedTestTileType;
      tile.setLabel("x");
      await expectEntryToBeComplete(manager, 2);
      const flushed = getSnapshot(manager.document.history[0]);
      document.treeMonitor!.disableMonitoring();

      document.setContent(oldContent() as any);

      expect(getSnapshot(manager.document.history[0])).toEqual(flushed);
    });
  });

  it("flushes the load entry before the first local entry that changes the content, outside the undo stack",
      async () => {
    const { document, manager } = makeDocument(oldContent());
    const historyManager = { onHistoryEntryCompleted: jest.fn() };
    manager.setHistoryManager(historyManager);
    document.treeMonitor!.enableMonitoring();
    const tile = document.content!.tileMap.get("t1")!.content as VersionedTestTileType;

    tile.setLabel("x");
    await expectEntryToBeComplete(manager, 2);

    expect(manager.document.history.map(e => e.isLoadEntry)).toEqual([true, undefined]);
    expect(historyManager.onHistoryEntryCompleted.mock.calls.map(c => c[2])).toEqual([0, 1]);
    expect(manager.undoStore.undoLevels).toBe(1);
    expect(manager.pendingLoadEntry).toBeUndefined();
  });

  it("counts a patch at exactly /content as changing the content", () => {
    const entryAt = (path: string) => ({
      id: "e1",
      records: [{ tree: "doc1", action: "/a", patches: [{ op: "replace", path, value: {} }], inversePatches: [] }]
    } as const);
    expect(entryChangesContent(entryAt("/content"))).toBe(true);
    expect(entryChangesContent(entryAt("/content/tileMap/t1"))).toBe(true);
    expect(entryChangesContent(entryAt("/title"))).toBe(false);
  });

  it("keeps the load entry pending until an entry changes the content", async () => {
    const { document, manager } = makeDocument(oldContent());
    document.treeMonitor!.enableMonitoring();

    document.setTitle("Renamed");
    await expectEntryToBeComplete(manager, 1);

    expect(manager.document.history.map(e => e.isLoadEntry)).toEqual([undefined]);
    expect(manager.pendingLoadEntry).toBeDefined();

    const tile = document.content!.tileMap.get("t1")!.content as VersionedTestTileType;
    tile.setLabel("x");
    await expectEntryToBeComplete(manager, 3);

    expect(manager.document.history.map(e => e.isLoadEntry)).toEqual([undefined, true, undefined]);
    expect(manager.pendingLoadEntry).toBeUndefined();
  });
});
