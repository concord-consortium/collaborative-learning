import { types, Instance } from "mobx-state-tree";
import { ToolContentModel, ToolMetadataModelType, toolContentModelHooks } from "../../models/tools/tool-types";
import { kDeckToolID } from "./deck-types";
import { ITileExportOptions } from "../../models/tools/tool-content-info";
import { setTileTitleFromContent } from "../../models/tools/tool-tile";
import { DataSet } from "../../models/data/data-set";
import { v4 as uuid } from "uuid";

export function defaultDeckContent(): DeckContentModelType {
  return DeckContentModel.create();
}

export const DeckContentModel = ToolContentModel
  .named("DeckTool")
  .props({
    type: types.optional(types.literal(kDeckToolID), kDeckToolID),
    //deckDescription: "",
    dataSet: types.optional(DataSet, () => DataSet.create())
  })
  .volatile(self => ({
    metadata: undefined as any as ToolMetadataModelType
  }))
  .views(self => ({
    get title() {
      return self.metadata.title;
    },
    get isUserResizable() {
      return true;
    },
    get dataSetName(){
      return self.dataSet.name;
    },
    get attributes(){
      console.log(self.dataSet.attributes)
      return self.dataSet.attributes;
    },
    caseByIndex(index:number){
      return self.dataSet.getCanonicalCaseAtIndex(index);
    },
    // hasCases(){
    //   return
    // },
    allCases(){
      return self.dataSet.getCanonicalCasesAtIndices(0, self.dataSet.cases.length);
      // const allCasesArr = self.dataSet.getCanonicalCasesAtIndices(0, self.dataSet.cases.length);
      // if (allCasesArr.length > 0 ){
      //   return self.dataSet.getCanonicalCasesAtIndices(0, self.dataSet.cases.length);
      // }
    },
    existingAttributes(){
      return self.dataSet.attributes.map((a) => {
        return { "attrName": a.name, "attrId": a.id };
      });
    },
    attrById(str: string){
      return self.dataSet.attrFromID(str);
    },
    exportJson(options?: ITileExportOptions){
      return [
        `{`,
        `  "type": "Deck",`,
        `  "dataSet.name": "${self.dataSet.name}"`,
        `}`
      ].join("\n");
    }
  }))
  .actions(self => toolContentModelHooks({
    doPostCreate(metadata: ToolMetadataModelType){
      self.metadata = metadata;
    }
  }))
  .actions(self => ({
    afterCreate(){
      if(self.dataSet.name){
        console.log("LETS DELETE THINGS")
      }
      if (!self.dataSet.name){
        this.createEmptyDataSetAndAddCase();

        // const firstCaseId = uuid();
        // const firstAttrId = uuid();

        // self.dataSet.setName("Data Card Collection");
        // self.dataSet.addAttributeWithID({
        //   id: firstAttrId,
        //   name: "Label1"
        // });

        // self.dataSet.addCanonicalCasesWithIDs([
        //   { __id__: firstCaseId, [firstAttrId]: "" },
        // ]);
      }
      if(self.dataSet.name && self.dataSet.cases.length < 1){
        this.setEmptyCaseOnExistingDataSet();

        // const firstCaseId = uuid();
        // const firstAttrId = uuid();

        // self.dataSet.addCanonicalCasesWithIDs([
        //   { __id__: firstCaseId, [firstAttrId]: "" },
        // ]);
      }
    },
    createEmptyDataSetAndAddCase(){
      const firstCaseId = uuid();
      const firstAttrId = uuid();

      self.dataSet.setName("Data Card Collection");
      self.dataSet.addAttributeWithID({
        id: firstAttrId,
        name: "Label1"
      });

      self.dataSet.addCanonicalCasesWithIDs([
        { __id__: firstCaseId, [firstAttrId]: "" },
      ]);
    },
    setEmptyCaseOnExistingDataSet(){
      const firstCaseId = uuid();
      const firstAttrId = uuid();

      self.dataSet.addCanonicalCasesWithIDs([
        { __id__: firstCaseId, [firstAttrId]: "" },
      ]);
    },
    // setDescription(text: string) {
    //   self.deckDescription = text;
    // },
    setTitle(title: string) {
      setTileTitleFromContent(self, title);
    },
    setAttName(attrId: string, name: string){
     self.dataSet.setAttributeName(attrId, name);
    },
    setAttValue(caseId: string, attrId: string, val: string){
      self.dataSet.setCanonicalCaseValues([
        { __id__: caseId, [attrId]: val }
      ]);
    }
  }));

export interface DeckContentModelType extends Instance<typeof DeckContentModel> {}
