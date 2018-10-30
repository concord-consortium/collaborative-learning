import { DrawingContentModel, kDrawingToolID } from "./drawing-content";

describe("DrawingContentModel", () => {

  it("accepts default arguments on creation", () => {
    const model = DrawingContentModel.create();
    expect(model.type).toBe(kDrawingToolID);
    expect(model.changes).toEqual([]);
    expect(model.selectedButton).toBe("select");
  });

  it("can reset the tool button", () => {
    const model = DrawingContentModel.create();
    model.setSelectedButton("vector");
    expect(model.selectedButton).toBe("vector");
    model.reset();
    expect(model.selectedButton).toBe("select");
  });

  it("can delete a set of selected drawing objects", () => {
    const model = DrawingContentModel.create();
    model.setSelection(["a", "b"]);
    model.deleteSelectedObjects();
    expect(model.changes.length).toBe(1);

    const change = JSON.parse(model.changes[0]);
    expect(change.action).toBe("delete");
    expect(change.data).toEqual(["a", "b"]);
  });

  it("can update the properties of a set of selected drawing objects", () => {
    const model = DrawingContentModel.create();
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
});
