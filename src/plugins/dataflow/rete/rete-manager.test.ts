import { AreaPlugin } from "rete-area-plugin";
import { AreaExtra, Schemes } from "../nodes/rete-scheme";
import { MAX_ZOOM, MIN_ZOOM, ReteManager } from "./rete-manager";

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

describe("ReteManager.getNodeIdsInReadingOrder (CLUE-455)", () => {
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

// The subset of rete-area-plugin's Area that zoomIn/zoomOut/pan/setZoom actually touch, typed off
// the real AreaPlugin so a signature change there (e.g. zoom/translate no longer returning a
// boolean promise) breaks this stub loudly instead of silently.
type FakeArea = Pick<AreaPlugin<Schemes, AreaExtra>["area"], "transform" | "zoom" | "translate">;

/** Stub with just the surface zoomIn/zoomOut/pan/setZoom touch: the rete area transform + zoom/translate,
 *  and the MST content that receives the live transform. */
function makeTransformStub(k = 1, x = 0, y = 0) {
  const calls = { zoom: [] as number[], translate: [] as Array<[number, number]> };
  const area: FakeArea = {
    transform: { k, x, y },
    // Area.zoom resolves false on a successful zoom (inverted vs. its own JSDoc; rete-area-plugin 2.0.2).
    zoom: async (scale: number) => { calls.zoom.push(scale); area.transform.k = scale; return false; },
    translate: async (tx: number, ty: number) => {
      calls.translate.push([tx, ty]);
      area.transform.x = tx; area.transform.y = ty;
      return true;
    },
  };
  const setLiveProgramZoom = jest.fn();
  const stub = Object.create(ReteManager.prototype) as ReteManager;
  (stub as unknown as { area: { area: FakeArea } }).area = { area };
  (stub as unknown as { mstContent: { setLiveProgramZoom: jest.Mock } }).mstContent = { setLiveProgramZoom };
  return { stub, calls, setLiveProgramZoom };
}

describe("ReteManager zoom/pan (CLUE-573)", () => {
  it("zoomIn steps +0.05", async () => {
    const { stub, calls } = makeTransformStub(1);
    await stub.zoomIn();
    expect(calls.zoom).toHaveLength(1);
    expect(calls.zoom[0]).toBeCloseTo(1.05, 10);
  });

  it("zoomIn clamps at MAX_ZOOM", async () => {
    const { stub, calls } = makeTransformStub(MAX_ZOOM - 0.01);
    await stub.zoomIn();
    expect(calls.zoom).toEqual([MAX_ZOOM]);
  });

  it("zoomOut steps -0.05", async () => {
    const { stub, calls } = makeTransformStub(1);
    await stub.zoomOut();
    expect(calls.zoom).toHaveLength(1);
    expect(calls.zoom[0]).toBeCloseTo(0.95, 10);
  });

  it("zoomOut clamps at MIN_ZOOM", async () => {
    const { stub, calls } = makeTransformStub(MIN_ZOOM + 0.01);
    await stub.zoomOut();
    expect(calls.zoom).toEqual([MIN_ZOOM]);
  });

  it("setZoom writes the resulting transform to liveProgramZoom", async () => {
    const { stub, setLiveProgramZoom } = makeTransformStub(1);
    await (stub as unknown as { setZoom(zoom: number): Promise<void> }).setZoom(1.5);
    expect(setLiveProgramZoom).toHaveBeenCalledWith(expect.objectContaining({ k: 1.5 }));
  });

  it("pan translates by exactly the requested delta", async () => {
    const { stub, calls } = makeTransformStub(1, 10, 20);
    await stub.pan(40, -40);
    expect(calls.translate).toEqual([[50, -20]]);
  });
});
