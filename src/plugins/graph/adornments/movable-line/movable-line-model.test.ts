import { AxisOrientation, IScaleType } from "../../imports/components/axis/axis-types";
import { MovableLineModel, MovableLineInstance } from "./movable-line-model";

// Set up mock axes
const hOrientation = "horizontal" as AxisOrientation;
const vOrientation = "vertical" as AxisOrientation;
const bottomPlace = "bottom" as "bottom" | "left" | "rightNumeric" | "rightCat" | "top";
const leftPlace = "left" as "bottom" | "left" | "rightNumeric" | "rightCat" | "top";
const scaleType = "linear" as IScaleType;
const mockAxes = {
  bottom: {
    isCategorical: false,
    isNumeric: true,
    max: 10,
    min: 0,
    orientation: hOrientation,
    place: bottomPlace,
    scale: scaleType,
    setScale: jest.fn(),
    setTransitionDuration: jest.fn(),
    transitionDuration: 0,
    type: "linear"
  },
  left: {
    isCategorical: false,
    isNumeric: true,
    max: 10,
    min: 0,
    orientation: vOrientation,
    place: leftPlace,
    scale: scaleType,
    setScale: jest.fn(),
    setTransitionDuration: jest.fn(),
    transitionDuration: 0,
    type: "linear"
  }
};

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
  it("is created with type property set to 'Movable Line' and with lines property set to an empty array", () => {
    const movableLine = MovableLineModel.create();
    expect(movableLine.type).toEqual("Movable Line");
    expect(movableLine.lines.size).toEqual(0);
  });
  it("can have a line added to its lines property", () => {
    const movableLine = MovableLineModel.create();
    movableLine.setLine(mockAxes.bottom, mockAxes.left, "line1");
    expect(movableLine.lines.size).toEqual(1);
  });
  it("can have multiple lines added to its lines property using the setLine action", () => {
    const movableLine = MovableLineModel.create();
    movableLine.setLine(mockAxes.bottom, mockAxes.left, "line1");
    movableLine.setLine(mockAxes.bottom, mockAxes.left, "line2");
    expect(movableLine.lines.size).toEqual(2);
  });
  it("can set one line as selected at a time", () => {
    const movableLine = MovableLineModel.create();
    movableLine.setLine(mockAxes.bottom, mockAxes.left, "line1");
    movableLine.setLine(mockAxes.bottom, mockAxes.left, "line2");
    movableLine.toggleSelected("line1");
    expect(movableLine.lines.get("line1")?.isSelected).toBeTruthy();
    expect(movableLine.lines.get("line2")?.isSelected).toBeFalsy();
    movableLine.toggleSelected("line2");
    expect(movableLine.lines.get("line1")?.isSelected).toBeFalsy();
    expect(movableLine.lines.get("line2")?.isSelected).toBeTruthy();
    movableLine.toggleSelected();
    expect(movableLine.lines.get("line1")?.isSelected).toBeFalsy();
    expect(movableLine.lines.get("line2")?.isSelected).toBeFalsy();
  });
  it("can report when there is a selected line", () => {
    const movableLine = MovableLineModel.create();
    movableLine.setLine(mockAxes.bottom, mockAxes.left, "line1");
    movableLine.setLine(mockAxes.bottom, mockAxes.left, "line2");
    expect(movableLine.hasSelectedInstances()).toBeFalsy();
    movableLine.toggleSelected("line1");
    expect(movableLine.hasSelectedInstances()).toBeTruthy();
  });
  it("can delete a specified line", () => {
    const movableLine = MovableLineModel.create();
    movableLine.setLine(mockAxes.bottom, mockAxes.left, "line1");
    movableLine.setLine(mockAxes.bottom, mockAxes.left, "line2");
    expect(movableLine.lines.size).toEqual(2);
    movableLine.deleteLine("line1");
    expect(movableLine.lines.size).toEqual(1);
  });
  it("can delete any selected line", () => {
    const movableLine = MovableLineModel.create();
    movableLine.setLine(mockAxes.bottom, mockAxes.left, "line1");
    movableLine.setLine(mockAxes.bottom, mockAxes.left, "line2");
    expect(movableLine.lines.size).toEqual(2);
    movableLine.toggleSelected("line1");
    movableLine.deleteSelected();
    expect(movableLine.lines.size).toEqual(1);
  });
  it("can update a line's intercept and slope values after dragging", () => {
    const movableLine = MovableLineModel.create();
    movableLine.setLine(mockAxes.bottom, mockAxes.left, "line1");
    expect(movableLine.lines.get("line1")?.intercept).toEqual(0);
    expect(movableLine.lines.get("line1")?.slope).toEqual(2);
    movableLine.dragLine(2, 3, "line1");
    movableLine.saveLine("line1");
    expect(movableLine.lines.get("line1")?.intercept).toEqual(2);
    expect(movableLine.lines.get("line1")?.slope).toEqual(3);
  });
  it("can update a line's equation coordinates after dragging", () => {
    const movableLine = MovableLineModel.create();
    movableLine.setLine(mockAxes.bottom, mockAxes.left, "line1");
    expect(movableLine.lines.get("line1")?.equationCoords).toBeUndefined();
    movableLine.dragEquation({x: 50, y: 50}, "line1");
    movableLine.saveEquationCoords("line1");
    expect(movableLine.lines.get("line1")?.equationCoords?.x).toEqual(50);
    expect(movableLine.lines.get("line1")?.equationCoords?.y).toEqual(50);
  });
});
