import { destroy } from "mobx-state-tree";
import {
  defaultGeometryContent, GeometryContentModelType, GeometryMetadataModel,
} from "../../../models/tiles/geometry/geometry-content";
import { isCircle, isInfiniteLine, isPoint, isPolygon } from "../../../models/tiles/geometry/jxg-types";
import { seedShapeForMode } from "./geometry-keyboard-create";

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

const divId = "keyboardCreateBoard";
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

function pointCoords(p: JXG.Point): [number, number] {
  const [, x, y] = p.coords.usrCoords;
  return [x, y];
}

describe("seedShapeForMode — points / select", () => {
  it("is a no-op for 'select' mode (navigation only — no point created)", () => {
    const { content, board } = createContentAndBoard();
    const created = seedShapeForMode(board, content, "select");
    expect(created).toEqual([]);
    cleanup(content, board);
  });

  it("seeds a single free point at (1, 1) for 'points' mode", () => {
    const { content, board } = createContentAndBoard();
    const created = seedShapeForMode(board, content, "points");
    const points = created.filter(isPoint);
    expect(points).toHaveLength(1);
    expect(pointCoords(points[0])).toEqual([1, 1]);
    cleanup(content, board);
  });
});

describe("seedShapeForMode — polygon", () => {
  it("seeds a unit-square polygon with 4 vertices at (1,1) (2,1) (2,2) (1,2)", () => {
    const { content, board } = createContentAndBoard();
    const created = seedShapeForMode(board, content, "polygon");
    const points = created.filter(isPoint);
    const polygons = created.filter(isPolygon);

    expect(points).toHaveLength(4);
    expect(polygons).toHaveLength(1);
    const coords = points.map(pointCoords).sort();
    expect(coords).toEqual([[1, 1], [1, 2], [2, 1], [2, 2]]);
    cleanup(content, board);
  });
});

describe("seedShapeForMode — circle", () => {
  it("seeds a unit circle centered at (1, 1) with tangent point at (2, 1)", () => {
    const { content, board } = createContentAndBoard();
    const created = seedShapeForMode(board, content, "circle");
    const points = created.filter(isPoint);
    const circles = created.filter(isCircle);

    expect(points).toHaveLength(2);
    expect(circles).toHaveLength(1);
    const coords = points.map(pointCoords).sort();
    expect(coords).toEqual([[1, 1], [2, 1]]);
    cleanup(content, board);
  });
});

describe("seedShapeForMode — line (infinite)", () => {
  it("seeds an infinite line through (1, 1) and (2, 1)", () => {
    const { content, board } = createContentAndBoard();
    const created = seedShapeForMode(board, content, "line");
    const points = created.filter(isPoint);
    const lines = created.filter(isInfiniteLine);

    expect(points).toHaveLength(2);
    expect(lines).toHaveLength(1);
    const coords = points.map(pointCoords).sort();
    expect(coords).toEqual([[1, 1], [2, 1]]);
    cleanup(content, board);
  });
});

describe("seedShapeForMode — unknown / unhandled modes", () => {
  it("returns an empty list and creates no objects for an unhandled mode", () => {
    const { content, board } = createContentAndBoard();
    const initialSize = content.objects.size;
    const created = seedShapeForMode(board, content, "unhandledmode" as any);
    expect(created).toEqual([]);
    expect(content.objects.size).toBe(initialSize);
    cleanup(content, board);
  });
});
