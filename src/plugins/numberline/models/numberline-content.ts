import { types, Instance } from "mobx-state-tree";
import { TileContentModel } from "../../../models/tiles/tile-content";
import { PointCoordinateType, kNumberlineTileType } from "../types/numberline-types";
import { uniqueId } from "../../../utilities/js-utils";

export function defaultNumberlineContent(): NumberlineContentModelType {
  return NumberlineContentModel.create({});
}

const PointObjectModel = types.model("PointObject", {
  id: types.identifier,
  pointCoordinates: types.optional(types.frozen<PointCoordinateType>(), {
    xPos: 0,
    val: 0,
    axisWidth: 0,
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
    get pointsXPositionsArr(){
      return self.points.map((pointObj) => pointObj.pointCoordinates.xPos);
    },
    get pointsIsHoveredArr(){
      return self.points.map((pointObj) => pointObj.isHovered);
    },

    get pointsIsSelectedArr(){
      return self.points.map((pointObj) => pointObj.isSelected);
    },
  }))
  .views(self =>({
    get hasPointHovered(){
      return !(self.pointsIsHoveredArr.filter(Boolean).length === 0);
    },
    get hasPointSelected(){
      return !(self.pointsIsSelectedArr.filter(Boolean).length === 0);
    },
    get indexOfPointHovered(){
      return self.pointsIsHoveredArr.findIndex((isHovered) =>  isHovered === true);
    }
  }))
  .actions(self => ({
    toggleIsSelected(index: number){
      self.points[index].isSelected = !self.points[index].isSelected;
    },
    clearAllPoints(){
      self.points.clear();
    },
    givenIdReplacePointCoordinates(id: string, newPointCoordinates: PointCoordinateType){
      //searches "points", removes PointObject at index that matches id
      //replaces it with a new PointObject at index that has newPointCoordinates
      self.points.forEach((pointObj, i) => {
        console.log("pointObj.id", pointObj.id);
        if (pointObj.id === id){
          const newPointObj: PointObjectModelType = {
            id,
            pointCoordinates: newPointCoordinates,
            isHovered: false,
            isSelected: false,
          };
          self.points.splice(i, 1, newPointObj);
        }
      });
    },
    replaceAllPoints(newPoints: PointObjectModelType[]){
      self.points.replace(newPoints);
    },
    mouseOverPoint(mousePosX: number){
      if (self.hasPoints){
        self.pointsXPositionsArr.forEach((pointXPos, idx)=>{
          const leftBound = pointXPos - 3;
          const rightBound = pointXPos + 3;
          if (mousePosX > leftBound && mousePosX < rightBound){
            // console.log("Hovering over point!");
            if (self.pointsIsHoveredArr.filter(Boolean).length === 0){
              self.points[idx].isHovered = true; //only one is true
            }
          }
          else{
            // console.log("NOT Hovering over point");
            self.points[idx].isHovered = false;
          }
        });
      }
    },


  }))
  .actions(self => ({
    createNewPoint(newPoint: PointCoordinateType){
      if (self.hasPointHovered){
        console.log("create new point where we already have a hover!");
        const index = self.indexOfPointHovered;
         //turn off hover for index
        //turn on isSelected
        self.points[index].isHovered = false;
        self.toggleIsSelected(index);
      } else {
        const id = uniqueId();
        const pointModel = PointObjectModel.create({ id, pointCoordinates: newPoint,
                                                  isHovered: false, isSelected: false });
        self.points.push(pointModel);
      }
    },
  }));

export interface NumberlineContentModelType extends Instance<typeof NumberlineContentModel> {}
