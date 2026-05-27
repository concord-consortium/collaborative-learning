import { destroy } from "mobx-state-tree";
import {
  defaultGeometryContent, GeometryContentModelType, GeometryMetadataModel,
} from "../../../models/tiles/geometry/geometry-content";
import { applyA11yAttributes } from "./geometry-aria-utils";
import { selectFocusedGeometryObject } from "./geometry-keyboard-selection";

// Logger / DOM scaffold mirroring geometry-apply-a11y.test.ts.
jest.mock("../../../models/tiles/log/log-tile-change-event", () => ({
  logTileChangeEvent: () => undefined,
}));

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
afterAll(() => consoleSpy.mockRestore());

const divId = "keyboardSelectionBoard";
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

function focus(elt: HTMLElement | SVGElement) {
  // jsdom honors .focus() on elements with tabindex; applyA11yAttributes sets tabindex=0.
  (elt as HTMLElement).focus();
}

describe("selectFocusedGeometryObject — bails", () => {
  it("returns false when nothing in the document is focused", () => {
    const { content, board } = createContentAndBoard();
    (document.activeElement as HTMLElement | null)?.blur();
    expect(selectFocusedGeometryObject(board, content, { extend: false })).toBe(false);
    cleanup(content, board);
  });

  it("returns false when the focused element has no data-object-id", () => {
    const { content, board } = createContentAndBoard();
    const stray = document.createElement("button");
    stray.tabIndex = 0;
    document.body.appendChild(stray);
    focus(stray);
    expect(selectFocusedGeometryObject(board, content, { extend: false })).toBe(false);
    stray.remove();
    cleanup(content, board);
  });
});

describe("selectFocusedGeometryObject — free point", () => {
  it("selects the focused point and returns true on first activation", () => {
    const { content, board } = createContentAndBoard();
    const point = content.addPoint(board, [3, 4])! as JXG.Point;
    applyA11yAttributes(point, content);
    focus(point.rendNode);

    const consumed = selectFocusedGeometryObject(board, content, { extend: false });

    expect(consumed).toBe(true);
    expect(content.isSelected(point.id)).toBe(true);
    cleanup(content, board);
  });

  it("deselects the focused point on second activation (toggle off)", () => {
    const { content, board } = createContentAndBoard();
    const point = content.addPoint(board, [3, 4])! as JXG.Point;
    applyA11yAttributes(point, content);
    content.selectElement(board, point.id);
    focus(point.rendNode);

    selectFocusedGeometryObject(board, content, { extend: false });

    expect(content.isSelected(point.id)).toBe(false);
    cleanup(content, board);
  });

  it("replaces the existing selection when activating a different point (extend=false)", () => {
    const { content, board } = createContentAndBoard();
    const pointA = content.addPoint(board, [1, 1])! as JXG.Point;
    const pointB = content.addPoint(board, [2, 2])! as JXG.Point;
    applyA11yAttributes(pointA, content);
    applyA11yAttributes(pointB, content);
    content.selectElement(board, pointA.id);
    focus(pointB.rendNode);

    selectFocusedGeometryObject(board, content, { extend: false });

    expect(content.isSelected(pointA.id)).toBe(false);
    expect(content.isSelected(pointB.id)).toBe(true);
    cleanup(content, board);
  });

  it("extends the selection (Shift) without deselecting the existing point", () => {
    const { content, board } = createContentAndBoard();
    const pointA = content.addPoint(board, [1, 1])! as JXG.Point;
    const pointB = content.addPoint(board, [2, 2])! as JXG.Point;
    applyA11yAttributes(pointA, content);
    applyA11yAttributes(pointB, content);
    content.selectElement(board, pointA.id);
    focus(pointB.rendNode);

    selectFocusedGeometryObject(board, content, { extend: true });

    expect(content.isSelected(pointA.id)).toBe(true);
    expect(content.isSelected(pointB.id)).toBe(true);
    cleanup(content, board);
  });

  it("no-ops when readOnly is true", () => {
    const { content, board } = createContentAndBoard();
    const point = content.addPoint(board, [3, 4])! as JXG.Point;
    applyA11yAttributes(point, content);
    focus(point.rendNode);

    const consumed = selectFocusedGeometryObject(board, content, { extend: false, readOnly: true });

    expect(consumed).toBe(false);
    expect(content.isSelected(point.id)).toBe(false);
    cleanup(content, board);
  });
});

describe("selectFocusedGeometryObject — polygon (compound shape)", () => {
  it("selects the polygon AND all its defining points so arrow-nudge moves the whole shape", () => {
    const { content, board } = createContentAndBoard();
    content.addPhantomPoint(board, [0, 0]);
    const { point: p1 } = content.realizePhantomPoint(board, [1, 1], "polygon");
    const { point: p2 } = content.realizePhantomPoint(board, [2, 1], "polygon");
    const { point: p3 } = content.realizePhantomPoint(board, [2, 2], "polygon");
    const polygon = content.closeActivePolygon(board, p1!) as JXG.Polygon;
    applyA11yAttributes(polygon, content);
    focus(polygon.rendNode);

    selectFocusedGeometryObject(board, content, { extend: false });

    expect(content.isSelected(polygon.id)).toBe(true);
    expect(content.isSelected(p1!.id)).toBe(true);
    expect(content.isSelected(p2!.id)).toBe(true);
    expect(content.isSelected(p3!.id)).toBe(true);
    cleanup(content, board);
  });

  it("deselects polygon + all its points when toggled off", () => {
    const { content, board } = createContentAndBoard();
    content.addPhantomPoint(board, [0, 0]);
    const { point: p1 } = content.realizePhantomPoint(board, [1, 1], "polygon");
    const { point: p2 } = content.realizePhantomPoint(board, [2, 1], "polygon");
    const { point: p3 } = content.realizePhantomPoint(board, [2, 2], "polygon");
    const polygon = content.closeActivePolygon(board, p1!) as JXG.Polygon;
    applyA11yAttributes(polygon, content);
    content.selectObjects(board, [polygon.id, p1!.id, p2!.id, p3!.id]);
    focus(polygon.rendNode);

    selectFocusedGeometryObject(board, content, { extend: false });

    expect(content.isSelected(polygon.id)).toBe(false);
    expect(content.isSelected(p1!.id)).toBe(false);
    expect(content.isSelected(p2!.id)).toBe(false);
    expect(content.isSelected(p3!.id)).toBe(false);
    cleanup(content, board);
  });
});
