import { getSnapshot, Instance } from "mobx-state-tree";
import { ConnectionModel, DataflowNodeModel, DataflowProgramModel } from "./dataflow-program-model";
import { DataflowContentModelType, kDataflowTileType } from "./dataflow-content";
import { IControlNodeModel } from "../nodes/control-node";
import { INumberNodeModel } from "../nodes/number-node";
import { createDocumentModel } from "../../../models/document/document";
import { ProblemDocument } from "../../../models/document/document-types";
import { TreeManager } from "../../../models/history/tree-manager";
import { expectEntryToBeComplete } from "../../../models/history/undo-store-test-utils";

import "../../../models/shared/shared-data-set-registration";
import "../../../models/shared/shared-program-data-registration";
import "../dataflow-registration";

// The undo test needs the tile registered, but not its component.
jest.mock("../components/dataflow-tile", () => ({ __esModule: true, default: () => null }));

describe("DataflowProgramModel", () => {
  it("should handle nodes with explicit x and y", () => {
    const node = {
      id: "0",
      name: 'node',
      x: 1,
      y: 2,
      inputs: {},
      outputs: {},
      data: {}
    };
    const mstNode = DataflowNodeModel.create(node);
    expect(mstNode.x).toBe(1);
    expect(mstNode.y).toBe(2);
  });
});

describe("DataflowProgramModel groups", () => {
  function makeProgram(ids: string[]) {
    const program = DataflowProgramModel.create();
    ids.forEach(id => program.addNode(DataflowNodeModel.create({ id, name: "Number", x: 0, y: 0, data: {} })));
    return program;
  }

  it("creates a group from 2+ nodes with an auto-incrementing label", () => {
    const program = makeProgram(["a", "b", "c"]);
    const group = program.createGroup(["a", "b"]);
    expect(group).toBeDefined();
    expect(group!.label).toBe("Group 1");
    expect([...group!.nodeIds.keys()].sort()).toEqual(["a", "b"]);
    expect(program.getGroupForNode("a")?.id).toBe(group!.id);
    expect(program.getGroupForNode("c")).toBeUndefined();
    // Membership is mirrored on each member node via groupId.
    expect(program.nodes.get("a")!.groupId).toBe(group!.id);
    expect(program.nodes.get("c")!.groupId).toBeUndefined();
  });

  it("refuses to group fewer than 2 valid nodes", () => {
    const program = makeProgram(["a", "b"]);
    expect(program.createGroup(["a"])).toBeUndefined();
    expect(program.createGroup(["a", "missing"])).toBeUndefined();
    expect(program.groups.size).toBe(0);
  });

  it("does not create a group from a repeated node id", () => {
    // nodeIds is a map, so ["a","a"] would pass a naive length check but store one member.
    const program = makeProgram(["a", "b"]);
    expect(program.createGroup(["a", "a"])).toBeUndefined();
    expect(program.groups.size).toBe(0);
  });

  it("does not group nodes that are already in a group", () => {
    const program = makeProgram(["a", "b", "c"]);
    program.createGroup(["a", "b"]);
    expect(program.createGroup(["a", "c"])).toBeUndefined();
  });

  it("increments the default group label per group", () => {
    const program = makeProgram(["a", "b", "c", "d"]);
    expect(program.createGroup(["a", "b"])!.label).toBe("Group 1");
    expect(program.createGroup(["c", "d"])!.label).toBe("Group 2");
  });

  it("ignores labels that aren't the default pattern when picking the next one", () => {
    const program = makeProgram(["a", "b", "c", "d"]);
    program.createGroup(["a", "b"], "Blink the light");
    expect(program.createGroup(["c", "d"])!.label).toBe("Group 1");
  });

  // removeNode is the low-level action; NodeEditorMST.clear() calls it directly for every node
  // rather than going through removeNodeAndConnections, so the group bookkeeping has to live here
  // or a cleared program keeps groups referencing deleted nodes.
  it("keeps groups consistent when nodes are removed one at a time via removeNode", () => {
    const program = makeProgram(["a", "b", "c"]);
    const groupId = program.createGroup(["a", "b", "c"])!.id;

    program.removeNode("a");
    expect([...program.groups.get(groupId)!.nodeIds.keys()].sort()).toEqual(["b", "c"]);

    // Dropping to a single member dissolves the group and clears the survivor's groupId.
    program.removeNode("b");
    expect(program.groups.has(groupId)).toBe(false);
    expect(program.nodes.get("c")!.groupId).toBeUndefined();
  });

  it("leaves no groups behind when every node is removed", () => {
    const program = makeProgram(["a", "b", "c", "d"]);
    program.createGroup(["a", "b"]);
    program.createGroup(["c", "d"]);
    [...program.nodes.keys()].forEach(id => program.removeNode(id));
    expect(program.nodes.size).toBe(0);
    expect(program.groups.size).toBe(0);
  });

  it("ungroups without removing the member nodes", () => {
    const program = makeProgram(["a", "b"]);
    const group = program.createGroup(["a", "b"])!;
    program.ungroupGroups([group.id]);
    expect(program.groups.size).toBe(0);
    expect(program.nodes.has("a")).toBe(true);
    expect(program.nodes.has("b")).toBe(true);
    // Ungrouping clears each member node's groupId.
    expect(program.nodes.get("a")!.groupId).toBeUndefined();
    expect(program.nodes.get("b")!.groupId).toBeUndefined();
  });

  it("auto-dissolves a group when a member is removed and it drops below 2", () => {
    const program = makeProgram(["a", "b", "c"]);
    // Capture the id before the group can be dissolved (reading `group.id` off a
    // removed MST node would warn).
    const groupId = program.createGroup(["a", "b", "c"])!.id;
    program.removeNodeAndConnections("a");
    expect(program.groups.has(groupId)).toBe(true);
    expect([...program.getGroupForNode("b")!.nodeIds.keys()].sort()).toEqual(["b", "c"]);
    program.removeNodeAndConnections("b");
    expect(program.groups.has(groupId)).toBe(false);
    // The last remaining member's groupId is cleared when the group dissolves.
    expect(program.nodes.get("c")!.groupId).toBeUndefined();
  });

  it("round-trips groups (label, collapsed, members) through a snapshot", () => {
    const program = makeProgram(["a", "b"]);
    const group = program.createGroup(["a", "b"], "My Group")!;
    group.setCollapsed(true);
    const restored = DataflowProgramModel.create(getSnapshot(program));
    const rGroup = [...restored.groups.values()][0];
    expect(rGroup.label).toBe("My Group");
    expect(rGroup.collapsed).toBe(true);
    expect([...rGroup.nodeIds.keys()].sort()).toEqual(["a", "b"]);
  });

  it("loads a legacy snapshot without a groups field as an empty map", () => {
    const program = DataflowProgramModel.create({ nodes: {}, connections: {} } as any);
    expect(program.groups.size).toBe(0);
  });
});

describe("DataflowProgramModel.resetRunningState", () => {
  function makeRunningProgram() {
    const program = DataflowProgramModel.create();
    program.addNode(DataflowNodeModel.create({
      id: "num", name: "Number", x: 0, y: 0, data: { type: "Number", value: 7 }
    }));
    program.addNode(DataflowNodeModel.create({
      id: "ctl", name: "Control", x: 0, y: 0,
      data: { type: "Control", controlOperator: "Hold 0", waitDuration: 4 }
    }));
    program.addNewTick("t0");
    for (let i = 0; i < 3; i++) program.tickAndProcess(() => {});
    return program;
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  it("empties the tick history and leaves one open tick", () => {
    const program = makeRunningProgram();
    expect(program.recentTicks.length).toBeGreaterThan(1);

    program.resetRunningState();

    expect(program.recentTicks.length).toBe(1);
    program.nodes.forEach(node => {
      expect(node.data.tickEntries.size).toBe(1);
      expect(node.data.tickEntries.get(program.currentTick)?.open).toBe(true);
    });
  });

  it("resets each graph's zoom range", () => {
    const program = makeRunningProgram();
    const node = program.nodes.get("num")!.data;
    node.setTickMax(10);
    node.setTickMin(-10);

    program.resetRunningState();

    expect(node.tickMax).toBeUndefined();
    expect(node.tickMin).toBeUndefined();
  });

  it("releases a held Control value and stops its wait timer", () => {
    jest.useFakeTimers();
    const program = makeRunningProgram();
    const control = program.nodes.get("ctl")!.data as IControlNodeModel;
    control.setWaitDuration(2);
    control.setHeldValue(5);
    control.setGateActive(true);
    control.startWaitTimer();
    expect(control.waitTimerId).not.toBeNull();

    program.resetRunningState();

    expect(control.heldValue).toBeNull();
    expect(control.gateActive).toBe(false);
    expect(control.waitTimerId).toBeNull();
    expect(control.timerRunning).toBeFalsy();
    expect(jest.getTimerCount()).toBe(0);
  });

  it("does not create an undo step", async () => {
    const document = createDocumentModel({
      type: ProblemDocument, uid: "1", key: "test", createdAt: 1, content: {}, visibility: "public"
    });
    const tileId = document.addTile(kDataflowTileType)!.tileId;
    const { program } = document.content!.getTile(tileId)!.content as DataflowContentModelType;
    program.addNode(DataflowNodeModel.create({
      id: "num", name: "Number", x: 0, y: 0, data: { type: "Number", value: 7 }
    }));
    program.addNewTick("t0");
    document.treeMonitor!.enableMonitoring();
    const manager = document.treeManagerAPI as Instance<typeof TreeManager>;

    program.resetRunningState();

    await expectEntryToBeComplete(manager, 1);
    expect(manager.undoStore.canUndo).toBe(false);
  });

  it("leaves blocks, block connections and settings alone", () => {
    const program = makeRunningProgram();
    program.addConnection(ConnectionModel.create({
      id: "c1", source: "num", sourceOutput: "value", target: "ctl", targetInput: "num2"
    }));
    const numberNode = program.nodes.get("num")!.data as INumberNodeModel;
    const control = program.nodes.get("ctl")!.data as IControlNodeModel;

    program.resetRunningState();

    expect(program.nodes.size).toBe(2);
    expect(program.connections.size).toBe(1);
    expect(numberNode.value).toBe(7);
    expect(control.controlOperator).toBe("Hold 0");
    expect(control.waitDuration).toBe(4);
  });
});
