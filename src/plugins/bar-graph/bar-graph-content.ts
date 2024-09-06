import { reaction } from "mobx";
import { types, Instance, addDisposer } from "mobx-state-tree";
import { SharedModelType } from "../../models/shared/shared-model";
import { ITileContentModel, TileContentModel } from "../../models/tiles/tile-content";
import { kBarGraphTileType, kBarGraphContentType } from "./bar-graph-types";
import { getSharedModelManager } from "../../models/tiles/tile-environment";
import { isSharedDataSet, SharedDataSet, SharedDataSetType } from "../../models/shared/shared-data-set";
import { ISharedModelManager } from "../../models/shared/shared-model-manager";

export function defaultBarGraphContent(): BarGraphContentModelType {
  return BarGraphContentModel.create({yAxisLabel: "Counts"});
}

export const BarGraphContentModel = TileContentModel
  .named(kBarGraphContentType)
  .props({
    type: types.optional(types.literal(kBarGraphTileType), kBarGraphTileType),
    yAxisLabel: "",
    primaryAttribute: types.maybe(types.string),
    secondaryAttribute: types.maybe(types.string)
  })
  .volatile(self => ({
    dataSet: undefined as SharedDataSetType|undefined
  }))
  .views(self => ({
    get isUserResizable() {
      return true;
    },
    get cases() {
      return self.dataSet?.dataSet.cases;
    },
    // Query the SharedModelManager to find a connected DataSet
    // An argument is passed in to avoid the return value being cached.
    sharedModelDataSet(smm: ISharedModelManager|undefined) {
      if (!smm || !smm.isReady) return;
      const sharedDataSets = smm.getTileSharedModelsByType(self, SharedDataSet);
      if (sharedDataSets.length > 0 && isSharedDataSet(sharedDataSets[0])) {
        return sharedDataSets[0];
      } else {
        return undefined;
      }
    }
  }))
  .actions(self => ({
    setYAxisLabel(text: string) {
      self.yAxisLabel = text;
    },
    setPrimaryAttribute(attrId: string) {
      self.primaryAttribute = attrId;
    },
    setSecondaryAttribute(attrId: string) {
      self.secondaryAttribute = attrId;
    },
    setSharedDataSet() {
      self.dataSet = self.sharedModelDataSet(getSharedModelManager(self));
    }
  }))
  .actions(self => ({
    unlinkDataSet() {
      const smm = getSharedModelManager(self);
      if (!smm || !smm.isReady) return;
      const sharedDataSets = smm.getTileSharedModelsByType(self, SharedDataSet);
      for (const sharedDataSet of sharedDataSets) {
        smm.removeTileSharedModel(self, sharedDataSet);
      }
      self.dataSet = undefined;
    },
    afterAttach() {
      // After attached to document & SMM is ready, cache a reference to our dataset.
      addDisposer(self, reaction(
        () => {
          return self.tileEnv?.sharedModelManager?.isReady;
        },
        (ready) => {
          if (!ready) return;
          self.setSharedDataSet();
        }, { fireImmediately: true }
      ));
    },
    updateAfterSharedModelChanges(sharedModel?: SharedModelType) {
      // When new dataset is attached, cache a reference to it and pick a category attribute.
      const dataSet = self.sharedModelDataSet(getSharedModelManager(self));
      if (self.dataSet !== dataSet) {
        self.dataSet = dataSet;
        if (dataSet) {
          const atts = dataSet.dataSet.attributes;
          if (atts.length > 0) {
            self.setPrimaryAttribute(atts[0].id);
          }
        }
      }
    }
  }));

export interface BarGraphContentModelType extends Instance<typeof BarGraphContentModel> {}


export function isBarGraphModel(model?: ITileContentModel): model is BarGraphContentModelType {
  return model?.type === kBarGraphTileType;
}
