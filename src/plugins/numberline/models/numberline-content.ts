import { types, Instance, getSnapshot } from "mobx-state-tree";
import { TileContentModel } from "../../../models/tiles/tile-content";
import { uniqueId } from "../../../utilities/js-utils";
import { createXScale, kNumberlineTileType, numberlineXHoverBound } from "../numberline-tile-constants";

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
    // isHovered: false,
    // isSelected: false,
  }))
  .views(self =>({
    get currentXValue(){
      return self.dragXValue || self.xValue;
    }
  }))
  .actions(self => ({
    setDragXValue(num: number | undefined){
      self.dragXValue = num;
    },
    setXValueToDragValue(){ //when mouse is let go
      if (self.dragXValue){
        self.xValue = self.dragXValue;
        self.dragXValue = undefined;
      }
    }

    // setIsHovered(state: boolean){
    //   self.isHovered = state;
    // },
    // setIsSelected(state: boolean){
    //   self.isSelected = state;
    // }
  }));


export interface PointObjectModelType extends Instance<typeof PointObjectModel> {}

export const NumberlineContentModel = TileContentModel
  .named("NumberlineTool")
  .props({
    type: types.optional(types.literal(kNumberlineTileType), kNumberlineTileType),
    points: types.map(PointObjectModel),
  })
  .volatile(self => ({
    selectedPoints: "", //maybe change this to a map or array
    hoveredPoint: ""
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
    // get hoveredPoint(){
    //   return self.hoveredPoint;
    // }
  }))
  .views(self =>({
    get pointsXValuesArr(){
      return self.pointsArr.map((pointObj) => pointObj.xValue);
    },

    // get pointsIsHoveredArr(){
    //   console.log("pointsIsHoveredArr:");
    //   console.log("returns:", self.axisPoints.map((pointObj) => pointObj.isHovered));
    //   return self.axisPoints.map((pointObj) => pointObj.isHovered);
    // },

  }))
  .views(self =>({
     //Pass snapshot of axisPoint models into outer/inner points to avoid D3 and MST error
    get axisPointsSnapshot(){

      return self.pointsArr.map((p)=> ({
                                          // isHovered: p.isHovered,
                                          // isSelected: p.isSelected,
                                          ...getSnapshot(p) //doesn't capture the volatile properties
                                        }));
    },
    get isHoveringOverPoint(){
      return false; //new
      // return !(self.pointsIsHoveredArr.filter(Boolean).length === 0); //old
    },
    get indexOfPointHovered(){
      return 1;
      // return self.pointsIsHoveredArr.findIndex((isHovered) => isHovered === true);
    }
  }))
  .actions(self => ({
    // setAllSelectedFalse(){
    //   self.points.forEach((point)=>{
    //     point.isSelected = false;
    //   });
    // },
    // setAllHoversFalse(){
    //   self.points.forEach((point)=>{
    //     point.isHovered = false;
    //   });
    // },
    createNewPoint(xValueClicked: number){
      const id = uniqueId();
      const pointModel = PointObjectModel
                        .create({
                          id,
                          xValue: xValueClicked
                        });
      self.points.set(id, pointModel);
    },

    setHoverPoint(id: string){ //id can also be empty string
      self.hoveredPoint = id;
    },

    clearAllPoints(){
      self.points.clear();
    },

    pointById(id: string){
      return self.points.get(id);
    },

    isDraggingUseIdReplacePointCoordinates(oldPoint: PointObjectModelType, newPointCoordinates: PointObjectModelType){
      //searches "points", removes PointObject at index that matches id
      //replaces it with a new PointObject at index that has newPointCoordinates
      // self.axisPoints.forEach((pointObj, i) => {
        // if (pointObj.id === oldPoint.id){
        //   const newPointObj = PointObjectModel.create({
        //     id: oldPoint.id,
        //     xValue: newPointCoordinates,
        //   });
        //   newPointObj.setIsHovered(oldPoint.isHovered);
        //   newPointObj.setIsSelected(oldPoint.isSelected);
        //   self.points.set(newPointObj.id, newPointObj);
        // }
      // });
    },
    replaceAllPoints(newPoints: PointObjectModelType[]){
      self.points.replace(newPoints);
    },

  }))
  .actions(self => ({
    analyzeXPosCreateHoverPoint(mouseXPos: number, axisWidth: number ){
      if (self.hasPoints){
        const xScale = createXScale(axisWidth);
        const pointsArr = self.pointsArr;
        for (let i = 0; i< pointsArr.length; i++){
          const point = pointsArr[i];
          const pointXPos = xScale(point.xValue);
          const pointXLeftBound = pointXPos - numberlineXHoverBound;
          const pointXRightBound = pointXPos + numberlineXHoverBound;
          console.log("\tpointXPos:", pointXPos);
          console.log("\tpointXLeftbound:", pointXLeftBound);
          console.log("\tpointXRightbound:", pointXRightBound);
          if (mouseXPos > pointXLeftBound && mouseXPos < pointXRightBound){
            self.setHoverPoint(point.id);
            break;
          }
          else{
            self.setHoverPoint("");
          }


        }
        // self.pointsArr.forEach((point: PointObjectModelType, idx)=>{
        //   console.log(`------for each idx: ${idx}---------with xValue ${point.xValue}-------`);
        //   const pointXPos = xScale(point.xValue);
        //   const pointXLeftBound = pointXPos - numberlineXHoverBound;
        //   const pointXRightBound = pointXPos + numberlineXHoverBound;
        //   console.log("\tpointXPos:", pointXPos);
        //   console.log("\tpointXLeftbound:", pointXLeftBound);
        //   console.log("\tpointXRightbound:", pointXRightBound);


        //   if (mouseXPos > pointXLeftBound && mouseXPos < pointXRightBound){
        //     self.setHoverPoint(point.id);
        //   }
        //   else{
        //     self.setHoverPoint("");
        //     // self.pointsArr[idx].isHovered = false;
        //   }
        // });
      }
    },

    toggleIsSelected(idx: number){
      // self.setAllSelectedFalse();
      // self.axisPoints[idx].isSelected = true;
    },
  }));

export interface NumberlineContentModelType extends Instance<typeof NumberlineContentModel> {}
