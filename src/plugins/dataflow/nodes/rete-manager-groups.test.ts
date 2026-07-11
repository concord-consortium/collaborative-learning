import { ReteManager } from "./rete-manager";

interface IConn {
  id: string;
  source: string; sourceOutput: string;
  target: string; targetInput: string;
}

// Minimal ReteManager stub exposing just the MST connections that
// getGroupBoundaryConnections reads. The method is pure over the connection set.
function managerWith(connections: IConn[]): ReteManager {
  const stub = Object.create(ReteManager.prototype);
  stub.mstProgram = { connections: new Map(connections.map(c => [c.id, c])) };
  return stub;
}

function conn(id: string, source: string, target: string): IConn {
  return { id, source, sourceOutput: "value", target, targetInput: "num1" };
}

describe("ReteManager.getGroupBoundaryConnections (CLUE-568)", () => {
  it("classifies a connection entering the group as an input", () => {
    // ext -> a, where a is a member.
    const mgr = managerWith([conn("c1", "ext", "a")]);
    const { inputs, outputs } = mgr.getGroupBoundaryConnections(["a", "b"]);
    expect(outputs).toHaveLength(0);
    expect(inputs).toEqual([{ connId: "c1", externalNodeId: "ext", externalKey: "value" }]);
  });

  it("classifies a connection leaving the group as an output", () => {
    // b -> ext, where b is a member.
    const mgr = managerWith([conn("c1", "b", "ext")]);
    const { inputs, outputs } = mgr.getGroupBoundaryConnections(["a", "b"]);
    expect(inputs).toHaveLength(0);
    expect(outputs).toEqual([{ connId: "c1", externalNodeId: "ext", externalKey: "num1" }]);
  });

  it("ignores connections wholly inside or wholly outside the group", () => {
    const mgr = managerWith([
      conn("internal", "a", "b"),      // both members
      conn("external", "x", "y"),      // neither a member
    ]);
    const { inputs, outputs } = mgr.getGroupBoundaryConnections(["a", "b"]);
    expect(inputs).toHaveLength(0);
    expect(outputs).toHaveLength(0);
  });

  it("collects every boundary crossing on both sides", () => {
    const mgr = managerWith([
      conn("in1", "e1", "a"),
      conn("in2", "e2", "b"),
      conn("out1", "a", "e3"),
      conn("mid", "a", "b"),           // internal, excluded
    ]);
    const { inputs, outputs } = mgr.getGroupBoundaryConnections(["a", "b"]);
    expect(inputs.map(i => i.connId).sort()).toEqual(["in1", "in2"]);
    expect(outputs.map(o => o.connId)).toEqual(["out1"]);
  });
});
