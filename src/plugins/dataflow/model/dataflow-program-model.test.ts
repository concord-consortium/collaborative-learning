import { getSnapshot } from "mobx-state-tree";
import { DataflowNodeModel, DataflowProgramModel } from "./dataflow-program-model";

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
