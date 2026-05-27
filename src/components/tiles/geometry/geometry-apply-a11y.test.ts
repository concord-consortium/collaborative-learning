import { destroy } from "mobx-state-tree";
import { defaultGeometryContent, GeometryContentModelType, GeometryMetadataModel }
  from "../../../models/tiles/geometry/geometry-content";
import { applyA11yAttributes, getOrderedGeometryFocusables, refreshA11yAttributes }
  from "./geometry-aria-utils";
import { createLinkedPoint } from "../../../models/tiles/geometry/jxg-table-link";
import { isComment } from "../../../models/tiles/geometry/jxg-types";

// Mirror geometry-content.test.ts — the logger reaches into a Documents store
// we don't set up here, so stub it out to keep tests focused on a11y attrs.
jest.mock("../../../models/tiles/log/log-tile-change-event", () => ({
  logTileChangeEvent: () => undefined,
}));

// Mock to silence JSXGraph's "IntersectionObserver not available" console.log,
// mirroring src/models/tiles/geometry/geometry-content.test.ts.
// eslint-disable-next-line no-console
const origConsoleLog = console.log;
let consoleSpy: jest.SpyInstance;
beforeAll(() => {
  consoleSpy = jest.spyOn(console, "log").mockImplementation((...args: any[]) => {
    if (!args.some(arg => typeof arg === "string" && arg.includes("IntersectionObserver not available"))) {
      origConsoleLog(...args);
    }
  });
});
afterAll(() => {
  consoleSpy.mockRestore();
});

const divId = "applyA11yBoard";
document.body.innerHTML = `<div id="${divId}" style="width:200px;height:200px"></div>`;

function createContentAndBoard(): { content: GeometryContentModelType, board: JXG.Board } {
  const content = defaultGeometryContent();
  const metadata = GeometryMetadataModel.create({ id: "geometry-1" });
  content.doPostCreate!(metadata);
  const board = content.initializeBoard(divId, false, () => {/* noop */}, () => {/* noop */}) as JXG.Board;
  content.resizeBoard(board, 200, 200);
  return { content, board };
}

function cleanup(content: GeometryContentModelType, board: JXG.Board) {
  content.destroyBoard(board);
  destroy(content);
}

describe("applyA11yAttributes — free point", () => {
  it("sets tabindex, role=button, aria-pressed=false, data-object-id, and aria-label on the rendNode", () => {
    const { content, board } = createContentAndBoard();
    const point = content.addPoint(board, [3, 4])! as JXG.Point;
    applyA11yAttributes(point, content);
    expect(point.rendNode.getAttribute("tabindex")).toBe("0");
    expect(point.rendNode.getAttribute("role")).toBe("button");
    expect(point.rendNode.getAttribute("aria-pressed")).toBe("false");
    expect(point.rendNode.getAttribute("data-object-id")).toBe(point.id);
    expect(point.rendNode.getAttribute("aria-label")).toContain("Point");
    expect(point.rendNode.getAttribute("aria-label")).toContain("(3, 4)");
    cleanup(content, board);
  });

  it("sets aria-pressed=true and ', Selected' suffix when the point is selected", () => {
    const { content, board } = createContentAndBoard();
    const point = content.addPoint(board, [3, 4])! as JXG.Point;
    content.selectElement(board, point.id);
    applyA11yAttributes(point, content);
    expect(point.rendNode.getAttribute("aria-pressed")).toBe("true");
    expect(point.rendNode.getAttribute("aria-label")).toContain(", Selected");
    cleanup(content, board);
  });

  it("removes tabindex and aria-label on a phantom point so it is not focusable", () => {
    const { content, board } = createContentAndBoard();
    const phantomPoint = content.addPhantomPoint(board, [0, 0])! as JXG.Point;
    applyA11yAttributes(phantomPoint, content);
    expect(phantomPoint.rendNode.getAttribute("tabindex")).toBeNull();
    expect(phantomPoint.rendNode.getAttribute("aria-label")).toBeNull();
    expect(phantomPoint.rendNode.getAttribute("role")).toBeNull();
    cleanup(content, board);
  });

  it("does not make objects focusable in read-only mode", () => {
    const { content, board } = createContentAndBoard();
    const point = content.addPoint(board, [3, 4])! as JXG.Point;
    applyA11yAttributes(point, content, { readOnly: true });
    expect(point.rendNode.getAttribute("tabindex")).toBeNull();
    expect(point.rendNode.getAttribute("role")).toBeNull();
    expect(point.rendNode.getAttribute("aria-label")).toBeNull();
    cleanup(content, board);
  });
});

describe("applyA11yAttributes — polygon", () => {
  it("sets attrs on the polygon's own rendNode with the polygon aria-label", () => {
    const { content, board } = createContentAndBoard();
    content.addPhantomPoint(board, [0, 0]);
    const { point: p1 } = content.realizePhantomPoint(board, [1, 1], "polygon");
    content.realizePhantomPoint(board, [2, 1], "polygon");
    content.realizePhantomPoint(board, [2, 2], "polygon");
    const polygon = content.closeActivePolygon(board, p1!) as JXG.Polygon;
    expect(polygon).toBeDefined();

    applyA11yAttributes(polygon, content);

    expect(polygon.rendNode.getAttribute("tabindex")).toBe("0");
    expect(polygon.rendNode.getAttribute("role")).toBe("button");
    expect(polygon.rendNode.getAttribute("data-object-id")).toBe(polygon.id);
    const label = polygon.rendNode.getAttribute("aria-label") ?? "";
    expect(label).toMatch(/^Polygon .* with 3 vertices$/);
    cleanup(content, board);
  });

  it("decorates each polygon vertex with its 'Vertex k of N of polygon X' label", () => {
    const { content, board } = createContentAndBoard();
    content.addPhantomPoint(board, [0, 0]);
    const { point: p1 } = content.realizePhantomPoint(board, [1, 1], "polygon");
    const { point: p2 } = content.realizePhantomPoint(board, [2, 1], "polygon");
    const { point: p3 } = content.realizePhantomPoint(board, [2, 2], "polygon");
    const polygon = content.closeActivePolygon(board, p1!) as JXG.Polygon;

    applyA11yAttributes(polygon, content);

    const labels = [p1!, p2!, p3!].map(pt => pt.rendNode.getAttribute("aria-label") ?? "");
    expect(labels[0]).toMatch(/^Vertex 1 of 3 of polygon /);
    expect(labels[1]).toMatch(/^Vertex 2 of 3 of polygon /);
    expect(labels[2]).toMatch(/^Vertex 3 of 3 of polygon /);
    cleanup(content, board);
  });

  it("keeps the vertex label after a standalone pass over the same point (order-independent)", () => {
    // A full-board refresh visits every object, including each polygon vertex
    // directly (with no vertexInfo). The polygon's recursive pass (not the
    // standalone point pass) must own the vertex label, regardless of which
    // pass runs last. Here we apply the standalone pass *after* the polygon's
    // pass to prove the bare "Point" label never clobbers "Vertex k of N".
    const { content, board } = createContentAndBoard();
    content.addPhantomPoint(board, [0, 0]);
    const { point: p1 } = content.realizePhantomPoint(board, [1, 1], "polygon");
    const { point: p2 } = content.realizePhantomPoint(board, [2, 1], "polygon");
    const { point: p3 } = content.realizePhantomPoint(board, [2, 2], "polygon");
    const polygon = content.closeActivePolygon(board, p1!) as JXG.Polygon;

    applyA11yAttributes(polygon, content);
    // Re-run the standalone point pass on each vertex, simulating a later
    // iteration of forEachBoardObject reaching the vertex with no vertexInfo.
    [p1!, p2!, p3!].forEach(pt => applyA11yAttributes(pt, content));

    const labels = [p1!, p2!, p3!].map(pt => pt.rendNode.getAttribute("aria-label") ?? "");
    expect(labels[0]).toMatch(/^Vertex 1 of 3 of polygon /);
    expect(labels[1]).toMatch(/^Vertex 2 of 3 of polygon /);
    expect(labels[2]).toMatch(/^Vertex 3 of 3 of polygon /);
    cleanup(content, board);
  });
});

describe("applyA11yAttributes — linked Table point", () => {
  it("labels a point created via createLinkedPoint with the 'Linked point' phrasing", () => {
    const { content, board } = createContentAndBoard();
    // Mirror the production wiring at geometry-content.tsx:967 — createLinkedPoint
    // produces a JXG.Point with clientType="linkedPoint"; handleCreatePoint then
    // calls applyA11yAttributes which uses the isLinked branch of the label
    // builder. We exercise the same boundary directly here.
    const point = createLinkedPoint(board, [3, 4], { id: "linked-test", name: "T1" });
    expect(point).toBeDefined();

    applyA11yAttributes(point as JXG.Point, content);

    expect((point as JXG.Point).rendNode.getAttribute("aria-label"))
      .toBe("Linked point at (3, 4)");
    expect((point as JXG.Point).rendNode.getAttribute("data-object-id"))
      .toBe((point as JXG.Point).id);
    expect((point as JXG.Point).rendNode.getAttribute("tabindex")).toBe("0");
    cleanup(content, board);
  });
});

describe("applyA11yAttributes — comment", () => {
  it("names the anchored object in the comment's aria-label", () => {
    const { content, board } = createContentAndBoard();
    const point = content.addPoint(board, [3, 4])! as JXG.Point;
    const elems = content.addComment(board, point.id, "needs work");
    const comment = elems?.find(isComment) as JXG.Text;
    expect(comment).toBeDefined();

    applyA11yAttributes(comment, content);

    const label = comment.rendNode.getAttribute("aria-label") ?? "";
    expect(label).toMatch(/^Comment on Point/);
    expect(label).toContain("needs work");
    cleanup(content, board);
  });
});

describe("getOrderedGeometryFocusables — semantic Tab order", () => {
  it("groups each polygon's defining vertices immediately after the polygon", () => {
    const { content, board } = createContentAndBoard();

    // First polygon: 3 vertices, drawn before the orphan points / second polygon.
    content.addPhantomPoint(board, [0, 0]);
    const r1a = content.realizePhantomPoint(board, [1, 1], "polygon");
    const r1b = content.realizePhantomPoint(board, [2, 1], "polygon");
    const r1c = content.realizePhantomPoint(board, [2, 2], "polygon");
    const polygon1 = content.closeActivePolygon(board, r1a.point!) as JXG.Polygon;
    // Apply attrs so isFocusable checks (tabindex=0) succeed.
    applyA11yAttributes(polygon1, content);

    // Orphan free points.
    const orphan1 = content.addPoint(board, [10, 10])! as JXG.Point;
    const orphan2 = content.addPoint(board, [20, 20])! as JXG.Point;
    applyA11yAttributes(orphan1, content);
    applyA11yAttributes(orphan2, content);

    // Second polygon: 3 different vertices, drawn after the orphans.
    content.addPhantomPoint(board, [0, 0]);
    const r2a = content.realizePhantomPoint(board, [5, 5], "polygon");
    const r2b = content.realizePhantomPoint(board, [6, 5], "polygon");
    const r2c = content.realizePhantomPoint(board, [6, 6], "polygon");
    const polygon2 = content.closeActivePolygon(board, r2a.point!) as JXG.Polygon;
    applyA11yAttributes(polygon2, content);

    const ordered = getOrderedGeometryFocusables(board);
    const ids = ordered.map(el => el.getAttribute("data-object-id"));

    // Expected: polygon1, p1.v1, p1.v2, p1.v3, polygon2, p2.v1, p2.v2, p2.v3, orphan1, orphan2.
    expect(ids).toEqual([
      polygon1.id, r1a.point!.id, r1b.point!.id, r1c.point!.id,
      polygon2.id, r2a.point!.id, r2b.point!.id, r2c.point!.id,
      orphan1.id, orphan2.id,
    ]);
    cleanup(content, board);
  });

  it("excludes phantom and invisible elements", () => {
    const { content, board } = createContentAndBoard();
    const point = content.addPoint(board, [1, 1])! as JXG.Point;
    const phantom = content.addPhantomPoint(board, [3, 3])! as JXG.Point;
    applyA11yAttributes(point, content);
    applyA11yAttributes(phantom, content);

    const ordered = getOrderedGeometryFocusables(board);
    const ids = ordered.map(el => el.getAttribute("data-object-id"));

    expect(ids).toContain(point.id);
    expect(ids).not.toContain(phantom.id);
    cleanup(content, board);
  });

  it("returns an empty list for an empty board", () => {
    const { content, board } = createContentAndBoard();
    expect(getOrderedGeometryFocusables(board)).toEqual([]);
    cleanup(content, board);
  });

  it("visits each point at most once when it belongs to multiple compound shapes", () => {
    const { content, board } = createContentAndBoard();
    // Build a polygon, then a circle that reuses the polygon's first vertex.
    content.addPhantomPoint(board, [0, 0]);
    const rp1 = content.realizePhantomPoint(board, [1, 1], "polygon");
    content.realizePhantomPoint(board, [3, 1], "polygon");
    content.realizePhantomPoint(board, [2, 3], "polygon");
    const polygon = content.closeActivePolygon(board, rp1.point!) as JXG.Polygon;
    applyA11yAttributes(polygon, content);

    // Now make a circle that shares the polygon's first vertex as its center.
    // (createCircleIncludingPoint reuses an existing point as the circle's center.)
    content.addPhantomPoint(board, [4, 4]);
    const circle = content.createCircleIncludingPoint(board, rp1.point!.id) as JXG.Circle;
    applyA11yAttributes(circle, content);

    const ordered = getOrderedGeometryFocusables(board);
    const sharedPointAppearances = ordered.filter(
      el => el.getAttribute("data-object-id") === rp1.point!.id,
    ).length;
    expect(sharedPointAppearances).toBe(1);
    cleanup(content, board);
  });
});

describe("refreshA11yAttributes", () => {
  it("re-applies attrs to every visible object on the board in one pass", () => {
    const { content, board } = createContentAndBoard();
    const pointA = content.addPoint(board, [1, 1])! as JXG.Point;
    const pointB = content.addPoint(board, [2, 2])! as JXG.Point;
    // Strip the attrs so we can prove the refresh re-applies them (otherwise
    // applyA11yAttributes called via createContentAndBoard could already have
    // set them).
    pointA.rendNode.removeAttribute("tabindex");
    pointB.rendNode.removeAttribute("tabindex");

    refreshA11yAttributes(board, content);

    expect(pointA.rendNode.getAttribute("tabindex")).toBe("0");
    expect(pointB.rendNode.getAttribute("tabindex")).toBe("0");
    cleanup(content, board);
  });

  it("updates aria-pressed when a point is selected after the first decoration", () => {
    const { content, board } = createContentAndBoard();
    const point = content.addPoint(board, [3, 4])! as JXG.Point;
    applyA11yAttributes(point, content);
    expect(point.rendNode.getAttribute("aria-pressed")).toBe("false");

    content.selectElement(board, point.id);
    refreshA11yAttributes(board, content);

    expect(point.rendNode.getAttribute("aria-pressed")).toBe("true");
    expect(point.rendNode.getAttribute("aria-label")).toContain(", Selected");
    cleanup(content, board);
  });

  it("clears object tab stops when refreshing a read-only board", () => {
    const { content, board } = createContentAndBoard();
    const point = content.addPoint(board, [1, 1])! as JXG.Point;
    applyA11yAttributes(point, content);
    expect(point.rendNode.getAttribute("tabindex")).toBe("0");

    refreshA11yAttributes(board, content, true);

    expect(point.rendNode.getAttribute("tabindex")).toBeNull();
    cleanup(content, board);
  });
});
