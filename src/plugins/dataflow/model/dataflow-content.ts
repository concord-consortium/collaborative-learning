import { types, Instance, applySnapshot, getSnapshot, addDisposer, getType } from "mobx-state-tree";
import { reaction } from "mobx";
import { cloneDeep} from "lodash";
import stringify from "json-stringify-pretty-compact";
import { DataflowProgramModel } from "./dataflow-program-model";
import { DEFAULT_DATA_RATE } from "./utilities/node";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import { ITileMetadataModel } from "../../../models/tiles/tile-metadata";
import { tileModelHooks } from "../../../models/tiles/tile-model-hooks";
import { TileContentModel } from "../../../models/tiles/tile-content";
import {
  SharedDataSet, kSharedDataSetType, SharedDataSetType,
} from "../../../models/shared/shared-data-set";
import { updateSharedDataSetColors } from "../../../models/shared/shared-data-set-colors";
import { SharedModelType } from "../../../models/shared/shared-model";
import { DataSet } from "../../../models/data/data-set";
import { uniqueId } from "../../../utilities/js-utils";
import { getTileContentById, getTileModelById } from "../../../utilities/mst-utils";

export const kDataflowTileType = "Dataflow";

export function defaultDataflowContent(): DataflowContentModelType {
  return DataflowContentModel.create();
}

export const kDataflowDefaultHeight = 480;
export const kDefaultLabel = "Dataflow Node";

export function defaultDataSet() {
  const dataSet = DataSet.create();
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
    }
  }))
  .views(self => ({
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
    setProgramDataRate(dataRate: number) {
      self.programDataRate = dataRate;
    },
    setProgramZoom(dx: number, dy: number, scale: number) {
      self.programZoom.dx = dx;
      self.programZoom.dy = dy;
      self.programZoom.scale = scale;
    },
    setFormattedTime(formattedTime: string){
      self.formattedTime = formattedTime;
    },
    updateAfterSharedModelChanges(sharedModel?: SharedModelType){
      //do nothing
    },
    addNewAttrFromNode(nodeId: number, nodeName: string, idx: number){
      const newAttributeId = uniqueId() + "*" + nodeId;
      self.dataSet.addAttributeWithID({
        id: newAttributeId,
        name: `${nodeName} ${idx}`
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
  }));

export type DataflowContentModelType = Instance<typeof DataflowContentModel>;
