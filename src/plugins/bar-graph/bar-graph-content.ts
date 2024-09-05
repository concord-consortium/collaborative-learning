import { types, Instance } from "mobx-state-tree";
import { SharedModelType } from "../../models/shared/shared-model";
import { ITileContentModel, TileContentModel } from "../../models/tiles/tile-content";
import { kBarGraphTileType, kBarGraphContentType } from "./bar-graph-types";
import { getSharedModelManager } from "../../models/tiles/tile-environment";
import { isSharedDataSet, SharedDataSet, SharedDataSetType } from "../../models/shared/shared-data-set";

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
    /** Query the SharedModelManager to find a connected DataSet */
    sharedModelDataSet() {
      const smm = getSharedModelManager(self);
      if (!smm || !smm.isReady) return;
      const sharedDataSets = smm.getTileSharedModelsByType(self, SharedDataSet);
      console.log('sharedDataSets',sharedDataSets);
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
    }
  }))
  .actions(self => ({
    /**
     * Sets the volatile self.dataSet property if it hasn't been set yet.
     */
    cacheSharedDataSet() {
      if (!self.dataSet) {
        self.dataSet = self.sharedModelDataSet();
      }
    },
    updateAfterSharedModelChanges(sharedModel?: SharedModelType) {
      const dataSet = self.sharedModelDataSet();
      if (self.dataSet !== dataSet) {
        self.dataSet = dataSet;
        if (dataSet) {
          const atts = dataSet.dataSet.attributes;
          if (atts.length > 0) {
            self.setPrimaryAttribute(atts[0].id);
            console.log('set primary attribute to',atts[0].name);
          }
        }
      }
    }
  }));

export interface BarGraphContentModelType extends Instance<typeof BarGraphContentModel> {}


export function isBarGraphModel(model?: ITileContentModel): model is BarGraphContentModelType {
  return model?.type === kBarGraphTileType;
}
