import { Instance, types } from "mobx-state-tree";
import { AdornmentModel, IAdornmentModel, IUpdateCategoriesOptions, PointModel,
         kInfinitePoint } from "../adornment-models";
import { Point } from "../../graph-types";
import { IAxisModel } from "../../imports/components/axis/models/axis-model";
import { computeSlopeAndIntercept, getUniqueLineColor } from "../../utilities/graph-utils";
import { kMovableLineType } from "./movable-line-types";
import { IGraphModel } from "../../models/graph-model";
import { IClueTileObject } from "../../../../models/annotations/clue-object";

export function getAnnotationId(lineKey: string | number, type: "handle"|"equation", position?: "lower"|"upper") {
  if (position) {
    return `movable_line_${type}:${lineKey}:${position}`;
  } else {
    return `movable_line_${type}:${lineKey}`;
  }
}

export const MovableLineInstance = types.model("MovableLineInstance", {
  color: types.optional(types.string, "#4782B4"),
  equationCoords: types.maybe(PointModel),
  intercept: types.number,
  isSelected: types.maybe(types.boolean),
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

export interface IMovableLineInstance extends Instance<typeof MovableLineInstance> {}

export const MovableLineModel = AdornmentModel
.named('MovableLineModel')
.props({
  type: 'Movable Line',
  lines: types.array(MovableLineInstance)
})
.actions(self => ({
  dragLine(intercept: number, slope: number, index: number) {
    const line = self.lines[index];
    line!.setDragIntercept(intercept);
    line!.setDragSlope(slope);
  },
  saveLine(index: number) {
    const line = self.lines[index];
    line!.saveIntercept();
    line!.saveSlope();
  },
  dragEquation(coords: Point, index: number) {
    const line = self.lines[index];
    line!.setDragEquationCoords(coords);
  },
  saveEquationCoords(index: number) {
    self.lines[index]!.saveEquationCoords();
  },
  setLine(xAxis?: IAxisModel, yAxis?: IAxisModel) {
    const { intercept, slope } = computeSlopeAndIntercept(xAxis, yAxis);
    const lineIndex = self.lines.length;
    const lineColorKey = `line-${lineIndex}-color`;
    const color = getUniqueLineColor(lineColorKey);
    self.lines.push({ color, intercept, slope });
    const line = self.lines[lineIndex];
    line!.setPivot1(kInfinitePoint);
    line!.setPivot2(kInfinitePoint);
  },
  toggleSelected(index: number) {
    // Only one line can be selected at a time.
    self.lines.forEach((line, lineIndex) => {
      if (lineIndex !== index) line.isSelected = false;
    });
    const targetLine = self.lines[index];
    if (!targetLine) return;
    targetLine.isSelected = !targetLine.isSelected;
  }
}))
.actions(self => ({
  addLine(xAxis?: IAxisModel, yAxis?: IAxisModel) {
    self.setLine(xAxis, yAxis);
  },
  deleteLine(index: number) {
    self.lines.splice(index, 1);
  }
}))
.actions(self => ({
  updateCategories(options: IUpdateCategoriesOptions) {
    const { xAxis, yAxis, topCats, rightCats, resetPoints } = options;
    const columnCount = topCats?.length || 1;
    const rowCount = rightCats?.length || 1;
    const totalCount = rowCount * columnCount;
    for (let i = 0; i < totalCount; ++i) {
      if (!self.lines[i] || resetPoints) {
        self.setLine(xAxis, yAxis);
      }
    }
  },
  deleteSelected() {
    self.lines.forEach((line, index) => {
      if (line.isSelected) {
        self.lines.splice(index, 1);
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
    return self.lines.some(line => line.isSelected);
  }
}));

export interface IMovableLineModel extends Instance<typeof MovableLineModel> {}
export function isMovableLine(adornment: IAdornmentModel): adornment is IMovableLineModel {
  return adornment.type === kMovableLineType;
}

export function defaultMovableLineAdornment(graph: IGraphModel) {
  const mLine = MovableLineModel.create();
  mLine.setLine(graph.axes.get("bottom"), graph.axes.get("left"));
  return mLine;
}
