import { types, Instance, getSnapshot } from "mobx-state-tree";
import { TileContentModel } from "../../../models/tiles/tile-content";
import { uniqueId } from "../../../utilities/js-utils";
import { createXScale, kNumberlineTileType, maxNumSelectedPoints,
         pointXYBoxRadius, yMidPoint} from "../numberline-tile-constants";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import stringify from "json-stringify-pretty-compact";

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
    get currentXValue(){
      return self.dragXValue || self.xValue;
    }
  }))
  .actions(self => ({
    setDragXValue(num?: number){
      self.dragXValue = num;
    },
    setXValueToDragValue(){ //when mouse is let go
      if (self.dragXValue){
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
    hoveredPoint: "", //holds one point id that is hovered over
    selectedPoints: {} as Record<string, PointObjectModelType> //dictionary of id - point
  }))
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    get pointsArr() { //returns array of all points
      return Array.from(self.points.values());
    },
    get hasPoints(){
      return (self.points.size > 0);
    },
    get isFilledSelectedPoints(){
      return (Object.keys(self.selectedPoints).length >= maxNumSelectedPoints);
    },
    get isEmptySelectedPoints(){
      return (Object.keys(self.selectedPoints).length === 0);
    }
  }))
  .views(self =>({
    get pointsXValuesArr(){
      return self.pointsArr.map((pointObj) => pointObj.xValue);
    },
    getPointFromId(id: string){
      return self.pointsArr.find((point)=> point.id === id) as PointObjectModelType;
    },
    //Pass snapshot of axisPoint models into outer/inner points to avoid D3 and MST error
    get axisPointsSnapshot(){
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
    clearSelectedPointsObj(){
      for (const id in self.selectedPoints){
        delete self.selectedPoints[id];
      }
    }
  }))
  .actions(self => ({
    createNewPoint(xValue: number){
      const id = uniqueId();
      const pointModel = PointObjectModel.create({ id, xValue });
      self.points.set(id, pointModel);
    },
    setHoverPoint(id: string){ //id can also be empty string
      self.hoveredPoint = id;
    },
    setSelectedPoint(point: PointObjectModelType){
      // this should be revised if we want more than one selected point
      // i.e. maxNumSelectedPoints (in numberline-tile-constants.ts) is greater than 1
      self.clearSelectedPointsObj();
      self.selectedPoints[point.id] = point;
    },
    replaceXValueWhileDragging(pointDraggedId: string, newXValue: number){
      const pointDragged = self.getPointFromId(pointDraggedId);
      pointDragged.setDragXValue(newXValue);
    },
    deleteSelectedPoints(){
      //For now - only one point can be selected
      for (const selectedPointId in self.selectedPoints){
        self.points.delete(selectedPointId); //delete all selectedIds from the points map
      }
      self.clearSelectedPointsObj();
    },
    deleteAllPoints(){
      self.points.clear();
    },
  }))
  .actions(self => ({
    analyzeXYPosDetermineHoverPoint(mouseXPos: number, mouseYPos: number, axisWidth: number ){
      if (self.hasPoints){
        const xScale = createXScale(axisWidth);
        const pointsArr = self.pointsArr;
        for (let i = 0; i< pointsArr.length; i++){
          const point = pointsArr[i];
          const pointXPos = xScale(point.xValue); //pixel x-offset of user's mouse
          const pointXLeftBound = pointXPos - pointXYBoxRadius;
          const pointXRightBound = pointXPos + pointXYBoxRadius;
          const pointYTopBound = yMidPoint - pointXYBoxRadius; //reversed since top of tile is where y=0
          const pointYBottomBound = yMidPoint + pointXYBoxRadius;
          const isMouseWithinLeftRightBound = (mouseXPos > pointXLeftBound && mouseXPos < pointXRightBound);
          const isMouseWithinTopBottomBound = (mouseYPos < pointYBottomBound && mouseYPos > pointYTopBound);
          if (isMouseWithinLeftRightBound && isMouseWithinTopBottomBound){
            self.setHoverPoint(point.id);
            break;
          }
          else{
            self.setHoverPoint("");
          }
        }
      }
    },
  }));

export interface NumberlineContentModelType extends Instance<typeof NumberlineContentModel> {}
