import { Instance, SnapshotIn, types } from "mobx-state-tree";
import { AdornmentModel, IAdornmentModel, IUpdateCategoriesOptions, PointModel,
         kInfinitePoint } from "../adornment-models";
import { Point } from "../../graph-types";
import { IAxisModel } from "../../imports/components/axis/models/axis-model";
import { computeSlopeAndIntercept } from "../../utilities/graph-utils";
import { kMovableLineType } from "./movable-line-types";
import { IGraphModel } from "../../models/graph-model";
import { IClueTileObject } from "../../../../models/annotations/clue-object";
import { uniqueId } from "../../../../utilities/js-utils";
import { JsonNumber } from "../../../../models/json-number";

export function getAnnotationId(lineKey: string, type: "handle"|"equation", position?: "lower"|"upper") {
  if (position) {
    return `movable_line_${type}:${lineKey}:${position}`;
  } else {
    return `movable_line_${type}:${lineKey}`;
  }
}

export const MovableLineInstance = types.model("MovableLineInstance", {
  equationCoords: types.maybe(PointModel),
  intercept: types.number,
  slope: JsonNumber,
})
.volatile(self => ({
  isSelected: false,
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

export interface IMovableLineInstance extends Instance<typeof MovableLineInstance> {}
export interface IMovableLineSnapshot extends SnapshotIn<typeof MovableLineInstance> {}

export const MovableLineModel = AdornmentModel
.named('MovableLineModel')
.props({
  type: 'Movable Line',
  lines: types.map(MovableLineInstance)
})
.actions(self => ({
  dragLine(intercept: number, slope: number, key: string) {
    const line = self.lines.get(key);
    line!.setDragIntercept(intercept);
    line!.setDragSlope(slope);
  },
  saveLine(key: string) {
    const line = self.lines.get(key);
    line!.saveIntercept();
    line!.saveSlope();
  },
  dragEquation(coords: Point, key: string) {
    const line = self.lines.get(key);
    line!.setDragEquationCoords(coords);
  },
  saveEquationCoords(key: string) {
    self.lines.get(key)!.saveEquationCoords();
  },
  setLine(xAxis?: IAxisModel, yAxis?: IAxisModel, key='') {
    const { intercept, slope } = computeSlopeAndIntercept(xAxis, yAxis);
    self.lines.set(key, { intercept, slope });
    const line = self.lines.get(key);
    line!.setPivot1(kInfinitePoint);
    line!.setPivot2(kInfinitePoint);
  },
  toggleSelected(key: string) {
    // Only one line can be selected at a time.
    self.lines.forEach((line, lineKey) => {
      if (lineKey !== key) line.isSelected = false;
    });
    const targetLine = self.lines.get(key);
    if (!targetLine) return;
    targetLine.isSelected = !targetLine.isSelected;
  }
}))
.actions(self => ({
  addLine(xAxis?: IAxisModel, yAxis?: IAxisModel) {
    const uniqueID = uniqueId();
    self.setLine(xAxis, yAxis, uniqueID);
  },
  deleteLine(key: string) {
    self.lines.delete(key);
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
        self.setLine(xAxis, yAxis, instanceKey);
      }
    }
  },
  deleteSelected() {
    self.lines.forEach((line, _key) => {
      const key = String(_key);
      if (line.isSelected) {
        self.lines.delete(key);
      }
    });
  }
}))
.views(self => ({
  get annotatableObjects() {
    const objects: IClueTileObject[] = [];
    if (self.isVisible) {
      for (const key of self.lines.keys()) {
        objects.push({ objectType: "movable-line-handle", objectId: getAnnotationId(key, "handle", "lower") });
        objects.push({ objectType: "movable-line-handle", objectId: getAnnotationId(key, "handle", "upper") });
        objects.push({ objectType: "movable-line-equation", objectId: getAnnotationId(key, "equation") });
      }
    }
    return objects;
  },
  hasSelectedInstances() {
    let hasSelected = false;
    self.lines.forEach(line => {
      if (line.isSelected) {
        hasSelected = true;
      }
    });
    return hasSelected;
  }
}));

export interface IMovableLineModel extends Instance<typeof MovableLineModel> {}
export function isMovableLine(adornment: IAdornmentModel): adornment is IMovableLineModel {
  return adornment.type === kMovableLineType;
}

export function defaultMovableLineAdornment(graph: IGraphModel) {
  const mLine = MovableLineModel.create();
  const uniqueID = uniqueId();
  mLine.setLine(graph.axes.get("bottom"), graph.axes.get("left"), uniqueID);
  return mLine;
}
