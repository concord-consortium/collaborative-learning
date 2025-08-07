import { addDisposer, onAction } from "mobx-state-tree";
import {
  createDrawingContent, defaultDrawingContent,
  DrawingContentModelSnapshot, DrawingToolMetadataModel
} from "./drawing-content";
import { kDrawingTileType } from "./drawing-types";
import { AlignType, DefaultToolbarSettings, VectorEndShape } from "./drawing-basic-types";
import { AppConfigModel } from "../../../models/stores/app-config-model";
import { ImageObject, ImageObjectSnapshotForAdd } from "../objects/image";
import { RectangleObject, RectangleObjectSnapshot, RectangleObjectSnapshotForAdd,
  RectangleObjectType } from "../objects/rectangle";
import { DeltaPoint, computeStrokeDashArray } from "../objects/drawing-object";
import { LogEventName } from "../../../lib/logger-types";
import { EllipseObject } from "../objects/ellipse";
import { VectorObject } from "../objects/vector";
import { LineObject } from "../objects/line";
import { TextObject } from "../objects/text";
import { GroupObjectType } from "../objects/group";

import "../drawing-registration";

const mockLogTileChangeEvent = jest.fn();
jest.mock("../../../models/tiles/log/log-tile-change-event", () => ({
  logTileChangeEvent: (...args: any[]) => mockLogTileChangeEvent(...args)
}));

describe("computeStrokeDashArray", () => {
  it("should return expected results", () => {
    expect(computeStrokeDashArray()).toBe("");
    expect(computeStrokeDashArray("dotted")).toBe("0,0");
    expect(computeStrokeDashArray("dotted", 0)).toBe("0,0");
    expect(computeStrokeDashArray("dotted", 1)).toBe("1,1");
    expect(computeStrokeDashArray("dashed")).toBe("0,0");
    expect(computeStrokeDashArray("dashed", 0)).toBe("0,0");
    expect(computeStrokeDashArray("dashed", 1)).toBe("3,3");
  });
});

describe('defaultDrawingContent', () => {
  it('should return content with no options', () => {
    const content = defaultDrawingContent();
    expect(content.type).toBe(kDrawingTileType);
    expect(content.stamps).toEqual([]);
    expect(content.objects).toEqual([]);
  });
  it('should return content with optional stamps', () => {
    const stamps = [{ url: "my/stamp/url", width: 10, height: 10 }];
    const appConfig = AppConfigModel.create({
      config: { stamps } as any,
    });
    const content = defaultDrawingContent({ appConfig });
    expect(content.type).toBe(kDrawingTileType);
    expect(content.stamps).toEqual(stamps);
    expect(content.objects).toEqual([]);
  });
});

describe("DrawingContentModel", () => {

  function createDrawingContentWithMetadata(options?: DrawingContentModelSnapshot) {
    const model = createDrawingContent(options);
    const metadata = DrawingToolMetadataModel.create({ id: "drawing-1" });
    model.doPostCreate!(metadata);
    addDisposer(model, onAction(model, (call) => {
      model.onTileAction!(call);
    }));
    return model;
  }

  const mockSettings = {
    fill: "#666666",
    stroke: "#888888",
    strokeDashArray: "3,3",
    strokeWidth: 5
  };
  const baseRectangleSnapshot: RectangleObjectSnapshotForAdd = {
    type: "rectangle",
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    ...mockSettings,
  };

  it("accepts default arguments on creation", () => {
    const model = createDrawingContentWithMetadata();
    expect(model.type).toBe(kDrawingTileType);
    expect(model.objects).toEqual([]);
    expect(model.isUserResizable).toBe(true);
    expect(model.selectedButton).toBe("select");
    expect(model.isSelectedButton("select")).toBe(true);
  });

  it("imports the drawing tool import format", () => {
    const { fill, stroke, strokeDashArray, strokeWidth} = mockSettings;
    const model = createDrawingContentWithMetadata({
      type: "Drawing", objects: [
        { type: "rectangle", x: 10, y: 10, width: 100, height: 100,
          fill, stroke, strokeDashArray, strokeWidth } as RectangleObjectSnapshot
      ]
    });
    expect(model.type).toBe(kDrawingTileType);
    expect(model.objects.length).toBe(1);
    expect(model.objects[0].type).toBe("rectangle");
  });

  it("can reset the tool button", () => {
    const model = createDrawingContentWithMetadata();
    model.setSelectedButton("vector");
    expect(model.selectedButton).toBe("vector");
    model.setSelectedButton("vector");
    expect(model.isSelectedButton("vector")).toBe(true);
    model.reset();
    expect(model.selectedButton).toBe("select");
    expect(model.isSelectedButton("select")).toBe(true);
  });

  it("can manage the toolbar settings", () => {
    const { fill, stroke, strokeDashArray, strokeWidth} = mockSettings;
    const model = createDrawingContentWithMetadata();
    const defaultSettings = {
      stroke: DefaultToolbarSettings.stroke,
      fill: DefaultToolbarSettings.fill,
      strokeDashArray: DefaultToolbarSettings.strokeDashArray,
      strokeWidth: DefaultToolbarSettings.strokeWidth,
      vectorType: undefined
    };
    expect(model.toolbarSettings).toEqual(defaultSettings);
    model.setStroke(stroke, model.selection);
    expect(model.toolbarSettings).toEqual({ ...defaultSettings, stroke });
    model.setFill(fill, model.selection);
    expect(model.toolbarSettings).toEqual({ ...defaultSettings, fill, stroke });
    model.setStrokeDashArray(strokeDashArray, model.selection);
    expect(model.toolbarSettings).toEqual({ ...defaultSettings, fill, stroke, strokeDashArray });
    model.setStrokeWidth(strokeWidth, model.selection);
    expect(model.toolbarSettings).toEqual({ ...defaultSettings, fill, stroke, strokeDashArray, strokeWidth });
  });

  it("can add objects", () => {
    const model = createDrawingContentWithMetadata();
    const rectSnapshot1: RectangleObjectSnapshotForAdd = {...baseRectangleSnapshot, id:"a", x:0, y:0};
    model.addObject(rectSnapshot1);

    const rectSnapshot2: RectangleObjectSnapshotForAdd = {...baseRectangleSnapshot, id:"b", x:20, y:20};
    model.addObject(rectSnapshot2);

    const imageSnapshot: ImageObjectSnapshotForAdd = {
      type: "image",
      id: "c",
      x: 0,
      y: 0,
      width: 10,
      height: 10,
      url: "",
     ...mockSettings
    };
    model.addObject(imageSnapshot, true);

    expect(model.objects.length).toBe(3);
    expect(model.objects.map((obj) => obj.id)).toStrictEqual(["c", "a", "b"]);
  });

  it("can reorder objects", () => {
    const model = createDrawingContentWithMetadata();
    model.addObject({...baseRectangleSnapshot, id:"a", x:0, y:0});
    model.addObject({...baseRectangleSnapshot, id:"b", x:10, y:10});
    model.addObject({...baseRectangleSnapshot, id:"c", x:20, y:20});
    model.addObject({...baseRectangleSnapshot, id:"d", x:30, y:30});
    expect(model.objects.map((obj) => obj.id)).toStrictEqual(["a", "b", "c", "d"]);

    model.changeZOrder("a", "c");
    expect(model.objects.map((obj) => obj.id)).toStrictEqual(["b", "c", "a", "d"]);

    model.changeZOrder("a", "b");
    expect(model.objects.map((obj) => obj.id)).toStrictEqual(["a", "b", "c", "d"]);
  });

  it("can delete a set of selected drawing objects", () => {
    const model = createDrawingContentWithMetadata();

    mockLogTileChangeEvent.mockReset();

    const rectSnapshot1: RectangleObjectSnapshotForAdd = {...baseRectangleSnapshot, id:"a", x:0, y:0};
    model.addObject(rectSnapshot1);

    const rectSnapshot2: RectangleObjectSnapshotForAdd = {...baseRectangleSnapshot, id:"b", x:20, y:20};
    model.addObject(rectSnapshot2);

    // delete does nothing if nothing is selected
    expect(model.objects.length).toBe(2);
    model.deleteObjects([...model.selection]);
    expect(model.objects.length).toBe(2);

    model.setSelectedIds(["a", "b"]);
    expect(model.hasSelectedObjects).toBe(true);

    model.deleteObjects([...model.selection]);
    expect(model.objects.length).toBe(0);

    // Note: Normally the path will start at the root of the document, but for this test we
    // are mocking the onTileAction so the path is just blank
    expect(mockLogTileChangeEvent).toHaveBeenNthCalledWith(1,
      LogEventName.DRAWING_TOOL_CHANGE, {
        operation: "addObject",
        change: {
          args: [ {
            fill: "#666666",
            height: 10,
            id: "a",
            stroke: "#888888",
            strokeDashArray: "3,3",
            strokeWidth: 5,
            type: "rectangle",
            width: 10,
            x: 0,
            y: 0
          } ],
          path: ""
        },
        tileId: "drawing-1"
      });
    expect(mockLogTileChangeEvent).toHaveBeenNthCalledWith(2,
      LogEventName.DRAWING_TOOL_CHANGE, {
        operation: "addObject",
        change: {
          args: [ {
            fill: "#666666",
            height: 10,
            id: "b",
            stroke: "#888888",
            strokeDashArray: "3,3",
            strokeWidth: 5,
            type: "rectangle",
            width: 10,
            x: 20,
            y: 20
          } ],
          path: ""
        },
        tileId: "drawing-1"
      });
    expect(mockLogTileChangeEvent).toHaveBeenNthCalledWith(3,
      LogEventName.DRAWING_TOOL_CHANGE,
      { operation: "deleteObjects", change: { args: [ [] ], path: ""}, tileId: "drawing-1" });
    expect(mockLogTileChangeEvent).toHaveBeenNthCalledWith(4,
      LogEventName.DRAWING_TOOL_CHANGE,
      { operation: "deleteObjects", change: { args: [ ["a", "b"] ], path: ""}, tileId: "drawing-1" });
    expect(mockLogTileChangeEvent).toHaveBeenCalledTimes(4);
  });

  it("can update the properties of a set of selected drawing objects", () => {
    const model = createDrawingContentWithMetadata();
    expect(model.currentStamp).toBeNull();

    const rectSnapshot1: RectangleObjectSnapshotForAdd = {...baseRectangleSnapshot, id:"a", x:0, y:0};
    model.addObject(rectSnapshot1);

    const rectSnapshot2: RectangleObjectSnapshotForAdd = {...baseRectangleSnapshot, id:"b", x:10, y:10};
    model.addObject(rectSnapshot2);

    mockLogTileChangeEvent.mockReset();
    model.setSelectedIds(["a", "b"]);
    model.setStroke("#000000", model.selection);
    model.setStrokeWidth(2, model.selection);
    model.setStrokeDashArray("3,3", model.selection);

    expect(model.objects[0].type).toBe("rectangle");
    const rect1 = model.objects[0] as RectangleObjectType;
    // Set stroke doesn't seem to be applied to the selected objects
    expect(rect1.stroke).toBe("#000000");
    expect(rect1.strokeWidth).toBe(2);

    expect(model.objects[1].type).toBe("rectangle");
    const rect2 = model.objects[0] as RectangleObjectType;
    expect(rect2.stroke).toBe("#000000");
    expect(rect2.strokeWidth).toBe(2);

    expect(mockLogTileChangeEvent).toHaveBeenNthCalledWith(1,
      LogEventName.DRAWING_TOOL_CHANGE,
      { operation: "setStroke", change: { args: ["#000000", ["a", "b"]], path: "" }, tileId: "drawing-1" });
    expect(mockLogTileChangeEvent).toHaveBeenNthCalledWith(2,
      LogEventName.DRAWING_TOOL_CHANGE,
      { operation: "setStrokeWidth", change: { args: [2, ["a", "b"]], path: "" }, tileId: "drawing-1" });
    expect(mockLogTileChangeEvent).toHaveBeenNthCalledWith(3,
      LogEventName.DRAWING_TOOL_CHANGE,
      { operation: "setStrokeDashArray", change: { args: ["3,3", ["a", "b"]], path: "" }, tileId: "drawing-1" });
    expect(mockLogTileChangeEvent).toHaveBeenCalledTimes(3);
  });

  it("can move objects", () => {
    const model = createDrawingContentWithMetadata();

    const rectSnapshot1: RectangleObjectSnapshotForAdd = {...baseRectangleSnapshot, id:"a", x:0, y:0};
    const rect1 = model.addObject(rectSnapshot1);

    mockLogTileChangeEvent.mockReset();
    rect1.setDragPosition(20, 20);
    rect1.repositionObject();
    expect(mockLogTileChangeEvent).toHaveBeenNthCalledWith(1,
      LogEventName.DRAWING_TOOL_CHANGE, {
        operation: "repositionObject",
        change: {
          args: [],
          path: "/objects/0"
        },
        tileId: "drawing-1"
      });
    expect(mockLogTileChangeEvent).toHaveBeenCalledTimes(1);
    expect(rect1.x).toBe(20);
    expect(rect1.y).toBe(20);
  });

  it("can rotate objects", async () => {
    const model = createDrawingContentWithMetadata();
    const rectSnapshot1: RectangleObjectSnapshotForAdd = {...baseRectangleSnapshot, id:"a", x:0, y:0};
    const rect1 = model.addObject(rectSnapshot1);
    await model.rotateMaybeCopy(["a"], 90, false);
    expect(rect1.rotation).toBe(90);
    await model.rotateMaybeCopy(["a"], 90, false);
    expect(rect1.rotation).toBe(180);

    await model.rotateMaybeCopy(["a"], 90, true);
    expect(model.objects.length).toBe(2);
    expect(model.objects[0]).toBe(rect1);
    expect(model.objects[0].rotation).toBe(180);
    expect(model.objects[1].rotation).toBe(270);
    expect(model.objects[0].id).not.toEqual(model.objects[1].id);
    expect(model.objects[1].x).toBe(0); // rotate in place
    expect(model.objects[1].y).toBe(0);
    expect(model.selection.length).toBe(1); // new object is selected
    expect(model.selection[0]).toBe(model.objects[1].id);
  });

  it("can align objects left", () => {
    const model = createDrawingContentWithMetadata();
    const rectSnapshot1: RectangleObjectSnapshotForAdd = {...baseRectangleSnapshot,
      id:"a", x:1, y:1, width: 5, height: 5};
    const rect1 = model.addObject(rectSnapshot1);
    const rectSnapshot2: RectangleObjectSnapshotForAdd = {...baseRectangleSnapshot,
      id:"b", x:10, y:10, width: 6, height: 6};
    const rect2 = model.addObject(rectSnapshot2);
    model.alignObjects(["a", "b"], AlignType.h_left);
    expect(rect1.x).toBe(1);
    expect(rect2.x).toBe(1);
    expect(rect1.y).toBe(1);
    expect(rect2.y).toBe(10);
  });

  it("can align objects center", () => {
    const model = createDrawingContentWithMetadata();
    const rectSnapshot1: RectangleObjectSnapshotForAdd = {...baseRectangleSnapshot,
      id:"a", x:1, y:1, width: 5, height: 5};
    const rect1 = model.addObject(rectSnapshot1);
    const rectSnapshot2: RectangleObjectSnapshotForAdd = {...baseRectangleSnapshot,
      id:"b", x:10, y:10, width: 6, height: 6};
    const rect2 = model.addObject(rectSnapshot2);
    model.alignObjects(["a", "b"], AlignType.h_center);
    expect(rect1.x).toBe(8.5-2.5);
    expect(rect2.x).toBe(8.5-3);
    expect(rect1.y).toBe(1);
    expect(rect2.y).toBe(10);
  });

  it("can align objects right", () => {
    const model = createDrawingContentWithMetadata();
    const rectSnapshot1: RectangleObjectSnapshotForAdd = {...baseRectangleSnapshot,
      id:"a", x:1, y:1, width: 5, height: 5};
    const rect1 = model.addObject(rectSnapshot1);
    const rectSnapshot2: RectangleObjectSnapshotForAdd = {...baseRectangleSnapshot,
      id:"b", x:10, y:10, width: 6, height: 6};
    const rect2 = model.addObject(rectSnapshot2);
    model.alignObjects(["a", "b"], AlignType.h_right);
    expect(rect1.x).toBe(16-5);
    expect(rect2.x).toBe(16-6);
    expect(rect1.y).toBe(1);
    expect(rect2.y).toBe(10);
  });

  it("can align objects top", () => {
    const model = createDrawingContentWithMetadata();
    const rectSnapshot1: RectangleObjectSnapshotForAdd = {...baseRectangleSnapshot,
      id:"a", x:1, y:1, width: 5, height: 5};
    const rect1 = model.addObject(rectSnapshot1);
    const rectSnapshot2: RectangleObjectSnapshotForAdd = {...baseRectangleSnapshot,
      id:"b", x:10, y:10, width: 6, height: 6};
    const rect2 = model.addObject(rectSnapshot2);
    model.alignObjects(["a", "b"], AlignType.v_top);
    expect(rect1.x).toBe(1);
    expect(rect2.x).toBe(10);
    expect(rect1.y).toBe(1);
    expect(rect2.y).toBe(1);
  });

  it("can align objects middle", () => {
    const model = createDrawingContentWithMetadata();
    const rectSnapshot1: RectangleObjectSnapshotForAdd = {...baseRectangleSnapshot,
      id:"a", x:1, y:1, width: 5, height: 5};
    const rect1 = model.addObject(rectSnapshot1);
    const rectSnapshot2: RectangleObjectSnapshotForAdd = {...baseRectangleSnapshot,
      id:"b", x:10, y:10, width: 6, height: 6};
    const rect2 = model.addObject(rectSnapshot2);
    model.alignObjects(["a", "b"], AlignType.v_center);
    expect(rect1.x).toBe(1);
    expect(rect2.x).toBe(10);
    expect(rect1.y).toBe(8.5-2.5);
    expect(rect2.y).toBe(8.5-3);
  });

  it("can align objects bottom", () => {
    const model = createDrawingContentWithMetadata();
    const rectSnapshot1: RectangleObjectSnapshotForAdd = {...baseRectangleSnapshot,
      id:"a", x:1, y:1, width: 5, height: 5};
    const rect1 = model.addObject(rectSnapshot1);
    const rectSnapshot2: RectangleObjectSnapshotForAdd = {...baseRectangleSnapshot,
      id:"b", x:10, y:10, width: 6, height: 6};
    const rect2 = model.addObject(rectSnapshot2);
    model.alignObjects(["a", "b"], AlignType.v_bottom);
    expect(rect1.x).toBe(1);
    expect(rect2.x).toBe(10);
    expect(rect1.y).toBe(16-5);
    expect(rect2.y).toBe(16-6);
  });

  it("can align all types of objects", () => {
    // Left edge of sized objects is just their x
    const rect = RectangleObject.create({ ...baseRectangleSnapshot, x: 1, y: 1, id: "rect" });
    const text = TextObject.create({ id: "text", x: 2, y: 2, width: 10, height: 10,
      text: "Hello, world!", ...mockSettings });
    const image = ImageObject.create({ id: "image", x: 3, y: 3, width: 10, height: 10,
      url: "my/image/url", ...mockSettings });
    // Left edge of line is the leftmost point, in this case x-11 = 4.
    const line = LineObject.create({ id: "line", x: 15, y: 15,
      deltaPoints: [{dx: -5, dy: -5}, {dx: -6, dy: 0}], ...mockSettings });
    // Left edge of ellipse is x - rx (= 10-5 = 5)
    const ellipse = EllipseObject.create({ id: "ellipse", x: 10, y: 10, rx: 5, ry: 1, ...mockSettings });
    // Left edge of vector is the leftmost point, in this case 16-10 = 6
    const vector = VectorObject.create({ id: "vector", x: 16, y: 16, dx: -10, dy: 10, ...mockSettings });

    const model = createDrawingContentWithMetadata({ objects: [rect, ellipse, text, image, line, vector] });
    model.alignObjects(["rect", "ellipse", "text", "image", "line", "vector"], AlignType.h_left);

    expect(rect.x).toBe(1);
    expect(text.x).toBe(1);
    expect(image.x).toBe(1);
    expect(line.x).toBe(12); // x-11 = 1
    expect(ellipse.x).toBe(6); // x-dx = 1
    expect(vector.x).toBe(11); // x-dx = 1
  });

  it("can resize rectangle", () => {
    mockLogTileChangeEvent.mockClear();
    const model = createDrawingContentWithMetadata();

    const rectSnapshot1: RectangleObjectSnapshotForAdd = {...baseRectangleSnapshot, id:"a"};
    model.addObject(rectSnapshot1);

    const obj = model.objectMap.a as RectangleObjectType;

    // drag bottom right bigger
    obj.setDragBounds({ top: 0, right: 10, bottom: 10, left: 0 });
    obj.resizeObject();
    expect(obj).toHaveProperty('x', 0);
    expect(obj).toHaveProperty('y', 0);
    expect(obj).toHaveProperty('width', 20);
    expect(obj).toHaveProperty('height', 20);

    // drag top left smaller
    obj.setDragBounds({ top: 10, right: 0, bottom: 0, left: 10 });
    obj.resizeObject();
    expect(obj).toHaveProperty('x', 10);
    expect(obj).toHaveProperty('y', 10);
    expect(obj).toHaveProperty('width', 10);
    expect(obj).toHaveProperty('height', 10);

    expect(mockLogTileChangeEvent).toHaveBeenNthCalledWith(1,
      LogEventName.DRAWING_TOOL_CHANGE, {
      operation: "addObject",
      change: {
        args: [{
          fill: "#666666",
          height: 10,
          id: "a",
          stroke: "#888888",
          strokeDashArray: "3,3",
          strokeWidth: 5,
          type: "rectangle",
          width: 10,
          x: 0,
          y: 0
        }],
        path: ""
      },
      tileId: "drawing-1"
    });
    expect(mockLogTileChangeEvent).toHaveBeenNthCalledWith(2,
      LogEventName.DRAWING_TOOL_CHANGE, {
      operation: "resizeObject",
      "change": {
        "args": [ ],
        "path": "/objects/0",
      },
      "tileId": "drawing-1"
    });
    expect(mockLogTileChangeEvent).toHaveBeenNthCalledWith(3,
      LogEventName.DRAWING_TOOL_CHANGE, {
      operation: "resizeObject",
      "change": {
        "args": [ ],
        "path": "/objects/0",
      },
      "tileId": "drawing-1"
    });

    expect(mockLogTileChangeEvent).toHaveBeenCalledTimes(3);
  });

  it("can resize ellipse", () => {
    const obj = EllipseObject.create({
      x: 0,
      y: 0,
      rx: 10,
      ry: 10,
    ...mockSettings
    });
    createDrawingContentWithMetadata({
      objects: [obj]
    });

    // drag bottom right bigger
    obj.setDragBounds({ top: 0, right: 10, bottom: 10, left: 0 });
    obj.resizeObject();
    expect(obj).toHaveProperty('x', 5);
    expect(obj).toHaveProperty('y', 5);
    expect(obj).toHaveProperty('rx', 15);
    expect(obj).toHaveProperty('ry', 15);

    // drag top left smaller
    obj.setDragBounds({ top: 10, right: 0, bottom: 0, left: 10 });
    obj.resizeObject();
    expect(obj).toHaveProperty('x', 10);
    expect(obj).toHaveProperty('y', 10);
    expect(obj).toHaveProperty('rx', 10);
    expect(obj).toHaveProperty('ry', 10);
  });

  it("can resize text", () => {
    const obj = TextObject.create({
      text: "This should be rendered as the body of the text object",
      x: 0, y: 0, width: 100, height: 100,
      stroke: "#000000"
    });
    createDrawingContentWithMetadata({
      objects: [obj]
    });
    // drag bottom right bigger
    obj.setDragBounds({ top: 0, right: 10, bottom: 10, left: 0 });
    obj.resizeObject();
    expect(obj).toHaveProperty('x', 0);
    expect(obj).toHaveProperty('y', 0);
    expect(obj).toHaveProperty('width', 110);
    expect(obj).toHaveProperty('height', 110);

    // drag top left smaller
    obj.setDragBounds({ top: 10, right: 0, bottom: 0, left: 10 });
    obj.resizeObject();
    expect(obj).toHaveProperty('x', 10);
    expect(obj).toHaveProperty('y', 10);
    expect(obj).toHaveProperty('width', 100);
    expect(obj).toHaveProperty('height', 100);
  });

  it("can resize image", () => {
    const obj = ImageObject.create({
      url: "my/image/url", x: 0, y: 0, width: 10, height: 10
    });
    createDrawingContentWithMetadata({
      objects: [obj]
    });

    // drag bottom right bigger
    obj.setDragBounds({ top: 0, right: 10, bottom: 10, left: 0 });
    obj.resizeObject();
    expect(obj).toHaveProperty('x', 0);
    expect(obj).toHaveProperty('y', 0);
    expect(obj).toHaveProperty('width', 20);
    expect(obj).toHaveProperty('height', 20);

    // drag top left smaller
    obj.setDragBounds({ top: 10, right: 0, bottom: 0, left: 10 });
    obj.resizeObject();
    expect(obj).toHaveProperty('x', 10);
    expect(obj).toHaveProperty('y', 10);
    expect(obj).toHaveProperty('width', 10);
    expect(obj).toHaveProperty('height', 10);
  });

  it("can resize vector", () => {
    const obj = VectorObject.create({
      x: 0, y: 0, dx: 10, dy: 10,
      ...mockSettings
    });
    createDrawingContentWithMetadata({
      objects: [obj]
    });

    // drag bottom right bigger
    obj.setDragBounds({ top: 0, right: 10, bottom: 10, left: 0 });
    obj.resizeObject();
    expect(obj).toHaveProperty('x', 0);
    expect(obj).toHaveProperty('y', 0);
    expect(obj).toHaveProperty('dx', 20);
    expect(obj).toHaveProperty('dy', 20);

    // drag top left smaller
    obj.setDragBounds({ top: 10, right: 0, bottom: 0, left: 10 });
    obj.resizeObject();
    expect(obj).toHaveProperty('x', 10);
    expect(obj).toHaveProperty('y', 10);
    expect(obj).toHaveProperty('dx', 10);
    expect(obj).toHaveProperty('dy', 10);
  });

  it("can resize line", () => {
    const obj = LineObject.create({
      x: 0, y: 0,
      ...mockSettings
    });
    obj.addPoint(DeltaPoint.create({dx: 10, dy: 10})); // FIXME this point is not actually getting added.
    createDrawingContentWithMetadata({
      objects: [obj]
    });

    // drag bottom right bigger
    obj.setDragBounds({ top: 0, right: 10, bottom: 10, left: 0 });
    obj.resizeObject();
    expect(obj).toHaveProperty('x', 0);
    expect(obj).toHaveProperty('y', 0);
    expect(obj).toHaveProperty('deltaPoints', [{dx: 20, dy: 20}]);

    // drag top left smaller
    obj.setDragBounds({ top: 10, right: 0, bottom: 0, left: 10 });
    obj.resizeObject();
    expect(obj).toHaveProperty('x', 10);
    expect(obj).toHaveProperty('y', 10);
    expect(obj).toHaveProperty('deltaPoints', [{dx: 10, dy: 10}]);
  });

  it("can copy rectangle", () => {
    mockLogTileChangeEvent.mockClear();
    const model = createDrawingContentWithMetadata();

    const rectSnapshot1: RectangleObjectSnapshotForAdd = {...baseRectangleSnapshot, id:"a"};
    model.addObject(rectSnapshot1);

    model.duplicateObjects(["a"]);
    expect(model.objects).toHaveLength(2);

    const copiedObj = model.objects[1];
    expect(copiedObj).toHaveProperty("type", "rectangle");
    expect(copiedObj).toHaveProperty("id");
    expect(copiedObj.id).not.toEqual("a");
    expect(copiedObj).toHaveProperty("x", 10);
    expect(copiedObj).toHaveProperty("y", 10);

    expect(mockLogTileChangeEvent).toHaveBeenCalledTimes(2);
    expect(mockLogTileChangeEvent).toHaveBeenNthCalledWith(1,
      LogEventName.DRAWING_TOOL_CHANGE, {
      operation: "addObject",
      "change": {
        "args": [
          {
            "fill": "#666666",
            "height": 10,
            "id": "a",
            "stroke": "#888888",
            "strokeDashArray": "3,3",
            "strokeWidth": 5,
            "type": "rectangle",
            "width": 10,
            "x": 0,
            "y": 0,
          }
         ],
        "path": "",
      },
      "tileId": "drawing-1"
    });
    expect(mockLogTileChangeEvent).toHaveBeenNthCalledWith(2,
      LogEventName.DRAWING_TOOL_CHANGE, {
      operation: "duplicateObjects",
      "change": {
        "args": [
          [ "a" ]
         ],
        "path": "",
      },
      "tileId": "drawing-1"
    });
  });

  it("can copy multiple objects", () => {
    mockLogTileChangeEvent.mockClear();

    const rectSnapshot: RectangleObjectSnapshotForAdd = {...baseRectangleSnapshot, id:"a"};

    const ellipse = EllipseObject.create({
      id: "b",
      x: 100,
      y: 100,
      rx: 10,
      ry: 10,
      ...mockSettings
    });
    const model = createDrawingContentWithMetadata({ objects: [rectSnapshot, ellipse] });

    expect(model.objects).toHaveLength(2);
    model.duplicateObjects(["a", "b"]);
    expect(model.objects).toHaveLength(4);

    const copiedRect = model.objects[2];
    expect(copiedRect).toHaveProperty("type", "rectangle");
    expect(copiedRect).toHaveProperty("id");
    expect(copiedRect.id).not.toEqual("a");
    expect(copiedRect).toHaveProperty("x", 10);
    expect(copiedRect).toHaveProperty("y", 10);

    const copiedEllipse = model.objects[3];
    expect(copiedEllipse).toHaveProperty("type", "ellipse");
    expect(copiedEllipse).toHaveProperty("id");
    expect(copiedEllipse.id).not.toEqual("b");
    expect(copiedEllipse).toHaveProperty("x", 110);
    expect(copiedEllipse).toHaveProperty("y", 110);
  });

  it("can change the current stamp", () => {
    const model = createDrawingContentWithMetadata({
      stamps: [ {
          url: "a.png",
          width: 10,
          height: 10
        },
        {
          url: "b.png",
          width: 10,
          height: 10
        }
      ]
    });

    expect(model.currentStamp).toBeDefined();
    expect(model.currentStamp!.url).toBe("a.png");

    model.setSelectedStamp(1);

    expect(model.currentStamp!.url).toBe("b.png");
  });

  test("addObject throws when an instance is passed to it", () => {
    const model = createDrawingContentWithMetadata();
    const rect = RectangleObject.create(baseRectangleSnapshot);

    expect(() => model.addObject(rect)).toThrow();
  });

  test("can group and ungroup objects", () => {
    mockLogTileChangeEvent.mockReset();
    const model = createDrawingContentWithMetadata();
    const r1: RectangleObjectSnapshotForAdd = {
      type: "rectangle",
      id: "r1",
      x: 0,
      y: 0,
      width: 30,
      height: 40,
      ...mockSettings,
    };
    const r2: RectangleObjectSnapshotForAdd = {
      type: "rectangle",
      id: "r2",
      x: 10,
      y: 50,
      width: 90,
      height: 50,
      ...mockSettings,
    };

    model.addObject(r1);
    model.addObject(r2);
    model.createGroup(['r1', 'r2']);
    const group = model.objects[model.objects.length-1] as GroupObjectType;
    const groupId = group.id;

    expect(model.objects).toHaveLength(1);
    expect(group.objects).toHaveLength(2);
    // Check group bounding box and dimensions
    expect(group.x).toBe(0);
    expect(group.y).toBe(0);
    expect(group.width).toBe(100);
    expect(group.height).toBe(100);
    expect(group.boundingBox).toStrictEqual({ nw: { x: 0, y: 0}, se: { x: 100, y: 100}});
    // Check member rectangles' relative positions and sizes
    // r1: x:0, y:0, width:0.3, height:0.4 (relative to group)
    // r2: x:0.1, y:0.5, width:0.9, height:0.5 (relative to group)
    const [rect1, rect2] = group.objects;
    // Cast to RectangleObjectType for property access in test
    const rect1Rel = rect1 as RectangleObjectType;
    const rect2Rel = rect2 as RectangleObjectType;
    expect(rect1Rel.type).toBe("rectangle");
    expect(rect1Rel.x).toBeCloseTo(0);
    expect(rect1Rel.y).toBeCloseTo(0);
    expect(rect1Rel.width).toBeCloseTo(0.3);
    expect(rect1Rel.height).toBeCloseTo(0.4);
    expect(rect2Rel.type).toBe("rectangle");
    expect(rect2Rel.x).toBeCloseTo(0.1);
    expect(rect2Rel.y).toBeCloseTo(0.5);
    expect(rect2Rel.width).toBeCloseTo(0.9);
    expect(rect2Rel.height).toBeCloseTo(0.5);

    model.ungroupGroups([groupId]);

    // After ungrouping, the rectangles should have their original absolute coordinates and sizes
    const rect1After = model.objectMap.r1 as RectangleObjectType;
    const rect2After = model.objectMap.r2 as RectangleObjectType;
    expect(rect1After.x).toBe(0);
    expect(rect1After.y).toBe(0);
    expect(rect1After.width).toBe(30);
    expect(rect1After.height).toBe(40);
    expect(rect2After.x).toBe(10);
    expect(rect2After.y).toBe(50);
    expect(rect2After.width).toBe(90);
    expect(rect2After.height).toBe(50);

    expect(mockLogTileChangeEvent).toHaveBeenCalledTimes(4);
    expect(mockLogTileChangeEvent).toHaveBeenNthCalledWith(1,
      LogEventName.DRAWING_TOOL_CHANGE, {
      operation: "addObject",
      "change": {
        "args": [
          {
            "fill": "#666666",
            "height": 40,
            "id": "r1",
            "stroke": "#888888",
            "strokeDashArray": "3,3",
            "strokeWidth": 5,
            "type": "rectangle",
            "width": 30,
            "x": 0,
            "y": 0,
          }
         ],
        "path": "",
      },
      "tileId": "drawing-1"
    });
    expect(mockLogTileChangeEvent).toHaveBeenNthCalledWith(2,
      LogEventName.DRAWING_TOOL_CHANGE, {
      operation: "addObject",
      "change": {
        "args": [
          {
            "fill": "#666666",
            "height": 50,
            "id": "r2",
            "stroke": "#888888",
            "strokeDashArray": "3,3",
            "strokeWidth": 5,
            "type": "rectangle",
            "width": 90,
            "x": 10,
            "y": 50,
          }
         ],
        "path": "",
      },
      "tileId": "drawing-1"
    });
    expect(mockLogTileChangeEvent).toHaveBeenNthCalledWith(3,
      LogEventName.DRAWING_TOOL_CHANGE, {
      operation: "createGroup",
      "change": {
        "args": [
          [
            "r1",
            "r2"
          ]
        ],
        "path": "",
      },
      "tileId": "drawing-1"
    });
    expect(mockLogTileChangeEvent).toHaveBeenNthCalledWith(4,
      LogEventName.DRAWING_TOOL_CHANGE, {
      operation: "ungroupGroups",
      "change": {
        "args": [
          [
            groupId
          ]
        ],
        "path": "",
      },
      "tileId": "drawing-1"
    });
  });

  test("can modify and resize grouped objects", () => {
    mockLogTileChangeEvent.mockReset();
    // Make a group with one of every type of object.
    const line = LineObject.create({
      x: 0, y: 0,
      deltaPoints: [{dx: 10, dy: 10}],
      ...mockSettings
    });
    const vector = VectorObject.create({
      x: 10, y: 10, dx: 10, dy: 10,
      ...mockSettings
    });
    const rect = RectangleObject.create({
      x: 20,
      y: 20,
      width: 10,
      height: 10,
      ...mockSettings,
    });
    const ellipse = EllipseObject.create({
      x: 35,
      y: 35,
      rx: 5,
      ry: 5,
    ...mockSettings});
    const image = ImageObject.create({
      url: "my/image/url", x: 40, y: 40, width: 10, height: 10
    });
    const text = TextObject.create({
      text: "This should be rendered as the body of the text object",
      x: 50, y: 50, width: 10, height: 10,
      stroke: "#000000"
    });
    const model = createDrawingContentWithMetadata({
      objects: [line, vector, rect, ellipse, image, text]
    });

    expect(model.objects).toHaveLength(6);
    model.createGroup([line.id, vector.id, rect.id, ellipse.id, image.id, text.id]);
    expect(model.objects).toHaveLength(1);

    const group = model.objects[0] as GroupObjectType;
    expect(group.boundingBox).toStrictEqual({ nw: {x: 0, y: 0}, se: {x: 60, y: 60}});
    // After grouping, ellipse coordinates are relative to the group
    // The bounding box should be in relative coordinates (use toBeCloseTo for floating point precision)
    expect(ellipse.boundingBox.nw.x).toBeCloseTo(0.5);
    expect(ellipse.boundingBox.nw.y).toBeCloseTo(0.5);
    expect(ellipse.boundingBox.se.x).toBeCloseTo(0.6667, 3);
    expect(ellipse.boundingBox.se.y).toBeCloseTo(0.6667, 3);

    group.setDragBounds({ top: 0, right: 60, bottom: 60, left: 0});
    group.resizeObject();
    expect(group.boundingBox).toStrictEqual({ nw: {x: 0, y: 0}, se: {x: 120, y: 120}});
    // After resizing, bounding boxes are relative to the group size (120x120)
    // Use toBeCloseTo for floating point precision
    expect(line.boundingBox.nw.x).toBeCloseTo(0);
    expect(line.boundingBox.nw.y).toBeCloseTo(0);
    expect(line.boundingBox.se.x).toBeCloseTo(0.1667, 3);
    expect(line.boundingBox.se.y).toBeCloseTo(0.1667, 3);

    expect(vector.boundingBox.nw.x).toBeCloseTo(0.1667, 3);
    expect(vector.boundingBox.nw.y).toBeCloseTo(0.1667, 3);
    expect(vector.boundingBox.se.x).toBeCloseTo(0.3333, 3);
    expect(vector.boundingBox.se.y).toBeCloseTo(0.3333, 3);

    expect(rect.boundingBox.nw.x).toBeCloseTo(0.3333, 3);
    expect(rect.boundingBox.nw.y).toBeCloseTo(0.3333, 3);
    expect(rect.boundingBox.se.x).toBeCloseTo(0.5, 3);
    expect(rect.boundingBox.se.y).toBeCloseTo(0.5, 3);

    expect(ellipse.boundingBox.nw.x).toBeCloseTo(0.5, 3);
    expect(ellipse.boundingBox.nw.y).toBeCloseTo(0.5, 3);
    expect(ellipse.boundingBox.se.x).toBeCloseTo(0.6667, 3);
    expect(ellipse.boundingBox.se.y).toBeCloseTo(0.6667, 3);

    expect(image.boundingBox.nw.x).toBeCloseTo(0.6667, 3);
    expect(image.boundingBox.nw.y).toBeCloseTo(0.6667, 3);
    expect(image.boundingBox.se.x).toBeCloseTo(0.8333, 3);
    expect(image.boundingBox.se.y).toBeCloseTo(0.8333, 3);

    expect(text.boundingBox.nw.x).toBeCloseTo(0.8333, 3);
    expect(text.boundingBox.nw.y).toBeCloseTo(0.8333, 3);
    expect(text.boundingBox.se.x).toBeCloseTo(1, 3);
    expect(text.boundingBox.se.y).toBeCloseTo(1, 3);

    group.setStroke('#abcdef');
    group.setStrokeDashArray('1 2');
    group.setStrokeWidth(10);
    expect([line.stroke, line.strokeDashArray, line.strokeWidth]).toEqual(['#abcdef', '1 2', 10]);
    expect([vector.stroke, vector.strokeDashArray, vector.strokeWidth]).toEqual(['#abcdef', '1 2', 10]);
    expect([rect.stroke, rect.strokeDashArray, rect.strokeWidth]).toEqual(['#abcdef', '1 2', 10]);
    expect([ellipse.stroke, ellipse.strokeDashArray, ellipse.strokeWidth]).toEqual(['#abcdef', '1 2', 10]);
    expect(text.stroke).toEqual('#abcdef');

    group.setFill('#fedcba');
    expect(rect.fill).toEqual('#fedcba');
    expect(ellipse.fill).toEqual('#fedcba');

    group.setEndShapes(VectorEndShape.triangle, VectorEndShape.triangle);
    expect([vector.headShape, vector.tailShape]).toEqual([VectorEndShape.triangle, VectorEndShape.triangle]);
  });

  test("duplicateObjects removes all ids from groups and nested groups", () => {
    // Create a rectangle and an ellipse
    const rect = {
      type: "rectangle",
      id: "rect1",
      x: 0,
      y: 0,
      width: 20,
      height: 10,
      ...mockSettings
    };
    const ellipse = {
      type: "ellipse",
      id: "ellipse1",
      x: 5,
      y: 5,
      rx: 5,
      ry: 3,
      ...mockSettings
    };
    // Create a nested group containing the ellipse
    const nestedGroup = {
      type: "group",
      id: "group2",
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      objects: [ellipse]
    };
    // Create a top-level group containing the rectangle and the nested group
    const topGroup = {
      type: "group",
      id: "group1",
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      objects: [rect, nestedGroup]
    };
    // Create the model with the top-level group
    const model = createDrawingContentWithMetadata({ objects: [topGroup] });
    expect(model.objects).toHaveLength(1);
    const originalGroup = model.objects[0];
    // Duplicate the top-level group
    model.duplicateObjects([originalGroup.id]);
    // There should now be two groups
    expect(model.objects).toHaveLength(2);
    const duplicatedGroup = model.objects[1];
    // Helper to collect all ids in a group (recursively)
    // Use 'as any' for test-only recursive property access
    function collectIds(obj: any): string[] {
      let ids: string[] = [];
      if (obj.id) ids.push(obj.id);
      if (Array.isArray((obj as any).objects)) {
        (obj as any).objects.forEach((child: any) => {
          ids = ids.concat(collectIds(child));
        });
      }
      return ids;
    }
    const originalIds = collectIds(originalGroup);
    const duplicatedIds = collectIds(duplicatedGroup);
    // All ids in the duplicate should be unique and not in the original
    duplicatedIds.forEach(id => {
      expect(originalIds).not.toContain(id);
    });
    // Structure should be preserved: group > [rect, group > [ellipse]]
    expect((duplicatedGroup as any).type).toBe("group");
    expect((duplicatedGroup as any).objects).toHaveLength(2);
    expect((duplicatedGroup as any).objects[0].type).toBe("rectangle");
    expect((duplicatedGroup as any).objects[1].type).toBe("group");
    expect((duplicatedGroup as any).objects[1].objects).toHaveLength(1);
    expect((duplicatedGroup as any).objects[1].objects[0].type).toBe("ellipse");
  });

});
