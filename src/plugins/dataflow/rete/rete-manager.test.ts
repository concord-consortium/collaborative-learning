import { AreaPlugin } from "rete-area-plugin";
import { AreaExtra, Schemes } from "../nodes/rete-scheme";
import {
  kDefaultNodeWidth, kTallestNodeHeight, MAX_ZOOM, MIN_ZOOM, ReteManager
} from "./rete-manager";

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

/**
 * A new block has to land where the user is looking. Node positions are world coordinates, and the
 * area transform maps them to the screen as `screen = world * k + (x, y)` — so a stub needs the
 * transform, the node count the grid steps through, and the container size that bounds the viewport.
 */
function makePositionStub(
  nodeCount: number,
  transform: { k: number, x: number, y: number },
  container: { width: number, height: number } | null = { width: 800, height: 600 }
) {
  const stub = Object.create(ReteManager.prototype) as ReteManager;
  const nodes = Array.from({ length: nodeCount }, (_, i) => ({ id: `n${i}` }));
  (stub as unknown as { editor: { getNodes(): unknown[] } }).editor = { getNodes: () => nodes };
  (stub as unknown as { area: { area: { transform: typeof transform } } }).area = { area: { transform } };
  // getContainerDimensions is private and reads the DOM; an own property shadows the prototype.
  (stub as unknown as { getContainerDimensions(): typeof container }).getContainerDimensions = () => container;
  return stub;
}

/** The world-coordinate rect the user can currently see, per `screen = world * k + (x, y)`. */
function visibleWorldRect(transform: { k: number, x: number, y: number },
                          container: { width: number, height: number }) {
  return {
    left: -transform.x / transform.k,
    top: -transform.y / transform.k,
    right: (container.width - transform.x) / transform.k,
    bottom: (container.height - transform.y) / transform.k,
  };
}

describe("ReteManager.getNewNodePosition (CLUE-689)", () => {
  const container = { width: 800, height: 600 };

  it("places the first block near the top left of the view when nothing is panned", () => {
    const pos = makePositionStub(0, { k: 1, x: 0, y: 0 }, container).getNewNodePosition();
    expect(pos[0]).toBeGreaterThanOrEqual(0);
    expect(pos[0]).toBeLessThan(100);
    expect(pos[1]).toBeGreaterThanOrEqual(0);
    expect(pos[1]).toBeLessThan(100);
  });

  // The bug: the grid was anchored at the world origin, so once the canvas was panned — which
  // fit-on-load does by itself — a new block was created outside the viewport and the button
  // looked dead.
  it("follows a panned view instead of staying at the world origin", () => {
    const transform = { k: 1, x: -1200, y: -800 };
    const pos = makePositionStub(0, transform, container).getNewNodePosition();
    const view = visibleWorldRect(transform, container);
    expect(pos[0]).toBeGreaterThanOrEqual(view.left);
    expect(pos[1]).toBeGreaterThanOrEqual(view.top);
    expect(pos[0]).toBeLessThan(view.right);
    expect(pos[1]).toBeLessThan(view.bottom);
  });

  it.each([
    ["unpanned",      { k: 1,   x: 0,     y: 0 }],
    ["panned",        { k: 1,   x: -1200, y: -800 }],
    ["zoomed in",     { k: 2,   x: -300,  y: -150 }],
    ["zoomed out",    { k: 0.5, x: 400,   y: 250 }],
  ])("keeps every block of a full grid inside a %s view", (_label, transform) => {
    const view = visibleWorldRect(transform, container);
    for (let n = 0; n < 24; n++) {
      const pos = makePositionStub(n, transform, container).getNewNodePosition();
      expect(pos[0]).toBeGreaterThanOrEqual(view.left);
      expect(pos[1]).toBeGreaterThanOrEqual(view.top);
      // The block's own footprint has to fit too, not just its top-left corner, and the bound is
      // the tallest block rather than the average one.
      expect(pos[0] + kDefaultNodeWidth).toBeLessThanOrEqual(view.right);
      expect(pos[1] + kTallestNodeHeight).toBeLessThanOrEqual(view.bottom);
    }
  });

  it("steps each new block to its own slot rather than stacking them", () => {
    const transform = { k: 1, x: 0, y: 0 };
    const first = makePositionStub(0, transform, container).getNewNodePosition();
    const second = makePositionStub(1, transform, container).getNewNodePosition();
    expect(second).not.toEqual(first);
  });

  // Zoomed in, the visible world is small enough that the grid fills in four blocks and the cascade
  // that offsets each later pass has only a few units of room to work in. That is the regime where
  // an unbounded cascade lands every pass past the edge on the same clamped spot, so several blocks
  // sit exactly on top of each other and read as one.
  it("does not stack later blocks once the grid has filled and refilled", () => {
    const transform = { k: 2, x: 0, y: 0 };
    const positions = Array.from({ length: 16 }, (_, n) =>
      makePositionStub(n, transform, container).getNewNodePosition().join(","));
    expect(new Set(positions).size).toBe(positions.length);
  });

  it("still returns a usable position before the container has been laid out", () => {
    const pos = makePositionStub(0, { k: 1, x: 0, y: 0 }, null).getNewNodePosition();
    expect(Number.isFinite(pos[0])).toBe(true);
    expect(Number.isFinite(pos[1])).toBe(true);
  });
});

/**
 * getContainerDimensions exists because the rete area element is routinely 0-wide, so it falls back
 * to a `.cover` ancestor and then to a parent walk. jsdom does no layout — every rect is 0 — so the
 * sizes here are defined explicitly; what is under test is which element the method decides to
 * believe, which is the part that silently breaks when the tile's markup moves around.
 */
function sizedDiv(className: string, width: number, height: number) {
  const el = document.createElement("div");
  el.className = className;
  Object.defineProperty(el, "offsetWidth", { value: width, configurable: true });
  Object.defineProperty(el, "offsetHeight", { value: height, configurable: true });
  Object.defineProperty(el, "clientWidth", { value: width, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: height, configurable: true });
  el.getBoundingClientRect = () => ({ width, height, top: 0, left: 0, right: width, bottom: height,
    x: 0, y: 0, toJSON: () => ({}) });
  return el;
}

function makeContainerStub(container: HTMLElement | null) {
  const stub = Object.create(ReteManager.prototype) as ReteManager;
  (stub as unknown as { area: { container: HTMLElement | null } }).area = { container };
  return (stub as unknown as { getContainerDimensions(): { width: number, height: number } | null });
}

describe("ReteManager.getContainerDimensions (CLUE-689)", () => {
  it("uses the area element's own size when it has one", () => {
    expect(makeContainerStub(sizedDiv("area", 640, 480)).getContainerDimensions())
      .toEqual({ width: 640, height: 480 });
  });

  // The .cover is deliberately smaller than the ancestor around it: both paths would otherwise
  // report the same size and the test could not tell which one ran.
  it("prefers a .cover ancestor over a larger one when the area element is zero-width", () => {
    const outer = sizedDiv("workspace", 900, 700);
    const cover = sizedDiv("cover", 250, 150);
    const area = sizedDiv("area", 0, 0);
    outer.appendChild(cover);
    cover.appendChild(area);
    expect(makeContainerStub(area).getContainerDimensions()).toEqual({ width: 250, height: 150 });
  });

  it("walks up to a sized ancestor when there is no .cover", () => {
    const outer = sizedDiv("workspace", 900, 700);
    const middle = sizedDiv("wrapper", 0, 0);
    const area = sizedDiv("area", 0, 0);
    outer.appendChild(middle);
    middle.appendChild(area);
    expect(makeContainerStub(area).getContainerDimensions()).toEqual({ width: 900, height: 700 });
  });

  // The walk requires a "reasonable" ancestor (> 300 x 200), so a chain of small ones yields nothing
  // rather than a misleading size — getNewNodePosition treats null as "not laid out yet".
  it("returns null when nothing in the chain is big enough to be the viewport", () => {
    const outer = sizedDiv("small", 120, 90);
    const area = sizedDiv("area", 0, 0);
    outer.appendChild(area);
    expect(makeContainerStub(area).getContainerDimensions()).toBeNull();
  });

  it("returns null without a container element at all", () => {
    expect(makeContainerStub(null).getContainerDimensions()).toBeNull();
  });
});
