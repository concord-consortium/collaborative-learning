import { playbackChanges } from "./drawing-change-playback";
import { DrawingToolChange } from "./drawing-types";
import { LineObjectSnapshot } from "../objects/line";
import { VectorObjectSnapshot } from "../objects/vector";
import { RectangleObjectSnapshot } from "../objects/rectangle";
import { EllipseObjectSnapshot } from "../objects/ellipse";
import { ImageObjectSnapshot } from "../objects/image";

function playbackObjectChanges(changes: DrawingToolChange[]) {
  const changesJson = changes.map(change => JSON.stringify(change));
  return playbackChanges(changesJson);
}

describe("playbackChanges", () => {

  const mockConsoleWarn = jest.fn();
  global.console.warn = mockConsoleWarn;

  beforeEach(() => {
    mockConsoleWarn.mockReset();
  });

  it("should handle empty changes", () => {
    expect(playbackObjectChanges([])).toEqual({ type: "Drawing", objects: [] });
    // ignores invalid changes
    expect(playbackChanges(["{ foo }"])).toEqual({ type: "Drawing", objects: [] });
  });

  it("should handle vectors (simple lines)", () => {
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
    const changes: DrawingToolChange[] = [
      { action: "create", data: vectorData }
    ];
    // skips objects without ids
    // TODO: verify with previous loading code
    expect(playbackObjectChanges(changes)).toEqual({ type: "Drawing", objects: [] });

    const v1Data: VectorObjectSnapshot = { ...vectorData, id: "v1" };
    const v2Data: VectorObjectSnapshot = { ...vectorData, id: "v2" };
    const changesWithId: DrawingToolChange[] = [
      { action: "create", data: v1Data },
      { action: "create", data: v2Data },
      // TODO: verify with previous loading code
      { action: "create", data: v2Data }  // ignores objects with duplicate ids
    ];
    expect(playbackObjectChanges(changesWithId)).toEqual({ type: "Drawing", objects: [v1Data, v2Data] });
    expect(mockConsoleWarn).toHaveBeenCalledTimes(1); // for duplicate id

    const changesWithUpdates: DrawingToolChange[] = [
      { action: "create", data: v1Data },
      { action: "create", data: v2Data },
      { action: "move", data: [{ id: "v1", destination: { x: 5, y: 5 } }] },
      { action: "update", data: { ids: ["v2"], update: { prop: "strokeWidth", newValue: 2 } }}
    ];
    const v1DataMoved = { ...v1Data, x: 5, y: 5 };
    const v2DataUpdated = { ...v2Data, strokeWidth: 2 };
    expect(playbackObjectChanges(changesWithUpdates))
      .toEqual({ type: "Drawing", objects: [v1DataMoved, v2DataUpdated] });

    const changesWithDeletion: DrawingToolChange[] = [
      { action: "create", data: v1Data },
      { action: "create", data: v2Data },
      { action: "delete", data: ["v1"]},
      // TODO: verify with previous loading code
      { action: "delete", data: ["v3"]}   // handles invalid ids
    ];
    expect(playbackObjectChanges(changesWithDeletion)).toEqual({ type: "Drawing", objects: [v2Data] });
  });

  it("should handle lines (polylines)", () => {
    const lineData: LineObjectSnapshot = {
      type: "line",
      x: 10, y: 10,
      deltaPoints: [{ dx: 1, dy: 1 }, { dx: 2, dy: 2 }],
      stroke: "#888888",
      strokeDashArray: "3,3",
      strokeWidth: 1,
      visible: true,
      hFlip: false,
      vFlip: false
    };
    const changes: DrawingToolChange[] = [
      { action: "create", data: lineData }
    ];
    // skips objects without ids
    expect(playbackObjectChanges(changes)).toEqual({ type: "Drawing", objects: [] });

    const l1Data: LineObjectSnapshot = { ...lineData, id: "l1" };
    const l2Data: LineObjectSnapshot = { ...lineData, id: "l2" };
    const changesWithId: DrawingToolChange[] = [
      { action: "create", data: l1Data },
      { action: "create", data: l2Data }
    ];
    expect(playbackObjectChanges(changesWithId)).toEqual({ type: "Drawing", objects: [l1Data, l2Data] });

    const changesWithUpdates: DrawingToolChange[] = [
      { action: "create", data: l1Data },
      { action: "create", data: l2Data },
      { action: "move", data: [{ id: "l1", destination: { x: 5, y: 5 } }] },
      { action: "update", data: { ids: ["l2"], update: { prop: "strokeWidth", newValue: 2 } }}
    ];
    const l1DataMoved = { ...l1Data, x: 5, y: 5 };
    const l2DataUpdated = { ...l2Data, strokeWidth: 2 };
    expect(playbackObjectChanges(changesWithUpdates))
      .toEqual({ type: "Drawing", objects: [l1DataMoved, l2DataUpdated] });

    const changesWithDeletion: DrawingToolChange[] = [
      { action: "create", data: l1Data },
      { action: "create", data: l2Data },
      { action: "delete", data: ["l1"]},
      { action: "delete", data: ["l3"]}   // handles invalid ids
    ];
    expect(playbackObjectChanges(changesWithDeletion)).toEqual({ type: "Drawing", objects: [l2Data] });
  });

  it("should handle rectangles", () => {
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
    const changes: DrawingToolChange[] = [
      { action: "create", data: rectData }
    ];
    // skips objects without ids
    expect(playbackObjectChanges(changes)).toEqual({ type: "Drawing", objects: [] });

    const r1Data: RectangleObjectSnapshot = { ...rectData, id: "r1" };
    const r2Data: RectangleObjectSnapshot = { ...rectData, id: "r2" };
    const r3Data: RectangleObjectSnapshot = { ...rectData, id: "r3" };
    const changesWithId: DrawingToolChange[] = [
      { action: "create", data: r1Data },
      { action: "create", data: r2Data },
      { action: "create", data: r3Data }
    ];
    expect(playbackObjectChanges(changesWithId)).toEqual({ type: "Drawing", objects: [r1Data, r2Data, r3Data] });

    const changesWithUpdates: DrawingToolChange[] = [
      { action: "create", data: r1Data },
      { action: "create", data: r2Data },
      { action: "create", data: r3Data },
      { action: "move", data: [{ id: "r1", destination: { x: 5, y: 5 } }, { id: "r2", destination: { x: 5, y: 5 } }] },
      { action: "update", data: { ids: ["r2", "r3"], update: { prop: "strokeWidth", newValue: 2 } }}
    ];
    const r1DataMoved = { ...r1Data, x: 5, y: 5 };
    const r2DataMovedAndUpdated = { ...r2Data, x: 5, y: 5, strokeWidth: 2 };
    const r3DataUpdated = { ...r3Data, strokeWidth: 2 };
    expect(playbackObjectChanges(changesWithUpdates))
            .toEqual({ type: "Drawing", objects: [r1DataMoved, r2DataMovedAndUpdated, r3DataUpdated] });

    const changesWithDeletion: DrawingToolChange[] = [
      { action: "create", data: r1Data },
      { action: "create", data: r2Data },
      { action: "create", data: r3Data },
      { action: "delete", data: ["r2", "r3", "r4"]}
    ];
    expect(playbackObjectChanges(changesWithDeletion)).toEqual({ type: "Drawing", objects: [r1Data] });
  });

  it("should handle ellipses", () => {
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
    const changes: DrawingToolChange[] = [
      { action: "create", data: ellipseData }
    ];
    // skips objects without ids
    expect(playbackObjectChanges(changes)).toEqual({ type: "Drawing", objects: [] });

    const e1Data: EllipseObjectSnapshot = { ...ellipseData, id: "e1" };
    const e2Data: EllipseObjectSnapshot = { ...ellipseData, id: "e2" };
    const e3Data: EllipseObjectSnapshot = { ...ellipseData, id: "e3" };
    const changesWithId: DrawingToolChange[] = [
      { action: "create", data: e1Data },
      { action: "create", data: e2Data },
      { action: "create", data: e3Data }
    ];
    expect(playbackObjectChanges(changesWithId)).toEqual({ type: "Drawing", objects: [e1Data, e2Data, e3Data] });

    const changesWithUpdates: DrawingToolChange[] = [
      { action: "create", data: e1Data },
      { action: "create", data: e2Data },
      { action: "create", data: e3Data },
      { action: "move", data: [{ id: "e1", destination: { x: 5, y: 5 } }, { id: "e2", destination: { x: 5, y: 5 } }] },
      { action: "update", data: { ids: ["e2", "e3"], update: { prop: "strokeWidth", newValue: 2 } }}
    ];
    const e1DataMoved = { ...e1Data, x: 5, y: 5 };
    const e2DataMovedAndUpdated = { ...e2Data, x: 5, y: 5, strokeWidth: 2 };
    const e3DataUpdated = { ...e3Data, strokeWidth: 2 };
    expect(playbackObjectChanges(changesWithUpdates))
            .toEqual({ type: "Drawing", objects: [e1DataMoved, e2DataMovedAndUpdated, e3DataUpdated] });

    const changesWithDeletion: DrawingToolChange[] = [
      { action: "create", data: e1Data },
      { action: "create", data: e2Data },
      { action: "create", data: e3Data },
      { action: "delete", data: ["e2", "e3", "e4"]}
    ];
    expect(playbackObjectChanges(changesWithDeletion)).toEqual({ type: "Drawing", objects: [e1Data] });
  });

  it("should handle images", () => {
    const imageData: ImageObjectSnapshot = {
      type: "image",
      url: "my/image/url",
      // Note: There used to be an originalUrl in the image data.
      // This originalUrl was set when the image drawing object was created from the
      // serialized image data. As far as I can tell this originalUrl should not
      // have been stored back in the serialized data. Additionally even if it was
      // stored and then loaded back in, it seems it would have only caused problems.
      // So it seems safe to ignore it here.
      x: 10, y: 10,
      width: 10, height: 10,
      visible: true,
      hFlip: false,
      vFlip: false
    };
    const changes: DrawingToolChange[] = [
      { action: "create", data: imageData }
    ];
    // skips objects without ids
    expect(playbackObjectChanges(changes)).toEqual({ type: "Drawing", objects: [] });

    const i1Data: ImageObjectSnapshot = { ...imageData, id: "i1" };
    const i2Data: ImageObjectSnapshot = { ...imageData, id: "i2" };
    const i3Data: ImageObjectSnapshot = { ...imageData, id: "i3" };
    const changesWithId: DrawingToolChange[] = [
      { action: "create", data: i1Data },
      { action: "create", data: i2Data },
      { action: "create", data: i3Data }
    ];
    expect(playbackObjectChanges(changesWithId)).toEqual({ type: "Drawing", objects: [i1Data, i2Data, i3Data] });

    const changesWithUpdates: DrawingToolChange[] = [
      { action: "create", data: i1Data },
      { action: "create", data: i2Data },
      { action: "create", data: i3Data },
      { action: "move", data: [{ id: "i1", destination: { x: 5, y: 5 } }, { id: "i2", destination: { x: 5, y: 5 } }] }
    ];
    const i1DataMoved = { ...i1Data, x: 5, y: 5 };
    const i2DataMoved = { ...i2Data, x: 5, y: 5 };
    expect(playbackObjectChanges(changesWithUpdates))
            .toEqual({ type: "Drawing", objects: [i1DataMoved, i2DataMoved, i3Data] });

    const changesWithDeletion: DrawingToolChange[] = [
      { action: "create", data: i1Data },
      { action: "create", data: i2Data },
      { action: "create", data: i3Data },
      { action: "delete", data: ["i2", "i4"]}
    ];
    expect(playbackObjectChanges(changesWithDeletion)).toEqual({ type: "Drawing", objects: [i1Data, i3Data] });
  });
});
