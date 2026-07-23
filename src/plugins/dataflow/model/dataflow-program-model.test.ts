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
    expect([...group!.nodeIds]).toEqual(["a", "b"]);
    expect(program.getGroupForNode("a")?.id).toBe(group!.id);
    expect(program.getGroupForNode("c")).toBeUndefined();
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

  it("ungroups without removing the member nodes", () => {
    const program = makeProgram(["a", "b"]);
    const group = program.createGroup(["a", "b"])!;
    program.ungroupGroups([group.id]);
    expect(program.groups.size).toBe(0);
    expect(program.nodes.has("a")).toBe(true);
    expect(program.nodes.has("b")).toBe(true);
  });

  it("auto-dissolves a group when a member is removed and it drops below 2", () => {
    const program = makeProgram(["a", "b", "c"]);
    // Capture the id before the group can be dissolved (reading `group.id` off a
    // removed MST node would warn).
    const groupId = program.createGroup(["a", "b", "c"])!.id;
    program.removeNodeAndConnections("a");
    expect(program.groups.has(groupId)).toBe(true);
    expect([...program.getGroupForNode("b")!.nodeIds]).toEqual(["b", "c"]);
    program.removeNodeAndConnections("b");
    expect(program.groups.has(groupId)).toBe(false);
  });

  it("round-trips groups (label, collapsed, members) through a snapshot", () => {
    const program = makeProgram(["a", "b"]);
    const group = program.createGroup(["a", "b"], "My Group")!;
    group.setCollapsed(true);
    const restored = DataflowProgramModel.create(getSnapshot(program));
    const rGroup = [...restored.groups.values()][0];
    expect(rGroup.label).toBe("My Group");
    expect(rGroup.collapsed).toBe(true);
    expect([...rGroup.nodeIds]).toEqual(["a", "b"]);
  });

  it("loads a legacy snapshot without a groups field as an empty map", () => {
    const program = DataflowProgramModel.create({ nodes: {}, connections: {} } as any);
    expect(program.groups.size).toBe(0);
  });
});
