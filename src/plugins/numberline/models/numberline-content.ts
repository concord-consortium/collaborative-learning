import stringify from "json-stringify-pretty-compact";
import { types, Instance, getSnapshot } from "mobx-state-tree";
import { tileContentAPIViews } from "../../../models/tiles/tile-model-hooks";
import { IClueTileObject } from "../../../models/annotations/clue-object";
import { TileContentModel } from "../../../models/tiles/tile-content";
import { getTileIdFromContent } from "../../../models/tiles/tile-model";
import { logTileChangeEvent } from "../../../models/tiles/log/log-tile-change-event";
import { LogEventName } from "../../../lib/logger-types";
import { uniqueId } from "../../../utilities/js-utils";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import { kNumberlineTileType, maxNumSelectedPoints } from "../numberline-tile-constants";

export function defaultNumberlineContent(): NumberlineContentModelType {
  return NumberlineContentModel.create({});
}

// Module-level logging helper (logBarGraphEvent/logAiEvent convention), so the model doesn't expose a
// public action that changes no state (which the history middleware would record as a nested action).
export function logNumberlineEvent(
  model: NumberlineContentModelType, operation: string, change: Record<string, any>
) {
  logTileChangeEvent(LogEventName.NUMBERLINE_TOOL_CHANGE, {
    tileId: getTileIdFromContent(model) ?? "", operation, change
  });
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
      logNumberlineEvent(self as NumberlineContentModelType, "setMin", { min: num });
    },
    setMax(num: number) {
      self.max = num;
      logNumberlineEvent(self as NumberlineContentModelType, "setMax", { max: num });
    }
  }))
  .actions(self => ({
    createNewPoint(xValue: number, isOpen: boolean) {
      const id = uniqueId();
      const pointModel = PointObjectModel.create({ id, xValue, isOpen });
      self.points.set(id, pointModel);
      logNumberlineEvent(self as NumberlineContentModelType, "createNewPoint", { id, xValue, isOpen });
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
      const ids = Object.keys(self.selectedPoints);
      for (const selectedPointId in self.selectedPoints){
        self.points.delete(selectedPointId); //delete all selectedIds from the points map
      }
      self.clearSelectedPoints();
      logNumberlineEvent(self as NumberlineContentModelType, "deleteSelectedPoints", { ids });
    },
    deleteAllPoints() {
      self.points.clear();
      logNumberlineEvent(self as NumberlineContentModelType, "deleteAllPoints", {});
    },
    // Commit a point drag (called from the drag "end" handler) and log the repositioning — the most
    // common way a numberline answer gets revised, which was previously unlogged. Takes the point id
    // (not the node) so the dispatched/recorded action serializes. Log only when a drag actually
    // occurred, so a plain selection click (which also fires drag "end" with no dragXValue) doesn't emit.
    setPointXValue(pointId: string) {
      const point = self.points.get(pointId);
      if (!point) return;
      const dragged = point.dragXValue !== undefined;
      point.setXValueToDragValue();
      if (dragged) {
        logNumberlineEvent(self as NumberlineContentModelType, "setPointXValue",
          { id: point.id, xValue: point.xValue });
      }
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
