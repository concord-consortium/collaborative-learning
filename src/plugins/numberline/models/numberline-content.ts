import { types, Instance } from "mobx-state-tree";
import { TileContentModel } from "../../../models/tiles/tile-content";
import { uniqueId } from "../../../utilities/js-utils";
import { kNumberlineTileType, numberlineDomainMax, numberlineDomainMin } from "../numberline-tile-constants";
import { scaleLinear } from "d3";

export function defaultNumberlineContent(): NumberlineContentModelType {
  return NumberlineContentModel.create({});
}

export interface PointCoordinateType {
  xValue: number, //actual x value from the numberline not raw x position
}

export const PointObjectModel = types.model("PointObject", {
  id: types.identifier,
  pointCoordinates: types.optional(types.frozen<PointCoordinateType>(), {
    xValue: 0,
  }),
  isHovered: false,
  isSelected: false,
});

export interface PointObjectModelType extends Instance<typeof PointObjectModel> {}

export const NumberlineContentModel = TileContentModel
  .named("NumberlineTool")
  .props({
    type: types.optional(types.literal(kNumberlineTileType), kNumberlineTileType),
    points: types.array(PointObjectModel),
  })
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    get axisPoints() {
      return self.points;
    },
    get hasPoints(){
      return (self.points.length > 0);
    },
    get pointsXValuesArr(){
      return self.points.map((pointObj) => pointObj.pointCoordinates.xValue);
    },
    get pointsIsHoveredArr(){
      return self.points.map((pointObj) => pointObj.isHovered);
    },
    get pointsIsSelectedArr(){
      return self.points.map((pointObj) => pointObj.isSelected);
    },
  }))
  .views(self =>({
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
    isDraggingUseIdReplacePointCoordinates(oldPoint: PointObjectModelType, newPointCoordinates: PointCoordinateType){
      //searches "points", removes PointObject at index that matches id
      //replaces it with a new PointObject at index that has newPointCoordinates
      self.points.forEach((pointObj, i) => {
        if (pointObj.id === oldPoint.id){
          const newPointObj: PointObjectModelType = {
            id: oldPoint.id,
            pointCoordinates: newPointCoordinates,
            isHovered: oldPoint.isHovered,
            isSelected: oldPoint.isSelected,
          };
          self.points.splice(i, 1, newPointObj);
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
              self.points[idx].isHovered = true; //only one is true
            }
          }
          else{
            self.points[idx].isHovered = false;
          }
        });
      }
    },
  }))
  .actions(self => ({
    createNewPoint(newPoint: PointCoordinateType){
      const id = uniqueId();
      const pointModel = PointObjectModel.create({ id, pointCoordinates: newPoint,
                                                isHovered: false, isSelected: false }); //old

      self.points.push(pointModel);
    },
    toggleIsSelected(idx: number){
      self.setAllSelectedFalse();
      self.points[idx].isSelected = true;
    },
  }));

export interface NumberlineContentModelType extends Instance<typeof NumberlineContentModel> {}
