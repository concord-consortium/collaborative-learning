import { ReteManager } from "./rete-manager";

interface IFakeNode { id: string; }
interface IFakeNodeView { position: { x: number; y: number }; }

/**
 * Builds a stub object with just enough surface area for the reading-order helpers.
 * `getNodeIdsInReadingOrder` reads `this.editor.getNodes()` and the position
 * from `this.mstProgram?.nodes?.get(id)` (with `this.area.nodeViews.get(id)?.position`
 * as a fallback for tests that don't supply an MST model). Rows are banded
 * with a fixed y-tolerance — measured node heights are intentionally not used.
 */
function makeManagerStub(
  nodes: Array<{ id: string; x: number; y: number }>
): ReteManager {
  const fakeNodes: IFakeNode[] = nodes.map(({ id }) => ({ id }));
  const fakeViews = new Map<string, IFakeNodeView>(
    nodes.map(({ id, x, y }) => [id, { position: { x, y } }])
  );
  const stub = Object.create(ReteManager.prototype);
  stub.editor = { getNodes: () => fakeNodes };
  stub.area = { nodeViews: fakeViews };
  return stub;
}

describe("ReteManager.getNodeIdsInReadingOrder", () => {
  it("orders three nodes left-to-right when they share the same row band", () => {
    const manager = makeManagerStub([
      { id: "c", x: 300, y: 10 },
      { id: "a", x: 100, y: 10 },
      { id: "b", x: 200, y: 10 },
    ]);
    expect(manager.getNodeIdsInReadingOrder()).toEqual(["a", "b", "c"]);
  });

  it("orders nodes top-to-bottom across row bands", () => {
    const manager = makeManagerStub([
      { id: "bottom", x: 100, y: 400 },
      { id: "top", x: 100, y: 10 },
      { id: "middle", x: 100, y: 200 },
    ]);
    expect(manager.getNodeIdsInReadingOrder()).toEqual(["top", "middle", "bottom"]);
  });

  it("breaks exact-position ties by node id", () => {
    const manager = makeManagerStub([
      { id: "node-z", x: 100, y: 100 },
      { id: "node-a", x: 100, y: 100 },
    ]);
    expect(manager.getNodeIdsInReadingOrder()).toEqual(["node-a", "node-z"]);
  });

  it("sorts by x within a row before advancing to the next row", () => {
    const manager = makeManagerStub([
      { id: "row1-right", x: 200, y: 10 },
      { id: "row1-left", x: 100, y: 10 },
      { id: "row2-only", x: 50, y: 200 },
    ]);
    expect(manager.getNodeIdsInReadingOrder()).toEqual(["row1-left", "row1-right", "row2-only"]);
  });

  it("treats a node with no view as positioned at (0, 0)", () => {
    const manager = makeManagerStub([{ id: "positioned", x: 500, y: 500 }]);
    // Add an extra node whose view lookup will return undefined.
    (manager as any).editor = { getNodes: () => [{ id: "no-view" }, { id: "positioned" }] };
    expect(manager.getNodeIdsInReadingOrder()).toEqual(["no-view", "positioned"]);
  });

  it("bands nodes into the same row when their y-coordinates are within tolerance", () => {
    // 45px tolerance against the first node's y. y=0 and y=30 are within
    // tolerance and band together; y=200 is well outside and starts a new row.
    const manager = makeManagerStub([
      { id: "left",  x: 0,   y: 0   },
      { id: "right", x: 100, y: 30  },
      { id: "below", x: 50,  y: 200 },
    ]);
    expect(manager.getNodeIdsInReadingOrder()).toEqual(["left", "right", "below"]);
  });
});

describe("ReteManager.nextNodeIdInReadingOrder", () => {
  const threeNodes = () => makeManagerStub([
    { id: "a", x: 100, y: 10 },
    { id: "b", x: 200, y: 10 },
    { id: "c", x: 300, y: 10 },
  ]);

  it("wraps from last node to first on ArrowRight", () => {
    expect(threeNodes().nextNodeIdInReadingOrder("c", "ArrowRight")).toBe("a");
  });

  it("wraps from first node to last on ArrowLeft", () => {
    expect(threeNodes().nextNodeIdInReadingOrder("a", "ArrowLeft")).toBe("c");
  });

  it("advances to the next node on ArrowDown", () => {
    expect(threeNodes().nextNodeIdInReadingOrder("a", "ArrowDown")).toBe("b");
  });

  it("returns the first node id on Home", () => {
    expect(threeNodes().nextNodeIdInReadingOrder("c", "Home")).toBe("a");
  });

  it("returns the last node id on End", () => {
    expect(threeNodes().nextNodeIdInReadingOrder("a", "End")).toBe("c");
  });

  it("returns the first node id when current id is unknown", () => {
    expect(threeNodes().nextNodeIdInReadingOrder("missing", "ArrowRight")).toBe("a");
  });

  it("returns undefined when there are no nodes", () => {
    const empty = makeManagerStub([]);
    expect(empty.nextNodeIdInReadingOrder("anything", "ArrowRight")).toBeUndefined();
  });

  it("returns undefined for an unrecognized key", () => {
    expect(threeNodes().nextNodeIdInReadingOrder("a", "Backspace")).toBeUndefined();
  });
});

/**
 * The title a new block is given. This is where the palette's word first reaches a document: the
 * student clicks "Waves" and the block must be titled "Waves 1", not "Generator 1", because that
 * title is persisted and is later what the AI reads back. Stubbed the same way as above —
 * `getNewNodeName` reads only `this.editor.getNodes()`, and each node only for its
 * `model.orderedDisplayName`.
 */
function makeNamingStub(existingNames: string[]): ReteManager {
  const stub = Object.create(ReteManager.prototype);
  stub.editor = { getNodes: () => existingNames.map(name => ({ model: { orderedDisplayName: name } })) };
  return stub;
}

// getNewNodeName is private; the tests reach it the same way the stub reaches the prototype.
function newNodeName(manager: ReteManager, nodeType: string): string {
  return (manager as any).getNewNodeName(nodeType);
}

describe("ReteManager.getNewNodeName", () => {
  it("titles a new block with the palette's word, not the internal type", () => {
    expect(newNodeName(makeNamingStub([]), "Generator")).toBe("Waves 1");
  });

  it("counts existing blocks by their display name", () => {
    expect(newNodeName(makeNamingStub(["Waves 1", "Waves 2"]), "Generator")).toBe("Waves 3");
  });

  it("does not count blocks of a different type", () => {
    expect(newNodeName(makeNamingStub(["Hold 1", "Compare 1"]), "Generator")).toBe("Waves 1");
  });

  it("leaves a type whose display name never changed alone", () => {
    expect(newNodeName(makeNamingStub(["Sensor 1"]), "Sensor")).toBe("Sensor 2");
  });

  // The hidden Timer block is absent from the display-name table, and its internal name carries
  // regex metacharacters that once made every new Timer "Timer (on/off) 1".
  it("names a block whose type is absent from the table by its internal type", () => {
    expect(newNodeName(makeNamingStub(["Timer 1"]), "Timer")).toBe("Timer 2");
  });
});
