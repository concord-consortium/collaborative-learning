import fs from "fs";
import path from "path";
import { cloneDeep } from "lodash";
import { getSnapshot } from "mobx-state-tree";
import {
  buildConversionEntry, convertContentJson, convertJsonAtPath, convertModelJsonAtPath, convertOldModelJsonAtPath,
  getModelPath, isOldModelJsonAtPath
} from "./schema-conversion";
import { getEntryPatchesForTree, HistoryEntry, HistoryOperation } from "./history";
import { applyJsonPatches } from "./json-patch";
import { getTileContentInfo, registerTileContentInfo } from "../tiles/tile-content-info";
import { TileContentModel } from "../tiles/tile-content";
import {
  kVersionedTestSharedModelType, kVersionedTestTileType, VersionedTestSharedModel, versionedTestSharedModelSchema,
  versionedTestTileSchema
} from "./schema-conversion-test-types";

const PlainTile = TileContentModel.named("SchemaPlainTile").props({ type: "SchemaPlainTile" });
registerTileContentInfo({ type: "SchemaPlainTile", modelClass: PlainTile, defaultContent: () => PlainTile.create() });

const oldTile = (id: string, text = "hello") =>
  ({ id, content: { type: "VersionedTestTile", text, items: [{ value: "a" }, { value: "b" }] } });
const newTile = (id: string) =>
  ({ id, content: { type: "VersionedTestTile", version: "2", label: "hi", items: [{ id: "i1", value: "a" }] } });
const oldShared = (id: string) => ({ id, type: "VersionedTestSharedModel", val: "x" });
// Version 3 is newer than the test types' converters know, so they decline it.
const newerTile = (id: string) =>
  ({ id, content: { type: kVersionedTestTileType, version: "3", label: "n", items: [] } });
const newerShared = (id: string) => ({ id, type: kVersionedTestSharedModelType, version: "3", value: "x" });

describe("getModelPath", () => {
  it("finds the model that a path is at or below", () => {
    expect(getModelPath("/content/tileMap/t1/content/label")).toBe("/content/tileMap/t1");
    expect(getModelPath("/content/tileMap/t1")).toBe("/content/tileMap/t1");
    expect(getModelPath("/content/sharedModelMap/sm1/sharedModel/value"))
      .toBe("/content/sharedModelMap/sm1/sharedModel");
    expect(getModelPath("/content/sharedModelMap/sm1/tiles/0")).toBeUndefined();
    expect(getModelPath("/content/rowMap/r1")).toBeUndefined();
  });
});

describe("isOldModelJsonAtPath", () => {
  it("detects old versions", () => {
    expect(isOldModelJsonAtPath("/content/tileMap/t1", oldTile("t1"))).toBe(true);
    expect(isOldModelJsonAtPath("/content/tileMap/t1", newTile("t1"))).toBe(false);
    expect(isOldModelJsonAtPath("/content/sharedModelMap/sm1/sharedModel", oldShared("sm1"))).toBe(true);
  });
  it("treats unregistered types and types without a schemaVersion as current", () => {
    const unregistered = { id: "t1", content: { type: "NoSuchTile" } };
    const noSchema = { id: "t1", content: { type: "SchemaPlainTile" } };
    expect(isOldModelJsonAtPath("/content/tileMap/t1", unregistered)).toBe(false);
    expect(isOldModelJsonAtPath("/content/tileMap/t1", noSchema)).toBe(false);
    expect(convertModelJsonAtPath("/content/tileMap/t1", unregistered)).toBe(unregistered);
    expect(isOldModelJsonAtPath("/content/sharedModelMap/s/sharedModel", { id: "s", type: "NoSuch" })).toBe(false);
  });
});

describe("convertOldModelJsonAtPath", () => {
  it("leaves a model its converter declines unconverted", () => {
    const tile = newerTile("t3");
    const shared = newerShared("sm3");
    expect(convertOldModelJsonAtPath("/content/tileMap/t3", tile)).toBeUndefined();
    expect(convertModelJsonAtPath("/content/tileMap/t3", tile)).toBe(tile);
    expect(convertOldModelJsonAtPath("/content/sharedModelMap/sm3/sharedModel", shared)).toBeUndefined();
    expect(convertModelJsonAtPath("/content/sharedModelMap/sm3/sharedModel", shared)).toBe(shared);
  });
});

describe("the test types' snapshot preprocessors", () => {
  it("pass a snapshot their converter declines through to MST unchanged", () => {
    const tile = newerTile("t3");
    expect(versionedTestTileSchema.convertSnapshot(tile)).toBeUndefined();
    expect(getTileContentInfo(kVersionedTestTileType)!.tileSnapshotPreProcessor!(tile)).toBe(tile);

    const shared = newerShared("sm3");
    expect(versionedTestSharedModelSchema.convertSnapshot(shared)).toBeUndefined();
    expect(getSnapshot(VersionedTestSharedModel.create(shared))).toEqual(shared);
  });
});

describe("convertContentJson", () => {
  it("converts old tiles and shared models without changing the input", () => {
    const content = {
      tileMap: { t1: oldTile("t1"), t2: newTile("t2") },
      sharedModelMap: { sm1: { sharedModel: oldShared("sm1"), tiles: ["t1"] } }
    };
    const before = cloneDeep(content);
    const result = convertContentJson(content);
    expect(content).toEqual(before);
    expect(result.convertedPaths.sort()).toEqual(
      ["/content/sharedModelMap/sm1/sharedModel", "/content/tileMap/t1"].sort());
    expect(result.content.tileMap.t1.content.version).toBe("2");
    expect(result.content.tileMap.t1.content.label).toBe("hello");
    expect(result.content.tileMap.t2).toBe(content.tileMap.t2);
    expect(result.content.sharedModelMap.sm1.sharedModel).toEqual(
      { id: "sm1", type: "VersionedTestSharedModel", version: "2", value: "x" });
    expect(result.content.sharedModelMap.sm1.tiles).toEqual(["t1"]);
  });

  it("converts shared models when there is no tileMap, without adding one", () => {
    const content = { sharedModelMap: { sm1: { sharedModel: oldShared("sm1"), tiles: [] } } };
    const result = convertContentJson(content);
    expect(result.convertedPaths).toEqual(["/content/sharedModelMap/sm1/sharedModel"]);
    expect(result.content.sharedModelMap.sm1.sharedModel.version).toBe("2");
    expect("tileMap" in result.content).toBe(false);
  });

  it("leaves models their converters decline as they are", () => {
    const content = {
      tileMap: { t1: oldTile("t1"), t3: newerTile("t3") },
      sharedModelMap: { sm3: { sharedModel: newerShared("sm3"), tiles: [] } }
    };
    const result = convertContentJson(content);
    expect(result.convertedPaths).toEqual(["/content/tileMap/t1"]);
    expect(result.content.tileMap.t3).toBe(content.tileMap.t3);
    expect(result.content.sharedModelMap).toBe(content.sharedModelMap);
  });

  it("returns the same object when nothing is old, including empty content", () => {
    const content = { tileMap: { t2: newTile("t2") } };
    expect(convertContentJson(content)).toEqual({ content, convertedPaths: [] });
    expect(convertContentJson(content).content).toBe(content);
    const empty = {};
    expect(convertContentJson(empty).content).toBe(empty);
  });
});

describe("convertJsonAtPath", () => {
  it("converts the tiles in a tileMap", () => {
    const tileMap = { t1: oldTile("t1"), t2: newTile("t2") };
    const result: any = convertJsonAtPath("/content/tileMap", tileMap);
    expect(result.t1.content.version).toBe("2");
    expect(result.t2).toBe(tileMap.t2);
    expect((tileMap.t1.content as any).text).toBe("hello");
  });

  it("returns the same map when nothing in it is old", () => {
    const tileMap = { t2: newTile("t2") };
    expect(convertJsonAtPath("/content/tileMap", tileMap)).toBe(tileMap);
    const sharedModelMap = { sm1: { sharedModel: { id: "sm1", type: "NoSuch" }, tiles: [] } };
    expect(convertJsonAtPath("/content/sharedModelMap", sharedModelMap)).toBe(sharedModelMap);
  });

  it("converts the shared model in a sharedModelMap entry and keeps its tiles", () => {
    const result: any = convertJsonAtPath("/content/sharedModelMap/sm1",
      { sharedModel: oldShared("sm1"), tiles: ["t1"] });
    expect(result.sharedModel.value).toBe("x");
    expect(result.tiles).toEqual(["t1"]);
  });

  it("converts everything inside /content and a single model path", () => {
    const content = { tileMap: { t1: oldTile("t1") }, sharedModelMap: { sm1: { sharedModel: oldShared("sm1") } } };
    const result: any = convertJsonAtPath("/content", content);
    expect(result.tileMap.t1.content.version).toBe("2");
    expect(result.sharedModelMap.sm1.sharedModel.version).toBe("2");
    expect((convertJsonAtPath("/content/tileMap/t1", oldTile("t1")) as any).content.version).toBe("2");
  });

  it("converts /content without adding a map it doesn't have", () => {
    const result: any = convertJsonAtPath("/content", { sharedModelMap: { sm1: { sharedModel: oldShared("sm1") } } });
    expect(result.sharedModelMap.sm1.sharedModel.version).toBe("2");
    expect("tileMap" in result).toBe(false);
    const tilesOnly: any = convertJsonAtPath("/content", { tileMap: { t1: oldTile("t1") } });
    expect(tilesOnly.tileMap.t1.content.version).toBe("2");
    expect("sharedModelMap" in tilesOnly).toBe(false);
  });

  it("leaves other paths and non-object values alone", () => {
    const value = { a: 1 };
    expect(convertJsonAtPath("/content/rowMap", value)).toBe(value);
    expect(convertJsonAtPath("/content/tileMap/t1/content/label", "x")).toBe("x");
    expect(convertJsonAtPath("/content/tileMap", undefined)).toBeUndefined();
  });
});

describe("buildConversionEntry", () => {
  afterEach(() => jest.restoreAllMocks());

  it("stamps the entry with the time it is built", () => {
    jest.spyOn(Date, "now").mockReturnValue(1234);
    const entry = buildConversionEntry("doc1",
      [{ path: "/content/tileMap/t1", before: oldTile("t1"), after: newTile("t1") }]);
    jest.spyOn(Date, "now").mockReturnValue(5678);
    expect(entry.created).toBe(1234);
    expect(HistoryEntry.create(entry).created.getTime()).toBe(1234);
  });

  it("logs an error when the entry is too large to upload", () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    const tile = (text: string) => ({ id: "t1", content: { type: "VersionedTestTile", version: "2", label: text } });
    const change = (size: number) =>
      ({ path: "/content/tileMap/t1", before: tile("a".repeat(size)), after: tile("b") });

    buildConversionEntry("doc1", [change(500000)]);
    expect(errorSpy).not.toHaveBeenCalled();

    buildConversionEntry("doc1", [change(1100000)]);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toMatch(/conversion entry for document doc1 is \d+ bytes/);
  });

  it("stores inverse patches so undo restores an array that the conversion shortened", () => {
    const before = { id: "t1", content: { type: "VersionedTestTile",
      items: [{ value: "a" }, { value: "b" }, { value: "c" }] } };
    const after = { id: "t1", content: { type: "VersionedTestTile", version: "2", label: "x",
      items: [{ id: "i", value: "a" }] } };
    const entry = HistoryEntry.create(
      buildConversionEntry("doc1", [{ path: "/content/tileMap/t1", before, after }]));
    const doc: any = { content: { tileMap: { t1: cloneDeep(after) } } };
    applyJsonPatches(doc, entry.records[0].getPatches(HistoryOperation.Undo));
    expect(doc.content.tileMap.t1).toEqual(before);
  });
});

describe("a stored conversion entry", () => {
  const fixture = JSON.parse(
    fs.readFileSync(path.join(__dirname, "fixtures", "conversion-chain.json"), "utf8"));

  it("is still recognized when it is loaded back", () => {
    const stored = fixture.entries.find((e: any) => e.isConversion);
    const entry = HistoryEntry.create(stored);
    expect(entry.records[0].patches.length).toBeGreaterThan(0);
    expect(getEntryPatchesForTree(entry, stored.tree, HistoryOperation.Undo)).toEqual([]);
    expect(getEntryPatchesForTree(entry, stored.tree, HistoryOperation.Redo)).toEqual([]);
  });
});
