import { types, Instance } from "mobx-state-tree";
import { uniqueId, uniqueTitle } from "../../utilities/js-utils";
import { ToolContentModel, ToolMetadataModelType, toolContentModelHooks } from "../../models/tools/tool-types";
import { kDataCardToolID, kDefaultLabel, kDefaultLabelPrefix } from "./data-card-types";
import { IDefaultContentOptions, ITileExportOptions } from "../../models/tools/tool-content-info";
import { getToolTileModel, setTileTitleFromContent } from "../../models/tools/tool-tile";
import {
  addAttributeToDataSet, addCanonicalCasesToDataSet, addCasesToDataSet, DataSet
} from "../../models/data/data-set";

export function defaultDataCardContent(props?: IDefaultContentOptions): DataCardContentModelType {
  // as per slack discussion, default attribute is added automatically
  const dataSet = DataSet.create();
  addAttributeToDataSet(dataSet, { name: kDefaultLabel });
  addCasesToDataSet(dataSet, [{ [kDefaultLabel]: "" }]);
  return DataCardContentModel.create({ dataSet });
}

export const DataCardContentModel = ToolContentModel
  .named("DataCardTool")
  .props({
    type: types.optional(types.literal(kDataCardToolID), kDataCardToolID),
    dataSet: types.optional(DataSet, () => DataSet.create())
  })
  .volatile(self => ({
    metadata: undefined as any as ToolMetadataModelType
  }))
  .views(self => ({
    get title(): string | undefined {
      return getToolTileModel(self)?.title;
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
    get totalCases(){
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
        `  "type": "DataCard",`,
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
      self.dataSet.addAttributeWithID({
        id: uniqueId(),
        name: uniqueTitle(kDefaultLabelPrefix, name => !self.dataSet.attrFromName(name))
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

export interface DataCardContentModelType extends Instance<typeof DataCardContentModel> {}
