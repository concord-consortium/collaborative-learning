import { SnapshotIn } from "mobx-state-tree";
import {
  computeStrokeDashArray, defaultDrawingContent, DrawingContentModel, DrawingToolMetadataModel, StampModel
} from "./drawing-content";
import { DefaultToolbarSettings, DrawingToolChange, kDrawingToolID } from "./drawing-types";

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
    expect(content.changes).toEqual([]);
  });
  it('should return content with optional stamps', () => {
    const myStamps = [{ url: "my/stamp/url", width: 10, height: 10 }];
    const content = defaultDrawingContent({ stamps: myStamps });
    expect(content.type).toBe(kDrawingToolID);
    expect(content.stamps).toEqual(myStamps);
    expect(content.changes).toEqual([]);
  });
});

describe("DrawingContentModel", () => {

  function createDrawingContent(options?: SnapshotIn<typeof DrawingContentModel>) {
    const model = DrawingContentModel.create(options);
    const metadata = DrawingToolMetadataModel.create({ id: "drawing-1" });
    model.doPostCreate(metadata);
    return model;
  }

  it("accepts default arguments on creation", () => {
    const model = createDrawingContent();
    expect(model.type).toBe(kDrawingToolID);
    expect(model.changes).toEqual([]);
    expect(model.isUserResizable).toBe(true);
    expect(model.selectedButton).toBe("select");
    expect(model.isSelectedButton("select")).toBe(true);
  });

  it("can reset the tool button", () => {
    const model = createDrawingContent();
    model.setSelectedButton("vector");
    expect(model.selectedButton).toBe("vector");
    model.setSelectedButton("vector");
    expect(model.isSelectedButton("vector")).toBe(true);
    model.reset();
    expect(model.selectedButton).toBe("select");
    expect(model.isSelectedButton("select")).toBe(true);
  });

  it("can manage the toolbar settings", () => {
    const fill = "#666666";
    const stroke = "#888888";
    const strokeDashArray = "3,3";
    const strokeWidth = 5;
    const model = createDrawingContent();
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
    const model = createDrawingContent();

    // delete does nothing if nothing is selected
    model.deleteSelectedObjects();
    expect(model.changes.length).toBe(0);

    model.setSelection(["a", "b"]);
    expect(model.hasSelectedObjects).toBe(true);
    model.deleteSelectedObjects();
    expect(model.changes.length).toBe(1);

    const change = JSON.parse(model.changes[0]);
    expect(change.action).toBe("delete");
    expect(change.data).toEqual(["a", "b"]);
  });

  it("can update the properties of a set of selected drawing objects", () => {
    const model = createDrawingContent();
    expect(model.currentStamp).toBeNull();

    model.setSelection(["a", "b"]);
    model.setStroke("#000000");
    model.setStrokeWidth(2);
    expect(model.changes.length).toBe(2);

    const change0 = JSON.parse(model.changes[0]);
    expect(change0.action).toBe("update");
    expect(change0.data.ids).toEqual(["a", "b"]);
    expect(change0.data.update.prop).toEqual("stroke");
    expect(change0.data.update.newValue).toEqual("#000000");

    const change1 = JSON.parse(model.changes[1]);
    expect(change1.data.update.prop).toEqual("strokeWidth");
    expect(change1.data.update.newValue).toEqual(2);
  });

  it("can change the current stamp", () => {
    const model = createDrawingContent({
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
    const changes: DrawingToolChange[] = [
      { action: "create", data: { type: "image", id: "img1", url: "my/image/url", x: 0, y: 0, width: 10, height: 10 }},
      { action: "update", data: { ids: ["img1"], update: { prop: "url", newValue: "my/image/url2" }}}
    ];
    const model = createDrawingContent({
      changes: changes.map(change => JSON.stringify(change))
    });
    const modelChanges = () => model.changes.map(change => JSON.parse(change));

    model.updateImageUrl("", "");
    expect(modelChanges()).toEqual(changes);
    model.updateImageUrl("my/image/url", "");
    expect(modelChanges()).toEqual(changes);
    model.updateImageUrl("", "my/image/newUrl");
    expect(modelChanges()).toEqual(changes);

    model.updateImageUrl("my/image/url", "my/image/newUrl");
    expect(JSON.parse(model.changes[0]).data.url).toBe("my/image/newUrl");
    model.updateImageUrl("my/image/url2", "my/image/newUrl");
    expect(JSON.parse(model.changes[1]).data.update.newValue).toBe("my/image/newUrl");
  });
});
