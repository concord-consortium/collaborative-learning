import { observable } from "mobx";
import {scaleQuantile, ScaleQuantile, schemeBlues} from "d3";
import { getSnapshot, Instance, ISerializedActionCall, SnapshotIn, types} from "mobx-state-tree";
import {AttributeType, attributeTypes} from "../../../models/data/attribute";
import { ICase } from "../../../models/data/data-set-types";
import { DataSet, IDataSet } from "../../../models/data/data-set";
import {getCategorySet, ISharedCaseMetadata, SharedCaseMetadata} from "../../../models/shared/shared-case-metadata";
import {isRemoveAttributeAction, isSetCaseValuesAction} from "../../../models/data/data-set-actions";
import {FilteredCases, IFilteredChangedCases} from "../../../models/data/filtered-cases";
import {typedId, uniqueId} from "../../../utilities/js-utils";
import {missingColor} from "../../../utilities/color-utils";
import {onAnyAction} from "../../../utilities/mst-utils";
import {CaseData} from "../d3-types";
import {GraphAttrRole, graphPlaceToAttrRole, PrimaryAttrRoles, TipAttrRoles} from "../graph-types";
import {AxisPlace} from "../imports/components/axis/axis-types";
import {GraphPlace} from "../imports/components/axis-graph-shared";

export const AttributeDescription = types
  .model('AttributeDescription', {
    attributeID: types.string,
    // user-specified type, e.g. treat as numeric
    type: types.maybe(types.enumeration([...attributeTypes]))
  })
  .actions(self => ({
    setType(type: AttributeType) {
      self.type = type;
    }
  }));

export type RoleAttrIDPair = { role: GraphAttrRole, attributeID: string };

export interface IAttributeDescriptionSnapshot extends SnapshotIn<typeof AttributeDescription> {
}

/**
 * A note about cases:
 * - For situations in which there is exactly one y-attribute, there exists one set of cases, filtered
 *    by the presence of values for all assigned attributes, neglecting caption and legend.
 *  - But when there is more than one y-attribute, there is one set of cases for each y-attribute. So
 *    we have to choose the set of cases we are referring to. To keep the api as simple as possible we provide a
 *    set of access methods that do not require the user to specify which set of cases they are
 *    interested in. For these methods, the assumption is that the caseArrayNumber is 0.
 *  -
 */

export const DataConfigurationModel = types
  .model('DataConfigurationModel', {
    id: types.optional(types.identifier, () => typedId("DCON")),
    dataset: types.safeReference(DataSet),
    metadata: types.safeReference(SharedCaseMetadata),
    // determines stacking direction in categorical-categorical, for instance
    primaryRole: types.maybe(types.enumeration([...PrimaryAttrRoles])),
    // keys are GraphAttrRoles, excluding y role
    _attributeDescriptions: types.map(AttributeDescription),
    // all attributes for (left) y role
    _yAttributeDescriptions: types.array(AttributeDescription),
  })
  .volatile(() => ({
    actionHandlerDisposer: undefined as (() => void) | undefined,
    filteredCases: observable.array<FilteredCases>([], {deep:false }),
    handlers: new Map<string, (actionCall: ISerializedActionCall) => void>(),
    pointsNeedUpdating: false
  }))
  .views(self => ({
    get isEmpty() {
      return self._attributeDescriptions.size + self._yAttributeDescriptions.length === 0;
    },
    get secondaryRole() {
      return self.primaryRole === 'x' ? 'y'
        : self.primaryRole === 'y' ? 'x'
          : '';
    },
    get y2AttributeDescriptionIsPresent() {
      return !!self._attributeDescriptions.get('rightNumeric');
    },
    get yAttributeDescriptionsExcludingY2() {
      return self._yAttributeDescriptions;
    },
    // Includes rightNumeric if present
    get yAttributeDescriptions() {
      const descriptions = self._yAttributeDescriptions,
        y2Description = self._attributeDescriptions.get('rightNumeric') ?? null;
      return descriptions.concat(y2Description ? [y2Description] : []);
    },
    get xAttributeID() {
      const xAttributeDescription = self._attributeDescriptions.get("x");
      return xAttributeDescription?.attributeID ?? "";
    },
    // Includes rightNumeric if present
    get yAttributeIDs() {
      return this.yAttributeDescriptions.map((d: IAttributeDescriptionSnapshot) => d.attributeID);
    },
    attributeIdforPlotNumber(plotNum: number) {
      return this.yAttributeIDs[plotNum];
    },
    /**
     * Returns the sequential number of the given Y attribute ID.
     * This includes the rightNumeric attribute if any.
     * If the attribute ID is not found, returns undefined.
     * @param id ID that should be one of the Y attributes.
     */
    plotNumberForAttributeID(id: string) {
      const index = this.yAttributeIDs.indexOf(id);
      return index >= 0 ? index : undefined;
    },
    /**
     * No attribute descriptions beyond the first for y are returned.
     * The rightNumeric attribute description is also not returned.
     */
    get attributeDescriptions() {
      const descriptions = {...getSnapshot(self._attributeDescriptions)};
      delete descriptions.rightNumeric;
      if (self._yAttributeDescriptions.length > 0) {
        descriptions.y = self._yAttributeDescriptions[0];
      }
      return descriptions;
    },
    get defaultCaptionAttributeID() {
      // In v2, the caption is the attribute left-most in the child-most collection among plotted attributes
      // Until we have better support for hierarchical attributes, we just return the left-most attribute.
      return self.dataset?.attributes[0]?.id;
    },
    /**
     * Return a single attributeDescription in use for the given role.
     * For the 'y' role we return the first y-attribute, for 'rightNumeric' we return the last y-attribute.
     * For all other roles we return the attribute description for the role.
     */
    attributeDescriptionForRole(role: GraphAttrRole) {
      return role === 'y' ? this.yAttributeDescriptions[0]
        : role === 'rightNumeric' ? self._attributeDescriptions.get('rightNumeric')
          : this.attributeDescriptions[role];
    },
    /**
     * Return a single attributeID in use for the given role.
     */
    attributeID(role: GraphAttrRole) {
      let attrID = this.attributeDescriptionForRole(role)?.attributeID;
      if ((role === "caption") && !attrID) {
        attrID = this.defaultCaptionAttributeID;
      }
      return attrID;
    },
    /**
     * Return the list of roles that the given attribute is currently assigned to.
     * Will include 'y' if the attribute is the only Y attribute, or 'yPlus' if it
     * is one of several.
     * @param attrID attribute ID
     * @returns list (possibly empty) of GraphAttrRole
     */
    rolesForAttribute(attrID: string) {
      const roles: GraphAttrRole[] = [];
      self._attributeDescriptions.forEach((desc, role) => {
        if (desc?.attributeID === attrID) {
          roles.push(role as GraphAttrRole);
        }
        if (this.yAttributeIDs.includes(attrID)) {
          // role depends on whether there are attributes remaining
          roles.push(this.yAttributeDescriptions.length > 1 ? "yPlus" : "y");
        }
      });
      return roles;
    },
    attributeType(role: GraphAttrRole) {
      const desc = this.attributeDescriptionForRole(role);
      const attrID = this.attributeID(role);
      const attr = attrID ? self.dataset?.attrFromID(attrID) : undefined;
      return desc?.type || attr?.type;
    },
    attributeTypeForID(attributeId: string) {
      let attributeDesc;
      const plotNum = this.plotNumberForAttributeID(attributeId);
      if (plotNum !== undefined) {
        attributeDesc = self._yAttributeDescriptions[plotNum];
      } else {
        self._attributeDescriptions.forEach((desc,role) => {
          if (desc.attributeID === attributeId) {
            attributeDesc = desc;
          }
        });
      }
      if (attributeDesc?.type) {
        return attributeDesc.type;
      }
      return self.dataset?.attrFromID(attributeId)?.type;
    },
    get places() {
      const places = new Set<string>(Object.keys(this.attributeDescriptions));
      self.dataset?.attributes.length && places.add("caption");
      return Array.from(places) as GraphAttrRole[];
    },
    placeCanHaveZeroExtent(place: GraphPlace) {
      return ['rightNumeric', 'legend', 'top', 'rightCat'].includes(place) &&
        this.attributeID(graphPlaceToAttrRole[place]) === '';
    },
    placeCanShowClickHereCue(place: GraphPlace) {
      const role = graphPlaceToAttrRole[place];
      return ['left', 'bottom'].includes(place) && !this.attributeID(role);
    },
    placeAlwaysShowsClickHereCue(place: GraphPlace) {
      return this.placeCanShowClickHereCue(place) &&
        !this.attributeID(graphPlaceToAttrRole[place === 'left' ? 'bottom' : 'left']);
    },
    placeShouldShowClickHereCue(place: GraphPlace, tileHasFocus: boolean) {
      return this.placeAlwaysShowsClickHereCue(place) ||
        (this.placeCanShowClickHereCue(place) && tileHasFocus);
    },
    isCaseInSubPlot(subPlotKey: Record<string, string>, caseData: Record<string, any>) {
      const numOfKeys = Object.keys(subPlotKey).length;
      let matchedValCount = 0;
      Object.keys(subPlotKey).forEach(key => {
        if (subPlotKey[key] === caseData[key]) matchedValCount++;
      });
      return matchedValCount === numOfKeys;
    }
  }))
  .views(self => ({
    get primaryAttributeID(): string {
      return self.primaryRole && self.attributeID(self.primaryRole) || '';
    },
    get secondaryAttributeID(): string {
      return self.secondaryRole && self.attributeID(self.secondaryRole) || '';
    },
    get graphCaseIDs() {
      const allGraphCaseIds = new Set<string>();
      // todo: We're bypassing get caseDataArray to avoid infinite recursion. Is it necessary?
      self.filteredCases.forEach(aFilteredCases => {
        if (aFilteredCases) {
          aFilteredCases.caseIds.forEach(id => allGraphCaseIds.add(id));
        }
      });
      return allGraphCaseIds;
    },
    subPlotCases(subPlotKey: Record<string, string>) {
      const casesInPlot = [] as ICase[];
      self.filteredCases.forEach(aFilteredCases => {
        aFilteredCases.caseIds.forEach((id) => {
          const caseData = self.dataset?.getCanonicalCase(id);
          if (caseData) {
            self.isCaseInSubPlot(subPlotKey, caseData) && casesInPlot.push(caseData);
          }
        });
      });
      return casesInPlot;
    }
  }))
  .actions(self => ({
    /**
     * Low-level method to set the attribute description for a graph role.
     * If no attribute description is provided, the role will be made empty.
     * Not used for Y attributes, which have their own set/remove methods.
     * @param iRole the graph role (not including 'y')
     * @param iDesc IAttributeDescriptionSnapshot (eg attribute and type)
     */
    _setAttributeDescription(iRole: GraphAttrRole, iDesc?: IAttributeDescriptionSnapshot) {
      if (iDesc?.attributeID) {
        self._attributeDescriptions.set(iRole, iDesc);
      } else {
        self._attributeDescriptions.delete(iRole);
      }
    }
  }))
  .actions(self => ({
    setPointsNeedUpdating(needUpdating: boolean) {
      self.pointsNeedUpdating = needUpdating;
    }
  }))
  .views(self => ({
    filterCase(data: IDataSet, caseID: string, caseArrayNumber?: number) {
      const hasY2 = !!self._attributeDescriptions.get('rightNumeric'),
        numY = self._yAttributeDescriptions.length,
        descriptions = {...self.attributeDescriptions};
      if (hasY2 && caseArrayNumber === self._yAttributeDescriptions.length) {
        descriptions.y = self._attributeDescriptions.get('rightNumeric') ?? descriptions.y;
      } else if (caseArrayNumber != null && caseArrayNumber < numY) {
        descriptions.y = self._yAttributeDescriptions[caseArrayNumber];
      }
      delete descriptions.rightNumeric;
      return Object.entries(descriptions).every(([role, {attributeID}]) => {
        // can still plot the case without a caption or a legend
        if (["caption", "legend"].includes(role)) return true;
        switch (self.attributeType(role as GraphAttrRole)) {
          case "numeric":
            return isFinite(data.getNumeric(caseID, attributeID) ?? NaN);
          default:
            // for now, all other types must just be non-empty
            return !!data.getValue(caseID, attributeID);
        }
      });
    }
  }))
  .views(self => ({
    yAttributeID(index: number) {
      if (index < self.yAttributeDescriptions.length) {
        return self.yAttributeDescriptions[index].attributeID;
      }
      return "";
    },
    get attributes() {
      return self.places.map(place => self.attributeID(place)).filter(attrID => !!attrID) as string[];
    },
    get uniqueAttributes() {
      return Array.from(new Set<string>(this.attributes));
    },
    get tipAttributes(): RoleAttrIDPair[] {
      return TipAttrRoles
        .map(role => {
          return {role, attributeID: self.attributeID(role) || ''};
        })
        .filter(pair => !!pair.attributeID);
    },
    get uniqueTipAttributes() {
      const tipAttributes = this.tipAttributes,
        idCounts: Record<string, number> = {};
      tipAttributes.forEach((aPair: RoleAttrIDPair) => {
        idCounts[aPair.attributeID] = (idCounts[aPair.attributeID] || 0) + 1;
      });
      return tipAttributes.filter((aPair: RoleAttrIDPair) => {
        if (idCounts[aPair.attributeID] > 1) {
          idCounts[aPair.attributeID]--;
          return false;
        }
        return true;
      });
    },
    /**
     * Return true if no attribute has been assigned to any graph role (other than caption).
     * The first attribute is always assigned as 'caption', so that does not count.
     */
    get noAttributesAssigned() {
      return this.attributes.length <= 1;
    },
    get numberOfPlots() {
      return self.filteredCases.length ?? 0;  // filteredCases is an array of CaseArrays
    },
    get hasY2Attribute() {
      return !!self.attributeID('rightNumeric');
    },
    /**
     * Note that in order to eliminate a selected case from the graph's selection, we have to check that it is not
     * present in any of the case sets, not just the 0th one.
     */
    get caseSelection() {
      if (!self.dataset || self.filteredCases.length === 0) return [];
      const caseSelection = Array.from(self.dataset.caseSelection as Set<string>),
        allGraphCaseIds = self.graphCaseIDs;
      return caseSelection.filter((caseId: string) => allGraphCaseIds.has(caseId));
    }
  }))
  .views(self => (
    {
      // Note that we have to go through each of the filteredCases in order to return all the values
      valuesForAttrRole(role: GraphAttrRole): string[] {
        const attrID = self.attributeID(role),
          dataset = self.dataset,
          allGraphCaseIds = Array.from(self.graphCaseIDs),
          allValues = attrID ? allGraphCaseIds.map((anID: string) => String(dataset?.getValue(anID, attrID)))
            : [];
        return allValues.filter(aValue => aValue !== '');
      },
      numericValuesForAttrRole(role: GraphAttrRole): number[] {
        if (role==='y') {
          // For Y axis, have to consider multiple attributes
          return this.numericValuesForYAxis;
        } else {
          return this.valuesForAttrRole(role).map((aValue: string) => Number(aValue))
            .filter((aValue: number) => isFinite(aValue));
        }
      },
      get numericValuesForYAxis() {
        const allGraphCaseIds = Array.from(self.graphCaseIDs),
          allValues: number[] = [];

        return self.yAttributeIDs.reduce((acc: number[], yAttrID: string) => {
          const values = allGraphCaseIds.map((anID: string) => Number(self.dataset?.getValue(anID, yAttrID)));
          return acc.concat(values);
        }, allValues);
      },
      categorySetForAttrRole(role: GraphAttrRole) {
        if (self.metadata) {
          const attributeID = self.attributeID(role) || '';
          return getCategorySet(self.metadata, attributeID);
        }
      },
      /**
       * Todo: This method is inefficient since it has to go through all the cases in the graph to determine
       * which categories are present. It should be replaced by some sort of functionality that allows
       * caching of the categories that have been determined to be valid.
       * @param role
       */
      categoryArrayForAttrRole(role: GraphAttrRole, emptyCategoryArray = ['__main__']): string[] {
        let categoryArray: string[] = [];
        if (self.metadata) {
          const attributeID = self.attributeID(role) || '',
            categorySet = getCategorySet(self.metadata, attributeID),
            validValues: Set<string> = new Set(this.valuesForAttrRole(role));
          categoryArray = (categorySet?.values || emptyCategoryArray)
                            .filter((aValue: string) => validValues.has(aValue));
        }
        if (categoryArray.length === 0) {
          categoryArray = emptyCategoryArray;
        }
        return categoryArray;
      },
      numRepetitionsForPlace(place: GraphPlace) {
        // numRepetitions is the number of times an axis is repeated in the graph
        let numRepetitions = 1;
        switch (place) {
          case 'left':
            numRepetitions = Math.max(this.categoryArrayForAttrRole('rightSplit').length, 1);
            break;
          case 'bottom':
            numRepetitions = Math.max(this.categoryArrayForAttrRole('topSplit').length, 1);
        }
        return numRepetitions;
      }
    }))
  .views(self => ({
    getUnsortedCaseDataArray(caseArrayNumber: number): CaseData[] {
      if (self.filteredCases.length <= caseArrayNumber) return [];
      return (self.filteredCases[caseArrayNumber].caseIds || []).map(id => {
        return {
          dataConfigID: self.id,
          plotNum: caseArrayNumber,
          caseID: id
        };
      });
    },
    getCaseDataArray(caseArrayNumber: number) {
      const caseDataArray = this.getUnsortedCaseDataArray(caseArrayNumber),
        legendAttrID = self.attributeID('legend');
      if (legendAttrID) {
        const categories = Array.from(self.categoryArrayForAttrRole('legend'));
        caseDataArray.sort((cd1: CaseData, cd2: CaseData) => {
          const cd1_Value = self.dataset?.getStrValue(cd1.caseID, legendAttrID) ?? '',
            cd2_value = self.dataset?.getStrValue(cd2.caseID, legendAttrID) ?? '';
          return categories.indexOf(cd1_Value) - categories.indexOf(cd2_value);
        });
      }
      return caseDataArray;
    },
    getJoinedCaseDataArrays(xType: AttributeType|undefined, yType?: AttributeType|undefined) {
      const joinedCaseData: CaseData[] = [];
      // If X axis doesn't match the given current X axis type, then none of our cases get plotted.
      if (self.attributeType("x") !== xType) {
        return joinedCaseData;
      }

      self.filteredCases.forEach((aFilteredCases, index) => {
        // If Y attribute of the attribute in question here doesn't match, skip this attribute.
        const relatedAttribute = self.yAttributeDescriptions[index]?.attributeID;
        if (self.attributeTypeForID(relatedAttribute) === yType) {
          aFilteredCases.caseIds.forEach(
            (id) => joinedCaseData.push({
              dataConfigID: self.id,
              plotNum: index,
              caseID: id
            }));
        }
      });
      return joinedCaseData;
    },
    get caseDataArray() {
      return this.getCaseDataArray(0);
    }
  }))
  .extend(self => {
    // TODO: This is a hack to get around the fact that MST doesn't seem to cache this as expected
    // when implemented as simple view.
    let quantileScale: ScaleQuantile<string> | undefined = undefined;

    return {
      views: {
        get legendQuantileScale() {
          if (!quantileScale) {
            quantileScale = scaleQuantile(self.numericValuesForAttrRole('legend'), schemeBlues[5]);
          }
          return quantileScale;
        },
      },
      actions: {
        invalidateQuantileScale() {
          quantileScale = undefined;
        }
      }
    };
  })
  .views(self => (
    {
      getLegendColorForCategory(cat: string): string {
        const categorySet = self.categorySetForAttrRole('legend');
        return categorySet?.colorForCategory(cat) ?? missingColor;
      },

      getLegendColorForNumericValue(value: number): string {
        return self.legendQuantileScale(value);
      },

      selectCasesForLegendValue(aValue: string, extend = false) {
        const dataset = self.dataset,
          legendID = self.attributeID('legend');
          let selection: string[] = [];
        selection = legendID ? self.caseDataArray.filter((aCaseData: CaseData) => {
          return dataset?.getValue(aCaseData.caseID, legendID) === aValue;
        }).map((aCaseData: CaseData) => aCaseData.caseID)
          : [];
        if (selection) {
          if (extend) dataset?.selectCases(selection);
          else dataset?.setSelectedCases(selection);
        }
      },
      allCasesForCategoryAreSelected(cat: string) {
        const dataset = self.dataset,
          legendID = self.attributeID('legend'),
          selection = (legendID && self.caseDataArray.filter((aCaseData: CaseData) => {
            return dataset?.getValue(aCaseData.caseID, legendID) === cat;
          }).map((aCaseData: CaseData) => aCaseData.caseID)) ?? [];
        return selection.length > 0 && (selection as Array<string>).every(anID => dataset?.isCaseSelected(anID));
      },
      selectedCasesForLegendQuantile(quantile: number) {
        const dataset = self.dataset,
          legendID = self.attributeID('legend'),
          thresholds = self.legendQuantileScale.quantiles(),
          min = quantile === 0 ? -Infinity : thresholds[quantile - 1],
          max = quantile === thresholds.length ? Infinity : thresholds[quantile],
          selection: string[] = legendID && legendID !== ''
            ? self.caseDataArray.filter((aCaseData: CaseData) => {
              const value = dataset?.getNumeric(aCaseData.caseID, legendID);
              return value !== undefined && value >= min && value < max;
            }).map((aCaseData: CaseData) => aCaseData.caseID)
            : [];
        return selection;
      },
      selectCasesForLegendQuantile(quantile: number, extend = false) {
        const selection = this.selectedCasesForLegendQuantile(quantile);
        if (selection) {
          if (extend) self.dataset?.selectCases(selection);
          else self.dataset?.setSelectedCases(selection);
        }
      },
      casesInQuantileAreSelected(quantile: number): boolean {
        const selection = this.selectedCasesForLegendQuantile(quantile);
        return !!(selection.length > 0 && selection?.every((anID: string) => self.dataset?.isCaseSelected(anID)));
      }
    }))
  .views(self => (
    {
      getLegendColorForCase(id: string): string {
        const legendID = self.attributeID('legend'),
          legendType = self.attributeType('legend'),
          legendValue = id && legendID ? self.dataset?.getStrValue(id, legendID) : null;
        return legendValue == null ? ''
          : legendType === 'categorical' ? self.getLegendColorForCategory(legendValue)
            : legendType === 'numeric' ? self.getLegendColorForNumericValue(Number(legendValue))
              : '';
      },
      categorySetForPlace(place: AxisPlace) {
        if (self.metadata) {
          const role = graphPlaceToAttrRole[place];
          return getCategorySet(self.metadata, self.attributeID(role) ?? '');
        }
      },
      /**
       * Called to determine whether the categories on an axis should be centered.
       * If the attribute is playing a primary role, then it should be centered.
       * If it is a secondary role, then it should not be centered.
       * 'top' and 'rightCat' are always centered.
       */
      categoriesForAxisShouldBeCentered(place: AxisPlace) {
        const role = graphPlaceToAttrRole[place],
          primaryRole = self.primaryRole;
        return primaryRole === role || !['left', 'bottom'].includes(place);
      },
      graphPlaceCanAcceptAttributeIDDrop(place: GraphPlace, dataSet?: IDataSet, idToDrop?: string) {
        const role = graphPlaceToAttrRole[place],
          typeToDropIsNumeric = !!idToDrop && dataSet?.attrFromID(idToDrop)?.type === 'numeric',
          xIsNumeric = self.attributeType('x') === 'numeric',
          existingID = self.attributeID(role);
        // only drops on left/bottom axes can change data set
        if (dataSet?.id !== self.dataset?.id && !['left', 'bottom'].includes(place)) {
          return false;
        }
        if (place === 'yPlus') {
          return xIsNumeric && typeToDropIsNumeric && !!idToDrop && !self.yAttributeIDs.includes(idToDrop);
        } else if (place === 'rightNumeric') {
          return xIsNumeric && typeToDropIsNumeric && !!idToDrop && existingID !== idToDrop;
        } else if (['top', 'rightCat'].includes(place)) {
          return !typeToDropIsNumeric && !!idToDrop && existingID !== idToDrop;
        } else {
          return !!idToDrop && existingID !== idToDrop;
        }
      }
    }))
  .actions(self => ({
    beforeDestroy() {
      self.actionHandlerDisposer?.();
    },
    /**
     * This is called when the user swaps categories in the legend, but not when the user swaps categories
     * by dragging categories on an axis.
     * @param role
     */
    storeAllCurrentColorsForAttrRole(role: GraphAttrRole) {
      const categorySet = self.categorySetForAttrRole(role);
      if (categorySet) {
        categorySet.storeAllCurrentColors();
      }
    },
    swapCategoriesForAttrRole(role: GraphAttrRole, catIndex1: number, catIndex2: number) {
      const categoryArray = self.categoryArrayForAttrRole(role),
        numCategories = categoryArray.length,
        categorySet = self.categorySetForAttrRole(role);
      if (catIndex2 < catIndex1) {
        const temp = catIndex1;
        catIndex1 = catIndex2;
        catIndex2 = temp;
      }
      if (categorySet && numCategories > catIndex1 && numCategories > catIndex2) {
        const cat1 = categoryArray[catIndex1],
          beforeCat = catIndex2 < numCategories - 1 ? categoryArray[catIndex2 + 1] : undefined;
        categorySet.move(cat1, beforeCat);
      }
    },
    handleAction(actionCall: ISerializedActionCall) {
      // forward all actions from dataset except "setCaseValues" which requires intervention
      if (isSetCaseValuesAction(actionCall)) return;
      self.handlers.forEach(handler => handler(actionCall));
    },
    handleSetCaseValues(actionCall: ISerializedActionCall, cases: IFilteredChangedCases) {
      if (!isSetCaseValuesAction(actionCall)) return;
      let [affectedCases, affectedAttrIDs] = actionCall.args;
      // this is called by the FilteredCases object with additional information about
      // whether the value changes result in adding/removing any cases from the filtered set
      // a single call to setCaseValues can result in up to three calls to the handlers
      if (cases.added.length) {
        const newCases = self.dataset?.getCases(cases.added);
        self.handlers.forEach(handler => handler({name: "addCases", args: [newCases]}));
      }
      if (cases.removed.length) {
        self.handlers.forEach(handler => handler({name: "removeCases", args: [cases.removed]}));
      }
      if (cases.changed.length) {
        const idSet = new Set(cases.changed);
        const changedCases = affectedCases.filter(aCase => idSet.has(aCase.__id__));
        self.handlers.forEach(handler => handler({name: "setCaseValues", args: [changedCases]}));
      }
      // Changes to case values require that existing cached categorySets be wiped.
      // But if we know the ids of the attributes involved, we can determine whether
      // an attribute that has a cache is involved
      if (!affectedAttrIDs && affectedCases.length === 1) {
        affectedAttrIDs = Object.keys(affectedCases[0]);
      }
      if (affectedAttrIDs) {
        for (const [key, desc] of Object.entries(self.attributeDescriptions)) {
          if (affectedAttrIDs.includes(desc.attributeID)) {
            if (key === "legend") {
              self.invalidateQuantileScale();
            }
          }
        }
      } else {
        self.invalidateQuantileScale();
      }
    }
  }))
  .actions(self => ({
    _addNewFilteredCases() {
      self.dataset && self.filteredCases
        ?.push(new FilteredCases({
          casesArrayNumber: self.filteredCases.length,
          source: self.dataset, filter: self.filterCase,
          onSetCaseValues: self.handleSetCaseValues
        }));
      self.setPointsNeedUpdating(true);
    },
    /**
     * Make sure the filteredCases array has the right number of FilteredCases.
     * For CLUE, this should be equal to the number of Y attributes,
     * or 1 if there is a dataset but no Y attributes. If there is no dataset
     * there are no filteredCases.
     * If this method adds or removes FilteredCases from the array, it will
     * invalidate the cached case lists.
     *
     * @param alwaysInvalidate - If true, the caches of all FilteredCases are
     * invalidated even if we did not modify the array.
     */
    syncFilteredCasesCount(alwaysInvalidate?: boolean) {
      let desiredCount = self.dataset ? self.yAttributeDescriptions.length : 0;
      if (desiredCount === 0 && self.dataset) {
        desiredCount = 1;
      }
      const changed = self.filteredCases.length !== desiredCount;
      while(self.filteredCases.length > desiredCount) {
        self.filteredCases.pop()?.destroy();
      }
      while(self.filteredCases.length < desiredCount) {
        this._addNewFilteredCases();
      }
      if (alwaysInvalidate || changed) {
        // Optimization: just invalidate some, not all, in cases where we know some are unchanged.
        self.filteredCases.forEach((aFilteredCases) => {
          aFilteredCases.invalidateCases();
        });
      }
    },
    setDataset(dataset: IDataSet | undefined, metadata: ISharedCaseMetadata | undefined) {
      self.dataset = dataset;
      self.metadata = metadata;
      this.handleDataSetChange();
    },
    handleDataSetChange() {
      self.actionHandlerDisposer?.();
      self.actionHandlerDisposer = undefined;
      if (self.dataset) {
        self.actionHandlerDisposer = onAnyAction(self.dataset, self.handleAction);
      }
      this.syncFilteredCasesCount(true);
      self.invalidateQuantileScale();
    },
    setPrimaryRole(role: GraphAttrRole) {
      if (role === 'x' || role === 'y') {
        self.primaryRole = role;
      }
    },
    /**
     * Remove all attributes currently in our lists.
     */
    clearAttributes() {
      // Clear the attributes one by one so that reactions can happen
      while (self._yAttributeDescriptions.length) {
        this.removeYAttributeWithID(self._yAttributeDescriptions[0].attributeID);
      }
      for (const [role] of self._attributeDescriptions) {
        this.removeAttributeFromRole(role as GraphAttrRole);
      }
    },
    /**
     * Unset any attribute currently in the given role.
     * Not used for Y attributes, which have their own methods.
     * @param role GraphAttrRole, not inluding 'y'
     */
    removeAttributeFromRole(role: GraphAttrRole) {
      self._setAttributeDescription(role);
    },
    /**
     * Assign the Attribute to the given graph role.
     * By default will also select the attribute.
     * @param role graph role.
     * @param desc attribute description, including the attribute ID and optionally a type.
     * @param select boolean default true to select the attribute.
     */
    setAttributeForRole(role: GraphAttrRole, desc?: IAttributeDescriptionSnapshot, select: boolean=true) {
      if (role === 'y') {
        // Setting "Y" role implies that user only wants one, or no Y attributes.
        while (self._yAttributeDescriptions.length) {
          this.removeYAttributeWithID(self._yAttributeDescriptions[0].attributeID);
        }
        if (desc && desc.attributeID !== '') {
          self._yAttributeDescriptions.push(desc);
        }
      } else if (role === 'yPlus' && desc && desc.attributeID !== '') {
        self._yAttributeDescriptions.push(desc);
      } else if (role === 'rightNumeric') {
        this.setY2Attribute(desc);
      } else {
        self._setAttributeDescription(role, desc);
      }
      if (desc && select) {
        self.dataset?.setSelectedAttributes([desc.attributeID]);
      }
      this.syncFilteredCasesCount(true);
      if (role === 'legend') {
        self.invalidateQuantileScale();
      }
    },
    addYAttribute(desc: IAttributeDescriptionSnapshot) {
      this.setAttributeForRole("yPlus", desc);
    },
    /**
     * Replace an existing Y attribute with a different one, maintaining its position in the list.
     * If the new attribute is already in the list of Y attributes, it will be removed from
     * the old position to prevent duplication.
     */
    replaceYAttribute(oldAttrId: string, newAttrId: string) {
      if (self.yAttributeIDs.includes(oldAttrId)) {
        if (self.yAttributeIDs.includes(newAttrId)) {
          // Remove the new attribute from its other position
          this.removeYAttributeWithID(newAttrId);
        }
        const index = self._yAttributeDescriptions.findIndex(d=>d.attributeID===oldAttrId);
        self._yAttributeDescriptions[index].attributeID = newAttrId;
        self.dataset?.setSelectedAttributes([newAttrId]);
        if (index === 0 && self._yAttributeDescriptions.length === 1) {
          self._yAttributeDescriptions[index].type = undefined;
        }
        self.filteredCases[index].invalidateCases();
      }
    },
    setY2Attribute(desc?: IAttributeDescriptionSnapshot) {
      const isNewAttribute = !self._attributeDescriptions.get('rightNumeric'),
        isEmpty = !desc?.attributeID;
      self._setAttributeDescription('rightNumeric', desc);
      this.syncFilteredCasesCount();
      if (isEmpty) {
        self.setPointsNeedUpdating(true);
      } else if (!isNewAttribute) {
        // Replacing one attribute with another, invalidate that specific cache
        const existingFilteredCases = self.filteredCases[self.filteredCases.length - 1];
        existingFilteredCases?.invalidateCases();
      }
    },
    /**
     * Remove the attribute with the given ID from the list of y attributes plotted.
     * Note, calls to this method are observed by Graph's handleNewAttributeID method.
     * @param id - ID of Attribute to remove.
     */
    removeYAttributeWithID(id: string) {
      const index = self._yAttributeDescriptions.findIndex((aDesc) => aDesc.attributeID === id);
      if (index >= 0) {
        self._yAttributeDescriptions.splice(index, 1);
        this.syncFilteredCasesCount(true);
        self.setPointsNeedUpdating(true);
      }
    },
    // Sets the type of the attribute in the given role.
    // An attribute ID may be given if specifying the role is ambiguous (eg there can be multple Y attributes)
    setAttributeType(role: GraphAttrRole, type: AttributeType, plotNumber = 0, attributeId?: string) {
      if (role === 'y') {
        if (attributeId) {
          self._yAttributeDescriptions.find(desc => desc.attributeID === attributeId)?.setType(type);
        } else {
          self._yAttributeDescriptions[plotNumber]?.setType(type);
        }
      } else {
        self._attributeDescriptions.get(role)?.setType(type);
      }
      self.filteredCases.forEach((aFilteredCases) => {
        aFilteredCases.invalidateCases();
      });
    },
    /**
     * Register a "handler" to be called on any action in the linked dataset.
     * @param handler - a method that accepts an actionCall parameter.
     */
    onAction(handler: (actionCall: ISerializedActionCall) => void) {
      const id = uniqueId();
      self.handlers.set(id, handler);
      return () => {
        self.handlers.delete(id);
      };
    },
    afterCreate() {
      this.onAction(this.handleDatasetRemoveAttributeAction);
    },
    /**
     * Respond to an attribute being removed from the underlying dataset.
     */
    handleDatasetRemoveAttributeAction(actionCall: ISerializedActionCall) {
      if (isRemoveAttributeAction(actionCall)) {
        const removedAttributeId = actionCall.args[0];
        for (const [role, desc] of self._attributeDescriptions.entries()) {
          if (desc.attributeID===removedAttributeId) {
            this.removeAttributeFromRole(role as GraphAttrRole);
          }
        }
        for (const desc of self._yAttributeDescriptions) {
          if (desc.attributeID===removedAttributeId) {
            this.removeYAttributeWithID(removedAttributeId);
          }
        }
      }
    }

  }));

export interface IDataConfigurationModel extends Instance<typeof DataConfigurationModel> {
}

export type AttributeAssignmentAction =
  SetAttributeForRoleAction | ReplaceYAttributeAction | RemoveAttributeFromRoleAction | RemoveYAttributeWithIDAction;
export function isAttributeAssignmentAction(action: ISerializedActionCall): action is AttributeAssignmentAction {
  return isSetAttributeForRoleAction(action)
    || isReplaceYAttributeAction(action)
    || isRemoveAttributeFromRoleAction(action)
    || isRemoveYAttributeWithIDAction(action);
}

export interface SetAttributeForRoleAction extends ISerializedActionCall {
  name: "SetAttributeForRole",
  args: [role: GraphAttrRole, desc?: IAttributeDescriptionSnapshot]
}
export function isSetAttributeForRoleAction(action: ISerializedActionCall): action is SetAttributeForRoleAction {
  return action.name === "setAttributeForRole";
}

export interface ReplaceYAttributeAction extends ISerializedActionCall {
  name: "ReplaceYAttribute",
  args: [oldAttrId: string, newAttrId: string]
}
export function isReplaceYAttributeAction(action: ISerializedActionCall): action is ReplaceYAttributeAction {
  return action.name === "replaceYAttribute";
}

export interface RemoveAttributeFromRoleAction extends ISerializedActionCall {
  name: "removeAttributeFromRole",
  args: [role: GraphAttrRole]
}
export function isRemoveAttributeFromRoleAction(action: ISerializedActionCall):
      action is RemoveAttributeFromRoleAction {
  return action.name === "removeAttributeFromRole";
}

export interface RemoveYAttributeWithIDAction extends ISerializedActionCall {
  name: "removeYAttributeWithID",
  args: [attrId: string]
}
export function isRemoveYAttributeWithIDAction(action: ISerializedActionCall): action is RemoveYAttributeWithIDAction {
  return action.name === "removeYAttributeWithID";
}
