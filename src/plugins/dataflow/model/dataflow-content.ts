import { types, Instance, applySnapshot, getSnapshot, addDisposer, getType } from "mobx-state-tree";
import { reaction } from "mobx";
import { cloneDeep} from "lodash";
import stringify from "json-stringify-pretty-compact";
import { DataflowProgramModel } from "./dataflow-program-model";
import { ITileExportOptions } from "../../../models/tiles/tile-content-info";
import { ITileMetadataModel } from "../../../models/tiles/tile-metadata";
import { tileModelHooks } from "../../../models/tiles/tile-model-hooks";
import { TileContentModel } from "../../../models/tiles/tile-content";
import { DEFAULT_DATA_RATE } from "./utilities/node";
import { getTileModel, setTileTitleFromContent } from "../../../models/tiles/tile-model";
import { SharedDataSet, kSharedDataSetType, SharedDataSetType  } from "../../../models/shared/shared-data-set";
import { addAttributeToDataSet, addCasesToDataSet, DataSet } from "../../../models/data/data-set";
import { updateSharedDataSetColors } from "../../../models/shared/shared-data-set-colors";
import { uniqueId } from "../../../utilities/js-utils";
import { SharedModelType } from "src/models/shared/shared-model";

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
    programZoom: types.optional(ProgramZoom, DEFAULT_PROGRAM_ZOOM),
  })
  .volatile(self => ({
    metadata: undefined as any as ITileMetadataModel,
    emptyDataSet: DataSet.create()
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
    }
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
        `  "program": ${stringify(self.programWithoutRecentValues())}`,
        `}`
      ].join("\n");
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
    updateAfterSharedModelChanges(sharedModel?: SharedModelType){
      //do nothing
    },

    addNewAttrFromNode(nodeId: number, nodeName: string){ //if already an attribute with the same nodeId,else write
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
          name: `Dataflow-${nodeName}_${nodeId}`
        });
      }
    },

    // this may be implemented if we change to preserve attributes accross runs
    removeAttributesInDatasetMissingInTile(attribute: string){
      const index = attribute.indexOf("*");
      const stringAfterIndex = attribute.substring(index + 1);
      let foundFlag = false;
      const { nodes } = getSnapshot(self.program);
      const castedNodes = nodes as Record<string, any>;
      const castedNodesIdArr = Object.keys(castedNodes);
      for (let i = 0; i < castedNodesIdArr.length; i++){
        const idInTile = castedNodesIdArr[i];
        if (idInTile === stringAfterIndex) foundFlag = true;
      }
      if (!foundFlag){
        self.dataSet.removeAttribute(attribute);
      }
    }
  }));

export type DataflowContentModelType = Instance<typeof DataflowContentModel>;
