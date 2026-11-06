// The detach-on-structural-change behavior and the node/column rename, tested through a real
// document with history enabled.
//
// It lives in its own file because it needs the undo harness — createDocumentModel, an enabled
// tree monitor and a TreeManager — plus the firebase mock that pulls in, none of which the rest of
// dataflow-content.test.ts wants.
//
// The question this file exists to answer is whether a shared-model change made inside a tile
// action joins that action's history entry. Shared models live in the document tree rather than
// the tile's, and CLUE's history is multi-tree, so if they landed in a separate entry the detach
// would need one undo of its own and the whole approach would have to move to a document-level
// action.
import { when } from "mobx";
import { Instance } from "mobx-state-tree";
import { createDocumentModel } from "../../../models/document/document";
import { ProblemDocument } from "../../../models/document/document-types";
import { TreeManager } from "../../../models/history/tree-manager";
import { registerTileTypes } from "../../../register-tile-types";
import { uniqueId } from "../../../utilities/js-utils";
import { DataflowContentModelType, kDataflowTableTileType } from "./dataflow-content";
import { recordCase } from "./utilities/recording-utilities";

jest.mock("firebase/app", () => ({
  functions: () => ({ httpsCallable: () => jest.fn() })
}));

registerTileTypes(["Dataflow", "Table"]);

function setupDocumentWithLinkedTable() {
  // The content goes in as a SNAPSHOT, not a built model: createDocumentModel only points the
  // shared model manager at content it constructs itself (DocumentModel.setContent), and without
  // that the Dataflow tile's afterAttach never sees a ready manager, so no SharedDataSet exists.
  const docModel = createDocumentModel({
    uid: "1", type: ProblemDocument, key: "test",
    content: {
      tiles: [
        { id: "df1", content: { type: "Dataflow" } },
        { id: "table1", content: { type: kDataflowTableTileType } }
      ]
    } as any
  });
  docModel.treeMonitor!.enableMonitoring();

  const docContent = docModel.content!;
  const manager = docModel.treeManagerAPI as Instance<typeof TreeManager>;
  const content = docContent.tileMap.get("df1")!.content as DataflowContentModelType;
  const tableContent = docContent.tileMap.get("table1")!.content as any;

  // addLinkedTile is the production path, and it severs the Table's own auto-created SharedDataSet
  // before attaching the program's. Adding the program's dataset directly would leave the table
  // holding two, and table.dataSet reads the first.
  content.addLinkedTile("table1");

  return { docContent, content, tableContent, manager, undoStore: manager.undoStore };
}

/** Waits for a named action to reach the top of the history and complete.
 *
 * Not expectEntryToBeComplete, which wants an exact entry count: a capture is several actions, and
 * an action that touches shared models records through an exchange, so its entry arrives after
 * entries for actions that ran later. Waiting on "the last entry is complete" would return
 * immediately against the PREVIOUS entry and undo the wrong thing. */
async function settleOn(manager: Instance<typeof TreeManager>, modelActionKey: string) {
  const history = manager.document.history;
  await when(
    () => history.at(-1)?.modelActionKey === modelActionKey && history.at(-1)?.state === "complete",
    { timeout: 5000 });
  expect(history.at(-1)?.activeExchanges.toJSON()).toEqual([]);
}

/** Gives the program two named nodes with values, then captures one point into the table. With
 * `connected`, the first node feeds the second through connection "c1". */
function captureOnePoint(content: DataflowContentModelType, { connected = false } = {}) {
  ["Sensor", "Servo"].forEach((name, i) => {
    content.program.addNodeSnapshot({
      id: `node-${i}`, name: "Number", x: 0, y: 0,
      data: { type: "Number", orderedDisplayName: name }
    } as any);
  });
  if (connected) {
    content.program.addConnection({
      id: "c1", source: "node-0", sourceOutput: "value", target: "node-1", targetInput: "nodeValueA"
    } as any);
  }
  content.program.addNewTick(uniqueId());
  [0, 1].forEach(i => content.program.nodes.get(`node-${i}`)?.data.setNodeValue(400 + i));
  content.prepareCapture();
  recordCase(content);
}

describe("detaching a linked table on a structural change", () => {
  it("hands the table its own copy of the data and stops it following the program", async () => {
    const { content, tableContent, manager } = setupDocumentWithLinkedTable();
    captureOnePoint(content);
    await settleOn(manager, "DataSet.addCanonicalCasesWithIDs");
    expect(content.linkedTableTileId).toBe("table1");

    content.program.addNodeSnapshot({
      id: "node-2", name: "Number", x: 0, y: 0, data: { type: "Number", orderedDisplayName: "Extra" }
    } as any);

    expect(content.linkedTableTileId).toBeUndefined();
    // The student's numbers survive the detach.
    expect(tableContent.dataSet.cases).toHaveLength(1);
  });

  // The time in the name says when that capture ran, so it belongs to the capture: the table keeps
  // it, and the program -- which no longer has a recording -- goes back to its plain name.
  it("leaves the capture's time on the table and takes it off the program", async () => {
    const { content, tableContent, manager } = setupDocumentWithLinkedTable();
    content.setContentTitle("Program 1");
    captureOnePoint(content);
    await settleOn(manager, "DataSet.addCanonicalCasesWithIDs");

    content.program.addNodeSnapshot({
      id: "node-2", name: "Number", x: 0, y: 0, data: { type: "Number", orderedDisplayName: "Extra" }
    } as any);

    expect(tableContent.dataSet.name).toMatch(/^Program 1 \d{2}:\d{2}:\d{2}$/);
    expect(content.dataSet.name).toBe("Program 1");
  });

  it("leaves an empty capture alone", () => {
    const { content } = setupDocumentWithLinkedTable();
    content.program.addNodeSnapshot({
      id: "node-9", name: "Number", x: 0, y: 0, data: { type: "Number", orderedDisplayName: "N" }
    } as any);
    expect(content.linkedTableTileId).toBe("table1");
  });

  it("does not detach when a node is renamed", () => {
    const { content } = setupDocumentWithLinkedTable();
    captureOnePoint(content);
    content.renameNode("node-0", "Renamed");
    expect(content.linkedTableTileId).toBe("table1");
  });

  it("does not detach when a node's value changes", () => {
    const { content } = setupDocumentWithLinkedTable();
    captureOnePoint(content);
    content.program.nodes.get("node-0")?.data.setNodeValue(999);
    expect(content.linkedTableTileId).toBe("table1");
  });
});

// A node and its column share one name, so renaming either is one change: one history entry, and
// one undo that puts both names back.
describe("renaming a node or its column with history", () => {
  const nodeName = (content: DataflowContentModelType, id: string) =>
    content.program.nodes.get(id)!.data.orderedDisplayName;

  /** The action of each history entry that renamed a node or a column.
   *
   * Picked out by patch rather than by counting entries: an entry from setting up the link can
   * arrive after the ones that follow it (see settleOn). */
  const renameEntryActions = (manager: Instance<typeof TreeManager>) =>
    manager.document.history
      .filter(entry => entry.modelActionKey !== "UndoStore.undo")
      .filter(entry => entry.records.some(record => record.patches.some(patch =>
        /\/orderedDisplayName$|\/attributes\/\d+\/name$/.test(patch.path))))
      .map(entry => entry.modelActionKey);

  it("records a column rename and the node rename it causes as one entry", async () => {
    const { content, tableContent, manager, undoStore } = setupDocumentWithLinkedTable();
    captureOnePoint(content);
    await settleOn(manager, "DataSet.addCanonicalCasesWithIDs");
    const servoAttr = tableContent.dataSet.attributes[2];

    tableContent.dataSet.setAttributeName(servoAttr.id, "Gripper");
    await settleOn(manager, "DataSet.setAttributeName");

    expect(nodeName(content, "node-1")).toBe("Gripper");
    expect(renameEntryActions(manager)).toEqual(["DataSet.setAttributeName"]);

    undoStore.undo();
    await settleOn(manager, "UndoStore.undo");

    expect(servoAttr.name).toBe("Servo");
    expect(nodeName(content, "node-1")).toBe("Servo");
  });

  it("records a node rename and the column rename it causes as one entry", async () => {
    const { content, tableContent, manager, undoStore } = setupDocumentWithLinkedTable();
    captureOnePoint(content);
    await settleOn(manager, "DataSet.addCanonicalCasesWithIDs");
    const columnNames = () => tableContent.dataSet.attributes.map((a: any) => a.name);

    content.renameNode("node-0", "Thermometer");
    await settleOn(manager, "DataflowTool.renameNode");

    expect(columnNames()).toEqual(["Point", "Thermometer", "Servo"]);
    expect(renameEntryActions(manager)).toEqual(["DataflowTool.renameNode"]);

    undoStore.undo();
    await settleOn(manager, "UndoStore.undo");

    expect(columnNames()).toEqual(["Point", "Sensor", "Servo"]);
    expect(nodeName(content, "node-0")).toBe("Sensor");
  });
});

// A student who undoes back to the program the data was captured against gets the live link back.
// Undoing a detach also removes the dataset it made for the program, which is what used to throw
// "Not a child" from the history code.
describe("undoing the change that caused a detach", () => {
  /** The action of each history entry that changed which tiles share which dataset. Picked out by
   * patch rather than by counting entries; see renameEntryActions. */
  const linkEntryActions = (manager: Instance<typeof TreeManager>) =>
    manager.document.history
      .filter(entry => entry.modelActionKey !== "UndoStore.undo")
      .filter(entry => entry.records.some(record => record.patches.some(patch =>
        /\/sharedModelMap\/[^/]+(\/tiles(\/\d+)?)?$/.test(patch.path))))
      .map(entry => entry.modelActionKey);

  it("records the change and the detach as one entry, and one undo re-links the table", async () => {
    const { content, tableContent, undoStore, manager } = setupDocumentWithLinkedTable();
    captureOnePoint(content);
    await settleOn(manager, "DataSet.addCanonicalCasesWithIDs");
    const capture = content.dataSet;

    content.program.addNodeSnapshot({
      id: "node-2", name: "Number", x: 0, y: 0, data: { type: "Number", orderedDisplayName: "Extra" }
    } as any);
    await settleOn(manager, "DataflowProgram.addNodeSnapshot");
    expect(content.linkedTableTileId).toBeUndefined();
    expect(linkEntryActions(manager)).toEqual(["DataflowTool.addLinkedTile", "DataflowProgram.addNodeSnapshot"]);

    undoStore.undo();
    await settleOn(manager, "UndoStore.undo");

    expect(content.program.nodes.has("node-2")).toBe(false);
    expect(content.linkedTableTileId).toBe("table1");
    expect(content.dataSet).toBe(capture);
    expect(tableContent.dataSet).toBe(capture);
    expect(capture.cases).toHaveLength(1);
  });

  // Removing a node also removes its connections, and each removal reports a structural change.
  it("re-links after a change that reports more than once", async () => {
    const { content, undoStore, manager } = setupDocumentWithLinkedTable();
    captureOnePoint(content, { connected: true });
    await settleOn(manager, "DataSet.addCanonicalCasesWithIDs");
    expect(content.linkedTableTileId).toBe("table1");

    content.program.removeNodeAndConnections("node-0");
    await settleOn(manager, "DataflowProgram.removeNodeAndConnections");
    expect(content.linkedTableTileId).toBeUndefined();

    undoStore.undo();
    await settleOn(manager, "UndoStore.undo");

    expect(content.program.nodes.has("node-0")).toBe(true);
    expect(content.program.connections.has("c1")).toBe(true);
    expect(content.linkedTableTileId).toBe("table1");
  });
});

// The first Table It or sample adds a table, sets up its columns and, for a sample, writes a row. All
// of it is one change to the student, so one history entry and one undo.
describe("the first capture into a new table", () => {
  async function setupProgramWithoutTable() {
    const docModel = createDocumentModel({
      uid: "1", type: ProblemDocument, key: "test",
      content: { tiles: [{ id: "df1", content: { type: "Dataflow" } }] } as any
    });
    docModel.treeMonitor!.enableMonitoring();
    const docContent = docModel.content!;
    const manager = docModel.treeManagerAPI as Instance<typeof TreeManager>;
    const tile = docContent.tileMap.get("df1")!;
    const content = tile.content as DataflowContentModelType;
    ["Sensor", "Servo"].forEach((name, i) => {
      content.program.addNodeSnapshot({
        id: `node-${i}`, name: "Number", x: 0, y: 0,
        data: { type: "Number", orderedDisplayName: name }
      } as any);
    });
    content.program.addNewTick(uniqueId());
    [0, 1].forEach(i => content.program.nodes.get(`node-${i}`)?.data.setNodeValue(400 + i));
    await settleOn(manager, "NumberNodeModel.setNodeValue");
    // What the toolbar buttons pass: AddTilesContext is the document content.
    const addTable = () => docContent.addTileAfter(kDataflowTableTileType, tile, [content.sharedModel!]);
    return { docContent, content, manager, addTable };
  }

  it("records a sample's new table, columns and row as one entry, and one undo removes them", async () => {
    const { docContent, content, manager, addTable } = await setupProgramWithoutTable();
    const history = manager.document.history;
    const entriesBefore = history.length;

    content.recordSingleSample(addTable);
    await settleOn(manager, "DataflowTool.recordSingleSample");

    expect(history.slice(entriesBefore).map(entry => entry.modelActionKey))
      .toEqual(["DataflowTool.recordSingleSample"]);
    const tableId = content.linkedTableTileId!;
    const tableContent = docContent.tileMap.get(tableId)!.content as any;
    expect(tableContent.dataSet).toBe(content.dataSet);
    expect(content.dataSet.attributes.map(a => a.name)).toEqual(["Point", "Sensor", "Servo"]);
    expect(content.dataSet.cases).toHaveLength(1);

    manager.undoStore.undo();
    await settleOn(manager, "UndoStore.undo");

    expect(docContent.tileMap.has(tableId)).toBe(false);
    expect(content.linkedTableTileId).toBeUndefined();
    expect(content.dataSet.cases).toHaveLength(0);
    expect(content.dataSet.attributes.map(a => a.name)).toEqual(["x", "y"]);
  });

  it("records Table It's new table and columns as one entry", async () => {
    const { content, manager, addTable } = await setupProgramWithoutTable();
    const history = manager.document.history;
    const entriesBefore = history.length;

    content.showCaptureInTable(addTable);
    await settleOn(manager, "DataflowTool.showCaptureInTable");

    expect(history.slice(entriesBefore).map(entry => entry.modelActionKey))
      .toEqual(["DataflowTool.showCaptureInTable"]);
    expect(content.linkedTableTileId).toBeDefined();
    expect(content.dataSet.attributes.map(a => a.name)).toEqual(["Point", "Sensor", "Servo"]);
  });
});
