import { ReteManager } from "./rete-manager";

interface IFakeNode {
  id: string;
  label: string;
  inputs: Record<string, { socket: unknown }>;
  outputs: Record<string, { socket: unknown }>;
}

interface IBuildNode {
  id: string;
  label?: string;
  x?: number;
  y?: number;
  inputs?: string[];
  outputs?: string[];
}

interface IFakeEnv {
  manager: ReteManager;
  addConnectionCalls: Array<{ id?: string; source: string; sourceOutput: string;
                              target: string; targetInput: string }>;
  removeInputConnectionCalls: Array<{ nodeId: string; inputKey: string }>;
  socketEl: (nodeId: string, side: "input" | "output", key: string) => HTMLElement;
}

function buildEnv(specs: IBuildNode[], opts: { readOnly?: boolean } = {}): IFakeEnv {
  // Each node renders into a real DOM element so querySelector works just like
  // the production code path. Each socket wrapper carries the data-* attributes
  // production sets in dataflow-node.tsx.
  const elements = new Map<string, HTMLDivElement>();
  const fakeNodes: IFakeNode[] = specs.map(spec => {
    const el = document.createElement("div");
    el.className = "node";
    el.setAttribute("data-test-node-id", spec.id);
    for (const inputKey of spec.inputs ?? []) {
      const socket = document.createElement("div");
      socket.setAttribute("data-socket-side", "input");
      socket.setAttribute("data-socket-key", inputKey);
      socket.setAttribute("data-node-id", spec.id);
      socket.tabIndex = 0;
      el.appendChild(socket);
    }
    for (const outputKey of spec.outputs ?? []) {
      const socket = document.createElement("div");
      socket.setAttribute("data-socket-side", "output");
      socket.setAttribute("data-socket-key", outputKey);
      socket.setAttribute("data-node-id", spec.id);
      socket.tabIndex = 0;
      el.appendChild(socket);
    }
    document.body.appendChild(el);
    elements.set(spec.id, el);

    const inputs = Object.fromEntries(
      (spec.inputs ?? []).map(k => [k, { socket: {} }])
    );
    const outputs = Object.fromEntries(
      (spec.outputs ?? []).map(k => [k, { socket: {} }])
    );
    return { id: spec.id, label: spec.label ?? spec.id, inputs, outputs };
  });

  const fakeViews = new Map<string, { position: {x:number;y:number}; element: HTMLDivElement }>(
    specs.map(spec => [
      spec.id,
      { position: { x: spec.x ?? 0, y: spec.y ?? 0 }, element: elements.get(spec.id)! }
    ])
  );

  const addConnectionCalls: IFakeEnv["addConnectionCalls"] = [];
  const removeInputConnectionCalls: IFakeEnv["removeInputConnectionCalls"] = [];

  const stub = Object.create(ReteManager.prototype);
  stub.editor = {
    getNodes: () => fakeNodes,
    getNode: (id: string) => fakeNodes.find(n => n.id === id),
    addConnection: (data: any) => {
      addConnectionCalls.push(data);
      return Promise.resolve(true);
    },
  };
  stub.area = { nodeViews: fakeViews };
  stub.readOnly = !!opts.readOnly;
  stub.removeInputConnection = (nodeId: string, inputKey: string) => {
    removeInputConnectionCalls.push({ nodeId, inputKey });
  };
  // Stub `announce` so we don't hit requestAnimationFrame in tests; capture into an array.
  stub.announceCalls = [] as string[];
  stub.announce = (msg: string) => { stub.announceCalls.push(msg); };

  return {
    manager: stub,
    addConnectionCalls,
    removeInputConnectionCalls,
    socketEl: (nodeId, side, key) =>
      elements.get(nodeId)!.querySelector(
        `[data-socket-side="${side}"][data-socket-key="${key}"]`
      ) as HTMLElement,
  };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ReteManager connection-mode state machine (CLUE-455)", () => {
  it("Enter on output socket transitions from idle to connecting", () => {
    const env = buildEnv([
      { id: "src", x: 0,   y: 0, outputs: ["value"] },
      { id: "dst", x: 200, y: 0, inputs: ["num1"] },
    ]);
    expect(env.manager.isConnecting).toBe(false);
    env.manager.beginConnectingFrom("src", "value");
    expect(env.manager.isConnecting).toBe(true);
  });

  it("announces 'No compatible target sockets' when none exist and stays idle", () => {
    const env = buildEnv([
      { id: "src", outputs: ["value"] },
    ]);
    env.manager.beginConnectingFrom("src", "value");
    expect(env.manager.isConnecting).toBe(false);
    expect((env.manager as any).announceCalls).toContain("No compatible target sockets");
  });

  it("highlights all candidate sockets and focuses the first one", () => {
    const env = buildEnv([
      { id: "src", x: 0,   y: 0, outputs: ["value"] },
      { id: "a",   x: 100, y: 0, inputs: ["num1"] },
      { id: "b",   x: 200, y: 0, inputs: ["num1"] },
    ]);
    env.manager.beginConnectingFrom("src", "value");
    expect(env.socketEl("a", "input", "num1").classList.contains("connection-candidate")).toBe(true);
    expect(env.socketEl("b", "input", "num1").classList.contains("connection-candidate")).toBe(true);
    expect(document.activeElement).toBe(env.socketEl("a", "input", "num1"));
  });

  it("excludes the source node's own inputs from candidates", () => {
    const env = buildEnv([
      { id: "src", x: 0,   y: 0, inputs: ["num1"], outputs: ["value"] },
      { id: "dst", x: 100, y: 0, inputs: ["num1"] },
    ]);
    env.manager.beginConnectingFrom("src", "value");
    const candidates = env.manager.getCompatibleTargets("src", "value");
    expect(candidates.map(c => c.nodeId)).toEqual(["dst"]);
  });

  it("orders candidates in node reading order", () => {
    // Three input nodes: positions chosen so reading order is "left", "middle", "right".
    const env = buildEnv([
      { id: "src",    x: 0,   y: 0,   outputs: ["value"] },
      { id: "right",  x: 400, y: 100, inputs: ["num1"] },
      { id: "left",   x: 100, y: 100, inputs: ["num1"] },
      { id: "middle", x: 250, y: 100, inputs: ["num1"] },
    ]);
    const candidates = env.manager.getCompatibleTargets("src", "value");
    expect(candidates.map(c => c.nodeId)).toEqual(["left", "middle", "right"]);
  });

  it("moveConnectingCandidate(1) wraps from last to first", () => {
    const env = buildEnv([
      { id: "src", x: 0,   y: 0, outputs: ["value"] },
      { id: "a",   x: 100, y: 0, inputs: ["num1"] },
      { id: "b",   x: 200, y: 0, inputs: ["num1"] },
    ]);
    env.manager.beginConnectingFrom("src", "value");
    env.manager.moveConnectingCandidate(1); // -> b
    env.manager.moveConnectingCandidate(1); // wraps -> a
    expect(document.activeElement).toBe(env.socketEl("a", "input", "num1"));
  });

  it("moveConnectingCandidate(-1) wraps from first to last", () => {
    const env = buildEnv([
      { id: "src", x: 0,   y: 0, outputs: ["value"] },
      { id: "a",   x: 100, y: 0, inputs: ["num1"] },
      { id: "b",   x: 200, y: 0, inputs: ["num1"] },
    ]);
    env.manager.beginConnectingFrom("src", "value");
    env.manager.moveConnectingCandidate(-1); // wraps -> b
    expect(document.activeElement).toBe(env.socketEl("b", "input", "num1"));
  });

  it("commitConnectingTo with a candidate input creates the connection and resets to idle", async () => {
    const env = buildEnv([
      { id: "src", x: 0,   y: 0, outputs: ["value"] },
      { id: "dst", x: 100, y: 0, inputs: ["num1"] },
    ]);
    env.manager.beginConnectingFrom("src", "value");
    await env.manager.commitConnectingTo("dst", "num1");
    expect(env.addConnectionCalls).toHaveLength(1);
    expect(env.addConnectionCalls[0]).toMatchObject({
      source: "src", sourceOutput: "value", target: "dst", targetInput: "num1",
    });
    expect(env.manager.isConnecting).toBe(false);
  });

  it("removes any existing connection on the target input before adding the new one", async () => {
    const env = buildEnv([
      { id: "src", x: 0,   y: 0, outputs: ["value"] },
      { id: "dst", x: 100, y: 0, inputs: ["num1"] },
    ]);
    env.manager.beginConnectingFrom("src", "value");
    await env.manager.commitConnectingTo("dst", "num1");
    expect(env.removeInputConnectionCalls).toEqual([{ nodeId: "dst", inputKey: "num1" }]);
  });

  it("clears connection-candidate classes from all candidate sockets after commit", async () => {
    const env = buildEnv([
      { id: "src", x: 0,   y: 0, outputs: ["value"] },
      { id: "a",   x: 100, y: 0, inputs: ["num1"] },
      { id: "b",   x: 200, y: 0, inputs: ["num1"] },
    ]);
    env.manager.beginConnectingFrom("src", "value");
    await env.manager.commitConnectingTo("a", "num1");
    expect(env.socketEl("a", "input", "num1").classList.contains("connection-candidate")).toBe(false);
    expect(env.socketEl("b", "input", "num1").classList.contains("connection-candidate")).toBe(false);
  });

  it("marks the source output socket with the connection-source class while connecting", () => {
    const env = buildEnv([
      { id: "src", x: 0,   y: 0, outputs: ["value"] },
      { id: "dst", x: 100, y: 0, inputs: ["num1"] },
    ]);
    env.manager.beginConnectingFrom("src", "value");
    expect(env.socketEl("src", "output", "value").classList.contains("connection-source")).toBe(true);
  });

  it("clears the connection-source class on commit", async () => {
    const env = buildEnv([
      { id: "src", x: 0,   y: 0, outputs: ["value"] },
      { id: "dst", x: 100, y: 0, inputs: ["num1"] },
    ]);
    env.manager.beginConnectingFrom("src", "value");
    await env.manager.commitConnectingTo("dst", "num1");
    expect(env.socketEl("src", "output", "value").classList.contains("connection-source")).toBe(false);
  });

  it("clears the connection-source class on cancel", () => {
    const env = buildEnv([
      { id: "src", x: 0,   y: 0, outputs: ["value"] },
      { id: "dst", x: 100, y: 0, inputs: ["num1"] },
    ]);
    env.manager.beginConnectingFrom("src", "value");
    env.manager.cancelConnecting();
    expect(env.socketEl("src", "output", "value").classList.contains("connection-source")).toBe(false);
  });

  it("commitConnectingTo with a non-candidate input is a no-op", async () => {
    const env = buildEnv([
      { id: "src",      x: 0,   y: 0, outputs: ["value"] },
      { id: "dst",      x: 100, y: 0, inputs: ["num1"] },
      { id: "unrelated", x: 200, y: 0, inputs: ["num1"] },
    ]);
    env.manager.beginConnectingFrom("src", "value");
    // Lie about the target id so it doesn't match any candidate.
    await env.manager.commitConnectingTo("not-a-real-id", "num1");
    expect(env.addConnectionCalls).toHaveLength(0);
    expect(env.manager.isConnecting).toBe(true);
  });

  it("cancelConnecting resets to idle and announces 'Cancelled connection'", () => {
    const env = buildEnv([
      { id: "src", x: 0,   y: 0, outputs: ["value"] },
      { id: "dst", x: 100, y: 0, inputs: ["num1"] },
    ]);
    env.manager.beginConnectingFrom("src", "value");
    env.manager.cancelConnecting();
    expect(env.manager.isConnecting).toBe(false);
    expect((env.manager as any).announceCalls).toContain("Cancelled connection");
  });

  it("cancelConnecting refocuses the source output socket", () => {
    const env = buildEnv([
      { id: "src", x: 0,   y: 0, outputs: ["value"] },
      { id: "dst", x: 100, y: 0, inputs: ["num1"] },
    ]);
    env.manager.beginConnectingFrom("src", "value");
    env.manager.cancelConnecting();
    expect(document.activeElement).toBe(env.socketEl("src", "output", "value"));
  });

  it("beginConnectingFrom is a no-op in read-only mode", () => {
    const env = buildEnv([
      { id: "src", x: 0,   y: 0, outputs: ["value"] },
      { id: "dst", x: 100, y: 0, inputs: ["num1"] },
    ], { readOnly: true });
    env.manager.beginConnectingFrom("src", "value");
    expect(env.manager.isConnecting).toBe(false);
    expect((env.manager as any).announceCalls).toEqual([]);
  });
});
