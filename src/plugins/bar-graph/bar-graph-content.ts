import { reaction } from "mobx";
import { types, Instance, addDisposer } from "mobx-state-tree";
import { isNumber } from "lodash";
import { SharedModelType } from "../../models/shared/shared-model";
import { ITileContentModel, TileContentModel } from "../../models/tiles/tile-content";
import { kBarGraphTileType, kBarGraphContentType } from "./bar-graph-types";
import { getSharedModelManager } from "../../models/tiles/tile-environment";
import { isSharedDataSet, SharedDataSet, SharedDataSetType } from "../../models/shared/shared-data-set";
import { ISharedModelManager } from "../../models/shared/shared-model-manager";
import { clueDataColorInfo } from "../../utilities/color-utils";

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
  .views(self => ({
    // TODO what should this do in the case of no secondary attribute?
    get dataArray() {
      console.log("calculating dataArray");
      const dataSet = self.dataSet?.dataSet;
      const primary = self.primaryAttribute;
      const secondary = self.secondaryAttribute;
      const cases = self.cases;
      if (!dataSet || !primary || !cases) return [];
      return cases.reduce((acc, caseID) => {
        const cat = dataSet.getStrValue(caseID.__id__, primary);
        const subCat = secondary ? dataSet.getStrValue(caseID.__id__, secondary) : "default"; // ??
        const index = acc.findIndex(r => r[primary] === cat);
        if (index >= 0) {
          const cur = acc[index][subCat];
          acc[index][subCat] = (isNumber(cur) ? cur : 0) + 1;
        } else {
          const newRow = { [primary]: cat, [subCat]: 1 };
          acc.push(newRow);
        }
        return acc;
      }, [] as { [key: string]: number|string }[]);
    }
  }))
  .views(self => ({
    get primaryKeys() {
      const primary = self.primaryAttribute;
      if (!primary) return [];
      return self.dataArray.map(d => d[primary] as string);
    },
    get secondaryKeys() {
      const primary = self.primaryAttribute;
      if (!primary) return [];
      return Array.from(new Set(self.dataArray.flatMap(d => Object.keys(d)).filter(k => k !== primary)));
    },
    get maxDataValue(): number {
      return self.dataArray.reduce((acc, row) => {
        const rowValues = Object.values(row).filter(v => isNumber(v)) as number[];
        const maxInRow = Math.max(...rowValues);
        return Math.max(maxInRow, acc);
      }, 0);
    }
  }))
  .views(self => ({
    // TODO this should track colors in a way that can be edited later
    getColorForSecondaryKey(key: string) {
      let n = self.secondaryKeys.indexOf(key);
      if (!n || n<0) n=0;
      return clueDataColorInfo[n % clueDataColorInfo.length].color;
    }
  }))
  .actions(self => ({
    setYAxisLabel(text: string) {
      self.yAxisLabel = text;
    },
    setPrimaryAttribute(attrId: string|undefined) {
      self.primaryAttribute = attrId;
    },
    setSecondaryAttribute(attrId: string|undefined) {
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
        self.setPrimaryAttribute(undefined);
        self.setSecondaryAttribute(undefined);
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
