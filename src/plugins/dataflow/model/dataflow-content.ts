import { types, Instance, applySnapshot, getSnapshot, addDisposer, SnapshotIn, getType } from "mobx-state-tree";
import { observable, reaction } from "mobx";
import { cloneDeep} from "lodash";
import stringify from "json-stringify-pretty-compact";

import { Transform } from "rete-area-plugin/_types/area";

import { DataflowProgramModel } from "./dataflow-program-model";
import { DEFAULT_DATA_RATE } from "./utilities/node";
import { SharedVariables, SharedVariablesType } from "../../shared-variables/shared-variables";
import { isInputVariable, isOutputVariable } from "../../shared-variables/simulations/simulation-utilities";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import { ITileMetadataModel } from "../../../models/tiles/tile-metadata";
import { tileContentAPIActions, tileContentAPIViews } from "../../../models/tiles/tile-model-hooks";
import { TileContentModel } from "../../../models/tiles/tile-content";
import {
  SharedDataSet, kSharedDataSetType, SharedDataSetType,
} from "../../../models/shared/shared-data-set";
import { updateSharedDataSetColors } from "../../../models/shared/shared-data-set-colors";
import { SharedModelType } from "../../../models/shared/shared-model";
import { DataSet, addAttributeToDataSet } from "../../../models/data/data-set";
import { SharedProgramData, SharedProgramDataType } from "../../shared-program-data/shared-program-data";

import { uniqueId } from "../../../utilities/js-utils";
import { getTileContentById, getTileModelById } from "../../../utilities/mst-utils";
import { getTileModel } from "../../../models/tiles/tile-model";
import { IClueTileObject } from "../../../models/annotations/clue-object";
import { NodeChannelInfo } from "./utilities/channel";

export const kDataflowTileType = "Dataflow";

export function defaultDataflowContent(): DataflowContentModelType {
  return DataflowContentModel.create();
}

export const kDataflowDefaultHeight = 480;
export const kDefaultLabel = "Dataflow Node";

// This is an arbitrary limit on how many values can be recorded in a dataset.
// The intention is to keep the size of the dataset manageable.
// A case has one value for time and one value for each node
const kMaxRecordedValues = 10000;

export function defaultDataSet(title: string|undefined) {
  const dataSet = DataSet.create({
    name: title,
    attributes: [ { name: "x"}, { name: "y"} ]
  });
  return dataSet;
}

const ProgramZoom = types.model({
  dx: types.number,
  dy: types.number,
  scale: types.number,
})
.actions(self => ({
  update(transform: Transform) {
    const { x, y, k} = transform;
    self.dx = x;
    self.dy = y;
    self.scale = k;
  }
}));
export type ProgramZoomType = typeof ProgramZoom.Type;
export const DEFAULT_PROGRAM_ZOOM = { dx: 0, dy: 0, scale: 1 };

export const DataflowContentModel = TileContentModel
  .named("DataflowTool")
  .props({
    type: types.optional(types.literal(kDataflowTileType), kDataflowTileType),
    program: types.optional(DataflowProgramModel, getSnapshot(DataflowProgramModel.create())),
    programDataRate: DEFAULT_DATA_RATE,
    programZoom: types.optional(ProgramZoom, DEFAULT_PROGRAM_ZOOM),
  })
  .volatile(self => ({
    metadata: undefined as any as ITileMetadataModel,
    emptyDataSet: DataSet.create(),
    channels: observable([]) as NodeChannelInfo[],
    liveProgramZoom: ProgramZoom.create(getSnapshot(self.programZoom))
  }))
  .views(self => ({
    get sharedModel() {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      const firstSharedModel = sharedModelManager?.getTileSharedModelsByType(self, SharedDataSet)?.[0];
      if (!firstSharedModel) return undefined;
      return firstSharedModel as SharedDataSetType;
    },
    get sharedVariables() {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      const firstSharedVariables = sharedModelManager?.getTileSharedModelsByType(self, SharedVariables)?.[0];
      if (!firstSharedVariables) return undefined;
      return firstSharedVariables as SharedVariablesType;
    },
    get sharedProgramData() {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      const firstSharedProgramData = sharedModelManager?.getTileSharedModelsByType(self, SharedProgramData)?.[0];
      if (!firstSharedProgramData) return undefined;
      return firstSharedProgramData as SharedProgramDataType;
    },
    get maxRecordableCases() {
      const numNodes = self.program.nodes.size;
      // The `+ 1` is for time which is recorded as the first value of each case
      return (kMaxRecordedValues/(numNodes + 1));
    },
  }))
  .views(self => ({
    get inputVariables() {
      const variables = self.sharedVariables?.variables;
      return variables?.filter(variable => isInputVariable(variable));
    },
    get outputVariables() {
      const variables = self.sharedVariables?.variables;
      return variables?.filter(variable => isOutputVariable(variable));
    },
    get dataSet(){
      return self.sharedModel?.dataSet || self.emptyDataSet;
    },

    get linkedDataSets(): SharedDataSetType[] {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      const foundSharedModels = sharedModelManager?.isReady
        ? sharedModelManager.getTileSharedModels(self) as SharedDataSetType[]
        : [];
      return foundSharedModels;
    }
  }))
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    exportJson(options?: ITileExportOptions) {
      const snapshot = getSnapshot(self);
      if (options?.forHash) {
        // We only need the program for hashing
        const {program} = snapshot;
        return stringify({program}, {maxLength: 120});
      }
      // We used to strip out the recent values, maybe we should again?
      return stringify(snapshot, {maxLength: 120});
    },
    get isDataSetEmptyCases(){
      //Used when DF linked to a table, then we clear. Different than isEmpty
      //Since there are two attributes X|Y for the default table, we only want to check if there are no cases
      return self.dataSet.cases.length === 0;
    },
    get isLinked(){
      return self.linkedDataSets.length > 0;
    },
    isLinkedToTile(tileId: string) {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      const isTileIdFound = self.linkedDataSets.some(link => { //link is the shared model
        return sharedModelManager?.getSharedModelTileIds(link).includes(tileId);
      });
      return isTileIdFound;
    },
    getTimeAtRecordedIndex(index: number) {
      const { dataSet } = self;
      if (!dataSet || index < 0 || index >= dataSet.cases.length) {
        return 0;
      }
      const timeQuantizedId = dataSet.attributes[0].id;
      const time = dataSet.getValueAtIndex(index, timeQuantizedId);
      if (typeof time !== "number") {
        return 0;
      }
      return time;
    },
  }))
  .views(self => ({
    get durationOfRecording() {
      const { dataSet } = self;
      if (!dataSet) {
        return 0;
      }
      const lastIndex = dataSet.cases.length - 1;
      return self.getTimeAtRecordedIndex(lastIndex);
    }
  }))
  .views(self => ({
    get durationOfRecordingFormatted() {
      return formatTime(self.durationOfRecording);
    }
  }))
  .views(self => tileContentAPIViews({
    get contentTitle() {
      return self.dataSet.name;
    },
    get annotatableObjects(): IClueTileObject[] {
      return [...self.program.nodes.values()].map(node => ({
        objectId: node.id,
        objectType: "Node",
      }));
    },
  }))
  .actions(self => tileContentAPIActions({
    doPostCreate(metadata: ITileMetadataModel) {
      self.metadata = metadata;
    },
    setContentTitle(title: string) {
      self.dataSet.setName(title);
    }
  }))
  .actions(self => ({
    afterAttach() { //
      addDisposer(self, reaction(() => {
        const sharedModelManager = self.tileEnv?.sharedModelManager;
        const sharedDataSet = sharedModelManager?.isReady
          ? sharedModelManager?.findFirstSharedModelByType(SharedDataSet, self.metadata.id)
          : undefined;

        const sharedVariables = sharedModelManager?.isReady
          ? sharedModelManager?.findFirstSharedModelByType(SharedVariables)
          : undefined;

        const tileSharedModels = sharedModelManager?.isReady
          ? sharedModelManager?.getTileSharedModels(self)
          : undefined;

        const ourSharedProgramData = tileSharedModels?.find( sharedModel => {
          return getType(sharedModel) === SharedProgramData;
        });

        return { sharedModelManager, sharedDataSet, sharedVariables, tileSharedModels, ourSharedProgramData };
      },
      ({sharedModelManager, sharedDataSet, sharedVariables, tileSharedModels, ourSharedProgramData}) => {
        if (!sharedModelManager?.isReady) {
          return;
        }

        if (!sharedDataSet) {
          const tileModel = getTileModel(self);
          const dataSet = defaultDataSet(tileModel?.title);
          sharedDataSet = SharedDataSet.create({ providerId: self.metadata.id, dataSet });
          tileModel?.setTitle(undefined);
        }

        if (!tileSharedModels?.includes(sharedDataSet)) {
          sharedModelManager.addTileSharedModel(self, sharedDataSet);
        }

        // We won't create a sharedVariables model, but we'll automatically attach to any we find
        if (sharedVariables && !tileSharedModels?.includes(sharedVariables)) {
          sharedModelManager.addTileSharedModel(self, sharedVariables);
        }

        if (!ourSharedProgramData) {
          const programData = SharedProgramData.create();
          sharedModelManager.addTileSharedModel(self, programData);
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
    setChannels(channels: NodeChannelInfo[]) {
      self.channels = observable(channels);
    },
    setProgramDataRate(dataRate: number) {
      self.programDataRate = dataRate;
    },
    setLiveProgramZoom(transform: Transform) {
      self.liveProgramZoom.update(transform);
    },
    setProgramZoom(transform: Transform) {
      self.programZoom.update(transform);
      self.liveProgramZoom.update(transform);
    },
    updateAfterSharedModelChanges(sharedModel?: SharedModelType){
      //do nothing
    },
    addNewAttrFromNode(nodeId: string, nodeName: string){
      const newAttributeId = uniqueId() + "*" + nodeId;
      self.dataSet.addAttributeWithID({
        id: newAttributeId,
        name: nodeName,
      });
    },
    addLinkedTile(tileId: string) {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      if (sharedModelManager?.isReady && !self.isLinkedToTile(tileId)) {
        const linkedTileContents = getTileContentById(self, tileId);
        const linkedTileSharedModels = sharedModelManager.getTileSharedModels(linkedTileContents);
        if (linkedTileSharedModels.length > 1){ //table ideally should only have 1 shared dataSet
          console.warn("Tile has more than one shared dataSet");
        }
        //sever connection tile -> tile sharedDataSet
        linkedTileSharedModels.length > 0 &&
          sharedModelManager.removeTileSharedModel(linkedTileContents, linkedTileSharedModels[0]);
        //connect tile -> dataflow sharedDataset
        self.sharedModel && sharedModelManager.addTileSharedModel(linkedTileContents, self.sharedModel);
      }
      else {
        console.warn("DataflowContent.addLinkedTile unable to link tile");
      }
    },
    removeLinkedTable(tableId: string) {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      if (sharedModelManager?.isReady && self.isLinkedToTile(tableId)) {
        //sever connection table -> table sharedDataSet
        const tableTileModel = getTileModelById(self, tableId); //get tableTile contents given a tableId
        const tableTileContent = tableTileModel?.content;
        self.sharedModel && sharedModelManager.removeTileSharedModel(tableTileContent, self.sharedModel);
      }
      else {
        console.warn("DataflowContent.addLinkedTable unable to unlink table");
      }
    },
    clearAttributes() {
      const allAttributes = self.dataSet.attributes;
      allAttributes.forEach((attr)=>{
        self.dataSet.removeAttribute(attr.id);
      });
    },
    clearCases() {
      const ids = self.dataSet.cases.map(({__id__}) => ( __id__));
      self.dataSet.removeCases(ids);
    },
  }))
  .actions(self => ({
    prepareRecording() {
      self.clearAttributes();
      // dataSet looks like
      // Time   |  Node 1 | Node 2 | Node 3 etc
      //    0   |   val    | val    |  val
      addAttributeToDataSet(self.dataSet, { name: "Time (sec)" }); //time quantized to nearest sampling rate
      self.program.nodes.forEach((n) => { //add attributes based on nodes in tile
        n.data.orderedDisplayName && self.addNewAttrFromNode(n.id, n.data.orderedDisplayName);
      });
    },
    resetRecording() {
      //clear the dataSet;
      self.clearAttributes();
      self.clearCases();
      // create a default dataSet x | y table
      addAttributeToDataSet(self.dataSet, { name: "x" });
      addAttributeToDataSet(self.dataSet, { name: "y" });
    },
  }));

export type DataflowContentModelType = Instance<typeof DataflowContentModel>;
export type DataflowContentModelSnapshotIn = SnapshotIn<typeof DataflowContentModel>;

export function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  const formattedMinutes = minutes.toString().padStart(3, '0');
  const formattedSeconds = remainingSeconds.toString().padStart(2, '0');
  return `${formattedMinutes}:${formattedSeconds}`;
}
