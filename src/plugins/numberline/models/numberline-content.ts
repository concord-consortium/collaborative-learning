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
  isHovered: false, //isHovered and isSelected should be volatile because they dont need to persist after refresh
  isSelected: false,
});

//MST ERROR: look at isAlive
//https://github.com/mobxjs/mobx-state-tree/issues/791

export interface PointObjectModelType extends Instance<typeof PointObjectModel> {}

export const NumberlineContentModel = TileContentModel
  .named("NumberlineTool")
  .props({
    type: types.optional(types.literal(kNumberlineTileType), kNumberlineTileType),
    points: types.map(PointObjectModel),//new
    // points: types.array(PointObjectModel), //old

  })
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    get axisPoints() {
      // return self.points; //old
      return Array.from(self.points.values()).map((pointObj) => pointObj); //new
    },
    get hasPoints(){
      return (self.points.size > 0); //new
      // return (self.points.length > 0); //old
    },

    get pointsXValuesArr(){
      return Array.from(self.points.values()).map((pointObj) => pointObj.pointCoordinates.xValue); //new
      // return self.points.map((pointObj) => pointObj.pointCoordinates.xValue); //old
    },
    get pointsIsHoveredArr(){
      return Array.from(self.points.values()).map((pointObj) => pointObj.isHovered); //new
      // return self.points.map((pointObj) => pointObj.isHovered); //old

    },
    get pointsIsSelectedArr(){
      return Array.from(self.points.values()).map((pointObj) => pointObj.isSelected); //new
      // return self.points.map((pointObj) => pointObj.isSelected); //old

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

    pointById(id: string){
      return self.points.get(id);//new
      //old comment out everything
    },

    isDraggingUseIdReplacePointCoordinates(oldPoint: PointObjectModelType, newPointCoordinates: PointCoordinateType){
      //searches "points", removes PointObject at index that matches id
      //replaces it with a new PointObject at index that has newPointCoordinates
      self.axisPoints.forEach((pointObj, i) => {
        if (pointObj.id === oldPoint.id){
          const newPointObj: PointObjectModelType = {
            id: oldPoint.id,
            pointCoordinates: newPointCoordinates,
            isHovered: oldPoint.isHovered,
            isSelected: oldPoint.isSelected,
          };

          self.points.set(newPointObj.id, newPointObj); //new
          // self.axisPoints.splice(i, 1, newPointObj);
        }
      });
      console.log("isDraggingUseIdReplacePointcoordinates");
    },
    replaceAllPoints(newPoints: PointObjectModelType[]){
      self.points.replace(newPoints);
    },
    isMouseHoverOverPoint(mouseXPos: number, axisWidth: number ){
      if (self.hasPoints){
        const xScale = scaleLinear()
          .domain([numberlineDomainMin, numberlineDomainMax])
          .range([0, axisWidth]);

          console.log("isMouseHoverOverPoint");
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
    createNewPoint(newPoint: PointCoordinateType){
      const id = uniqueId();
      const pointModel = PointObjectModel.create({ id, pointCoordinates: newPoint,
                                                isHovered: false, isSelected: false });

      self.points.set(id, pointModel); //new
      // self.points.push(pointModel); //old

      console.log("self.points map after creation:", self.axisPoints);
    },

    toggleIsSelected(idx: number){
      self.setAllSelectedFalse();
      console.log("toggleIsSelected");

      self.axisPoints[idx].isSelected = true;
    },
  }));

export interface NumberlineContentModelType extends Instance<typeof NumberlineContentModel> {}
