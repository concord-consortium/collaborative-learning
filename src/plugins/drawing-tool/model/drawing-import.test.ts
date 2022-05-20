import { IDrawingTileImportSpec, importDrawingTileSpec, isDrawingTileImportSpec } from "./drawing-import";
import {
  EllipseDrawingObjectData, ImageDrawingObjectData, LineDrawingObjectData,
  RectangleDrawingObjectData, VectorDrawingObjectData
} from "./drawing-objects";

// mock uniqueId so we can recognize auto-generated IDs
let idCount = 0;
jest.mock("../../../utilities/js-utils", () => {
  const { uniqueId, ...others } = jest.requireActual("../../../utilities/js-utils");
  return {
    uniqueId: () => `testid-${++idCount}`,
    ...others
  };
});

describe("isDrawingTileImportSpec", () => {
  it("should work", () => {
    expect(isDrawingTileImportSpec(null)).toBe(false);
    expect(isDrawingTileImportSpec({ type: "Drawing", objects: [] })).toBe(true);
    expect(isDrawingTileImportSpec({ type: "Drawing" })).toBe(false);
    expect(isDrawingTileImportSpec({ objects: [] })).toBe(false);
    expect(isDrawingTileImportSpec({ type: "Drawing", objects: [], changes: [] })).toBe(false);
  });
});

describe("importDrawingTileSpec", () => {

  beforeEach(() => {
    idCount = 0;
  });

  function importToChanges(input: IDrawingTileImportSpec) {
    const imported = importDrawingTileSpec(input);
    return imported.changes.map(change => JSON.parse(change));
  }

  it("should import vectors (simple lines)", () => {
    const vectorData: VectorDrawingObjectData = {
      type: "vector",
      x: 10, y: 10,
      dx: 10, dy: 10,
      stroke: "#888888",
      strokeDashArray: "3,3",
      strokeWidth: 1
    };
    const input = { type: "Drawing" as const, objects: [vectorData] };
    // assigns a unique id if none is provided
    expect(importToChanges(input)[0]).toEqual({ action: "create", data: { ...vectorData, id: "testid-1" } });

    const vectorDataWithId = { ...vectorData, id: "vector-id" };
    const inputWithId = { type: "Drawing" as const, objects: [vectorDataWithId] };
    // preserves id if one is provided
    expect(importToChanges(inputWithId)[0]).toEqual({ action: "create", data: vectorDataWithId });
  });

  it("should import lines (polylines)", () => {
    const lineData: LineDrawingObjectData = {
      type: "line",
      x: 10, y: 10,
      deltaPoints: [{ dx: 10, dy: 10 }, { dx: 5, dy: 5 }],
      stroke: "#888888",
      strokeDashArray: "3,3",
      strokeWidth: 1
    };
    const input = { type: "Drawing" as const, objects: [lineData] };
    // assigns a unique id if none is provided
    expect(importToChanges(input)[0]).toEqual({ action: "create", data: { ...lineData, id: "testid-1" } });

    const lineDataWithId = { ...lineData, id: "line-id" };
    const inputWithId = { type: "Drawing" as const, objects: [lineDataWithId] };
    // preserves id if one is provided
    expect(importToChanges(inputWithId)[0]).toEqual({ action: "create", data: lineDataWithId });
  });

  it("should import rectangles", () => {
    const rectData: RectangleDrawingObjectData = {
      type: "rectangle",
      x: 10, y: 10,
      width: 10, height: 10,
      fill: "#cccccc",
      stroke: "#888888",
      strokeDashArray: "3,3",
      strokeWidth: 1
    };
    const input = { type: "Drawing" as const, objects: [rectData] };
    // assigns a unique id if none is provided
    expect(importToChanges(input)[0]).toEqual({ action: "create", data: { ...rectData, id: "testid-1" } });

    const rectDataWithId = { ...rectData, id: "rect-id" };
    const inputWithId = { type: "Drawing" as const, objects: [rectDataWithId] };
    // preserves id if one is provided
    expect(importToChanges(inputWithId)[0]).toEqual({ action: "create", data: rectDataWithId });
  });

  it("should import ellipses", () => {
    const ellipseData: EllipseDrawingObjectData = {
      type: "ellipse",
      x: 10, y: 10,
      rx: 10, ry: 10,
      fill: "#cccccc",
      stroke: "#888888",
      strokeDashArray: "3,3",
      strokeWidth: 1
    };
    const input = { type: "Drawing" as const, objects: [ellipseData] };
    // assigns a unique id if none is provided
    expect(importToChanges(input)[0]).toEqual({ action: "create", data: { ...ellipseData, id: "testid-1" } });

    const ellipseDataWithId = { ...ellipseData, id: "ellipse-id" };
    const inputWithId = { type: "Drawing" as const, objects: [ellipseDataWithId] };
    // preserves id if one is provided
    expect(importToChanges(inputWithId)[0]).toEqual({ action: "create", data: ellipseDataWithId });
  });

  it("should import images", () => {
    const imageData: ImageDrawingObjectData = {
      type: "image",
      url: "my/image/url",
      x: 10, y: 10,
      width: 10, height: 10
    };
    const input = { type: "Drawing" as const, objects: [imageData] };
    // assigns a unique id if none is provided
    expect(importToChanges(input)[0]).toEqual({ action: "create", data: { ...imageData, id: "testid-1" } });

    const imageDataWithId = { ...imageData, id: "image-id" };
    const inputWithId = { type: "Drawing" as const, objects: [imageDataWithId] };
    // preserves id if one is provided
    expect(importToChanges(inputWithId)[0]).toEqual({ action: "create", data: imageDataWithId });
  });
});
