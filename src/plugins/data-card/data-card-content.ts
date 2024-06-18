import { reaction } from "mobx";
import { addDisposer, getType, Instance, SnapshotIn, types } from "mobx-state-tree";
import { cloneDeep } from "lodash";

import { kDataCardTileType, kDefaultLabel, kDefaultLabelPrefix } from "./data-card-types";
import { withoutUndo } from "../../models/history/without-undo";
import { IDefaultContentOptions, ITileExportOptions } from "../../models/tiles/tile-content-info";
import { ITileMetadataModel } from "../../models/tiles/tile-metadata";
import { tileContentAPIActions, tileContentAPIViews } from "../../models/tiles/tile-model-hooks";
import { TileContentModel } from "../../models/tiles/tile-content";
import {
  addAttributeToDataSet, addCanonicalCasesToDataSet, addCasesToDataSet, DataSet
} from "../../models/data/data-set";
import {
  kSharedDataSetType, SharedDataSet, SharedDataSetType, UpdatedSharedDataSetIds
} from "../../models/shared/shared-data-set";
import { updateSharedDataSetColors } from "../../models/shared/shared-data-set-colors";
import { SharedModelType } from "../../models/shared/shared-model";
import { uniqueId, uniqueTitle } from "../../utilities/js-utils";
import { getTileModel } from "../../models/tiles/tile-model";
import { SharedModelEntrySnapshotType } from "../../models/document/shared-model-entry";

export function defaultDataSet(name?: string) {
  const dataSet = DataSet.create({name});
  // A default attribute and a single case is added automatically
  addAttributeToDataSet(dataSet, { name: kDefaultLabel });
  addCasesToDataSet(dataSet, [{ [kDefaultLabel]: "" }]);
  return dataSet;
}

export function defaultDataCardContent(props?: IDefaultContentOptions): DataCardContentModelType {
  return DataCardContentModel.create();
}

export const DataCardContentModel = TileContentModel
  .named("DataCardTool")
  .props({
    type: types.optional(types.literal(kDataCardTileType), kDataCardTileType),
    caseIndex: 0,
    selectedSortAttributeId: types.maybe(types.string)
  })
  .volatile(self => ({
    metadata: undefined as any as ITileMetadataModel,
    // used as fallback when shared model isn't available
    emptyDataSet: DataSet.create()
  }))
  .views(self => ({
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
    }
  }))
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
    caseIdsFromAttributeValue(attrId: string, value: string){
      const allCases = this.allCases();
      const foundCases: string[] = [];
      allCases.forEach((c) => c && c[attrId] === value && foundCases.push(c.__id__));
      return foundCases;
    },
    exportJson(options?: ITileExportOptions){
      return [
        `{`,
        `  "type": "DataCard"`,
        `}`
      ].join("\n");
    }
  }))
  .views(self => ({
    get caseId() {
      return self.dataSet.caseIDFromIndex(self.caseIndex);
    }
  }))
  .views(self => ({
    get caseSelected() {
      if (self.caseId !== undefined) {
        return self.dataSet.isCaseSelected(self.caseId);
      }
      return false;
    }
  }))
  .views(self => tileContentAPIViews({
    get contentTitle() {
      return self.dataSet.name;
    }
  }))
  .actions(self => tileContentAPIActions({
    doPostCreate(metadata: ITileMetadataModel){
      self.metadata = metadata;
    },
    setContentTitle(title: string) {
      self.dataSet.setName(title);
    }
  }))
  .actions(self => ({
    afterAttach() {
      // Monitor our parents and update our shared model when we have a document parent
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
            // The document doesn't have a shared model yet; create one.
            const tile = getTileModel(self);
            const dataSet = defaultDataSet(tile!.title);
            sharedDataSet = SharedDataSet.create({ providerId: self.metadata.id, dataSet });
            // Unset title of the tile so that the name of the dataset will be displayed.
            tile!.setTitle(undefined);
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
      if (self.caseIndex >= self.totalCases && self.totalCases > 0) {
          this.setCaseIndex(self.totalCases - 1);
      }
    },
    setCaseIndex(caseIndex: number) {
      // current case is serialized, but navigation is not undoable
      withoutUndo();
      self.caseIndex = caseIndex;
    },
    setSelectedSortAttributeId(attrId: string){
      withoutUndo();
      self.selectedSortAttributeId = attrId;
    },
    setAttName(attrId: string, name: string){
     self.dataSet.setAttributeName(attrId, name);
    },
    setAttValue(caseId: string, attrId: string, val: string){
      self.dataSet.setCanonicalCaseValues([
        { __id__: caseId, [attrId]: val }
      ]);
    },
    addNewCaseFromAttrKeys(atts: string[], beforeId?: string ){
      const obj = atts.reduce((o, key) => Object.assign(o, {[key]: ""}), {});
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
  }))
  .actions(self => ({
    duplicateCard() {
      const originalCaseIndex = self.caseIndex;
      const copyableCase = self.caseByIndex(originalCaseIndex);
      if (copyableCase) {
        // strip __id__ so a new id will be generated on insertion
        const { __id__, ...canonicalCase } = copyableCase;
        const desiredIndex = originalCaseIndex + 1;
        const beforeId = self.dataSet.caseIDFromIndex(desiredIndex);
        addCanonicalCasesToDataSet(self.dataSet, [canonicalCase], beforeId);
        self.setCaseIndex(desiredIndex);
      }
    }
  }));

export interface DataCardContentModelType extends Instance<typeof DataCardContentModel> {}
export type DataCardContentSnapshotType = SnapshotIn<typeof DataCardContentModel>;

export function updateDataCardContentWithNewSharedModelIds(
  content: DataCardContentSnapshotType,
  sharedDataSetEntries: SharedModelEntrySnapshotType[],
  updatedSharedModelMap: Record<string, UpdatedSharedDataSetIds>
) {
  const updatedContent = cloneDeep(content);
  // Datacard content uses an attribute id for sorting, which has to be updated with new shared dataset ids
  const oldAttributeId = content.selectedSortAttributeId;
  sharedDataSetEntries.forEach(sharedDataSetEntry => {
    const originalSharedDataSetId = sharedDataSetEntry.sharedModel.id;
    if (originalSharedDataSetId) {
      const attributeIdMap = updatedSharedModelMap[originalSharedDataSetId].attributeIdMap;
      if (oldAttributeId && attributeIdMap[oldAttributeId]) {
        updatedContent.selectedSortAttributeId = attributeIdMap[oldAttributeId];
      }
    }
  });
  return updatedContent;
}
