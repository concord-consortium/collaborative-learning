import { types, Instance } from "mobx-state-tree";
import { isNumber } from "lodash";
import { ITileContentModel, TileContentModel } from "../../models/tiles/tile-content";
import { kBarGraphTileType, kBarGraphContentType } from "./bar-graph-types";
import { getSharedModelManager } from "../../models/tiles/tile-environment";
import { SharedDataSet, SharedDataSetType } from "../../models/shared/shared-data-set";
import { clueDataColorInfo } from "../../utilities/color-utils";
import { displayValue } from "./bar-graph-utils";
import { SharedModelType } from "../../models/shared/shared-model";

export function defaultBarGraphContent(): BarGraphContentModelType {
  return BarGraphContentModel.create({yAxisLabel: "Counts"});
}

export const BarGraphContentModel = TileContentModel
  .named(kBarGraphContentType)
  .props({
    type: types.optional(types.literal(kBarGraphTileType), kBarGraphTileType),
    yAxisLabel: "",
    // ID of the dataset to which primaryAttribute and secondaryAttribute belong.
    // The currently linked dataset is available from SharedModelManager, but we store the ID so
    // that we can tell when it changes.
    dataSetId: types.maybe(types.string),
    primaryAttribute: types.maybe(types.string),
    secondaryAttribute: types.maybe(types.string)
  })
  .views(self => ({
    get sharedModel() {
      const sharedModelManager = self.tileEnv?.sharedModelManager;
      const firstSharedModel = sharedModelManager?.getTileSharedModelsByType(self, SharedDataSet)?.[0];
      if (!firstSharedModel) return undefined;
      return firstSharedModel as SharedDataSetType;
    },
    get isUserResizable() {
      return true;
    }
  }))
  .views(self => ({
    get cases() {
      return self.sharedModel?.dataSet.cases;
    }
  }))
  .views(self => ({
    /**
     * Returns the dataset data in a format suitable for plotting.
     *
     * With a primary attribute "species" and no secondary attribute, this will be something like:
     * ```json
     * [
     *   { species: "cat", value: 7 },
     *   { species: "owl", value: 3 }
     * ]
     * ```
     *
     * If there is a secondary attribute "location", this will be like:
     * ```json
     * [
     *   { species: "cat", backyard: 5, street: 2, forest: 0 },
     *   { species: "owl", backyard: 1, street: 0, forest: 2 }
     * ]
     * ```
     * Any empty values of attributes are replaced with "(no value)".
     */
    get dataArray() {
      const dataSet = self.sharedModel?.dataSet;
      const primary = self.primaryAttribute;
      const secondary = self.secondaryAttribute;
      const cases = self.cases;
      if (!dataSet || !primary || !cases) return [];
      if (secondary) {
        // Two-dimensionsal data
        return cases.reduce((acc, caseID) => {
          const cat = displayValue(dataSet.getStrValue(caseID.__id__, primary));
          const subCat = displayValue(dataSet.getStrValue(caseID.__id__, secondary));
          const index = acc.findIndex(r => r[primary] === cat);
          if (index >= 0) {
            const cur = acc[index][subCat];
            acc[index][subCat] = (isNumber(cur) ? cur : 0) + 1;
          } else {
            const newRow = { [primary]: cat, [subCat]: 1 };
            acc.push(newRow);
          }
          return acc;
        }, [] as { [key: string]: number | string }[]);
      } else {
        // One-dimensional data
        return cases.reduce((acc, caseID) => {
          const cat = displayValue(dataSet.getStrValue(caseID.__id__, primary));
          const index = acc.findIndex(r => r[primary] === cat);
          if (index >= 0) {
            const cur = acc[index].value;
            acc[index].value = isNumber(cur) ? cur + 1 : 1;
          } else {
            const newRow = { [primary]: cat, value: 1 };
            acc.push(newRow);
          }
          return acc;
        }, [] as { [key: string]: number | string }[]);
      }
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
      self.secondaryAttribute = undefined;
    },
    setSecondaryAttribute(attrId: string|undefined) {
      self.secondaryAttribute = attrId;
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
    },

    updateAfterSharedModelChanges(sharedModel?: SharedModelType) {
      // When new dataset is attached, store its ID and pick a primary attribute to display.
      const dataSetId = self.sharedModel?.dataSet?.id;
      if (self.dataSetId !== dataSetId) {
        self.dataSetId = dataSetId;
        self.setPrimaryAttribute(undefined);
        self.setSecondaryAttribute(undefined);
        if (dataSetId) {
          const atts = self.sharedModel.dataSet.attributes;
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
