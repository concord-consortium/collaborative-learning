import { getSnapshot, types, Instance } from "mobx-state-tree";
import { isObject } from "lodash";
import stringify from "json-stringify-pretty-compact";
import { ITileContentModel, TileContentModel } from "../../models/tiles/tile-content";
import { kBarGraphTileType, kBarGraphContentType, BarInfo } from "./bar-graph-types";
import { getSharedModelManager } from "../../models/tiles/tile-environment";
import { SharedDataSet, SharedDataSetType } from "../../models/shared/shared-data-set";
import { clueDataColorInfo } from "../../utilities/color-utils";
import { keyForValue } from "./bar-graph-utils";
import { SharedModelType } from "../../models/shared/shared-model";
import { ITileExportOptions } from "../../models/tiles/tile-content-info";
import { findLeastUsedNumber } from "../../utilities/math-utils";

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
    primaryAttributeColor: types.optional(types.number, 0),
    secondaryAttribute: types.maybe(types.string),
    // Map of secondary attribute keys to color indices. Each secondary attribute has its own map.
    secondaryAttributeColorMap: types.optional(types.map(types.map(types.number)), {}),
  })
  .views(self => ({
    exportJson(options?: ITileExportOptions) {
      const snapshot = getSnapshot(self);
      return stringify(snapshot, {maxLength: 200});
    },
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
          const cat = keyForValue(dataSet.getStrValue(caseID.__id__, primary));
          const subCat = keyForValue(dataSet.getStrValue(caseID.__id__, secondary));
          const selected = dataSet.isCaseSelected(caseID.__id__);
          const index = acc.findIndex(r => r[primary] === cat);
          if (index >= 0) {
            const cur = acc[index][subCat];
            if (isObject(cur)) {
              acc[index][subCat] = { count: cur.count + 1, selected: cur.selected || selected };
            } else {
              acc[index][subCat] = { count: 1, selected };
            }
          } else {
            const newRow = { [primary]: cat, [subCat]: { count: 1, selected } };
            acc.push(newRow);
          }
          return acc;
        }, [] as { [key: string]: BarInfo | string }[]);
      } else {
        // One-dimensional data
        return cases.reduce((acc, caseID) => {
          const cat = keyForValue(dataSet.getStrValue(caseID.__id__, primary));
          const selected = dataSet.isCaseSelected(caseID.__id__);
          const index = acc.findIndex(r => r[primary] === cat);
          if (index >= 0) {
            const cur = acc[index].value;
            if (isObject(cur)) {
              acc[index].value = { count: cur.count + 1, selected: cur.selected || selected };
            }
          } else {
            const newRow = { [primary]: cat, value: { count: 1, selected } };
            acc.push(newRow);
          }
          return acc;
        }, [] as { [key: string]: BarInfo | string }[]);
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
      const dataSet = self.sharedModel?.dataSet;
      const secondary = self.secondaryAttribute;
      if (!secondary || !dataSet || !self.cases) return [];
      return Array.from(new Set(self.cases.map(caseID => keyForValue(dataSet.getStrValue(caseID.__id__, secondary)))));
    },
    get maxDataValue(): number {
      return self.dataArray.reduce((acc, row) => {
        const rowValues = Object.values(row).map(v => isObject(v) ? v.count : 0);
        const maxInRow = Math.max(...rowValues);
        return Math.max(maxInRow, acc);
      }, 0);
    },
    get currentSecondaryAttributeColorMap() {
      return self.secondaryAttribute
        ? self.secondaryAttributeColorMap.get(self.secondaryAttribute) || new Map<string, number>()
        : new Map<string, number>();
    }
  }))
  .views(self => ({
    colorForSecondaryKey(key: string) {
      return self.currentSecondaryAttributeColorMap.get(key) ?? 0;
    },
    newEmptyColorMap() {
      return getSnapshot(types.map(types.number).create());
    }
  }))
  .actions(self => ({
    setPrimaryAttributeColor(colorIndex: number) {
      self.primaryAttributeColor = colorIndex;
    },
    setSecondaryAttributeKeyColor(key: string, colorIndex: number) {
      if (!self.secondaryAttribute) return;

      if (!self.secondaryAttributeColorMap.has(self.secondaryAttribute)) {
        self.secondaryAttributeColorMap.set(self.secondaryAttribute, self.newEmptyColorMap());
      }

      self.secondaryAttributeColorMap.get(self.secondaryAttribute)?.set(key, colorIndex);
    }
  }))
  .actions(self => ({
    updateSecondaryAttributeKeyColorMap() {
      if (!self.secondaryAttribute) return;

      if (!self.secondaryAttributeColorMap.has(self.secondaryAttribute)) {
        self.secondaryAttributeColorMap.set(self.secondaryAttribute, self.newEmptyColorMap());
      }

      const colorMap = self.secondaryAttributeColorMap.get(self.secondaryAttribute);

      for (const key of self.secondaryKeys) {
        if (!colorMap?.has(key)) {
          const color = findLeastUsedNumber(clueDataColorInfo.length, colorMap?.values() ?? []);
          self.setSecondaryAttributeKeyColor(key, color);
        }
      }
    }
  }))
  .actions(self => ({
    setYAxisLabel(text: string) {
      self.yAxisLabel = text;
    },
    setPrimaryAttribute(attrId?: string) {
      self.primaryAttribute = attrId;
      self.secondaryAttribute = undefined;
    },
    setSecondaryAttribute(attrId?: string) {
      self.secondaryAttribute = attrId;
      if (attrId) {
        self.updateSecondaryAttributeKeyColorMap();
      }
    },
    selectCasesByValues(primaryVal: string, secondaryVal?: string) {
      const dataSet = self.sharedModel?.dataSet;
      const cases = self.cases;
      const primaryAttribute = self.primaryAttribute;
      if (!dataSet || !cases || !primaryAttribute) return;
      const secondaryAttribute = self.secondaryAttribute;
      if (!secondaryAttribute && secondaryVal) return;
      let matchingCases = cases
        .filter(caseID => keyForValue(dataSet.getStrValue(caseID.__id__, primaryAttribute)) === primaryVal);
      if (secondaryAttribute && secondaryVal) {
        matchingCases = matchingCases
          .filter(caseID => keyForValue(dataSet.getStrValue(caseID.__id__, secondaryAttribute)) === secondaryVal);
      }
      const caseIds = matchingCases.map(caseID => caseID.__id__);
      dataSet.setSelectedCases(caseIds);
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
          // Set the primary attribute to the first non-image attribute
          const atts = self.sharedModel.dataSet.attributes;
          if (atts.length > 0) {
            for(const att of atts) {
              if (!att.includesAnyImages) {
                self.setPrimaryAttribute(att.id);
                break;
              }
            }
            // If all attributes were image-based, still pick the first.
            if (!self.primaryAttribute) {
              self.setPrimaryAttribute(atts[0].id);
            }
          }
        }
      }
      // Check if primary or secondary attribute has been deleted
      if (self.primaryAttribute && !self.sharedModel?.dataSet.attrFromID(self.primaryAttribute)) {
        self.setPrimaryAttribute(undefined); // this will also unset secondaryAttribute
      }
      if (self.secondaryAttribute && !self.sharedModel?.dataSet.attrFromID(self.secondaryAttribute)) {
        self.setSecondaryAttribute(undefined);
      }
      if (self.secondaryAttribute) {
        self.updateSecondaryAttributeKeyColorMap();
      }
    }
  }));

export interface BarGraphContentModelType extends Instance<typeof BarGraphContentModel> {}

export function isBarGraphModel(model?: ITileContentModel): model is BarGraphContentModelType {
  return model?.type === kBarGraphTileType;
}
