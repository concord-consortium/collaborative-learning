import { MovableLineModel, MovableLineInstance } from "./movable-line-model";

describe("MovableLineInstance", () => {
  it("is created with intercept and slope properties", () => {
    const lineParams = MovableLineInstance.create({intercept: 1, slope: 1});
    expect(lineParams.intercept).toEqual(1);
    expect(lineParams.slope).toEqual(1);
    expect(lineParams.currentIntercept).toEqual(1);
    expect(lineParams.currentSlope).toEqual(1);
    expect(lineParams.currentEquationCoords).toBeUndefined();
  });
  it("can have pivot1 and pivot2 properties set", () => {
    const lineParams = MovableLineInstance.create({intercept: 1, slope: 1});
    expect(lineParams.pivot1.isValid()).toBeFalsy();
    expect(lineParams.pivot2.isValid()).toBeFalsy();
    lineParams.setPivot1({x: 1, y: 1});
    lineParams.setPivot2({x: 2, y: 2});
    expect(lineParams.pivot1.isValid()).toBeTruthy();
    expect(lineParams.pivot2.isValid()).toBeTruthy();
    expect(lineParams.pivot1.x).toEqual(1);
    expect(lineParams.pivot1.y).toEqual(1);
    expect(lineParams.pivot2.x).toEqual(2);
    expect(lineParams.pivot2.y).toEqual(2);
  });
  it("can set currentEquationCoords by dragging", () => {
    const lineParams = MovableLineInstance.create({intercept: 1, slope: 1});
    expect(lineParams.currentEquationCoords).toBeUndefined();
    lineParams.setDragEquationCoords({x: 50, y: 50});
    expect(lineParams.currentEquationCoords?.x).toEqual(50);
    expect(lineParams.currentEquationCoords?.y).toEqual(50);
    expect(lineParams.equationCoords).toBeUndefined();

    lineParams.saveEquationCoords();
    expect(lineParams.currentEquationCoords?.x).toEqual(50);
    expect(lineParams.currentEquationCoords?.y).toEqual(50);
    expect(lineParams.equationCoords?.x).toEqual(50);
    expect(lineParams.equationCoords?.y).toEqual(50);
  });
  it("can set slope and intercept by dragging", () => {
    const lineParams = MovableLineInstance.create({intercept: 1, slope: 1});
    expect(lineParams.intercept).toEqual(1);
    expect(lineParams.slope).toEqual(1);
    expect(lineParams.currentIntercept).toEqual(1);
    expect(lineParams.currentSlope).toEqual(1);
    lineParams.setDragIntercept(2);
    expect(lineParams.intercept).toEqual(1);
    expect(lineParams.currentIntercept).toEqual(2);
    lineParams.setDragSlope(3);
    expect(lineParams.slope).toEqual(1);
    expect(lineParams.currentSlope).toEqual(3);
    lineParams.saveIntercept();
    expect(lineParams.intercept).toEqual(2);
    expect(lineParams.currentIntercept).toEqual(2);
    lineParams.saveSlope();
    expect(lineParams.slope).toEqual(3);
    expect(lineParams.currentSlope).toEqual(3);
  });
});

describe("MovableLineModel", () => {
  it("is created with its type property set to 'Movable Line' and with its lines property set to an empty map", () => {
    const movableLine = MovableLineModel.create();
    expect(movableLine.type).toEqual("Movable Line");
    expect(movableLine.lines.size).toEqual(0);
  });
  it("can have a line added to its lines property", () => {
    const movableLine = MovableLineModel.create();
    movableLine.setInitialLine();
    expect(movableLine.lines.size).toEqual(1);
  });
  // Multiple lines not currently supported
  it.skip("can have multiple lines added to its lines property", () => {
    const line1 = {
      intercept: 1,
      slope: 1,
      pivot1: {x: 2, y: 2},
      pivot2: {x: 3, y: 3}
    };
    const line2 = {
      intercept: 2,
      slope: 2,
      pivot1: {x: 3, y: 3},
      pivot2: {x: 4, y: 4}
    };
    const movableLine = MovableLineModel.create();
    movableLine.lines.set("line1key", line1);
    movableLine.lines.set("line2key", line2);
    expect(movableLine.lines.size).toEqual(2);
    expect(movableLine.lines.get('line1key')).toEqual(line1);
    expect(movableLine.lines.get('line2key')).toEqual(line2);
  });
});
