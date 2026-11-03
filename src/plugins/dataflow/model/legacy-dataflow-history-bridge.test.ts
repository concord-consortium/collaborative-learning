// the tile component is not needed here and warns about missing CSS when imported under jest
jest.mock("../components/dataflow-tile", () => ({ __esModule: true, default: () => null }));

import fs from "fs";
import path from "path";
import { cloneDeep } from "lodash";
import { getSnapshot, IJsonPatch, Instance } from "mobx-state-tree";
import { registerTileTypes } from "../../../register-tile-types";
import { createDocumentModel, DocumentModelType } from "../../../models/document/document";
import { DocumentContentModel } from "../../../models/document/document-content";
import { ProblemDocument } from "../../../models/document/document-types";
import { HistoryEntrySnapshot } from "../../../models/history/history";
import { toJsonValue } from "../../../models/history/json-patch";
import { CDocument, TreeManager } from "../../../models/history/tree-manager";
import { DataflowContentModelType } from "./dataflow-content";
import { isLegacyDataflowPatch, legacyDataflowHistoryBridge } from "./legacy-dataflow-history-bridge";

const kTreeId = "doc1";
const kTilePath = "/content/tileMap/t1";
const kProgramPath = `${kTilePath}/content/program`;
const kLegacyProgram = { id: "dataflow@0.1.0", nodes: {}, values: {} };

interface IFixture {
  content: any;
  history: HistoryEntrySnapshot[];
}

function readFixture(name: string): IFixture {
  const fixturePath = path.join(__dirname, "fixtures", "legacy-history", `${name}.json`);
  return JSON.parse(fs.readFileSync(fixturePath, "utf8"));
}

/** Loads a fixture's end content and history the way a document with stored history is loaded. */
function loadFixture(name: string) {
  const fixture = readFixture(name);
  const content = DocumentContentModel.create(cloneDeep(fixture.content));
  const document = createDocumentModel({ uid: "u1", type: ProblemDocument, key: kTreeId, content: content as any });
  const manager = document.treeManagerAPI as Instance<typeof TreeManager>;
  manager.setChangeDocument(CDocument.create({ history: cloneDeep(fixture.history) }));
  manager.setNumHistoryEntriesApplied(fixture.history.length);
  return { fixture, document, manager };
}

function getProgramJson(document: DocumentModelType): any {
  const tile = document.content!.tileMap.get("t1")!;
  return toJsonValue(getSnapshot((tile.content as DataflowContentModelType).program));
}

let entryCount = 0;
function makeEntry(patches: IJsonPatch[], extra: Partial<HistoryEntrySnapshot> = {}, tree = kTreeId) {
  const action = "/content/tileMap/t1/content/setProgram";
  return {
    id: `entry-${++entryCount}`, tree: kTreeId, action, undoable: true, state: "complete" as const,
    records: [{ tree, action, patches, inversePatches: [] }],
    ...extra
  };
}

function findConversions(entries: HistoryEntrySnapshot[]) {
  const history = CDocument.create({ history: entries }).history;
  return legacyDataflowHistoryBridge.findVirtualConversions(history, kTreeId);
}

const addLegacyTile = (tileId = "t1") => makeEntry([{
  op: "add", path: `/content/tileMap/${tileId}`,
  value: { id: tileId, content: { type: "Dataflow", program: kLegacyProgram } }
}]);
const legacyValue = (tileId = "t1") => makeEntry([{
  op: "add", path: `/content/tileMap/${tileId}/content/program/values/1`, value: { currentValues: {} }
}]);
const currentMove = (tileId = "t1") => makeEntry([{
  op: "replace", path: `/content/tileMap/${tileId}/content/program/nodes/1@${tileId}/x`, value: 10
}]);

describe("isLegacyDataflowPatch", () => {
  const patch = (patchPath: string, value?: unknown): IJsonPatch => ({ op: "replace", path: patchPath, value });

  it("is true for legacy paths", () => {
    expect(isLegacyDataflowPatch(patch(`${kProgramPath}/values/3/currentValues/nodeValue`, 1))).toBe(true);
    expect(isLegacyDataflowPatch({ op: "add", path: `${kProgramPath}/nodes/3`, value: { id: 3 } })).toBe(true);
    expect(isLegacyDataflowPatch(patch(`${kProgramPath}/nodes/3/x`, 10))).toBe(true);
    expect(isLegacyDataflowPatch({ op: "remove", path: `${kProgramPath}/nodes/abc/inputs/num1` })).toBe(true);
    expect(isLegacyDataflowPatch(patch(`${kProgramPath}/nodes/abc/outputs/num/connections/x`, {}))).toBe(true);
  });

  it("is true for a program, content or tile value holding a legacy program", () => {
    expect(isLegacyDataflowPatch(patch(kProgramPath, kLegacyProgram))).toBe(true);
    expect(isLegacyDataflowPatch(patch(`${kTilePath}/content`, { program: kLegacyProgram }))).toBe(true);
    expect(isLegacyDataflowPatch({ op: "add", path: kTilePath, value: { content: { program: kLegacyProgram } } }))
      .toBe(true);
  });

  it("is false for current-format and unrelated patches", () => {
    const currentProgram = { id: "dataflow@1", nodes: {}, connections: {} };
    expect(isLegacyDataflowPatch(patch(`${kProgramPath}/nodes/1@t1/x`, 10))).toBe(false);
    expect(isLegacyDataflowPatch(patch(`${kProgramPath}/connections/abc`, {}))).toBe(false);
    expect(isLegacyDataflowPatch(patch(kProgramPath, currentProgram))).toBe(false);
    expect(isLegacyDataflowPatch({ op: "add", path: kTilePath, value: { content: { program: currentProgram } } }))
      .toBe(false);
    expect(isLegacyDataflowPatch(patch(`${kTilePath}/content/programZoom/dx`, 1))).toBe(false);
    expect(isLegacyDataflowPatch(patch(`${kTilePath}/content/values/1`, 1))).toBe(false);
    expect(isLegacyDataflowPatch(patch("/content/rowMap/r1/nodes/1", 1))).toBe(false);
  });
});

describe("legacyDataflowHistoryBridge", () => {
  it("puts the conversion after the last legacy entry of each tile", () => {
    const conversions = findConversions([
      addLegacyTile("t1"), legacyValue("t1"), addLegacyTile("t2"), currentMove("t1"), legacyValue("t2")
    ]);
    expect(conversions.map(c => [c.path, c.position])).toEqual([
      ["/content/tileMap/t1", 2], ["/content/tileMap/t2", 5]
    ]);
  });

  it("rebuilds the legacy tile by replaying forward from its add", () => {
    const { history } = readFixture("whole-program-set-program");
    const [conversion] = findConversions(history);
    const addedTile: any = history[0].records![0].patches[0].value;
    const setProgramPatch = history[1].records![0].patches[0];
    expect(conversion.position).toBe(2);
    expect(conversion.oldJson)
      .toEqual({ ...addedTile, content: { ...addedTile.content, program: setProgramPatch.value } });
  });

  it("replays the patches after the add in its own entry", () => {
    const add = makeEntry([
      ...addLegacyTile().records[0].patches,
      { op: "replace", path: `${kTilePath}/title`, value: "Program 2" }
    ]);
    const [conversion] = findConversions([add, legacyValue(), currentMove()]);
    expect((conversion.oldJson as any).title).toBe("Program 2");
  });

  it("can't rebuild the legacy tile without an add or when a patch doesn't apply", () => {
    expect(findConversions([legacyValue(), currentMove()])[0].oldJson).toBeUndefined();
    const missingParent = makeEntry([{ op: "replace", path: `${kProgramPath}/values/9/currentValues/x`, value: 1 }]);
    expect(findConversions([addLegacyTile(), missingParent, currentMove()])[0].oldJson).toBeUndefined();
  });

  it("ignores patches recorded for other trees", () => {
    expect(findConversions([makeEntry([{ op: "remove", path: `${kProgramPath}/values/1` }], {}, "other")]))
      .toEqual([]);
  });

  it("skips tiles a stored conversion entry already covers", () => {
    const conversionEntry = makeEntry([{ op: "replace", path: `${kProgramPath}/id`, value: "dataflow@1" }],
      { isLoadEntry: true, undoable: false });
    const conversions = findConversions([
      addLegacyTile("t1"), addLegacyTile("t2"), legacyValue("t1"), legacyValue("t2"), conversionEntry, currentMove()
    ]);
    expect(conversions.map(c => c.path)).toEqual(["/content/tileMap/t2"]);
  });
});

describe("playback of legacy DataFlow history", () => {
  beforeAll(async () => {
    await registerTileTypes(["Dataflow"]);
  });

  const crossable = [
    "legacy-ticks", "node-moves-and-additions", "connection-added-and-deleted", "whole-program-set-program",
    "legacy-values-in-other-actions"
  ];
  crossable.forEach(name => {
    it(`plays ${name} back to the start and forward to the end`, async () => {
      const { fixture, document, manager } = loadFixture(name);
      const endProgram = getProgramJson(document);
      const endConnectionIds = Object.keys(fixture.content.tileMap.t1.content.program.connections);
      expect(Object.keys(endProgram.connections)).toEqual(endConnectionIds);
      expect(manager.needsJsonCopy).toBe(true);

      await manager.goToHistoryEntryPosition(0);
      expect(manager.historyPlaybackFailures).toEqual([]);
      expect(manager.numHistoryEventsApplied).toBe(0);
      expect(manager.oldestReachablePosition).toBeUndefined();

      await manager.goToHistoryEntryPosition(fixture.history.length);
      expect(manager.historyPlaybackFailures).toEqual([]);
      expect(manager.numHistoryEventsApplied).toBe(fixture.history.length);
      expect(getProgramJson(document)).toEqual(endProgram);
    });
  });

  it("stops at the boundary of a tile with no add entry", async () => {
    const { fixture, document, manager } = loadFixture("no-add-entry");
    const endProgram = getProgramJson(document);
    const [conversion] = legacyDataflowHistoryBridge.findVirtualConversions(manager.document.history, kTreeId);
    expect(conversion.oldJson).toBeUndefined();

    await manager.goToHistoryEntryPosition(0);
    expect(manager.numHistoryEventsApplied).toBe(conversion.position);
    expect(manager.oldestReachablePosition).toBe(conversion.position);
    expect(manager.historyPlaybackFailures).toEqual([]);

    await manager.goToHistoryEntryPosition(fixture.history.length);
    expect(manager.historyPlaybackFailures).toEqual([]);
    expect(getProgramJson(document)).toEqual(endProgram);
  });
});
