import { DrawingContentModel, kDrawingToolID, DrawingToolMetadataModel } from "./drawing-content";

describe("DrawingContentModel", () => {

  function createDrawingContent(options?: any) {
    const model = DrawingContentModel.create(options);
    const metadata = DrawingToolMetadataModel.create({ id: "drawing-1" });
    model.doPostCreate(metadata);
    return model;
  }

  it("accepts default arguments on creation", () => {
    const model = createDrawingContent();
    expect(model.type).toBe(kDrawingToolID);
    expect(model.changes).toEqual([]);
    expect(model.selectedButton).toBe("select");
  });

  it("can reset the tool button", () => {
    const model = createDrawingContent();
    model.setSelectedButton("vector");
    expect(model.selectedButton).toBe("vector");
    model.reset();
    expect(model.selectedButton).toBe("select");
  });

  it("can delete a set of selected drawing objects", () => {
    const model = createDrawingContent();

    model.setSelection(["a", "b"]);
    model.deleteSelectedObjects();
    expect(model.changes.length).toBe(1);

    const change = JSON.parse(model.changes[0]);
    expect(change.action).toBe("delete");
    expect(change.data).toEqual(["a", "b"]);
  });

  it("can update the properties of a set of selected drawing objects", () => {
    const model = createDrawingContent();

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
});
