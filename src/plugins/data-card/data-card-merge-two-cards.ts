import { DataCardContentModelType } from "./data-card-content";

export const dataCardMergeTwoCards = (draggedTile: any, droppedTile: DataCardContentModelType,
                                      addNewCase: () => void) => {
  const dataSetOfDraggedTile = draggedTile.dataSet;
  const attrNamesDraggedTile = dataSetOfDraggedTile.attributes.map((attrObj: any) => {
    return attrObj.name;
  });
  const attrNamesDroppedTile = droppedTile.existingAttributesWithNames().map((attrObj: any) => {
    return attrObj.attrName;
  });

  //search for duplicates between draggedTile & droppedTile - only add names of unique attr
  attrNamesDraggedTile.forEach((attrNameDrag: any) => {
    let foundAttrFlag = false;
    attrNamesDroppedTile.forEach((attrNameDrop: any) => {
      if (attrNameDrag === attrNameDrop){
        foundAttrFlag = true;
      }
    });
    if (!foundAttrFlag){
      droppedTile.addNewAttr(); //add names
      const attrIds = droppedTile.existingAttributes();
      const lastIndex = attrIds.length - 1;
      const newAttrId = attrIds[lastIndex];
      droppedTile.setAttName(newAttrId, attrNameDrag);
    } //else don't add
  });
  //Add data cards (case) from draggedTile
  dataSetOfDraggedTile.cases.forEach((card: any) => {
    addNewCase(); //add # of cases (cards)
  });

  const numCasesDraggedTile = dataSetOfDraggedTile.cases.length;
  const allCasesDroppedTile = droppedTile.allCases();
  const startIndexDroppedTile = allCasesDroppedTile.length - numCasesDraggedTile;
  let startIndexDraggedTile = 0;

  const attrOfDraggedTile = dataSetOfDraggedTile.attributes; //name id + others
  const attrOfDroppedTile = droppedTile.existingAttributesWithNames();//this holds both name and Id

  //insert all values
  for (let i = startIndexDroppedTile; i < allCasesDroppedTile.length; i++){ //start at cards that were added
    const caseId = allCasesDroppedTile[i]?.__id__;
    attrOfDroppedTile.forEach((attrDrop) => {
      attrOfDraggedTile.forEach((attrDrag: any, idx: number) => {
        if (attrDrop.attrName === attrDrag.name){
          const val = attrDrag.values[startIndexDraggedTile];
          if (caseId){
            droppedTile.setAttValue(caseId, attrDrop.attrId, val);
          }
        }
      });
    });
    startIndexDraggedTile ++;
  }
};


