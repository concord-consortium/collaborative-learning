import { kDefaultLabel } from "../../plugins/data-card/data-card-types";
import { IDataSet, addAttributeToDataSet, addCasesToDataSet } from "../../models/data/data-set";


//used by data-card-tile.tsx when dragging one tile onto another
export const mergeTwoDataSets = ( dataSetOfDraggedTile: IDataSet, dataSetOfDroppedTile: IDataSet ) => {

  // search for duplicates between attr of draggedTile & droppedTile - only add names of unique attr
  const attrNamesDraggedTile = dataSetOfDraggedTile.attributes.map((attrObj: any) => attrObj.name);
  const attrNamesDroppedTile = Object.keys(dataSetOfDroppedTile.attrNameMap);

  attrNamesDraggedTile.forEach((attrNameDrag: any) => {
    let foundAttrFlag = false;
    attrNamesDroppedTile.forEach((attrNameDrop: any) => {
      if (attrNameDrag === attrNameDrop){
        foundAttrFlag = true;
      }
    });
    if (!foundAttrFlag){
      addAttributeToDataSet(dataSetOfDroppedTile, { name: `${attrNameDrag}` });
    } //else don't add
  });


  //Add data cards (case) from draggedTile
  dataSetOfDraggedTile.cases.forEach((card: any) => {
    addCasesToDataSet(dataSetOfDroppedTile, [{ [kDefaultLabel]: "" }]);
  });

  //iterate through the cards added and insert values attribute names match
  const numCasesDraggedTile = dataSetOfDraggedTile.cases.length;
  const attrIdsDroppedTile = Object.keys(dataSetOfDroppedTile.caseIDMap);
  const allCasesDroppedTile = dataSetOfDroppedTile.getCases(attrIdsDroppedTile);
  const startIndexDroppedTile = allCasesDroppedTile.length - numCasesDraggedTile;
  let startIndexDraggedTile = 0;
  const attrOfDroppedTile = dataSetOfDroppedTile.attributes;
  const attrOfDraggedTile = dataSetOfDraggedTile.attributes;

  // //insert all values
  for (let i = startIndexDroppedTile; i < allCasesDroppedTile.length; i++){ //start at cards that were added
    const caseId = allCasesDroppedTile[i]?.__id__;
    console.log("caseID:", caseId);
    attrOfDroppedTile.forEach((attrDrop) => {
      attrOfDraggedTile.forEach((attrDrag: any, idx: number) => {
        if (attrDrop.name === attrDrag.name){
          const val = attrDrag.values[startIndexDraggedTile];
          if (caseId){
            dataSetOfDroppedTile.setCanonicalCaseValues([
              { __id__: caseId, [attrDrop.id]: val }
            ]);
          }
        }
      });
    });
    startIndexDraggedTile ++;
  }
};


