import { addDisposer, onAction } from "mobx-state-tree";
import {
  createDrawingContent, defaultDrawingContent,
  DrawingContentModelSnapshot, DrawingToolMetadataModel
} from "./drawing-content";
import { kDrawingTileType } from "./drawing-types";
import { DefaultToolbarSettings } from "./drawing-basic-types";
import { AppConfigModel } from "../../../models/stores/app-config-model";
import { ImageObject } from "../objects/image";
import { RectangleObject, RectangleObjectSnapshot, RectangleObjectSnapshotForAdd,
  RectangleObjectType } from "../objects/rectangle";
import { DeltaPoint, computeStrokeDashArray } from "../objects/drawing-object";
import { LogEventName } from "../../../lib/logger-types";
import { EllipseObject } from "../objects/ellipse";
import { VectorObject } from "../objects/vector";
import { LineObject } from "../objects/line";
import { TextObject } from "../objects/text";

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
      "curriculumBaseUrl": "https://curriculum.example.com",
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
      strokeWidth: DefaultToolbarSettings.strokeWidth
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
      { operation: "setSelectedIds", change: { args: [ ["a", "b"] ], path: ""}, tileId: "drawing-1" });
    expect(mockLogTileChangeEvent).toHaveBeenNthCalledWith(5,
      LogEventName.DRAWING_TOOL_CHANGE,
      { operation: "deleteObjects", change: { args: [ ["a", "b"] ], path: ""}, tileId: "drawing-1" });
    expect(mockLogTileChangeEvent).toHaveBeenCalledTimes(5);
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
      { operation: "setSelectedIds", change: { args: [["a", "b"]], path: "" }, tileId: "drawing-1" });
    expect(mockLogTileChangeEvent).toHaveBeenNthCalledWith(2,
      LogEventName.DRAWING_TOOL_CHANGE,
      { operation: "setStroke", change: { args: ["#000000", ["a", "b"]], path: "" }, tileId: "drawing-1" });
    expect(mockLogTileChangeEvent).toHaveBeenNthCalledWith(3,
      LogEventName.DRAWING_TOOL_CHANGE,
      { operation: "setStrokeWidth", change: { args: [2, ["a", "b"]], path: "" }, tileId: "drawing-1" });
    expect(mockLogTileChangeEvent).toHaveBeenNthCalledWith(4,
      LogEventName.DRAWING_TOOL_CHANGE,
      { operation: "setStrokeDashArray", change: { args: ["3,3", ["a", "b"]], path: "" }, tileId: "drawing-1" });
    expect(mockLogTileChangeEvent).toHaveBeenCalledTimes(4);
    });

  it("can move objects", () => {
    const model = createDrawingContentWithMetadata();

    const rectSnapshot1: RectangleObjectSnapshotForAdd = {...baseRectangleSnapshot, id:"a", x:0, y:0};
    model.addObject(rectSnapshot1);

    const rectSnapshot2: RectangleObjectSnapshotForAdd = {...baseRectangleSnapshot, id:"b", x:10, y:10};
    model.addObject(rectSnapshot2);

    mockLogTileChangeEvent.mockReset();
    model.moveObjects([
      {id: "a", destination: {x: 20, y: 20}},
      {id: "b", destination: {x: 30, y: 30}}
    ]);
    expect(mockLogTileChangeEvent).toHaveBeenNthCalledWith(1,
      LogEventName.DRAWING_TOOL_CHANGE, {
        operation: "moveObjects",
        change: {
          args: [[{id: "a", destination: {x: 20, y: 20}}, {id: "b", destination: {x: 30, y: 30}}]],
          path: ""
        },
        tileId: "drawing-1"
      });
    expect(mockLogTileChangeEvent).toHaveBeenCalledTimes(1);
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

  it("can update image urls", () => {
    const originalUrl = "my/image/url";
    const image = ImageObject.create({
      url: originalUrl, x: 0, y: 0, width: 10, height: 10
    });
    const model = createDrawingContentWithMetadata({
      objects: [image]
    });

    model.updateImageUrl("", "");
    expect(image.url).toEqual(originalUrl);

    // Updates to a empty string are ignored
    model.updateImageUrl("my/image/url", "");
    expect(image.url).toEqual(originalUrl);

    model.updateImageUrl("", "my/image/newUrl");
    expect(image.url).toEqual(originalUrl);

    model.updateImageUrl("my/image/url", "my/image/newUrl");
    expect(image.url).toBe("my/image/newUrl");
  });

  test("addObject throws when an instance is passed to it", () => {
    const model = createDrawingContentWithMetadata();
    const rect = RectangleObject.create(baseRectangleSnapshot);

    expect(() => model.addObject(rect)).toThrow();
  });
});
