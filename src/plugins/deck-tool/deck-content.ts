import { types, Instance } from "mobx-state-tree";
import { ToolContentModel, ToolMetadataModelType, toolContentModelHooks } from "../../models/tools/tool-types";
import { kDeckToolID } from "./deck-types";
import { ITileExportOptions } from "../../models/tools/tool-content-info";
import { setTileTitleFromContent } from "../../models/tools/tool-tile";
import { DataSet } from "../../models/data/data-set";

export function defaultDeckContent(): DeckContentModelType {
  return DeckContentModel.create({deckDescription: "description..."});
}

export const DeckContentModel = ToolContentModel
  .named("DeckTool")
  .props({
    type: types.optional(types.literal(kDeckToolID), kDeckToolID),
    deckDescription: "",
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
      return self.dataSet.getCanonicalCaseAtIndex(index)
    },
    allCases(){
      return self.dataSet.getCanonicalCasesAtIndices(0, self.dataSet.cases.length)
    },
    exportJson(options?: ITileExportOptions){
      return [
        `{`,
        `  "type": "Deck",`,
        `  "deckDescription": "${self.deckDescription}"`,
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
      if (!self.dataSet.name){
        self.dataSet.setName("My Moth Collection");
        self.dataSet.addAttributeWithID({
          id: "mothName",
          name: "Moth Name"
        });
        self.dataSet.addAttributeWithID({
          id: "sciName",
          name: "Scientific Name"
        });
        self.dataSet.addAttributeWithID({
          id: "captureDate",
          name: "Capture Date"
        });
        self.dataSet.addCanonicalCasesWithIDs([
          // case ids are always __id__, attribute ids ar id
          { __id__: "mottledGray", mothName: "Mottled Gray", sciName: "Cladara limitaria", captureDate: "9/3/21" },
          { __id__: "sweaterMoth", mothName: "Sweater Moth", sciName: "Closeta Habituas", captureDate: "9/3/21" },
          { __id__: "pizzaMoth", mothName: "Pizza Moth", sciName: "Cladara Tomatus", captureDate: "9/3/21" }
        ]);
        console.log('Created: ', self.dataSet.cases)
      }
    },
    setDescription(text: string) {
      self.deckDescription = text;
    },
    setTitle(title: string) {
      setTileTitleFromContent(self, title);
    }
  }));

export interface DeckContentModelType extends Instance<typeof DeckContentModel> {}
