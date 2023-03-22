import { reaction } from "mobx";
import { addDisposer, getType, Instance, types } from "mobx-state-tree";
import { kDataCardTileType, kDefaultLabel, kDefaultLabelPrefix } from "./data-card-types";
import { withoutUndo } from "../../models/history/without-undo";
import { IDefaultContentOptions, ITileExportOptions } from "../../models/tiles/tile-content-info";
import { ITileMetadataModel } from "../../models/tiles/tile-metadata";
import { tileModelHooks } from "../../models/tiles/tile-model-hooks";
import { getTileModel, setTileTitleFromContent } from "../../models/tiles/tile-model";
import { TileContentModel } from "../../models/tiles/tile-content";
import {
  addAttributeToDataSet, addCanonicalCasesToDataSet, addCasesToDataSet, DataSet
} from "../../models/data/data-set";
import { kSharedDataSetType, SharedDataSet, SharedDataSetType } from "../../models/shared/shared-data-set";
import { updateSharedDataSetColors } from "../../models/shared/shared-data-set-colors";
import { SharedModelType } from "../../models/shared/shared-model";
import { uniqueId, uniqueTitle } from "../../utilities/js-utils";

export function defaultDataSet() {
  // as per slack discussion, default attribute is added automatically
  const dataSet = DataSet.create();
  addAttributeToDataSet(dataSet, { name: kDefaultLabel });
  addCasesToDataSet(dataSet, [{ [kDefaultLabel]: "" }]);
  return dataSet;
}

export function defaultDataCardContent(props?: IDefaultContentOptions): DataCardContentModelType {
  const content = DataCardContentModel.create();
  props?.title && content.setTitle(props.title);
  return content;
}

export const DataCardContentModel = TileContentModel
  .named("DataCardTool")
  .props({
    type: types.optional(types.literal(kDataCardTileType), kDataCardTileType),
    caseIndex: 0
  })
  .volatile(self => ({
    metadata: undefined as any as ITileMetadataModel,
    // used as fallback when shared model isn't available
    emptyDataSet: DataSet.create()
  }))
  .views(self => ({
    get title(): string | undefined {
      return getTileModel(self)?.title;
    },
    get sharedModel() {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      // Perhaps we should pass the type to getTileSharedModel, so it can return the right value
      // just like findFirstSharedModelByType does
      //
      // For now we are checking the type ourselves, and we are assuming the shared model we want
      // is the first one.
      const firstSharedModel = sharedModelManager?.getTileSharedModels(self)?.[0];
      if (!firstSharedModel || getType(firstSharedModel) !== SharedDataSet) {
        return undefined;
      }
      return firstSharedModel as SharedDataSetType;
    },
    get isUserResizable() {
      return true;
    },
  }))
  .views(self => ({
    get dataSet() {
      return self.sharedModel?.dataSet || self.emptyDataSet;
    },
  }))
  //why seperate them into seperate views() - there are three
  .views(self => ({
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
    isEmptyCase(caseId: string){
      let attributesWithValues = 0;
      this.existingAttributes().forEach((attr) => {
        const value = self.dataSet.getValue(caseId, attr);
        if (value !== "" && value != null) {
          attributesWithValues++;
        }
      });
      return attributesWithValues === 0;
    },
    exportJson(options?: ITileExportOptions){
      return [
        `{`,
        `  "type": "DataCard"`,
        `}`
      ].join("\n");
    }
  }))
  .actions(self => tileModelHooks({
    doPostCreate(metadata: ITileMetadataModel){
      self.metadata = metadata;
    }
  }))
  .actions(self => ({
    afterAttach() {
      // Monitor our parents and update our shared model when we have a document parent
      // ** after this tile gets added to the document, then wait for sharedModelManager to become available
      // after its available, create a dataset, add it to sharedModelManager, then says this tile is using it

      addDisposer(self, reaction(() => {
        const sharedModelManager = self.tileEnv?.sharedModelManager;

        const sharedDataSet = sharedModelManager?.isReady
          ? sharedModelManager?.findFirstSharedModelByType(SharedDataSet, self.metadata.id)
          : undefined;

        const tileSharedModels = sharedModelManager?.isReady
          ? sharedModelManager?.getTileSharedModels(self)
          : undefined;

        return { sharedModelManager, sharedDataSet, tileSharedModels };
      },
      // reaction/effect
      ({sharedModelManager, sharedDataSet, tileSharedModels}) => {
        if (!sharedModelManager?.isReady) {
          // We aren't added to a document yet so we can't do anything yet
          return;
        }

        if (sharedDataSet && tileSharedModels?.includes(sharedDataSet)) {
          // The shared model has already been registered by a client, but as the
          // "owner" of the data, we synchronize it with our local content.
          // if (!self.importedDataSet.isEmpty) {
          //   sharedDataSet.dataSet = DataSet.create(getSnapshot(self.importedDataSet));
          //   self.clearImportedDataSet();
          // }
        }
        else {
          if (!sharedDataSet) {
            // The document doesn't have a shared model yet
            const dataSet = defaultDataSet();
            sharedDataSet = SharedDataSet.create({ providerId: self.metadata.id, dataSet });
          }

          // Add the shared model to both the document and the tile
          sharedModelManager.addTileSharedModel(self, sharedDataSet);
        }

        // update the colors
        const dataSets = sharedModelManager.getSharedModelsByType(kSharedDataSetType) as SharedDataSetType[];
        updateSharedDataSetColors(dataSets);
      },
      {name: "sharedModelSetup", fireImmediately: true}));
    },
    updateAfterSharedModelChanges(sharedModel?: SharedModelType) {
      console.log("data-card-content.ts > updateAfterSharedModelChanges with sharedModel:", sharedModel);
      console.log("data-card-content.ts >  updateAftersharedModelChanges > self.caseIndex:", self.caseIndex,
      "self.totalCases:", self.totalCases);


      if (self.caseIndex >= self.totalCases) {
        this.setCaseIndex(self.totalCases - 1);
      }
    },
    setTitle(title: string) {
      setTileTitleFromContent(self, title);
    },
    setCaseIndex(caseIndex: number) {
      // current case is serialized, but navigation is not undoable
      console.log("data-card-content.ts > setCaseIndex with caseIndex:", caseIndex);
      withoutUndo();
      self.caseIndex = caseIndex;
    },
    setAttName(attrId: string, name: string){
     self.dataSet.setAttributeName(attrId, name);
    },
    setAttValue(caseId: string, attrId: string, val: string){
      console.log("data-card-content.ts > \n\t with caseId:", caseId, "attrId:", attrId, "val:", val);
      self.dataSet.setCanonicalCaseValues([
        { __id__: caseId, [attrId]: val }
      ]);
    },
    addNewCaseFromAttrKeys(atts: string[], beforeId?: string ){
      console.log("data-card-content.ts > addNewCaseFromAttrKeys with atts:", atts);
      const obj = atts.reduce((o, key) => Object.assign(o, {[key]: ""}), {});
      console.log("data-card-content.ts > obj: ", obj);
      if (beforeId){
        addCanonicalCasesToDataSet(self.dataSet, [obj], beforeId);
      } else {
        addCanonicalCasesToDataSet(self.dataSet, [obj]);
      }
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
