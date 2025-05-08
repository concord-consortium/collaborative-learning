import { getSnapshot } from "mobx-state-tree";
import { EllipseObjectSnapshot } from "../objects/ellipse";
import { ImageObjectSnapshot } from "../objects/image";
import { LineObjectSnapshot } from "../objects/line";
import { RectangleObjectSnapshot } from "../objects/rectangle";
import { VectorObjectSnapshot } from "../objects/vector";
import { DrawingContentModelSnapshot } from "./drawing-content";
import { DrawingMigrator } from "./drawing-migrator";

// mock uniqueId so we can recognize auto-generated IDs
let idCount = 0;
jest.mock("../../../utilities/js-utils", () => {
  const { uniqueId, ...others } = jest.requireActual("../../../utilities/js-utils");
  return {
    uniqueId: () => `testid-${++idCount}`,
    ...others
  };
});

describe("import drawing", () => {

  beforeEach(() => {
    idCount = 0;
  });

  function importToObjects(input: DrawingContentModelSnapshot) {
    const imported = DrawingMigrator.create(input);
    return getSnapshot(imported).objects;
  }

  it("should import vectors (simple lines)", () => {
    const vectorData: VectorObjectSnapshot = {
      type: "vector",
      x: 10, y: 10,
      dx: 10, dy: 10,
      stroke: "#888888",
      strokeDashArray: "3,3",
      strokeWidth: 1,
      visible: true,
      hFlip: false,
      vFlip: false
    };
    const input = { type: "Drawing" as const, objects: [vectorData] };
    // assigns a unique id if none is provided
    expect(importToObjects(input)[0]).toEqual({ ...vectorData, id: "testid-1" });

    const vectorDataWithId = { ...vectorData, id: "vector-id" };
    const inputWithId = { type: "Drawing" as const, objects: [vectorDataWithId] };
    // preserves id if one is provided
    expect(importToObjects(inputWithId)[0]).toEqual(vectorDataWithId);
  });

  it("should import lines (polylines)", () => {
    const lineData: LineObjectSnapshot = {
      type: "line",
      x: 10, y: 10,
      deltaPoints: [{ dx: 10, dy: 10 }, { dx: 5, dy: 5 }],
      stroke: "#888888",
      strokeDashArray: "3,3",
      strokeWidth: 1,
      visible: true,
      hFlip: false,
      vFlip: false
    };
    const input = { type: "Drawing" as const, objects: [lineData] };
    // assigns a unique id if none is provided
    expect(importToObjects(input)[0]).toEqual({ ...lineData, id: "testid-1" });

    const lineDataWithId = { ...lineData, id: "line-id" };
    const inputWithId = { type: "Drawing" as const, objects: [lineDataWithId] };
    // preserves id if one is provided
    expect(importToObjects(inputWithId)[0]).toEqual(lineDataWithId);
  });

  it("should import rectangles", () => {
    const rectData: RectangleObjectSnapshot = {
      type: "rectangle",
      x: 10, y: 10,
      width: 10, height: 10,
      fill: "#cccccc",
      stroke: "#888888",
      strokeDashArray: "3,3",
      strokeWidth: 1,
      visible: true,
      hFlip: false,
      vFlip: false
    };
    const input = { type: "Drawing" as const, objects: [rectData] };
    // assigns a unique id if none is provided
    expect(importToObjects(input)[0]).toEqual({ ...rectData, id: "testid-1" });

    const rectDataWithId = { ...rectData, id: "rect-id" };
    const inputWithId = { type: "Drawing" as const, objects: [rectDataWithId] };
    // preserves id if one is provided
    expect(importToObjects(inputWithId)[0]).toEqual(rectDataWithId);
  });

  it("should import ellipses", () => {
    const ellipseData: EllipseObjectSnapshot = {
      type: "ellipse",
      x: 10, y: 10,
      rx: 10, ry: 10,
      fill: "#cccccc",
      stroke: "#888888",
      strokeDashArray: "3,3",
      strokeWidth: 1,
      visible: true,
      hFlip: false,
      vFlip: false
    };
    const input = { type: "Drawing" as const, objects: [ellipseData] };
    // assigns a unique id if none is provided
    expect(importToObjects(input)[0]).toEqual({ ...ellipseData, id: "testid-1" });

    const ellipseDataWithId = { ...ellipseData, id: "ellipse-id" };
    const inputWithId = { type: "Drawing" as const, objects: [ellipseDataWithId] };
    // preserves id if one is provided
    expect(importToObjects(inputWithId)[0]).toEqual(ellipseDataWithId);
  });

  it("should import images", () => {
    const imageData: ImageObjectSnapshot = {
      type: "image",
      url: "my/image/url",
      x: 10, y: 10,
      width: 10, height: 10,
      visible: true,
      hFlip: false,
      vFlip: false
    };
    const input = { type: "Drawing" as const, objects: [imageData] };
    // assigns a unique id if none is provided
    expect(importToObjects(input)[0]).toEqual({ ...imageData, id: "testid-1" });

    const imageDataWithId = { ...imageData, id: "image-id" };
    const inputWithId = { type: "Drawing" as const, objects: [imageDataWithId] };
    // preserves id if one is provided
    expect(importToObjects(inputWithId)[0]).toEqual(imageDataWithId);
  });
});
