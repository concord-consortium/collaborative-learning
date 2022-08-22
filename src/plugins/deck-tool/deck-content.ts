import { types, Instance } from "mobx-state-tree";
import { uniqueId } from "../../utilities/js-utils";
import { ToolContentModel, ToolMetadataModelType, toolContentModelHooks } from "../../models/tools/tool-types";
import { kDeckToolID } from "./deck-types";
import { ITileExportOptions } from "../../models/tools/tool-content-info";
import { setTileTitleFromContent } from "../../models/tools/tool-tile";
import { DataSet, addCanonicalCasesToDataSet } from "../../models/data/data-set";

export function defaultDeckContent(): DeckContentModelType {
  return DeckContentModel.create();
}

export const DeckContentModel = ToolContentModel
  .named("DeckTool")
  .props({
    type: types.optional(types.literal(kDeckToolID), kDeckToolID),
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
      return self.dataSet.attributes;
    },
    caseByIndex(index:number){
      return self.dataSet.getCanonicalCaseAtIndex(index);
    },
    totalCases(){
      return self.dataSet.cases.length;
    },
    allCases(){
      return self.dataSet.getCanonicalCasesAtIndices(0, self.dataSet.cases.length);
    },
    allCasesJsonString(){
      const obj = this.allCases();
      const str = JSON.stringify(obj);
      return str;
    },
    allAttributesJsonString(){
      const obj = self.dataSet.attributes;
      const str = JSON.stringify(obj);
      return str;
    },
    existingAttributesWithNames(){
      return self.dataSet.attributes.map((a) => {
        return { "attrName": a.name, "attrId": a.id };
      });
    },
    existingAttributes(){
      return self.dataSet.attributes.map((a) => {
        return a.id;
      });
    },
    attrById(str: string){
      return self.dataSet.attrFromID(str);
    },
    exportJson(options?: ITileExportOptions){
      this.allAttributesJsonString();
      return [
        `{`,
        `  "type": "Deck",`,
        `  "dataSet.name": "${self.dataSet.name}"`,
        `  "dataSet.attributes": "${this.allAttributesJsonString()}`,
        `  "dataSet.allCases": "${this.allCasesJsonString()}"`,
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
      if (!self.dataSet.name){
        self.dataSet.setName("Data Card Collection");
        const firstAttrId = uniqueId();
        self.dataSet.addAttributeWithID({
          id: firstAttrId,
          name: ""
        });
        addCanonicalCasesToDataSet(self.dataSet, [{ [firstAttrId]: "" }]);
      }
    },
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
    },
    addNewCaseFromAttrKeys(atts: string[]){
      const obj = atts.reduce((o, key) => Object.assign(o, {[key]: ""}), {});
      addCanonicalCasesToDataSet(self.dataSet, [obj]);
    },
    addNewAttr(){
      const newAttrId = uniqueId();
      self.dataSet.addAttributeWithID({
        id: newAttrId,
        name: ""
      });

      const casesArr = self.allCases().map(c => c?.__id__);
      const attrsArr = self.existingAttributes();

      casesArr.forEach((caseId) => {
        if (caseId){
          attrsArr.forEach((attr) => {
            const notSet = self.dataSet.getValue(caseId, attr) === undefined;
            if (notSet){
              this.setAttValue(caseId, attr, "");
            }
          });
        }
      });
    }
  }));

export interface DeckContentModelType extends Instance<typeof DeckContentModel> {}
