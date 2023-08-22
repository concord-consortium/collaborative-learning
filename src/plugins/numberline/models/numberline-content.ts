import { types, Instance, getSnapshot } from "mobx-state-tree";
import { TileContentModel } from "../../../models/tiles/tile-content";
import { uniqueId } from "../../../utilities/js-utils";
import { kNumberlineTileType, numberlineDomainMax, numberlineDomainMin } from "../numberline-tile-constants";
import { scaleLinear } from "d3";

export function defaultNumberlineContent(): NumberlineContentModelType {
  return NumberlineContentModel.create({});
}

export interface IPointCoordinate {
  xValue: number, //actual x value from the numberline not raw x position
}

export const PointObjectModel = types
  .model("PointObject", {
    id: types.identifier,
    // pointCoordinates: types.literal(Ipoint)
    pointCoordinates: types.optional(types.frozen<IPointCoordinate>(), {
      xValue: 0,
    })
  })
  .volatile(self => ({
    isHovered: false,
    isSelected: false,
  }))
  .actions(self => ({
    setIsHovered(state: boolean){
      self.isHovered = state;
    },
    setIsSelected(state: boolean){
      self.isSelected = state;
    }
  }));


export interface PointObjectModelType extends Instance<typeof PointObjectModel> {}

export const NumberlineContentModel = TileContentModel
  .named("NumberlineTool")
  .props({
    type: types.optional(types.literal(kNumberlineTileType), kNumberlineTileType),
    points: types.map(PointObjectModel),
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    get axisPoints() { //returns array of all points
      return Array.from(self.points.values()).map((pointObj) => pointObj);
    },
    get hasPoints(){
      return (self.points.size > 0);
    },

    get pointsXValuesArr(){
      return Array.from(self.points.values()).map((pointObj) => pointObj.pointCoordinates.xValue);
    },
    get pointsIsHoveredArr(){
      return Array.from(self.points.values()).map((pointObj) => pointObj.isHovered);
    },
    get pointsIsSelectedArr(){
      return Array.from(self.points.values()).map((pointObj) => pointObj.isSelected);
    },
  }))
  .views(self =>({
     //Pass snapshot of axisPoint models into outer/inner points to avoid D3 and MST error
    get axisPointsSnapshot(){
      return self.axisPoints.map((p)=> ({
                                          isHovered: p.isHovered,
                                          isSelected: p.isSelected,
                                          ...getSnapshot(p) //doesn't capture the volatile properties
                                        }));
    },
    get isHoveringOverPoint(){
      return !(self.pointsIsHoveredArr.filter(Boolean).length === 0);
    },
    get indexOfPointHovered(){
      return self.pointsIsHoveredArr.findIndex((isHovered) => isHovered === true);
    }
  }))
  .actions(self => ({
    setAllSelectedFalse(){
      self.points.forEach((point)=>{
        point.isSelected = false;
      });
    },
    setAllHoversFalse(){
      self.points.forEach((point)=>{
        point.isHovered = false;
      });
    },
    clearAllPoints(){
      self.points.clear();
    },

    pointById(id: string){
      return self.points.get(id);
    },

    isDraggingUseIdReplacePointCoordinates(oldPoint: PointObjectModelType, newPointCoordinates: IPointCoordinate){
      //searches "points", removes PointObject at index that matches id
      //replaces it with a new PointObject at index that has newPointCoordinates
      self.axisPoints.forEach((pointObj, i) => {
        if (pointObj.id === oldPoint.id){
          const newPointObj = PointObjectModel.create({
            id: oldPoint.id,
            pointCoordinates: newPointCoordinates,
          });
          newPointObj.setIsHovered(oldPoint.isHovered);
          newPointObj.setIsSelected(oldPoint.isSelected);
          self.points.set(newPointObj.id, newPointObj);
        }
      });
    },
    replaceAllPoints(newPoints: PointObjectModelType[]){
      self.points.replace(newPoints);
    },
    isMouseHoverOverPoint(mouseXPos: number, axisWidth: number ){
      if (self.hasPoints){
        const xScale = scaleLinear()
          .domain([numberlineDomainMin, numberlineDomainMax])
          .range([0, axisWidth]);

        self.pointsXValuesArr.forEach((pointXValue: number, idx)=>{
          const pointXPos = xScale(pointXValue);
          const pointXLeftBound = pointXPos - 5;
          const pointXRightBound = pointXPos + 5;
          if (mouseXPos > pointXLeftBound && mouseXPos < pointXRightBound){
            if (self.pointsIsHoveredArr.filter(Boolean).length === 0){
              self.axisPoints[idx].isHovered = true; //only one is true
            }
          }
          else{
            self.axisPoints[idx].isHovered = false;
          }
        });
      }
    },
  }))
  .actions(self => ({
    createNewPoint(newPoint: IPointCoordinate){
      const id = uniqueId();
      const pointModel = PointObjectModel
                        .create({
                          id,
                          pointCoordinates: newPoint
                        });

      self.points.set(id, pointModel);
    },

    toggleIsSelected(idx: number){
      self.setAllSelectedFalse();
      self.axisPoints[idx].isSelected = true;
    },
  }));

export interface NumberlineContentModelType extends Instance<typeof NumberlineContentModel> {}
