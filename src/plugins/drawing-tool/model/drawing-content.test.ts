import {
  createDrawingContent, defaultDrawingContent, 
  DrawingContentModelSnapshot, DrawingToolMetadataModel
} from "./drawing-content";
import { kDrawingToolID } from "./drawing-types";
import { DefaultToolbarSettings } from "./drawing-basic-types";
import { StampModel } from "./stamp";
import { AppConfigModel } from "../../../models/stores/app-config-model";
import { ImageObject } from "../objects/image";
import { RectangleObject, RectangleObjectSnapshot, RectangleObjectType } from "../objects/rectangle";
import { computeStrokeDashArray } from "../objects/drawing-object";

// mock Logger calls
jest.mock("../../../lib/logger", () => {
  return {
    ...(jest.requireActual("../../../lib/logger") as any),
    Logger: {
      logToolChange: jest.fn()
    }
  };
});

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

describe("StampModel", () => {
  it("should migrate urls", () => {
    // handles empty urls
    expect(StampModel.create({ url: "", width: 10, height: 10 }).url).toBe("");
    // most urls are unchanged
    expect(StampModel.create({ url: "curriculum/foo/stamps", width: 10, height: 10 }).url)
      .toBe("curriculum/foo/stamps");
    // old-style urls are migrated
    expect(StampModel.create({ url: "assets/tools/drawing-tool/stamps", width: 10, height: 10 }).url)
      .toBe("curriculum/moving-straight-ahead/stamps");
  });
});

describe('defaultDrawingContent', () => {
  it('should return content with no options', () => {
    const content = defaultDrawingContent();
    expect(content.type).toBe(kDrawingToolID);
    expect(content.stamps).toEqual([]);
    expect(content.objects).toEqual([]);
  });
  it('should return content with optional stamps', () => {
    const stamps = [{ url: "my/stamp/url", width: 10, height: 10 }];
    const appConfig = AppConfigModel.create({ config: { stamps } as any });
    const content = defaultDrawingContent({ appConfig });
    expect(content.type).toBe(kDrawingToolID);
    expect(content.stamps).toEqual(stamps);
    expect(content.objects).toEqual([]);
  });
});

describe("DrawingContentModel", () => {

  function createDrawingContentWithMetadata(options?: DrawingContentModelSnapshot) {
    const model = createDrawingContent(options);
    const metadata = DrawingToolMetadataModel.create({ id: "drawing-1" });
    model.doPostCreate(metadata);
    return model;
  }

  const mockSettings = {
    fill: "#666666",
    stroke: "#888888",
    strokeDashArray: "3,3",
    strokeWidth: 5
  };

  it("accepts default arguments on creation", () => {
    const model = createDrawingContentWithMetadata();
    expect(model.type).toBe(kDrawingToolID);
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
    expect(model.type).toBe(kDrawingToolID);
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
    model.setStroke(stroke);
    expect(model.toolbarSettings).toEqual({ ...defaultSettings, stroke });
    model.setFill(fill);
    expect(model.toolbarSettings).toEqual({ ...defaultSettings, fill, stroke });
    model.setStrokeDashArray(strokeDashArray);
    expect(model.toolbarSettings).toEqual({ ...defaultSettings, fill, stroke, strokeDashArray });
    model.setStrokeWidth(strokeWidth);
    expect(model.toolbarSettings).toEqual({ ...defaultSettings, fill, stroke, strokeDashArray, strokeWidth });
  });

  it("can delete a set of selected drawing objects", () => {
    const model = createDrawingContentWithMetadata();
    const {stroke, fill, strokeWidth, strokeDashArray} = mockSettings;

    model.addObject(RectangleObject.create(
      {id:"a", x:0, y:0, width:10, height:10,
       stroke, fill, strokeWidth, strokeDashArray}));

    model.addObject(RectangleObject.create(
      {id:"b", x:20, y:20, width:10, height:10,
       stroke, fill, strokeWidth, strokeDashArray}));

    // delete does nothing if nothing is selected
    expect(model.objects.length).toBe(2);
    model.deleteSelectedObjects();
    expect(model.objects.length).toBe(2);

    model.setSelection(["a", "b"]);
    expect(model.hasSelectedObjects).toBe(true);
    model.deleteSelectedObjects();
    expect(model.objects.length).toBe(0);
  });

  it("can update the properties of a set of selected drawing objects", () => {
    const model = createDrawingContentWithMetadata();
    expect(model.currentStamp).toBeNull();

    const {stroke, fill, strokeWidth, strokeDashArray} = mockSettings;
    model.addObject(RectangleObject.create(
      {id:"a", x:0, y:0, width:10, height:10,
       stroke, fill, strokeWidth, strokeDashArray}));

    model.addObject(RectangleObject.create(
      {id:"b", x:20, y:20, width:10, height:10,
       stroke, fill, strokeWidth, strokeDashArray}));

    model.setSelection(["a", "b"]);
    model.setStroke("#000000");
    model.setStrokeWidth(2);

    expect(model.objects[0].type).toBe("rectangle");
    const rect1 = model.objects[0] as RectangleObjectType;
    // Set stroke doesn't seem to be applied to the selected objects
    expect(rect1.stroke).toBe("#000000");
    expect(rect1.strokeWidth).toBe(2);

    expect(model.objects[1].type).toBe("rectangle");
    const rect2 = model.objects[0] as RectangleObjectType;
    expect(rect2.stroke).toBe("#000000");
    expect(rect2.strokeWidth).toBe(2);
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
});
