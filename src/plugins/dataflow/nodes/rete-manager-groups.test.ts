import { ReteManager } from "./rete-manager";

interface IConn {
  id: string;
  source: string; sourceOutput: string;
  target: string; targetInput: string;
}

interface INodeSockets { inputs?: string[]; outputs?: string[]; }

// Minimal ReteManager stub exposing just the MST connections and the rete node socket lists that
// getGroupInterface reads.
function managerWith(connections: IConn[], nodeSockets: Record<string, INodeSockets>): ReteManager {
  const stub = Object.create(ReteManager.prototype);
  stub.mstProgram = { connections: new Map(connections.map(c => [c.id, c])) };
  stub.editor = {
    getNode: (id: string) => {
      const s = nodeSockets[id];
      if (!s) return undefined;
      return {
        inputs: Object.fromEntries((s.inputs ?? []).map(k => [k, {}])),
        outputs: Object.fromEntries((s.outputs ?? []).map(k => [k, {}])),
      };
    },
  };
  return stub;
}

const conn = (id: string, source: string, sourceOutput: string, target: string, targetInput: string): IConn =>
  ({ id, source, sourceOutput, target, targetInput });

describe("ReteManager.getGroupInterface (CLUE-568)", () => {
  it("exposes a member input fed by an external node, with its boundary connection", () => {
    // ext.val -> a.num1, where a is a member.
    const mgr = managerWith([conn("c1", "ext", "val", "a", "num1")], { a: { inputs: ["num1"] } });
    const { inputs, outputs } = mgr.getGroupInterface(["a"]);
    expect(outputs).toEqual([]);
    expect(inputs).toEqual([
      { nodeId: "a", key: "num1", external: { connId: "c1", externalNodeId: "ext", externalKey: "val" } },
    ]);
  });

  it("exposes an open member output (no connections) with no wire", () => {
    const mgr = managerWith([], { a: { outputs: ["value"] } });
    const { inputs, outputs } = mgr.getGroupInterface(["a"]);
    expect(inputs).toEqual([]);
    expect(outputs).toEqual([{ nodeId: "a", key: "value", externals: [] }]);
  });

  it("exposes a member output that feeds an external node", () => {
    // a.value -> ext.num1
    const mgr = managerWith([conn("c1", "a", "value", "ext", "num1")], { a: { outputs: ["value"] } });
    const { inputs, outputs } = mgr.getGroupInterface(["a"]);
    expect(inputs).toEqual([]);
    expect(outputs).toEqual([
      { nodeId: "a", key: "value", externals: [{ connId: "c1", externalNodeId: "ext", externalKey: "num1" }] },
    ]);
  });

  it("hides sockets consumed internally (member -> member)", () => {
    const mgr = managerWith(
      [conn("c1", "a", "value", "b", "num1")],
      { a: { outputs: ["value"] }, b: { inputs: ["num1"] } }
    );
    const { inputs, outputs } = mgr.getGroupInterface(["a", "b"]);
    expect(inputs).toEqual([]);
    expect(outputs).toEqual([]);
  });

  it("exposes an output that feeds both a member and an external", () => {
    const mgr = managerWith(
      [conn("internal", "a", "value", "b", "num1"), conn("external", "a", "value", "ext", "in")],
      { a: { outputs: ["value"] }, b: { inputs: ["num1"] } }
    );
    const { inputs, outputs } = mgr.getGroupInterface(["a", "b"]);
    expect(inputs).toEqual([]);
    expect(outputs).toEqual([
      { nodeId: "a", key: "value", externals: [{ connId: "external", externalNodeId: "ext", externalKey: "in" }] },
    ]);
  });
});
