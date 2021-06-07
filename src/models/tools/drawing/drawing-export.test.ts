import { safeJsonParse } from "../../../utilities/js-utils";
import { exportDrawingTileSpec } from "./drawing-export";
import { importDrawingTileSpec } from "./drawing-import";
import {
  EllipseDrawingObjectData, ImageDrawingObjectData, LineDrawingObjectData,
  RectangleDrawingObjectData, VectorDrawingObjectData
} from "./drawing-objects";
import { DrawingToolChange } from "./drawing-types";

function exportDrawing(changes: DrawingToolChange[]) {
  const changesJson = changes.map(change => JSON.stringify(change));
  const exportJson = exportDrawingTileSpec(changesJson);
  const exportJs = safeJsonParse(exportJson);
  if (exportJs) {
    // validate export-import-export round-trip
    const importJs = importDrawingTileSpec(exportJs);
    const export2Json = exportDrawingTileSpec(importJs.changes);
    expect(safeJsonParse(export2Json)).toEqual(exportJs);
  }
  else {
    // log the JSON on error for debugging
    !exportJs && console.log("JSON PARSE ERROR\n----------------\n", exportJson);
  }
  return exportJs;
}

describe("exportDrawingTileSpec", () => {

  it("should export empty changes", () => {
    expect(exportDrawing([])).toEqual({ type: "Drawing", objects: [] });
    // ignores invalid changes
    expect(JSON.parse(exportDrawingTileSpec(["{ foo }"]))).toEqual({ type: "Drawing", objects: [] });
  });

  it("should export vectors (simple lines)", () => {
    const vectorData: VectorDrawingObjectData = {
      type: "vector",
      x: 10, y: 10,
      dx: 10, dy: 10,
      stroke: "#888888",
      strokeDashArray: "3,3",
      strokeWidth: 1
    };
    const changes: DrawingToolChange[] = [
      { action: "create", data: vectorData }
    ];
    // skips objects without ids
    expect(exportDrawing(changes)).toEqual({ type: "Drawing", objects: [] });

    const v1Data: VectorDrawingObjectData = { ...vectorData, id: "v1" };
    const v2Data: VectorDrawingObjectData = { ...vectorData, id: "v2" };
    const changesWithId: DrawingToolChange[] = [
      { action: "create", data: v1Data },
      { action: "create", data: v2Data }
    ];
    expect(exportDrawing(changesWithId)).toEqual({ type: "Drawing", objects: [v1Data, v2Data] });

    const changesWithUpdates: DrawingToolChange[] = [
      { action: "create", data: v1Data },
      { action: "create", data: v2Data },
      { action: "move", data: [{ id: "v1", destination: { x: 5, y: 5 } }] },
      { action: "update", data: { ids: ["v2"], update: { prop: "strokeWidth", newValue: 2 } }}
    ];
    const v1DataMoved = { ...v1Data, x: 5, y: 5 };
    const v2DataUpdated = { ...v2Data, strokeWidth: 2 };
    expect(exportDrawing(changesWithUpdates)).toEqual({ type: "Drawing", objects: [v1DataMoved, v2DataUpdated] });

    const changesWithDeletion: DrawingToolChange[] = [
      { action: "create", data: v1Data },
      { action: "create", data: v2Data },
      { action: "delete", data: ["v1"]},
      { action: "delete", data: ["v3"]}   // handles invalid ids
    ];
    expect(exportDrawing(changesWithDeletion)).toEqual({ type: "Drawing", objects: [v2Data] });
  });

  it("should export lines (polylines)", () => {
    const lineData: LineDrawingObjectData = {
      type: "line",
      x: 10, y: 10,
      deltaPoints: [{ dx: 1, dy: 1 }, { dx: 2, dy: 2 }],
      stroke: "#888888",
      strokeDashArray: "3,3",
      strokeWidth: 1
    };
    const changes: DrawingToolChange[] = [
      { action: "create", data: lineData }
    ];
    // skips objects without ids
    expect(exportDrawing(changes)).toEqual({ type: "Drawing", objects: [] });

    const l1Data: LineDrawingObjectData = { ...lineData, id: "l1" };
    const l2Data: LineDrawingObjectData = { ...lineData, id: "l2" };
    const changesWithId: DrawingToolChange[] = [
      { action: "create", data: l1Data },
      { action: "create", data: l2Data }
    ];
    expect(exportDrawing(changesWithId)).toEqual({ type: "Drawing", objects: [l1Data, l2Data] });

    const changesWithUpdates: DrawingToolChange[] = [
      { action: "create", data: l1Data },
      { action: "create", data: l2Data },
      { action: "move", data: [{ id: "l1", destination: { x: 5, y: 5 } }] },
      { action: "update", data: { ids: ["l2"], update: { prop: "strokeWidth", newValue: 2 } }}
    ];
    const l1DataMoved = { ...l1Data, x: 5, y: 5 };
    const l2DataUpdated = { ...l2Data, strokeWidth: 2 };
    expect(exportDrawing(changesWithUpdates)).toEqual({ type: "Drawing", objects: [l1DataMoved, l2DataUpdated] });

    const changesWithDeletion: DrawingToolChange[] = [
      { action: "create", data: l1Data },
      { action: "create", data: l2Data },
      { action: "delete", data: ["l1"]},
      { action: "delete", data: ["l3"]}   // handles invalid ids
    ];
    expect(exportDrawing(changesWithDeletion)).toEqual({ type: "Drawing", objects: [l2Data] });
  });

  it("should export rectangles", () => {
    const rectData: RectangleDrawingObjectData = {
      type: "rectangle",
      x: 10, y: 10,
      width: 10, height: 10,
      fill: "#cccccc",
      stroke: "#888888",
      strokeDashArray: "3,3",
      strokeWidth: 1
    };
    const changes: DrawingToolChange[] = [
      { action: "create", data: rectData }
    ];
    // skips objects without ids
    expect(exportDrawing(changes)).toEqual({ type: "Drawing", objects: [] });

    const r1Data: RectangleDrawingObjectData = { ...rectData, id: "r1" };
    const r2Data: RectangleDrawingObjectData = { ...rectData, id: "r2" };
    const r3Data: RectangleDrawingObjectData = { ...rectData, id: "r3" };
    const changesWithId: DrawingToolChange[] = [
      { action: "create", data: r1Data },
      { action: "create", data: r2Data },
      { action: "create", data: r3Data }
    ];
    expect(exportDrawing(changesWithId)).toEqual({ type: "Drawing", objects: [r1Data, r2Data, r3Data] });

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
    expect(exportDrawing(changesWithUpdates))
            .toEqual({ type: "Drawing", objects: [r1DataMoved, r2DataMovedAndUpdated, r3DataUpdated] });

    const changesWithDeletion: DrawingToolChange[] = [
      { action: "create", data: r1Data },
      { action: "create", data: r2Data },
      { action: "create", data: r3Data },
      { action: "delete", data: ["r2", "r3", "r4"]}
    ];
    expect(exportDrawing(changesWithDeletion)).toEqual({ type: "Drawing", objects: [r1Data] });
  });

  it("should export ellipses", () => {
    const ellipseData: EllipseDrawingObjectData = {
      type: "ellipse",
      x: 10, y: 10,
      rx: 10, ry: 10,
      fill: "#cccccc",
      stroke: "#888888",
      strokeDashArray: "3,3",
      strokeWidth: 1
    };
    const changes: DrawingToolChange[] = [
      { action: "create", data: ellipseData }
    ];
    // skips objects without ids
    expect(exportDrawing(changes)).toEqual({ type: "Drawing", objects: [] });

    const e1Data: EllipseDrawingObjectData = { ...ellipseData, id: "e1" };
    const e2Data: EllipseDrawingObjectData = { ...ellipseData, id: "e2" };
    const e3Data: EllipseDrawingObjectData = { ...ellipseData, id: "e3" };
    const changesWithId: DrawingToolChange[] = [
      { action: "create", data: e1Data },
      { action: "create", data: e2Data },
      { action: "create", data: e3Data }
    ];
    expect(exportDrawing(changesWithId)).toEqual({ type: "Drawing", objects: [e1Data, e2Data, e3Data] });

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
    expect(exportDrawing(changesWithUpdates))
            .toEqual({ type: "Drawing", objects: [e1DataMoved, e2DataMovedAndUpdated, e3DataUpdated] });

    const changesWithDeletion: DrawingToolChange[] = [
      { action: "create", data: e1Data },
      { action: "create", data: e2Data },
      { action: "create", data: e3Data },
      { action: "delete", data: ["e2", "e3", "e4"]}
    ];
    expect(exportDrawing(changesWithDeletion)).toEqual({ type: "Drawing", objects: [e1Data] });
  });


  it("should export images", () => {
    const imageData: ImageDrawingObjectData = {
      type: "image",
      url: "my/image/url",
      originalUrl: "my/image/originalUrl",
      x: 10, y: 10,
      width: 10, height: 10,
    };
    const changes: DrawingToolChange[] = [
      { action: "create", data: imageData }
    ];
    // skips objects without ids
    expect(exportDrawing(changes)).toEqual({ type: "Drawing", objects: [] });

    const i1Data: ImageDrawingObjectData = { ...imageData, id: "i1" };
    const i2Data: ImageDrawingObjectData = { ...imageData, id: "i2" };
    const i3Data: ImageDrawingObjectData = { ...imageData, id: "i3" };
    const changesWithId: DrawingToolChange[] = [
      { action: "create", data: i1Data },
      { action: "create", data: i2Data },
      { action: "create", data: i3Data }
    ];
    expect(exportDrawing(changesWithId)).toEqual({ type: "Drawing", objects: [i1Data, i2Data, i3Data] });

    const changesWithUpdates: DrawingToolChange[] = [
      { action: "create", data: i1Data },
      { action: "create", data: i2Data },
      { action: "create", data: i3Data },
      { action: "move", data: [{ id: "i1", destination: { x: 5, y: 5 } }, { id: "i2", destination: { x: 5, y: 5 } }] }
    ];
    const i1DataMoved = { ...i1Data, x: 5, y: 5 };
    const i2DataMoved = { ...i2Data, x: 5, y: 5 };
    expect(exportDrawing(changesWithUpdates))
            .toEqual({ type: "Drawing", objects: [i1DataMoved, i2DataMoved, i3Data] });

    const changesWithDeletion: DrawingToolChange[] = [
      { action: "create", data: i1Data },
      { action: "create", data: i2Data },
      { action: "create", data: i3Data },
      { action: "delete", data: ["i2", "i4"]}
    ];
    expect(exportDrawing(changesWithDeletion)).toEqual({ type: "Drawing", objects: [i1Data, i3Data] });
  });

});
