import { Instance, types } from "mobx-state-tree";
import { AdornmentModel, IAdornmentModel, IUpdateCategoriesOptions, PointModel,
         kInfinitePoint } from "../adornment-models";
import { Point } from "../../graph-types";
import { IAxisModel } from "../../imports/components/axis/models/axis-model";
import { computeSlopeAndIntercept } from "../../utilities/graph-utils";
import { kMovableLineType } from "./movable-line-types";
import { IGraphModel } from "../../models/graph-model";

export const MovableLineInstance = types.model("MovableLineInstance", {
  equationCoords: types.maybe(PointModel),
  intercept: types.number,
  slope: types.number,
})
.volatile(self => ({
  pivot1: PointModel.create(),
  pivot2: PointModel.create()
}))
.actions(self => ({
  setEquationCoords(coords: Point) {
    self.equationCoords = PointModel.create(coords);
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
  setLine(
    aLine: {intercept: number, slope: number, pivot1?: Point, pivot2?: Point, equationCoords?: Point}, key=''
  ) {
    self.lines.set(key, aLine);
    const line = self.lines.get(key);
    line?.setPivot1(aLine.pivot1 ?? kInfinitePoint);
    line?.setPivot2(aLine.pivot2 ?? kInfinitePoint);
  }
}))
.actions(self => ({
  setInitialLine(xAxis?: IAxisModel, yAxis?: IAxisModel, key='') {
    const { intercept, slope } = computeSlopeAndIntercept(xAxis, yAxis);
    self.setLine({ intercept, slope }, key);
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
