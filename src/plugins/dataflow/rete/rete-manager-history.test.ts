// How the actions a running program makes are recorded in the document history, tested through a
// real document with history enabled.
import { when } from "mobx";
import { getSnapshot, Instance } from "mobx-state-tree";
import { createDocumentModel } from "../../../models/document/document";
import { ProblemDocument } from "../../../models/document/document-types";
import { HistoryEntryType } from "../../../models/history/history";
import { TreeManager } from "../../../models/history/tree-manager";
import { specStores } from "../../../models/stores/spec-stores";
import { registerTileTypes } from "../../../register-tile-types";
import { DataflowContentModelType } from "../model/dataflow-content";
import { ReteManager } from "./rete-manager";

jest.mock("firebase/app", () => ({
  functions: () => ({ httpsCallable: () => jest.fn() })
}));

// The default svg mock is a string, and the Math block's operator dropdown renders its icon as a
// component.
jest.mock("../../shared-assets/icons/dataflow/math/add.svg", () => function AddIconMock() { return null; });
jest.mock("../../shared-assets/icons/dataflow/math/subtract.svg", () => function SubtractIconMock() { return null; });
jest.mock("../../shared-assets/icons/dataflow/math/multiply.svg", () => function MultiplyIconMock() { return null; });
jest.mock("../../shared-assets/icons/dataflow/math/divide.svg", () => function DivideIconMock() { return null; });

registerTileTypes(["Dataflow"]);

const kRunningStatePath = /^\/content\/tileMap\/df1\/content\/program\/nodes\/[^/]+\/data\/(tickEntries\/|tilt$)/;

async function setupProgram() {
  const docModel = createDocumentModel({
    uid: "1", type: ProblemDocument, key: "test",
    content: { tiles: [{ id: "df1", content: { type: "Dataflow" } }] } as any
  });
  docModel.treeMonitor!.enableMonitoring();

  const treeManager = docModel.treeManagerAPI as Instance<typeof TreeManager>;
  const content = docModel.content!.tileMap.get("df1")!.content as DataflowContentModelType;
  const manager = new ReteManager(
    content.program, "df1", document.createElement("div"), content, specStores(), false
  );
  await manager.setupComplete;
  manager.tickAndProcessNodes();
  await settle(treeManager);
  return { content, manager, treeManager, undoStore: treeManager.undoStore };
}

/** Waits for every history entry to complete, including the shared model exchanges they wait on. */
async function settle(treeManager: Instance<typeof TreeManager>) {
  await new Promise(resolve => setTimeout(resolve));
  const { history } = treeManager.document;
  await when(() => history.every(entry => entry.state === "complete"), { timeout: 5000 });
}

function entriesFor(treeManager: Instance<typeof TreeManager>, actionSuffix: string) {
  return treeManager.document.history.filter(entry => entry.action?.endsWith(actionSuffix));
}

function patchPaths(entry: HistoryEntryType) {
  return entry.records.flatMap(record => record.patches.map(patch => patch.path));
}

describe("ReteManager history entries", () => {
  const managers: ReteManager[] = [];
  afterEach(() => {
    managers.splice(0).forEach(m => m.dispose());
  });

  it("records a tick as a background entry owned by its tile", async () => {
    const { manager, treeManager } = await setupProgram();
    managers.push(manager);

    const ticks = entriesFor(treeManager, "/tickAndProcess");
    expect(ticks).toHaveLength(1);
    expect(ticks[0].background).toBe(true);
    expect(ticks[0].producerTileId).toBe("df1");
    expect(ticks[0].undoable).toBe(false);
  });

  it("records a running recording's case as a background entry and a single sample as a user entry", async () => {
    const { content, manager, treeManager } = await setupProgram();
    managers.push(manager);

    content.recordTickCase();
    await settle(treeManager);
    const tickCases = entriesFor(treeManager, "/recordTickCase");
    expect(tickCases).toHaveLength(1);
    expect(tickCases[0].background).toBe(true);
    expect(tickCases[0].producerTileId).toBe("df1");

    content.recordSingleSample(jest.fn());
    await settle(treeManager);
    const samples = entriesFor(treeManager, "/recordSingleSample");
    expect(samples).toHaveLength(1);
    expect(samples[0].background).toBeUndefined();
    const snapshot = JSON.parse(JSON.stringify(getSnapshot(samples[0])));
    expect(snapshot).not.toHaveProperty("background");
    expect(snapshot).not.toHaveProperty("producerTileId");
  });

  it("records the recompute after a program edit as a background entry that only touches running state",
      async () => {
    const { content, manager, treeManager } = await setupProgram();
    managers.push(manager);

    await manager.createAndAddNode("Number");
    await settle(treeManager);
    await manager.createAndAddNode("Math");
    await settle(treeManager);
    const [numberId, mathId] = [...content.program.nodes.keys()];
    await manager.connect(numberId, "value", mathId, "num1");
    await settle(treeManager);
    manager.removeInputConnection(mathId, "num1");
    await settle(treeManager);
    await manager.removeNodeAndConnections(numberId);
    await settle(treeManager);

    const recomputes = entriesFor(treeManager, "/processAfterProgramChange");
    // A recompute that changes nothing records no entry, as after the first block, when no block
    // is derived yet. Each later edit recomputes the Math block's value.
    expect(recomputes.length).toBeGreaterThanOrEqual(4);
    recomputes.forEach(entry => {
      expect(entry.background).toBe(true);
      patchPaths(entry).forEach(path => expect(path).toMatch(kRunningStatePath));
    });
  });

  it("undoes a connection edit in one undo", async () => {
    const { content, manager, treeManager, undoStore } = await setupProgram();
    managers.push(manager);
    await manager.createAndAddNode("Number");
    await manager.createAndAddNode("Math");
    await settle(treeManager);
    const [numberId, mathId] = [...content.program.nodes.keys()];

    const undoLevels = undoStore.undoLevels;
    await manager.connect(numberId, "value", mathId, "num1");
    await settle(treeManager);
    expect(content.program.connections.size).toBe(1);
    expect(undoStore.undoLevels).toBe(undoLevels + 1);

    undoStore.undo();
    await settle(treeManager);
    expect(content.program.connections.size).toBe(0);
  });
});
