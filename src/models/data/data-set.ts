import { cloneDeep, findIndex } from "lodash";
import { observable } from "mobx";
import { applyAction, getEnv, hasEnv, Instance, ISerializedActionCall,
          onAction, types, getSnapshot, SnapshotOut } from "mobx-state-tree";
import { Attribute, IAttribute, IAttributeSnapshot } from "./attribute";
import { uniqueId, uniqueSortableId } from "../../utilities/js-utils";
import { CaseGroup } from "./data-set-types";
import { compareValues } from "./data-set-utils";
import { getCellFromId, getCellId, ICell, IValueType, uniqueCaseIds } from "./data-types";
import { getAppConfig } from "../tiles/tile-environment";

export const newCaseId = uniqueSortableId;

export const CaseID = types.model("CaseID", {
  __id__: types.optional(types.identifier, () => newCaseId())
  // __index__: types.number
});
export interface ICaseID extends Instance<typeof CaseID> {}

export interface ICase {
  __id__: string;
  [key: string]: IValueType;
}
export interface ICaseCreation {
  __id__?: string;
  [key: string]: IValueType | null;
}

export type ICaseFilter = (aCase: ICase) => ICase | undefined;

export interface IDerivationSpec {
  attributeIDs?: string[];
  filter?: ICaseFilter;
  synchronize?: boolean;
}

interface IEnvContext {
  srcDataSet?: IDataSet;
  derivationSpec?: IDerivationSpec;
}

export const DataSet = types.model("DataSet", {
  id: types.optional(types.identifier, () => uniqueId()),
  sourceID: types.maybe(types.string),
  name: types.maybe(types.string),
  attributes: types.array(Attribute),
  cases: types.array(CaseID),
})
.volatile(self => ({
  // MobX-observable set of selected attribute IDs
  attributeSelection: observable.set<string>(),
  // MobX-observable set of selected case IDs
  caseSelection: observable.set<string>(),
  // MobX-observable set of selected cell IDs
  cellSelection: observable.set<string>(),
  // map from pseudo-case ID to the CaseGroup it represents
  pseudoCaseMap: {} as Record<string, CaseGroup>,
  transactionCount: 0
}))
.views(self => ({
  get isEmpty() {
    return self.attributes.length === 0 && self.cases.length === 0;
  },
  get attrIDMap() {
    const attrIDMap: { [index: string]: IAttribute } = {};
    self.attributes.forEach(attr => {
      attrIDMap[attr.id] = attr;
    });
    return attrIDMap;
  },
  get attrNameMap() {
    const attrNameMap: { [index: string]: string } = {};
    self.attributes.forEach(attr => {
      attrNameMap[attr.name] = attr.id;
    });
    return attrNameMap;
  },
  get caseIDMap() {
    const caseIDMap: { [index: string]: number } = {};
    self.cases.forEach((aCase, index) => {
      caseIDMap[aCase.__id__] = index;
    });
    return caseIDMap;
  },
  get cellsSelectCases() {
    return getAppConfig(self)?.getSetting("cellsSelectCases", "dataset");
  }
}))
.views(self => {
  let cachingCount = 0;
  const caseCache = new Map<string, ICase>();
  return {
    get isCaching() {
      return cachingCount > 0;
    },
    get caseCache() {
      return caseCache;
    },
    clearCache() {
      caseCache.clear();
    },
    beginCaching() {
      return ++cachingCount;
    },
    _endCaching() {
      return --cachingCount;
    }
  };
})
.views(self => ({
  get selectedAttributeIds() {
    return Array.from(self.attributeSelection as Set<string>);
  },
  get selectedCaseIds() {
    return Array.from(self.caseSelection as Set<string>);
  },
  get selectedCells() {
    return Array.from(self.cellSelection as Set<string>).map(cellId => getCellFromId(cellId))
      .filter(cell => cell !== undefined) as ICell[];
  }
}))
.views(self => ({
  get selectedAttributeIdString() {
    return self.selectedAttributeIds.join(", ");
  },
  get selectedCaseIdString() {
    return self.selectedCaseIds.join(", ");
  },
  get selectedCellIdString() {
    return Array.from(self.cellSelection).join(", ");
  }
}))
.views(self => ({
  get selectionIdString() {
    const attributeString = `attributes: ${self.selectedAttributeIdString}`;
    const caseString = `cases: ${self.selectedCaseIdString}`;
    const cellString = `cells: ${self.selectedCellIdString}`;
    return `${attributeString}, ${caseString}, ${cellString}`;
  },
  getValue(caseID: string, attributeID: string) {
    const attr = self.attrIDMap[attributeID],
          index = self.caseIDMap[caseID];
    return attr && (index != null) ? attr.value(index) : undefined;
  },
  getValueAtIndex(index: number, attributeID: string) {
    const attr = self.attrIDMap[attributeID];
    return attr && (index != null) ? attr.value(index) : undefined;
  }
}))
.extend(self => {
  const disposers: { [index: string]: () => void } = {};
  let inFlightActions = 0;

  function derive(name?: string) {
    return { id: uniqueId(), sourceID: self.id, name: name || self.name, attributes: [], cases: [] };
  }

  function attrIndexFromID(id: string) {
    const index = findIndex(self.attributes, (attr) => attr.id === id );
    return index >= 0 ? index : undefined;
  }

  function mapBeforeID(srcDataSet?: IDataSet, beforeID?: string) {
    let id: string | undefined = beforeID;
    while (id && (self.caseIDMap[id] == null)) {
      id = srcDataSet && srcDataSet.nextCaseID(id);
    }
    return id && self.caseIDMap[id] ? id : undefined;
  }

  function mapBeforeIDArg(beforeID?: string | string[]) {
    const context: IEnvContext = getEnv(self),
          { srcDataSet } = context;
    if (Array.isArray(beforeID)) {
      return beforeID.map((id) => mapBeforeID(srcDataSet, id));
    }
    else {
      return mapBeforeID(srcDataSet, beforeID);
    }
  }

  function getCase(caseID: string): ICase | undefined {
    const index = self.caseIDMap[caseID];
    if (index == null) { return undefined; }

    const aCase: ICase = { __id__: caseID };
    self.attributes.forEach((attr) => {
      aCase[attr.name] = attr.value(index);
    });
    return aCase;
  }

  function getCaseAtIndex(index: number) {
    if (index >= self.cases.length) return;
    const aCase = self.cases[index],
          id = aCase && aCase.__id__;
    return id ? getCase(id) : undefined;
  }

  // canonical cases are keyed by attribute ID rather than attribute name
  function getCanonicalCase(caseID: string): ICase | undefined {
    const index = self.caseIDMap[caseID];
    if (index == null) { return undefined; }

    const aCase: ICase = { __id__: caseID };
    self.attributes.forEach((attr) => {
      aCase[attr.id] = attr.value(index);
    });
    return aCase;
  }

  function getCanonicalCaseAtIndex(index: number) {
    const aCase = self.cases[index],
          id = aCase && aCase.__id__;
    return id ? getCanonicalCase(id) : undefined;
  }

  function beforeIndexForInsert(index: number, beforeID?: string | string[]) {
    if (!beforeID) { return self.cases.length; }
    return Array.isArray(beforeID)
            ? self.caseIDMap[beforeID[index]]
            : self.caseIDMap[beforeID];
  }

  function insertCaseIDAtIndex(id: string, beforeIndex: number) {
    const newCase = { __id__: id };
    if ((beforeIndex != null) && (beforeIndex < self.cases.length)) {
      self.cases.splice(beforeIndex, 0, newCase );
    }
    else {
      self.cases.push(newCase);
      beforeIndex = self.cases.length - 1;
    }
    return newCase;
  }

  // `affectedAttributes` are not used in the function, but are present as a potential
  // optimization for responders, as all arguments are available to `onAction` listeners.
  // For instance, a scatter plot that is dragging many points but affecting only two
  // attributes can indicate that, which can enable more efficient responses.
  function setCaseValues(caseValues: ICase, affectedAttributes?: string[]) {
    const index = self.caseIDMap[caseValues.__id__];
    if (index == null) { return; }

    for (const key in caseValues) {
      if (key !== "__id__") {
        const attributeID = self.attrNameMap[key],
              attribute = self.attrIDMap[attributeID];
        if (attribute) {
          const value = caseValues[key];
          attribute.setValue(index, value != null ? value : undefined);
        }
      }
    }
  }

  function setCanonicalCaseValues(caseValues: ICase) {
    const index = self.caseIDMap[caseValues.__id__];
    if (index == null) { return; }

    for (const key in caseValues) {
      if (key !== "__id__") {
        const attributeID = key,
              attribute = self.attrIDMap[attributeID];
        if (attribute) {
          const value = caseValues[key];
          attribute.setValue(index, value != null ? value : undefined);
        }
      }
    }
  }

  function delayApplyActions(actions: ISerializedActionCall[]) {
    ++inFlightActions;
    setTimeout(() => {
      if (--inFlightActions <= 0) {
        applyAction(self, actions);
      }
    });
  }

  function clearAllSelections() {
    self.attributeSelection.clear();
    self.caseSelection.clear();
    self.cellSelection.clear();
  }

  // Returns a list of caseIds, which could be from pseudo cases
  function getCaseIds(caseIds: string[]) {
    const ids: string[] = [];
    caseIds.forEach(id => {
      const pseudoCase = self.pseudoCaseMap[id];
      if (pseudoCase) {
        ids.push(...pseudoCase.childCaseIds);
      } else {
        ids.push(id);
      }
    });
    return ids;
  }

  function selectCases(caseIds: string[], select = true) {
    if (select) {
      self.attributeSelection.clear();
      self.cellSelection.clear();
    }
    const ids = getCaseIds(caseIds);
    ids.forEach(id => {
      if (select) {
        self.caseSelection.add(id);
      }
      else {
        self.caseSelection.delete(id);
      }
    });
  }

  function setSelectedCases(caseIds: string[]) {
    clearAllSelections();
    const ids = getCaseIds(caseIds);
    self.caseSelection.replace(ids);
  }

  return {
    views: {
      attrFromID(id: string) {
        return self.attrIDMap[id];
      },
      attrFromName(name: string) {
        const id = self.attrNameMap[name];
        return id ? self.attrIDMap[id] : undefined;
      },
      attrIndexFromID(id: string) {
        return attrIndexFromID(id);
      },
      attrIDFromIndex(index: number) {
        if (index >= self.attributes.length) return;
        const attr = self.attributes[index];
        return attr?.id;
      },
      caseIndexFromID(id: string) {
        return self.caseIDMap[id];
      },
      caseIDFromIndex(index: number) {
        return getCaseAtIndex(index)?.__id__;
      },
      nextCaseID(id: string) {
        const index = self.caseIDMap[id],
              nextCase = (index != null) && (index < self.cases.length - 1)
                          ? self.cases[index + 1] : undefined;
        return nextCase ? nextCase.__id__ : undefined;
      },
      getStrValue(caseID: string, attributeID: string) {
        // The values of a pseudo-case are considered to be the values of the first real case.
        // For grouped attributes, these will be the grouped values. Clients shouldn't be
        // asking for ungrouped values from pseudo-cases.
        const _caseId = self.pseudoCaseMap[caseID]
                          ? self.pseudoCaseMap[caseID].childCaseIds[0]
                          : caseID;
        const index = _caseId ? self.caseIDMap[_caseId] : undefined;
        const strValue = index != null
                        ? this.getStrValueAtIndex(self.caseIDMap[_caseId], attributeID)
                        : "";
        return strValue;
      },
      getStrValueAtIndex(index: number, attributeID: string) {
        const attr = self.attrIDMap[attributeID],
              caseID = self.cases[index]?.__id__,
              cachedCase = self.isCaching ? self.caseCache.get(caseID) : undefined;
        const valueAtIndex = (cachedCase && Object.prototype.hasOwnProperty.call(cachedCase, attributeID))
                        ? `${cachedCase[attributeID]}`  // TODO: respect attribute formatting
                        : attr && (index != null) ? attr.value(index) : "";
        return valueAtIndex?.toString() || "";
      },
      getNumeric(caseID: string, attributeID: string): number | undefined {
        // The values of a pseudo-case are considered to be the values of the first real case.
        // For grouped attributes, these will be the grouped values. Clients shouldn't be
        // asking for ungrouped values from pseudo-cases.
        const _caseId = self.pseudoCaseMap[caseID]
                          ? self.pseudoCaseMap[caseID].childCaseIds[0]
                          : caseID;
        const index = _caseId ? self.caseIDMap[_caseId] : undefined;
        if (index == null) {
          console.warn('Did not find case', _caseId, 'in', attributeID);
        }
        return index != null
                ? this.getNumericAtIndex(self.caseIDMap[_caseId], attributeID)
                : undefined;
      },
      getNumericAtIndex(index: number, attributeID: string) {
        const attr = self.attrIDMap[attributeID],
              caseID = self.cases[index]?.__id__,
              cachedCase = self.isCaching ? self.caseCache.get(caseID) : undefined;
        return (cachedCase && Object.prototype.hasOwnProperty.call(cachedCase, attributeID))
                ? Number(cachedCase[attributeID])
                : attr && (index != null) ? attr.numValue(index) : undefined;
      },
      getCase(caseID: string): ICase | undefined {
        return getCase(caseID);
      },
      getCases(caseIDs: string[]): ICase[] {
        const cases: ICase[] = [];
        caseIDs.forEach((caseID) => {
          const aCase = getCase(caseID);
          if (aCase) {
            cases.push(aCase);
          }
        });
        return cases;
      },
      getCaseAtIndex(index: number) {
        return getCaseAtIndex(index);
      },
      getCasesAtIndices(start = 0, count?: number) {
        const endIndex = count != null
                          ? Math.min(start + count, self.cases.length)
                          : self.cases.length,
              cases = [];
        for (let i = start; i < endIndex; ++i) {
          cases.push(getCaseAtIndex(i));
        }
        return cases;
      },
      getCanonicalCase(caseID: string): ICase | undefined {
        return getCanonicalCase(caseID);
      },
      getCanonicalCases(caseIDs: string[]): ICase[] {
        const cases: ICase[] = [];
        caseIDs.forEach((caseID) => {
          const aCase = getCanonicalCase(caseID);
          if (aCase) {
            cases.push(aCase);
          }
        });
        return cases;
      },
      getCanonicalCaseAtIndex(index: number) {
        return getCanonicalCaseAtIndex(index);
      },
      getCanonicalCasesAtIndices(start = 0, count?: number) {
        const endIndex = count != null
                          ? Math.min(start + count, self.cases.length)
                          : self.cases.length,
              cases = [];
        for (let i = start; i < endIndex; ++i) {
          cases.push(getCanonicalCaseAtIndex(i));
        }
        return cases;
      },
      isAttributeSelected(attributeId: string) {
        return self.attributeSelection.has(attributeId);
      },
      isCaseSelected(caseId: string) {
        // a pseudo-case is selected if all of its individual cases are selected
        const group = self.pseudoCaseMap[caseId];
        return group
                ? group.childCaseIds.every(id => self.caseSelection.has(id))
                : self.caseSelection.has(caseId);
      },
      isCellSelected(cell: ICell) {
        const cellId = getCellId(cell);
        return self.cellSelection.has(cellId);
      },
      get firstSelectedAttributeId() {
        if (self.selectedAttributeIds.length > 0) return self.selectedAttributeIds[0];
      },
      get firstSelectedCaseId() {
        if (self.selectedCaseIds.length > 0) return self.selectedCaseIds[0];
      },
      get firstSelectedCell() {
        if (self.selectedCells.length > 0) return self.selectedCells[0];
      },
      get isAnyCaseSelected() {
        return self.caseSelection.size > 0;
      },
      get isAnyCellSelected() {
        return self.cellSelection.size > 0;
      },
      get isInTransaction() {
        return self.transactionCount > 0;
      },
      get isSynchronizing() {
        return inFlightActions > 0;
      },
      onSynchronized() {
        if (inFlightActions <= 0) {
          return Promise.resolve(self);
        }
        return new Promise((resolve, reject) => {
          function waitForSync() {
            if (inFlightActions <= 0) {
              resolve(self);
            }
            else {
              setTimeout(waitForSync);
            }
          }
          waitForSync();
        });
      },
      derive(name?: string, derivationSpec?: IDerivationSpec) {
        const context = { srcDataSet: self, derivationSpec };
        const derived = DataSet.create(derive(name), context);
        const attrIDs = derivationSpec && derivationSpec.attributeIDs ||
                          self.attributes.map(attr => attr.id),
              filter = derivationSpec && derivationSpec.filter;
        attrIDs.forEach((attrID) => {
          const attribute = self.attrIDMap[attrID];
          if (attribute) {
            addAttributeToDataSet(derived, attribute.derive());
          }
        });
        self.cases.forEach((aCaseID) => {
          const inCase = getCase(aCaseID.__id__),
                outCase = filter && inCase ? filter(inCase) : inCase;
          if (outCase) {
            addCasesToDataSet(derived, [outCase]);
          }
        });
        return derived;
      }
    },
    actions: {
      afterCreate() {
        const context: IEnvContext = hasEnv(self) ? getEnv(self) : {},
              { srcDataSet, derivationSpec = {} } = context,
              { attributeIDs, filter, synchronize } = derivationSpec;

        // set up onAction handler to perform synchronization with source
        if (srcDataSet && synchronize) {
          disposers.srcDataSetOnAction = onAction(srcDataSet, (action) => {
            const actions = [];
            let newAction;
            switch (action.name) {
              case "addAttributeWithID":
                // ignore new attributes if we have a subset of attributes
                if (!attributeIDs) {
                  actions.push(action);
                }
                break;
              case "addCasesWithIDs": {
                const addCasesArgs = action.args && action.args.slice(),
                      srcCasesToAdd = addCasesArgs && addCasesArgs[0],
                      // only add new cases if they pass the filter
                      dstCasesToAdd = srcCasesToAdd && filter
                                        ? srcCasesToAdd.filter(filter)
                                        : srcCasesToAdd,
                      srcBeforeID = addCasesArgs && addCasesArgs[1],
                      // map beforeIDs from src to dst
                      dstBeforeID = srcBeforeID && mapBeforeIDArg(srcBeforeID),
                      // adjust arguments for the updated action
                      dstCasesArgs = [dstCasesToAdd, dstBeforeID];
                // only add the new cases if they pass our filter
                if (addCasesArgs && dstCasesToAdd && dstCasesToAdd.length) {
                  newAction = { name: action.name, path: "", args: dstCasesArgs };
                  actions.push(newAction);
                }
                break;
              }
              case "setCaseValues":
              case "setCanonicalCaseValues": {
                const setValuesArgs = action.args && action.args.slice(),
                      actionCases = setValuesArgs && setValuesArgs[0],
                      casesToAdd: ICase[] = [],
                      beforeIDs: Array<string | undefined> = [],
                      casesToRemove: string[] = [];
                let isValidAction = !!(actionCases && actionCases.length);
                actionCases.forEach((aCase: ICase) => {
                  const caseID = aCase.__id__;
                  const srcCase = srcDataSet && caseID && srcDataSet.getCase(caseID);
                  if (caseID && srcCase) {
                    const filteredCase = filter ? filter(srcCase) : srcCase,
                          doesInclude = self.caseIDMap[caseID] != null;
                    // identify cases that now pass the filter after change
                    if (filteredCase && !doesInclude) {
                      casesToAdd.push(filteredCase);
                      // determine beforeIDs so that cases end up in correct locations
                      const srcBeforeID = srcDataSet && srcDataSet.nextCaseID(caseID),
                            dstBeforeID = mapBeforeID(srcDataSet, srcBeforeID);
                      beforeIDs.push(dstBeforeID);
                    }
                    // identify cases that no longer pass the filter after change
                    if (!filteredCase && doesInclude) {
                      casesToRemove.push(caseID);
                    }
                  }
                  else {
                    isValidAction = false;
                  }
                });
                // modify existing cases
                if (isValidAction) {
                  actions.push(action);
                }
                // add cases that now pass the filter
                if (casesToAdd && casesToAdd.length) {
                  actions.push({ name: "addCasesWithIDs", path: "", args: [casesToAdd, beforeIDs] });
                }
                // remove cases that no longer pass the filter
                if (casesToRemove && casesToRemove.length) {
                  actions.push({ name: "removeCases", path: "", args: [casesToRemove] });
                }
                break;
              }
              // other actions can be applied as is
              default:
                actions.push(action);
                break;
            }
            if (actions && actions.length) {
              delayApplyActions(actions);
            }
          // attachAfter: if true, listener is called after action has been applied
          }, true);
        }
      },
      beforeDestroy() {
        Object.keys(disposers).forEach((key: string) => disposers[key]());
      },
      beginTransaction() {
        ++self.transactionCount;
      },
      endTransaction() {
        --self.transactionCount;
      },
      setName(name: string) {
        self.name = name;
      },
      addAttributeWithID(snapshot: IAttributeSnapshot, beforeID?: string) {
        const { formula, ...others } = snapshot;
        const attrSnap = { formula: { display: formula }, ...others };
        const beforeIndex = beforeID ? attrIndexFromID(beforeID) : undefined;
        let newIndex = beforeIndex;
        if (beforeIndex != null) {
          self.attributes.splice(beforeIndex, 0, attrSnap as IAttribute);
        }
        else {
          newIndex = self.attributes.push(attrSnap as IAttribute) - 1;
        }
        const attribute = self.attributes[newIndex as number];
        for (let i = attribute.values.length; i < self.cases.length; ++i) {
          attribute.values.push("");
        }
        return attribute;
      },

      setAttributeName(attributeID: string, name: string) {
        const attribute = attributeID && self.attrIDMap[attributeID];
        if (attribute) {
          attribute.setName(name);
        }
      },

      /**
       * Remove an attribute from the dataset.
       * @param attributeID
       */
      removeAttribute(attributeID: string) {
        const attrIndex = attrIndexFromID(attributeID);
        if (attrIndex != null) {
          self.attributes.splice(attrIndex, 1);
        }
      },

      moveAttribute(attributeID: string, beforeID?: string) {
        const srcAttrIndex = attrIndexFromID(attributeID);
        if (srcAttrIndex != null) {
          const snapshot = getSnapshot(self.attributes[srcAttrIndex]);
          self.attributes.splice(srcAttrIndex, 1);
          let dstAttrIndex = beforeID ? attrIndexFromID(beforeID) : undefined;
          if (dstAttrIndex != null) {
            self.attributes.splice(dstAttrIndex, 0, snapshot as IAttribute);
          }
          else {
            self.attributes.push(snapshot as IAttribute);
            dstAttrIndex = self.attributes.length - 1;
          }
        }
      },

      addCasesWithIDs(cases: ICase[], beforeID?: string | string[]) {
        cases.forEach((aCase, index) => {
          if (!aCase || !aCase.__id__) { return; }
          const beforeIndex = beforeIndexForInsert(index, beforeID);
          self.attributes.forEach((attr: IAttribute) => {
            const value = aCase[attr.name];
            attr.addValue(value != null ? value : undefined, beforeIndex);
          });
          insertCaseIDAtIndex(aCase.__id__, beforeIndex);
        });
      },

      addCanonicalCasesWithIDs(cases: ICase[], beforeID?: string | string[]) {
        const newCases: ICase[] = [];
        cases.forEach((aCase, index) => {
          const beforeIndex = beforeIndexForInsert(index, beforeID);
          self.attributes.forEach((attr: IAttribute) => {
            const value = aCase[attr.id];
            attr.addValue(value != null ? value : undefined, beforeIndex);
          });
          newCases.push(insertCaseIDAtIndex(aCase.__id__, beforeIndex));
        });
      },

      setCaseValues(cases: ICase[], affectedAttributes?: string[]) {
        cases.forEach((caseValues) => {
          setCaseValues(caseValues);
        });
      },

      setCanonicalCaseValues(cases: ICase[]) {
        cases.forEach((caseValues) => {
          setCanonicalCaseValues(caseValues);
        });
      },

      removeCases(caseIDs: string[]) {
        caseIDs.forEach((caseID) => {
          const index = self.caseIDMap[caseID];
          if (index != null) {
            self.cases.splice(index, 1);
            self.attributes.forEach((attr) => {
              attr.removeValues(index);
            });
          }
        });
      },
      sortByAttribute(attributeId: string, direction: "ASC" |"DESC" = "ASC") {
        const compareFn = (aItemId: string, bItemId: string) => {
          const aValue = self.getValue(aItemId, attributeId);
          const bValue = self.getValue(bItemId, attributeId);
          const compareResult = compareValues(aValue, bValue,
                                  (aStr, bStr) => aStr.localeCompare(bStr, undefined, { sensitivity: 'base' }));
          return direction === "DESC" ? -compareResult : compareResult;
        };
        const finalCaseIds = self.cases.map(c => c.__id__);
        const caseIdToIndexMap: Record<string, { beforeIndex: number, afterIndex: number }> = {};
        finalCaseIds.forEach((caseId, beforeIndex) => caseIdToIndexMap[caseId] = { beforeIndex, afterIndex: -1 });
        finalCaseIds.sort(compareFn);
        finalCaseIds.forEach((caseId, index) => caseIdToIndexMap[caseId].afterIndex = index);
        if (finalCaseIds.every((caseId, index) => caseId === self.cases[index].__id__)) {
          return;
        }
        // apply the index mapping to each attribute's value arrays
        const origIndices = finalCaseIds.map(caseId => caseIdToIndexMap[caseId].beforeIndex);
        self.attributes.forEach(attr => attr.orderValues(origIndices));

        // update the cases array
        self.cases.replace(finalCaseIds.map(__id__ => ({__id__})));

        return caseIdToIndexMap;
      },

      clearAllSelections,

      selectAllAttributes(select = true) {
        self.caseSelection.clear();
        self.cellSelection.clear();
        if (select) {
          self.attributes.forEach(attribute => self.attributeSelection.add(attribute.id));
        } else {
          self.attributeSelection.clear();
        }
      },

      selectAllCases(select = true) {
        self.attributeSelection.clear();
        self.cellSelection.clear();
        if (select) {
          self.cases.forEach(({__id__}) => self.caseSelection.add(__id__));
        }
        else {
          self.caseSelection.clear();
        }
      },

      selectAllCells(select = true) {
        if (select) {
          self.attributeSelection.clear();
          self.caseSelection.clear();
          self.attributes.forEach(attribute => {
            self.cases.forEach(({__id__}) => {
              self.cellSelection.add(getCellId({ attributeId: attribute.id, caseId: __id__ }));
            });
          });
        } else {
          self.cellSelection.clear();
        }
      },

      selectAttributes(attributeIds: string[], select = true) {
        if (select) {
          self.caseSelection.clear();
          self.cellSelection.clear();
        }
        attributeIds.forEach(id => {
          if (select) {
            self.attributeSelection.add(id);
          } else {
            self.attributeSelection.delete(id);
          }
        });
      },

      selectCases,

      selectCells(cells: ICell[], select = true) {
        if (select) {
          self.attributeSelection.clear();
          self.caseSelection.clear();
        }

        if (self.cellsSelectCases) {
          const caseIds = uniqueCaseIds(cells);
          if (select) {
            selectCases(caseIds, select);
          } else {
            // When deselecting cells, we don't want to deselect cases that
            // are related to a cell not being deselected
            const preservedCellIds: string[] = [];
            const cellIds = cells.map(cell => getCellId(cell));
            // Find cells that will continue to be selected
            self.cellSelection.forEach(cellId => {
              if (!cellIds.includes(cellId)) {
                preservedCellIds.push(cellId);
              }
            });
            // Find cases related to cells that will continue to be selected
            const preservedCaseIds = uniqueCaseIds(preservedCellIds.map(cellId => getCellFromId(cellId)) as ICell[]);
            // Only remove cases related to deselected cells if they aren't also related to a continuing cell
            const removedCaseIds: string[] = [];
            caseIds.forEach(caseId => {
              if (!preservedCaseIds.includes(caseId)) {
                removedCaseIds.push(caseId);
              }
            });
            selectCases(removedCaseIds, select);
          }
        }

        cells.forEach(cell => {
          if (select) {
            self.cellSelection.add(getCellId(cell));
          } else {
            self.cellSelection.delete(getCellId(cell));
          }
        });
      },

      setSelectedAttributes(attributeIds: string[]) {
        clearAllSelections();
        self.attributeSelection.replace(attributeIds);
      },

      setSelectedCases,

      setSelectedCells(cells: ICell[]) {
        clearAllSelections();

        if (self.cellsSelectCases) {
          setSelectedCases(uniqueCaseIds(cells));
        }

        self.cellSelection.replace(cells.map(cell => getCellId(cell)));
      },

      addActionListener(key: string, listener: (action: ISerializedActionCall) => void) {
        if (typeof listener === "function") {
          disposers[key] = onAction(self, (action) => listener(action), true);
        }
        else {
          console.warn(`DataSet.addActionListener called for '${key}' with non-function argument!`);
        }
      },

      removeActionListener(key: string) {
        const disposer = disposers[key];
        if (disposer) {
          delete disposers[key];
          disposer();
        }
      },
/*
      addMiddleware(key: string, handler: (call: {}, next: {}) => void) {
        disposers[key] = addMiddleware(self, handler);
      },

      removeMiddleware(key: string) {
        const disposer = disposers[key];
        if (disposer) {
          delete disposers[key];
          disposer();
        }
      }
*/
    }
  };
});
export type IDataSet = Instance<typeof DataSet>;
// Need to redefine to make id optional
export interface IDataSetCreation {
  id?: string;
  sourceID?: string;
  name: string;
  attributes?: IAttribute[];
  cases: ICaseID[];
}
export type IDataSetSnapshot = SnapshotOut<typeof DataSet>;

export function addAttributeToDataSet(dataset: IDataSet, snapshot: IAttributeSnapshot, beforeID?: string) {
  if (!snapshot.id) {
    snapshot.id = uniqueId();
  }
  return dataset.addAttributeWithID(snapshot, beforeID);
}

export function addCasesToDataSet(dataset: IDataSet, cases: ICaseCreation[], beforeID?: string | string[]) {
  const newCases = cloneDeep(cases) as ICase[];
  newCases.forEach((aCase) => {
    if (!aCase.__id__) {
      aCase.__id__ = newCaseId();
    }
  });
  dataset.addCasesWithIDs(newCases, beforeID);
}

// canonical cases are keyed by attribute ID rather than attribute name
export function addCanonicalCasesToDataSet(dataset: IDataSet, cases: ICaseCreation[], beforeID?: string | string[]) {
  const newCases = cloneDeep(cases) as ICase[];
  newCases.forEach((aCase) => {
    if (!aCase.__id__) {
      aCase.__id__ = newCaseId();
    }
  });
  dataset.addCanonicalCasesWithIDs(newCases, beforeID);
  return newCases;
}

export function getDataSetBounds(dataSet: IDataSet) {
  const result: Array<{ min: number, max: number}> = [];
  dataSet.attributes.forEach(( attr, attrIndex) => {
    let min = Infinity;
    let max = -Infinity;
    dataSet.cases.forEach(( aCase, caseIndex) => {
      const value = dataSet.attributes[attrIndex].numValue(caseIndex);
      if (isFinite(value)) {
        if (value < min) min = value;
        if (value > max) max = value;
      }
    });
    result.push({ min, max });
  });
  return result;
}


