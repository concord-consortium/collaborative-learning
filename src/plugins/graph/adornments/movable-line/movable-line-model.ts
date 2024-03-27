import { Instance, types } from "mobx-state-tree";
import { AdornmentModel, IAdornmentModel, IUpdateCategoriesOptions, PointModel,
         kInfinitePoint } from "../adornment-models";
import { Point } from "../../graph-types";
import { IAxisModel } from "../../imports/components/axis/models/axis-model";
import { computeSlopeAndIntercept } from "../../utilities/graph-utils";
import { kMovableLineType } from "./movable-line-types";
import { IGraphModel } from "../../models/graph-model";
import { IClueObject } from "../../../../models/annotations/clue-object";

export function getAnnotationId(lineKey: string, position: string) {
  return `movable_line_handle:${lineKey}:${position}`;
}

export const MovableLineInstance = types.model("MovableLineInstance", {
  equationCoords: types.maybe(PointModel),
  intercept: types.number,
  slope: types.number,
})
.volatile(self => ({
  pivot1: PointModel.create(),
  pivot2: PointModel.create(),
  dragEquationCoords: undefined as Point|undefined,
  dragIntercept: undefined as number|undefined,
  dragSlope: undefined as number|undefined
}))
.views(self => ({
  get currentEquationCoords() {
    if (self.dragEquationCoords) return self.dragEquationCoords;
    if (self.equationCoords?.isValid()) return self.equationCoords;
    return undefined;
  },
  get currentIntercept() {
    return self.dragIntercept !== undefined ? self.dragIntercept : self.intercept;
  },
  get currentSlope() {
    return self.dragSlope !== undefined ? self.dragSlope : self.slope;
  }
}))
.actions(self => ({
  setDragEquationCoords(coords: Point) {
    self.dragEquationCoords = coords;
  },
  saveEquationCoords() {
    self.equationCoords = PointModel.create(self.dragEquationCoords);
    self.dragEquationCoords = undefined;
  },
  setDragIntercept(intercept: number) {
    self.dragIntercept = intercept;
  },
  saveIntercept() {
    if (self.dragIntercept) {
      self.intercept = self.dragIntercept;
      self.dragIntercept = undefined;
    }
  },
  setDragSlope(slope: number) {
    self.dragSlope = slope;
  },
  saveSlope() {
    if (self.dragSlope) {
      self.slope = self.dragSlope;
      self.dragSlope = undefined;
    }
  },
  setPivot1(point: Point) {
    self.pivot1.set(point);
  },
  setPivot2(point: Point) {
    self.pivot2.set(point);
  }
}));

export const MovableLineModel = AdornmentModel
.named('MovableLineModel')
.props({
  type: 'Movable Line',
  lines: types.map(MovableLineInstance)
})
.actions(self => ({
  dragLine(intercept: number, slope: number, key='') {
    const line = self.lines.get(key);
    line!.setDragIntercept(intercept);
    line!.setDragSlope(slope);
  },
  saveLine(key='') {
    const line = self.lines.get(key);
    line!.saveIntercept();
    line!.saveSlope();
  },
  dragEquation(coords: Point, key='') {
    const line = self.lines.get(key);
    line!.setDragEquationCoords(coords);
  },
  saveEquationCoords(key='') {
    self.lines.get(key)!.saveEquationCoords();
  },
  setInitialLine(xAxis?: IAxisModel, yAxis?: IAxisModel, key='') {
    const { intercept, slope } = computeSlopeAndIntercept(xAxis, yAxis);
    self.lines.set(key, { intercept, slope });
    const line = self.lines.get(key);
    line!.setPivot1(kInfinitePoint);
    line!.setPivot2(kInfinitePoint);
  }
}))
.actions(self => ({
  updateCategories(options: IUpdateCategoriesOptions) {
    const { xAxis, yAxis, topCats, rightCats, resetPoints } = options;
    const columnCount = topCats?.length || 1;
    const rowCount = rightCats?.length || 1;
    const totalCount = rowCount * columnCount;
    for (let i = 0; i < totalCount; ++i) {
      const subPlotKey = self.setSubPlotKey(options, i);
      const instanceKey = self.instanceKey(subPlotKey);
      if (!self.lines.get(instanceKey) || resetPoints) {
        self.setInitialLine(xAxis, yAxis, instanceKey);
      }
    }
  }
}))
.views(self => ({
  getAnnotatableObjects(tileId: string) {
    const objects: IClueObject[] = [];
    if (self.isVisible) {
      for (const key of self.lines.keys()) {
        objects.push({ tileId, objectType: "movable-line-handle", objectId: getAnnotationId(key, "lower") });
        objects.push({ tileId, objectType: "movable-line-handle", objectId: getAnnotationId(key, "upper") });
      }
    }
    return objects;
  }
}));

export interface IMovableLineModel extends Instance<typeof MovableLineModel> {}
export function isMovableLine(adornment: IAdornmentModel): adornment is IMovableLineModel {
  return adornment.type === kMovableLineType;
}

export function defaultMovableLineAdornment(graph: IGraphModel) {
  const mLine = MovableLineModel.create();
  mLine.setInitialLine(graph.axes.get("bottom"), graph.axes.get("left"), "{}");
  return mLine;
}
