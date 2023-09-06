import stringify from "json-stringify-pretty-compact";
import { types, Instance, getSnapshot } from "mobx-state-tree";

import { kNumberlineTileType, maxNumSelectedPoints } from "../numberline-tile-constants";
import { getTileIdFromContent } from "../../../models/tiles/tile-model";
import { TileContentModel } from "../../../models/tiles/tile-content";
import { uniqueId } from "../../../utilities/js-utils";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";

export function defaultNumberlineContent(): NumberlineContentModelType {
  return NumberlineContentModel.create({});
}

export const PointObjectModel = types
  .model("PointObject", {
    id: types.identifier,
    xValue: 0,
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
    setDragXValue(num?: number) {
      self.dragXValue = num;
    },
    setXValueToDragValue(){ //when mouse is let go
      if (self.dragXValue !== undefined) {
        self.xValue = self.dragXValue;
        self.dragXValue = undefined;
      }
    }
  }));


export interface PointObjectModelType extends Instance<typeof PointObjectModel> {}

export const NumberlineContentModel = TileContentModel
  .named("NumberlineTool")
  .props({
    type: types.optional(types.literal(kNumberlineTileType), kNumberlineTileType),
    points: types.map(PointObjectModel),
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
    get annotatableObjects() {
      const tileId = getTileIdFromContent(self) ?? "";
      return self.pointsArr.map(point => ({
        objectId: point.id,
        objectType: "point",
        tileId
      }));
    },
    get pointsXValuesArr() {
      return self.pointsArr.map((pointObj) => pointObj.xValue);
    },
    getPoint(id: string) {
      return self.pointsArr.find(point => point.id === id);
    },
    //Pass snapshot of axisPoint models into outer/inner points to avoid D3 and MST error
    get axisPointsSnapshot() {
      return self.pointsArr.map((p) =>{
        return {
                dragXValue: p.dragXValue,
                currentXValue: p.currentXValue,
                setDragXValue: p.setDragXValue,
                setXValueToDragValue: p.setXValueToDragValue,
                ...getSnapshot(p) //doesn't capture the volatile properties and methods
              };
      });
    },
    exportJson(options?: ITileExportOptions) {
      const snapshot = getSnapshot(self);
      return stringify(snapshot, {maxLength: 200});
    },

  }))
  .actions(self =>({
    clearSelectedPoints() {
      for (const id in self.selectedPoints){
        delete self.selectedPoints[id];
      }
    }
  }))
  .actions(self => ({
    createNewPoint(xValue: number) {
      const id = uniqueId();
      const pointModel = PointObjectModel.create({ id, xValue });
      self.points.set(id, pointModel);
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
  }));

export interface NumberlineContentModelType extends Instance<typeof NumberlineContentModel> {}
