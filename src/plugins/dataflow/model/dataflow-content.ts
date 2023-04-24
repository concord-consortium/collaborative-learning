/* eslint-disable max-len */
import { types, Instance, applySnapshot, getSnapshot, addDisposer, getType } from "mobx-state-tree";
import { reaction } from "mobx";
import { cloneDeep} from "lodash";
import stringify from "json-stringify-pretty-compact";
import { DataflowProgramModel } from "./dataflow-program-model";
import { createDefaultDataSet } from "./utilities/create-default-data-set";
import { DEFAULT_DATA_RATE } from "./utilities/node";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import { ITileMetadataModel } from "../../../models/tiles/tile-metadata";
import { tileModelHooks } from "../../../models/tiles/tile-model-hooks";
import { TileContentModel } from "../../../models/tiles/tile-content";
import { getTileModel, setTileTitleFromContent, getTileTitleFromContent } from "../../../models/tiles/tile-model";
import { SharedDataSet, kSharedDataSetType, SharedDataSetType  } from "../../../models/shared/shared-data-set";
import { updateSharedDataSetColors } from "../../../models/shared/shared-data-set-colors";
import { SharedModelType } from "../../../models/shared/shared-model";
import { addAttributeToDataSet, addCasesToDataSet, DataSet } from "../../../models/data/data-set";
import { uniqueId } from "../../../utilities/js-utils";
import { getTileContentById } from "../../../utilities/mst-utils";

export const kDataflowTileType = "Dataflow";




export function defaultDataflowContent(): DataflowContentModelType {
  return DataflowContentModel.create();
}

export const kDataflowDefaultHeight = 480;
export const kDefaultLabel = "Dataflow Node";

export function defaultDataSet() {
  const dataSet = DataSet.create();
  addAttributeToDataSet(dataSet, { name: kDefaultLabel });
  addCasesToDataSet(dataSet, [{ [kDefaultLabel]: "" }]);
  return dataSet;
}

const ProgramZoom = types.model({
  dx: types.number,
  dy: types.number,
  scale: types.number,
});
export type ProgramZoomType = typeof ProgramZoom.Type;
export const DEFAULT_PROGRAM_ZOOM = { dx: 0, dy: 0, scale: 1 };

export const DataflowContentModel = TileContentModel
  .named("DataflowTool")
  .props({
    type: types.optional(types.literal(kDataflowTileType), kDataflowTileType),
    program: types.optional(DataflowProgramModel, getSnapshot(DataflowProgramModel.create())),
    programDataRate: DEFAULT_DATA_RATE,
    programRecordingMode: 0,
    programZoom: types.optional(ProgramZoom, DEFAULT_PROGRAM_ZOOM),
    formattedTime: "000:00"
  })
  .volatile(self => ({
    metadata: undefined as any as ITileMetadataModel,
    emptyDataSet: DataSet.create(),
  }))
  .views(self => ({
    get sharedModel() {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      const firstSharedModel = sharedModelManager?.getTileSharedModels(self)?.[0];
      if (!firstSharedModel || getType(firstSharedModel) !== SharedDataSet) {
        return undefined;
      }
      return firstSharedModel as SharedDataSetType;
    },
    programWithoutRecentValues() {
      const { values, ...rest } = getSnapshot(self.program);
      const castedValues = values as Record<string, any>;
      const newValues: Record<string, any> = {};
      if (values) {
        Object.keys(castedValues).forEach((key: string) => {
          const { recentValues, ...other } = castedValues[key];
          newValues[key] = { ...other };
        });
      }
      return { values: newValues, ...rest };
    }
  }))
  .views(self => ({
    get dataSet(){
      return self.sharedModel?.dataSet || self.emptyDataSet;
    },

    get linkedDataSets(): SharedDataSetType[] {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      const foundSharedModels = sharedModelManager?.isReady
        ? sharedModelManager.getTileSharedModels(self) as SharedDataSetType[]
        : [];
      return foundSharedModels;
    },
  }))
  .views(self => ({
    get title() {
      return getTileModel(self)?.title;
    },
    get isUserResizable() {
      return true;
    },
    exportJson(options?: ITileExportOptions) {
      const zoom = getSnapshot(self.programZoom);
      return [
        `{`,
        `  "type": "Dataflow",`,
        `  "programDataRate": ${self.programDataRate},`,
        `  "programZoom": {`,
        `    "dx": ${zoom.dx},`,
        `    "dy": ${zoom.dy},`,
        `    "scale": ${zoom.scale}`,
        `  },`,
        // `  "programRecordingMode: ${self.programRecordingMode}"`,
        `  "program": ${stringify(self.programWithoutRecentValues())}`,
        `}`
      ].join("\n");
    },
    // ------ADDED---------------------------------
    get isEmptyDataSet(){
      return self.dataSet.isEmpty;
    },
    // ------ END -----------------------------------
    get isLinked(){
      return self.linkedDataSets.length > 0;
    },
    isLinkedToTable(tableId: string) {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      const isTableIdFound = self.linkedDataSets.some(link => { //link is the shared model
        return sharedModelManager?.getSharedModelTileIds(link).includes(tableId);
      });
      return isTableIdFound;
    },
  }))
  .actions(self => tileModelHooks({
    doPostCreate(metadata: ITileMetadataModel) {
      self.metadata = metadata;
    }
  }))
  .actions(self => ({
    afterAttach() { //
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
      ({sharedModelManager, sharedDataSet, tileSharedModels}) => {
        if (!sharedModelManager?.isReady) {
          return;
        }

        if (sharedDataSet && tileSharedModels?.includes(sharedDataSet)) {
          // The shared model has already been registered by a client, but as the
          // "owner" of the data, we synchronize it with our local content.
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
    setProgram(program: any) {
      if (program) {
        applySnapshot(self.program, cloneDeep(program));
      }
    },
    setTitle(title: string) {
      setTileTitleFromContent(self, title);
    },
    setProgramDataRate(dataRate: number) {
      self.programDataRate = dataRate;
    },
    setProgramZoom(dx: number, dy: number, scale: number) {
      self.programZoom.dx = dx;
      self.programZoom.dy = dy;
      self.programZoom.scale = scale;
    },
    incrementProgramRecordingMode(refreshFlag?: boolean){
      self.programRecordingMode = (self.programRecordingMode + 1) % 3;
      if (refreshFlag){
        self.programRecordingMode = 2;
      }
    },
    setFormattedTime(formattedTime: string){
      self.formattedTime = formattedTime;
    },
    updateAfterSharedModelChanges(sharedModel?: SharedModelType){
      //do nothing
    },
    addNewAttrFromNode(nodeId: number, nodeName: string){
      //if already an attribute with the same nodeId do nothing, else write
      const dataSetAttributes = self.dataSet.attributes;
      let foundFlag = false;

      for (let i = 0; i < Object.keys(dataSetAttributes).length ; i++){ //look in dataSet.attributes for each Id
        const idInDataSet = dataSetAttributes[i].id;
        const index = idInDataSet.indexOf("*");
        const stringAfterIndex = idInDataSet.substring(index+1);
        if (nodeId.toString() === stringAfterIndex)foundFlag = true;
      }

      if (!foundFlag) {
        const newAttributeId = uniqueId() + "*" + nodeId;
        self.dataSet.addAttributeWithID({
          id: newAttributeId,
          name: `${nodeName}_${nodeId}`
        });
      }
    },
    addLinkedTable(tableId: string) {  //tableID is table we linked it to
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      if (sharedModelManager?.isReady && !self.isLinkedToTable(tableId)) {
        const tableTileContents = getTileContentById(self, tableId); //get tableTile contents given a tableId
        const tableSharedModels = sharedModelManager.getTileSharedModels(tableTileContents);
        if (tableSharedModels.length > 1){ //table ideally should only have 1 shared dataSet
          console.warn("Table has more than one shared dataSet");
        }
        //sever connection table -> table sharedDataSet
        tableSharedModels && sharedModelManager.removeTileSharedModel(tableTileContents, tableSharedModels[0]);
        //connect table -> dataflow sharedDataset
        self.sharedModel && sharedModelManager.addTileSharedModel(tableTileContents, self.sharedModel);
      }
      else {
        console.warn("DataflowContent.addLinkedTable unable to link table");
      }
    },
    removeLinkedTable(tableId: string) {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      if (sharedModelManager?.isReady && self.isLinkedToTable(tableId)) {
        //sever connection table -> table sharedDataSet
        const tableTileContents = getTileContentById(self, tableId); //get tableTile contents given a tableId
        self.sharedModel && sharedModelManager.removeTileSharedModel(tableTileContents, self.sharedModel);
        //create a dataSet with two attributes with X / Y, link table tile to this dataSet
        const title = tableTileContents ? getTileTitleFromContent(tableTileContents) : undefined;
        const newDataSet = createDefaultDataSet(title);
        const newSharedDataSet = newDataSet && SharedDataSet.create({ providerId: tableId, dataSet: newDataSet });
        sharedModelManager.addTileSharedModel(tableTileContents, newSharedDataSet);
      }
      else {
        console.warn("DataflowContent.addLinkedTable unable to unlink table");
      }
    },
  }));

export type DataflowContentModelType = Instance<typeof DataflowContentModel>;
