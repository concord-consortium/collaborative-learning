// the tile component is not needed here and warns about missing CSS when imported under jest
jest.mock("./components/dataflow-tile", () => ({ __esModule: true, default: () => null }));

import { cloneDeep } from "lodash";
import { getSnapshot, Instance } from "mobx-state-tree";
import { createDocumentModel } from "../../models/document/document";
import { ProblemDocument } from "../../models/document/document-types";
import { HistoryEntry, HistoryOperation } from "../../models/history/history";
import { applyJsonPatches, toJsonValue } from "../../models/history/json-patch";
import { TreeManager } from "../../models/history/tree-manager";
import { getTileContentInfo } from "../../models/tiles/tile-content-info";
import { DataflowContentModelType } from "./model/dataflow-content";
import "../../models/shared/shared-data-set-registration";
import "../../models/shared/shared-program-data-registration";
import "./dataflow-registration";
import legacyDataflowDocument from "./test-docs/dataflow-0.1.0.json";

describe("Dataflow schemaVersion", () => {
  const schemaVersion = getTileContentInfo("Dataflow")!.schemaVersion!;

  it("reports the program id as the version", () => {
    expect(schemaVersion.currentVersion).toBe("dataflow@1");
    expect(schemaVersion.getVersion({ content: { program: { id: "dataflow@0.1.0" } } })).toBe("dataflow@0.1.0");
    expect(schemaVersion.getVersion({ content: { program: { id: "dataflow@1" } } })).toBe("dataflow@1");
  });

  it("converts a legacy tile to the current version", () => {
    const legacy = { id: "t1", content: { type: "Dataflow", program: { id: "dataflow@0.1.0",
      nodes: { 1: { id: 1, name: "Number", data: { nodeValue: 3 }, inputs: {}, outputs: {}, x: 10, y: 20 } },
      values: { 1: { currentValues: { nodeValue: 3 } } } } } };
    const converted = schemaVersion.convertSnapshot(legacy);
    expect(schemaVersion.getVersion(converted)).toBe(schemaVersion.currentVersion);
    expect(Object.keys(converted.content.program.nodes)).toEqual(["1@t1"]);
  });

  describe("a program saved by a newer release", () => {
    const newerTile = () => ({ id: "t1", content: { type: "Dataflow", program: { id: "dataflow@2", nodes: {} } } });

    it("is declined by convertSnapshot and passed through unchanged by the preprocessor", () => {
      const tile = newerTile();
      expect(schemaVersion.convertSnapshot(tile)).toBeUndefined();
      expect(getTileContentInfo("Dataflow")!.tileSnapshotPreProcessor!(tile)).toBe(tile);
    });

    it("records nothing and loads as before, at load and at every later load", () => {
      const load = (content: any) => {
        const document = createDocumentModel({ uid: "1", type: ProblemDocument, key: "doc1", content });
        const manager = document.treeManagerAPI as Instance<typeof TreeManager>;
        const tile = document.content!.tileMap.get("t1")!.content as DataflowContentModelType;
        return { document, manager, tile };
      };
      const first = load({ tileMap: { t1: newerTile() } });
      expect(first.manager.pendingLoadEntry).toBeUndefined();
      expect(first.tile.program.id).toBe("dataflow@2");

      const later = load(toJsonValue(getSnapshot(first.document.content!)));
      expect(later.manager.pendingLoadEntry).toBeUndefined();
      expect(later.tile.program.id).toBe("dataflow@2");
    });
  });

  it("records a load entry for a legacy document whose patches turn the stored tile into the live one", () => {
    const tileId = "CIUYXl4cwYYrfP5t";
    const stored = cloneDeep(legacyDataflowDocument);
    const document = createDocumentModel({ uid: "1", type: ProblemDocument, key: "doc1", content: stored });
    const manager = document.treeManagerAPI as Instance<typeof TreeManager>;
    expect(manager.pendingLoadEntry).toBeDefined();
    const record = HistoryEntry.create(manager.pendingLoadEntry!).records[0];
    const liveTile = toJsonValue(getSnapshot(document.content!.tileMap.get(tileId)!));
    const storedTile = toJsonValue(legacyDataflowDocument.tileMap[tileId]);
    expect(liveTile).not.toEqual(storedTile);

    // The rest of the document differs between stored and live (the live one has shared models),
    // so only the tile is compared.
    const json: any = { content: cloneDeep(legacyDataflowDocument) };
    applyJsonPatches(json, record.getPatches(HistoryOperation.Redo));
    expect(json.content.tileMap[tileId]).toEqual(liveTile);
    applyJsonPatches(json, record.getPatches(HistoryOperation.Undo));
    expect(json.content.tileMap[tileId]).toEqual(storedTile);
  });

  it("returns a current tile unchanged", () => {
    const tile = { id: "t1", content: { type: "Dataflow", program: { id: "dataflow@1", nodes: {} } } };
    expect(schemaVersion.convertSnapshot(tile)).toBe(tile);
  });

  it("treats a tile with no program as current", () => {
    expect(schemaVersion.getVersion({ content: {} })).toBe("dataflow@1");
  });

  it("treats a program with no id as legacy only when it has the legacy values map", () => {
    expect(schemaVersion.getVersion({ content: { program: { nodes: {}, values: {} } } })).toBe("dataflow@0.1.0");
    expect(schemaVersion.getVersion({ content: { program: { nodes: {} } } })).toBe("dataflow@1");
  });

  it("converts a program with no id and a values map, and returns one with neither unchanged", () => {
    const noIdLegacy = { id: "t1", content: { type: "Dataflow", program: { nodes: {}, values: {} } } };
    expect(schemaVersion.convertSnapshot(noIdLegacy).content.program.id).toBe("dataflow@1");
    const noIdCurrent = { id: "t1", content: { type: "Dataflow", program: { nodes: {} } } };
    expect(schemaVersion.convertSnapshot(noIdCurrent)).toBe(noIdCurrent);
  });
});
