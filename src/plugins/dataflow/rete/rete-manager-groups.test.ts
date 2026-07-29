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

describe("ReteManager.getGroupInterface", () => {
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

// Builds a ReteManager stub over a real DOM: one `.editor` per mounted tile, each holding the rete
// container plus its sibling groups overlay, mirroring dataflow-program.tsx's structure.
function mountTile(
  { nodeIds, collapsedGroup, proxies }:
  { nodeIds: string[]; collapsedGroup?: string[]; proxies?: string[] }
) {
  const editor = document.createElement("div");
  editor.className = "editor";
  const container = document.createElement("div");
  container.className = "flow-tool";
  editor.appendChild(container);

  const nodeViews = new Map<string, { element: HTMLElement }>();
  nodeIds.forEach(id => {
    const el = document.createElement("div");
    el.innerHTML = `<span data-socket-side="input" data-socket-key="num1">` +
      `<span data-testid="input-socket"></span></span>`;
    container.appendChild(el);
    nodeViews.set(id, { element: el });
  });

  const overlay = document.createElement("div");
  overlay.className = "dataflow-groups-overlay";
  (proxies ?? []).forEach(id => {
    const dot = document.createElement("span");
    dot.setAttribute("data-group-proxy", "true");
    dot.setAttribute("data-socket-side", "input");
    dot.setAttribute("data-node-id", id);
    dot.setAttribute("data-socket-key", "num1");
    overlay.appendChild(dot);
  });
  editor.appendChild(overlay);
  document.body.appendChild(editor);

  const stub: any = Object.create(ReteManager.prototype);
  stub.area = { container, nodeViews };
  stub.mstProgram = {
    nodes: new Map(nodeIds.map(id => [id, { groupId: collapsedGroup?.includes(id) ? "g1" : undefined }])),
    groups: new Map([["g1", { collapsed: true }]]),
  };
  return { manager: stub as ReteManager, overlay };
}

describe("ReteManager.calculateContentBounds", () => {
  // Stubs just the pieces calculateContentBounds reads. `rect: null` stands for a node with no
  // nodeView at all; a zero-size rect stands for a member hidden inside a collapsed group.
  function boundsManager(nodes: Array<{ id: string; x: number; y: number; rect: DOMRect | null }>) {
    const stub: any = Object.create(ReteManager.prototype);
    stub.area = {
      area: { transform: { k: 1, x: 0, y: 0 } },
      nodeViews: new Map(nodes.filter(n => n.rect).map(n =>
        [n.id, { element: { getBoundingClientRect: () => n.rect } }]
      )),
    };
    stub.mstProgram = {
      nodes: new Map(nodes.map(n => [n.id, { id: n.id, currentX: n.x, currentY: n.y }])),
    };
    return stub as ReteManager;
  }
  const rect = (width: number, height: number) => ({ width, height }) as DOMRect;

  it("uses the measured size of a visible node", () => {
    const mgr = boundsManager([{ id: "a", x: 10, y: 20, rect: rect(100, 50) }]);
    expect(mgr.calculateContentBounds()).toEqual({ minX: 10, minY: 20, maxX: 110, maxY: 70 });
  });

  it("falls back to the default node size for a member hidden in a collapsed group", () => {
    // display:none reports an all-zero rect rather than no rect, so without the dimension check
    // this node would contribute a point and shrink the bounds.
    const mgr = boundsManager([{ id: "a", x: 10, y: 20, rect: rect(0, 0) }]);
    expect(mgr.calculateContentBounds()).toEqual({ minX: 10, minY: 20, maxX: 186, maxY: 140 });
  });

  it("keeps non-degenerate bounds when every node is hidden in one column", () => {
    // "Add two nodes, group them, collapse" — new nodes share an x, so with zero-size rects the
    // width collapsed to 0 and calculateFitTransform bailed out, skipping the fit entirely.
    const mgr = boundsManager([
      { id: "a", x: 40, y: 0, rect: rect(0, 0) },
      { id: "b", x: 40, y: 200, rect: rect(0, 0) },
    ]);
    const bounds = mgr.calculateContentBounds()!;
    expect(bounds.maxX - bounds.minX).toBeGreaterThan(0);
    expect(bounds.maxY - bounds.minY).toBeGreaterThan(0);
  });

  it("returns null when no member is present", () => {
    expect(boundsManager([]).calculateContentBounds()).toBeNull();
    expect(boundsManager([{ id: "a", x: 0, y: 0, rect: rect(10, 10) }])
      .calculateContentBounds(["missing"])).toBeNull();
  });
});

describe("ReteManager.getSocketElement", () => {
  afterEach(() => { document.body.innerHTML = ""; });

  it("returns the real socket dot for a node that is not in a collapsed group", () => {
    const { manager } = mountTile({ nodeIds: ["a"] });
    expect(manager.getSocketElement("a", "num1", "input")?.dataset.testid).toBe("input-socket");
  });

  it("returns the chip proxy for a node hidden inside a collapsed group", () => {
    // The real socket still exists in the DOM but sits in a display:none subtree, so measuring it
    // would anchor the wire at the viewport origin. The proxy is the visible anchor.
    const { manager } = mountTile({ nodeIds: ["a"], collapsedGroup: ["a"], proxies: ["a"] });
    const el = manager.getSocketElement("a", "num1", "input");
    expect(el?.getAttribute("data-group-proxy")).toBe("true");
  });

  it("returns undefined when a collapsed member exposes no proxy, so the caller drops the wire", () => {
    const { manager } = mountTile({ nodeIds: ["a"], collapsedGroup: ["a"] });
    expect(manager.getSocketElement("a", "num1", "input")).toBeUndefined();
  });

  it("finds its own tile's proxy when the same document is mounted twice", () => {
    // Thumbnails, the compare pane and four-up mount the same document alongside the workspace,
    // and those mounts share node ids — a document-wide lookup would return the first in DOM order.
    const first = mountTile({ nodeIds: ["a"], collapsedGroup: ["a"], proxies: ["a"] });
    const second = mountTile({ nodeIds: ["a"], collapsedGroup: ["a"], proxies: ["a"] });
    expect(second.manager.getSocketElement("a", "num1", "input")).toBe(second.overlay.firstChild);
    expect(first.manager.getSocketElement("a", "num1", "input")).toBe(first.overlay.firstChild);
  });
});
