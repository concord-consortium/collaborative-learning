import stringify from "json-stringify-pretty-compact";
import { types, Instance, getSnapshot } from "mobx-state-tree";
import { tileContentAPIViews } from "../../../models/tiles/tile-model-hooks";
import { IClueTileObject } from "../../../models/annotations/clue-object";
import { TileContentModel } from "../../../models/tiles/tile-content";
import { uniqueId } from "../../../utilities/js-utils";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import { kNumberlineTileType, maxNumSelectedPoints } from "../numberline-tile-constants";

export function defaultNumberlineContent(): NumberlineContentModelType {
  return NumberlineContentModel.create({});
}

export const PointObjectModel = types
  .model("PointObject", {
    id: types.identifier,
    xValue: 0,
    isOpen: false
  })
  .volatile(self => ({
    dragXValue: undefined as undefined | number,
  }))
  .views(self =>({
    get currentXValue() {
      return self.dragXValue ?? self.xValue;
    }
  }))
  .actions(self => ({
    setDragXValue(num: number | undefined) {
      self.dragXValue = num;
    },
    setXValueToDragValue(){ //when mouse is let go
      if (self.dragXValue !== undefined) {
        self.xValue = self.dragXValue;
        self.dragXValue = undefined;
      }
    },
  }));

export interface PointObjectModelType extends Instance<typeof PointObjectModel> {}

export const NumberlineContentModel = TileContentModel
  .named("NumberlineTool")
  .props({
    type: types.optional(types.literal(kNumberlineTileType), kNumberlineTileType),
    points: types.map(PointObjectModel),
    min: -5,
    max: 5
  })
  .volatile(self => ({
    selectedPoints: {} as Record<string, PointObjectModelType> //dictionary of id - point
  }))
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    get pointsArr() { //returns array of all points
      return Array.from(self.points.values());
    },
    get hasPoints() {
      return (self.points.size > 0);
    },
    get isFilledSelectedPoints() {
      return (Object.keys(self.selectedPoints).length >= maxNumSelectedPoints);
    },
    get isEmptySelectedPoints() {
      return (Object.keys(self.selectedPoints).length === 0);
    }
  }))
  .views(self =>({
    get pointsXValuesArr() {
      return self.pointsArr.map((pointObj) => pointObj.xValue);
    },
    getPoint(id: string) {
      return self.points.get(id);
    },
    exportJson(options?: ITileExportOptions) {
      // ignore options?.forHash option - return default export when hashing
      const snapshot = getSnapshot(self);
      return stringify(snapshot, {maxLength: 200});
    }
  }))
  .views(self => tileContentAPIViews({
    get annotatableObjects(): IClueTileObject[] {
      return self.pointsArr.map(point => ({
        objectId: point.id,
        objectType: "point",
      }));
    },
  }))
  .actions(self =>({
    clearSelectedPoints() {
      for (const id in self.selectedPoints){
        delete self.selectedPoints[id];
      }
    },
    setMin(num: number) {
      self.min = num;
    },
    setMax(num: number) {
      self.max = num;
    }
  }))
  .actions(self => ({
    createNewPoint(xValue: number, isOpen: boolean) {
      const id = uniqueId();
      const pointModel = PointObjectModel.create({ id, xValue, isOpen });
      self.points.set(id, pointModel);
      return pointModel;
    },
    setSelectedPoint(point: PointObjectModelType) {
      // this should be revised if we want more than one selected point
      // i.e. maxNumSelectedPoints (in numberline-tile-constants.ts) is greater than 1
      self.clearSelectedPoints();
      self.selectedPoints[point.id] = point;
    },
    deleteSelectedPoints() {
      //For now - only one point can be selected
      for (const selectedPointId in self.selectedPoints){
        self.points.delete(selectedPointId); //delete all selectedIds from the points map
      }
      self.clearSelectedPoints();
    },
    deleteAllPoints() {
      self.points.clear();
    },
  }))
  .actions(self => ({
    createAndSelectPoint(xValue: number, isOpen: boolean) {
      const newPoint = self.createNewPoint(xValue, isOpen);
      self.setSelectedPoint(newPoint);
      return newPoint;
    }
  }));

export interface NumberlineContentModelType extends Instance<typeof NumberlineContentModel> {}
