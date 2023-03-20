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
import { addAttributeToDataSet, addCasesToDataSet, addCanonicalCasesToDataSet, DataSet } from "../../../models/data/data-set";
import { updateSharedDataSetColors } from "../../../models/shared/shared-data-set-colors";
import { uniqueId, uniqueTitle } from "../../../utilities/js-utils";

export const kDataflowTileType = "Dataflow";

export function defaultDataflowContent(): DataflowContentModelType {
  return DataflowContentModel.create();
}

export const kDataflowDefaultHeight = 480;
export const kDefaultLabel = "Dataflow Node";


export function defaultDataSet() { //added
  // as per slack discussion, default attribute is added automatically
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
    programRecordState: 0,
  })
  .volatile(self => ({
    metadata: undefined as any as ITileMetadataModel,
    emptyDataSet: DataSet.create() //added
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
      console.log("DataFlow model > views > get sharedModel() > firstSharedModel\n", firstSharedModel);
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
  .views(self => ({ //added
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
    get dataSet() {
      return self.sharedModel?.dataSet || self.emptyDataSet;
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
    //added (not used )
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

  }))
  .actions(self => tileModelHooks({
    doPostCreate(metadata: ITileMetadataModel){
      self.metadata = metadata;
    }
  }))
  .actions(self => ({
    afterAttach() { //     //added built-in hook is called on every model right after added to the tree
      // Monitor our parents and update our shared model when we have a document parent
      addDisposer(self, reaction(() => {
        // disposers call the function passed to it when model is disposed
        // and here we pass a reaction, which is a mobx thing that watches the stuff in the first argument
        // it calls second argument when first is done

        // looking in the tileEnv for the shared modelManager - "environment" is a mobx context,
        // but must be set at root of tree
        // tile env proxies the actual mechanism
        const sharedModelManager = self.tileEnv?.sharedModelManager;

        // collecting the stats on current sharedModels here so we can pass on to reaction on 119
        const sharedDataSet = sharedModelManager?.isReady
          // TODO, where is this coming from, might not want it id by any "metadata"
          ? sharedModelManager?.findFirstSharedModelByType(SharedDataSet, self.metadata.id)
          : undefined;

        const tileSharedModels = sharedModelManager?.isReady
          ? sharedModelManager?.getTileSharedModels(self)
          : undefined;

        return { sharedModelManager, sharedDataSet, tileSharedModels };
      },
      // reaction/effect ("second argument" above), a mobx reaction watches the model
      // and "reacts" there are various flavors, e.g.
      // autorun, when, (what we are watching, what we do if what watching changes)
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

         // SharedDataSet.providerId (might be a table, in the case of a new table)
              // DataSet

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
    addNewCaseFromAttrKeys(atts: string[], beforeId?: string ){
      const obj = atts.reduce((o, key) => Object.assign(o, {[key]: ""}), {});
      if (beforeId){
        addCanonicalCasesToDataSet(self.dataSet, [obj], beforeId);
      } else {
        addCanonicalCasesToDataSet(self.dataSet, [obj]);
      }
    },
    addNewAttr(nodeId: number, nodeName: string){
      const newAttributeId = uniqueId() + "_" + nodeId;
      self.dataSet.addAttributeWithID({
        id: newAttributeId,
        name: uniqueTitle(`Dataflow-${nodeName}`, name => !self.dataSet.attrFromName(name))
      });
    }
  }))
  .actions(self => ({
    // [RECORDING manage recording state]
    // TODO I moved this functionality to the tile's react state
    // It should not be in the MST model because it will not be serialized
    // It will need to be more fully integrated with the UI built in #182326333
    // setProgramRecordState(){
    //   //0 - Record
    //   //1 - Stop
    //   //2 - Clear
    //   // console.log("dataflow-content.ts > setProgramRecordState() with programRecordState", self.programRecordState);
    //   if (self.programRecordState === 0){
    //     console.log("we are in recording mode");
    //     console.log("self.title", self.title); //when calling on view methods, we do not need to invoke them
    //     console.log("self.dataset", self.dataSet); //when calling on view methods, we do not need to invoke them

    //     //from datacard
    //     // self.addNewCaseFromAttrKeys(self.existingAttributes()); //calls to other actions must be above(?), not below
    //     // setCaseIndex(content.totalCases - 1);
    //   }
    //   self.programRecordState = (self.programRecordState + 1) % 3;
    // }



  }));

export type DataflowContentModelType = Instance<typeof DataflowContentModel>;
