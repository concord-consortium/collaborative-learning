import { safeJsonParse } from "../../../utilities/js-utils";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import { LineObjectSnapshot, LineObjectType } from "../objects/line";
import { VectorObjectSnapshot, VectorObjectType } from "../objects/vector";
import { RectangleObjectSnapshot, RectangleObjectType } from "../objects/rectangle";
import { EllipseObjectSnapshot, EllipseObjectType } from "../objects/ellipse";
import { ImageObjectSnapshot } from "../objects/image";
import { createDrawingContent, DrawingContentModelType } from "./drawing-content";
import { DrawingMigrator } from "./drawing-migrator";

function exportDrawing2(drawing: DrawingContentModelType) {
  const exportedString = drawing.exportJson();
  // validate export import round-trip
  const exportedJSON = safeJsonParse(exportedString);
  const imported = DrawingMigrator.create(exportedJSON);
  const exportedString2 = imported.exportJson();
  expect(safeJsonParse(exportedString2)).toEqual(exportedJSON);
  return safeJsonParse(exportedString);
}

describe("exportDrawingTileSpec", () => {

  const mockConsoleWarn = jest.fn();
  global.console.warn = mockConsoleWarn;

  beforeEach(() => {
    mockConsoleWarn.mockReset();
  });

  it("should export empty drawings", () => {
    const drawing = createDrawingContent({ objects: []});
    expect(exportDrawing2(drawing)).toEqual({ type: "Drawing", objects: [] });
  });

  it("should export vectors (simple lines)", () => {
    const vectorData: VectorObjectSnapshot = {
      type: "vector",
      x: 10, y: 10,
      dx: 10, dy: 10,
      rotation: 0,
      stroke: "#888888",
      strokeDashArray: "3,3",
      strokeWidth: 1,
      visible: true,
      hFlip: false,
      vFlip: false
    };

    const v1Data: VectorObjectSnapshot = { ...vectorData, id: "v1" };
    const v2Data: VectorObjectSnapshot = { ...vectorData, id: "v2" };
    const drawing = createDrawingContent({ objects: [
      v1Data, v2Data
    ]});
    expect(exportDrawing2(drawing)).toEqual({ type: "Drawing", objects: [v1Data, v2Data] });

    const drawing2 = createDrawingContent({ objects: [
      v1Data, v2Data
    ]});
    drawing2.objects[0].setPosition(5,5);
    (drawing2.objects[1] as VectorObjectType).setStrokeWidth(2);
    const v1DataMoved = { ...v1Data, x: 5, y: 5 };
    const v2DataUpdated = { ...v2Data, strokeWidth: 2 };
    expect(exportDrawing2(drawing2)).toEqual({ type: "Drawing", objects: [v1DataMoved, v2DataUpdated] });

    const drawing3 = createDrawingContent({ objects: [
      v1Data, v2Data
    ]});
    drawing3.deleteObjects([drawing3.objects[0].id]);
    expect(exportDrawing2(drawing3)).toEqual({ type: "Drawing", objects: [v2Data] });
  });

  it("should export lines (polylines)", () => {
    const lineData: LineObjectSnapshot = {
      type: "line",
      x: 10, y: 10,
      rotation: 0,
      deltaPoints: [{ dx: 1, dy: 1 }, { dx: 2, dy: 2 }],
      stroke: "#888888",
      fill: "none",
      strokeDashArray: "3,3",
      strokeWidth: 1,
      visible: true,
      hFlip: false,
      vFlip: false
    };

    const l1Data: LineObjectSnapshot = { ...lineData, id: "l1" };
    const l2Data: LineObjectSnapshot = { ...lineData, id: "l2" };
    const drawing = createDrawingContent({ objects: [
      l1Data, l2Data
    ]});
    expect(exportDrawing2(drawing)).toEqual({ type: "Drawing", objects: [l1Data, l2Data] });

    const drawing2 = createDrawingContent({ objects: [
      l1Data, l2Data
    ]});
    drawing2.objects[0].setPosition(5,5);
    (drawing2.objects[1] as LineObjectType).setStrokeWidth(2);
    const l1DataMoved = { ...l1Data, x: 5, y: 5 };
    const l2DataUpdated = { ...l2Data, strokeWidth: 2 };
    expect(exportDrawing2(drawing2)).toEqual({ type: "Drawing", objects: [l1DataMoved, l2DataUpdated] });

    const drawing3 = createDrawingContent({ objects: [
      l1Data, l2Data
    ]});
    drawing3.deleteObjects([drawing3.objects[0].id]);
    expect(exportDrawing2(drawing3)).toEqual({ type: "Drawing", objects: [l2Data] });
  });

  it("should export rectangles", () => {
    const rectData: RectangleObjectSnapshot = {
      type: "rectangle",
      x: 10, y: 10,
      width: 10, height: 10,
      rotation: 0,
      fill: "#cccccc",
      stroke: "#888888",
      strokeDashArray: "3,3",
      strokeWidth: 1,
      visible: true,
      hFlip: false,
      vFlip: false
    };

    const r1Data: RectangleObjectSnapshot = { ...rectData, id: "r1" };
    const r2Data: RectangleObjectSnapshot = { ...rectData, id: "r2" };
    const r3Data: RectangleObjectSnapshot = { ...rectData, id: "r3" };
    const drawing = createDrawingContent({ objects: [
      r1Data, r2Data, r3Data
    ]});
    expect(exportDrawing2(drawing)).toEqual({ type: "Drawing", objects: [r1Data, r2Data, r3Data] });

    const drawing2 = createDrawingContent({ objects: [
      r1Data, r2Data, r3Data
    ]});
    drawing2.objects[0].setPosition(5,5);
    drawing2.objects[1].setPosition(5,5);
    (drawing2.objects[1] as RectangleObjectType).setStrokeWidth(2);
    (drawing2.objects[2] as RectangleObjectType).setStrokeWidth(2);
    const r1DataMoved = { ...r1Data, x: 5, y: 5 };
    const r2DataMovedAndUpdated = { ...r2Data, x: 5, y: 5, strokeWidth: 2 };
    const r3DataUpdated = { ...r3Data, strokeWidth: 2 };
    expect(exportDrawing2(drawing2))
      .toEqual({ type: "Drawing", objects: [r1DataMoved, r2DataMovedAndUpdated, r3DataUpdated] });

    const drawing3 = createDrawingContent({ objects: [
      r1Data, r2Data, r3Data
    ]});
    drawing3.deleteObjects([drawing3.objects[1].id, drawing3.objects[2].id]);
    expect(exportDrawing2(drawing3)).toEqual({ type: "Drawing", objects: [r1Data] });
  });

  it("should export ellipses", () => {
    const ellipseData: EllipseObjectSnapshot = {
      type: "ellipse",
      x: 10, y: 10,
      rx: 10, ry: 10,
      rotation: 0,
      fill: "#cccccc",
      stroke: "#888888",
      strokeDashArray: "3,3",
      strokeWidth: 1,
      visible: true,
      hFlip: false,
      vFlip: false
    };
    const e1Data: EllipseObjectSnapshot = { ...ellipseData, id: "e1" };
    const e2Data: EllipseObjectSnapshot = { ...ellipseData, id: "e2" };
    const e3Data: EllipseObjectSnapshot = { ...ellipseData, id: "e3" };
    const drawing = createDrawingContent({ objects: [
      e1Data, e2Data, e3Data
    ]});
    expect(exportDrawing2(drawing)).toEqual({ type: "Drawing", objects: [e1Data, e2Data, e3Data] });

    const drawing2 = createDrawingContent({ objects: [
      e1Data, e2Data, e3Data
    ]});
    drawing2.objects[0].setPosition(5,5);
    drawing2.objects[1].setPosition(5,5);
    (drawing2.objects[1] as EllipseObjectType).setStrokeWidth(2);
    (drawing2.objects[2] as EllipseObjectType).setStrokeWidth(2);

    const e1DataMoved = { ...e1Data, x: 5, y: 5 };
    const e2DataMovedAndUpdated = { ...e2Data, x: 5, y: 5, strokeWidth: 2 };
    const e3DataUpdated = { ...e3Data, strokeWidth: 2 };
    expect(exportDrawing2(drawing2))
            .toEqual({ type: "Drawing", objects: [e1DataMoved, e2DataMovedAndUpdated, e3DataUpdated] });

    const drawing3 = createDrawingContent({ objects: [
      e1Data, e2Data, e3Data
    ]});
    drawing3.deleteObjects([drawing3.objects[1].id, drawing3.objects[2].id]);
    expect(exportDrawing2(drawing3)).toEqual({ type: "Drawing", objects: [e1Data] });
  });

  it("should export images", () => {
    const imageData: ImageObjectSnapshot = {
      type: "image",
      url: "my/image/url",
      x: 10, y: 10,
      width: 10, height: 10,
      rotation: 0,
      visible: true,
      hFlip: false,
      vFlip: false
    };
    const i1Data: ImageObjectSnapshot = { ...imageData, id: "i1" };
    const i2Data: ImageObjectSnapshot = { ...imageData, id: "i2" };
    const i3Data: ImageObjectSnapshot = { ...imageData, id: "i3" };
    const drawing = createDrawingContent({ objects: [
      i1Data, i2Data, i3Data
    ]});
    expect(exportDrawing2(drawing)).toEqual({ type: "Drawing", objects: [i1Data, i2Data, i3Data] });

    const drawing2 = createDrawingContent({ objects: [
      i1Data, i2Data, i3Data
    ]});
    drawing2.objects[0].setPosition(5,5);
    drawing2.objects[1].setPosition(5,5);
    const i1DataMoved = { ...i1Data, x: 5, y: 5 };
    const i2DataMoved = { ...i2Data, x: 5, y: 5 };
    expect(exportDrawing2(drawing2))
            .toEqual({ type: "Drawing", objects: [i1DataMoved, i2DataMoved, i3Data] });

    const drawing3 = createDrawingContent({ objects: [
      i1Data, i2Data, i3Data
    ]});
    drawing3.deleteObjects([drawing3.objects[1].id]);
    expect(exportDrawing2(drawing3)).toEqual({ type: "Drawing", objects: [i1Data, i3Data] });
  });

  it("should export images with transformed urls when appropriate", () => {
    const options: ITileExportOptions = {
      transformImageUrl(url: string, _filename?: string) {
        return _filename ? `curriculum/images/${_filename}` : url;
      }
    };
    const exportDrawingWithTransform = (_drawing: DrawingContentModelType) => {
      const exportedString = _drawing.exportJson(options);
      return safeJsonParse(exportedString);
    };

    const imageData: ImageObjectSnapshot = {
      type: "image",
      url: "my/image/url",
      filename: "image.png",
      x: 10, y: 10,
      width: 10, height: 10,
      rotation: 0,
      visible: true,
      hFlip: false,
      vFlip: false
    };
    const { filename, ...others } = imageData;
    const exportImageData = { ...others, url: "curriculum/images/image.png" };

    const i1Data: ImageObjectSnapshot = { ...imageData, id: "i1" };
    const i2Data: ImageObjectSnapshot = { ...imageData, id: "i2" };
    const i3Data: ImageObjectSnapshot = { ...imageData, id: "i3" };
    const drawing = createDrawingContent({ objects: [
      i1Data, i2Data, i3Data
    ]});

    const i1OutData = { ...exportImageData, id: "i1" };
    const i2OutData = { ...exportImageData, id: "i2" };
    const i3OutData = { ...exportImageData, id: "i3" };
    expect(exportDrawingWithTransform(drawing))
            .toEqual({ type: "Drawing", objects: [i1OutData, i2OutData, i3OutData] });

    const drawing2 = createDrawingContent({ objects: [
      i1Data, i2Data, i3Data
    ]});
    drawing2.objects[0].setPosition(5,5);
    drawing2.objects[1].setPosition(5,5);
    const i1DataMoved = { ...i1OutData, x: 5, y: 5 };
    const i2DataMoved = { ...i2OutData, x: 5, y: 5 };
    expect(exportDrawingWithTransform(drawing2))
            .toEqual({ type: "Drawing", objects: [i1DataMoved, i2DataMoved, i3OutData] });

    const drawing3 = createDrawingContent({ objects: [
      i1Data, i2Data, i3Data
    ]});
    drawing3.deleteObjects([drawing3.objects[1].id]);
    expect(exportDrawingWithTransform(drawing3))
            .toEqual({ type: "Drawing", objects: [i1OutData, i3OutData] });
  });
});
