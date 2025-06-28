import {
  IDataSet as IFormulaDataSet
} from "@concord-consortium/codap-formulas-react17/models/data/data-set";
import {
  CaseInfo,
  ICase as IFormulaCase,
  IItem
} from "@concord-consortium/codap-formulas-react17/models/data/data-set-types";
import {
  IAttribute as IFormulaAttribute
} from "@concord-consortium/codap-formulas-react17/models/data/attribute";
import {
  ICollection as IFormulaCollection
} from "@concord-consortium/codap-formulas-react17/models/data/collection";
import { observable } from "mobx";
import { types } from "mobx-state-tree";
import { IAttribute } from "./attribute";
import { ICase, IDataSet } from "./data-set";

function getFormulaAttribute(attr: IAttribute): IFormulaAttribute {
  return  {
    id: attr.id,
    name: attr.name || "",
    title: attr.name || "",
    formula: attr.formula,
    hasFormula: attr.formula != null,
    // FIXME: need to validate the formula
    hasValidFormula: attr.formula != null,
    strValues: attr.strValues,
    numValue: attr.numValue
  };
}

const kDefaultCollectionId = "__default-collection__";

const FormulaDataSetProxy = types.model("FormulaDataSetProxy", {
})
.volatile(self => ({
  dataSet: {} as IDataSet,
}))
.actions(self => ({
  setCLUEDataSet(dataSet: IDataSet) {
    self.dataSet = dataSet;
  }
}))
.views(self => ({
  get _itemIds() {
    return self.dataSet.cases?.map(({ __id__ }) => __id__) ?? [];
  },
}))
.views(self => ({
  get allICases(): IFormulaCase[] {
    return self.dataSet.getCases(self._itemIds);
  }
}))
.views(self => ({
  get defaultCollection(): IFormulaCollection {
    // CLUE doesn't support collections, so return a single ungrouped collection
    return {
      id: kDefaultCollectionId,
      attributes: self.dataSet.attributes.map(getFormulaAttribute),
      cases: self.allICases,
      // FIXME: what should caseGroups be?
      caseGroups: [],
      caseIds: self._itemIds,
    };
  }
}))
.views(self => ({
  get id() {
    return self.dataSet.id;
  },
  get name() {
    return self.dataSet.name || "";
  },
  get title() {
    return self.dataSet.name || "";
  },
  get itemIdsHash() {
    // The formula system doesn't seem to use this, but perhaps it does
    return null;
  },
  get attrNameMap() {
    const attrNameMap = observable.map<string, string>({}, { name: "attrNameMap" });
    self.dataSet.attributes.forEach(attr => {
      attrNameMap.set(attr.name, attr.id);
    });
    return attrNameMap;
  },
  get collections() {
    // CLUE doesn't support collections, so return an empty array
    return [self.defaultCollection];
  },
  get attributes() {
    return self.dataSet.attributes.map(getFormulaAttribute);
  },
  getValue(caseID: string, attributeID: string) {
    return self.dataSet.getValue(caseID, attributeID);
  },
  attrFromID(attrId: string): IFormulaAttribute | undefined {
    const attr = self.dataSet.attrFromID(attrId);
    return attr ? getFormulaAttribute(attr) : undefined;
  },
  validateCases() {
    // FIXME: wha should we actually do here?
    console.warn("validateCases is not implemented in formula data set proxy");
    return undefined;
  },
  getAttribute(id: string): IFormulaAttribute | undefined {
    const attr = self.dataSet.attrFromID(id);
    return attr ? getFormulaAttribute(attr) : undefined;
  },
  // CHECKME: is the -1 return correct here?
  getCollectionIndex(collectionId?: string): number {
    if (collectionId === kDefaultCollectionId) {
      // CLUE doesn't support collections, so default collection is at index 0
      return 0;
    }

    // Anything else is invalid.
    console.warn(`getCollectionIndex: collectionId ${collectionId} is not valid`);
    return -1;
  },
  // CHECKME: do we need to return something here?
  getCollectionForAttribute(attributeId: string) {
    // CLUE doesn't support collections, so return the default collection
    return self.defaultCollection;
  },
  // CHECKME: do we need to return something here?
  getCollectionForCase(caseId: string) {
    // CLUE doesn't support collections, so return the default collection
    return self.defaultCollection;
  },
  get caseInfoMap(): Map<string, CaseInfo> {
    // CHECKME: do we need to return something here?
    return new Map<string, CaseInfo>();
  },
  getItemIndex(itemId: string): number {
    return self._itemIds.indexOf(itemId);
  },
  // FIXME: this probably needs to return numeric values when
  // that is what CODAP would do
  getValueAtItemIndex(index: number, attributeID: string): string | undefined {
    const attr = self.dataSet.attrFromID(attributeID);
    if (attr) {
      return attr.strValues[index];
    }
    return undefined;
  },
  get items(): readonly IItem[] {
    return self._itemIds.map(id => ({ __id__: id }));
  },
  get hasFilterFormula() {
    return false;
  },
  get itemsNotSetAside(): string[] {
    // CODAP has a concept of hidden items, CLUE does not.
    return self._itemIds;
  },
  getItem(itemId: string): IItem | undefined {
    console.warn("getItem is not implemented in formula data set proxy");
    return undefined;
  },
  get filterFormula() {
    // CLUE doesn't support filter formulas, so return undefined
    return undefined;
  },
  getAttributeByName(name: string): IFormulaAttribute | undefined {
    const attr = self.dataSet.attrFromName(name) || undefined;
    return attr ? getFormulaAttribute(attr) : undefined;
  },
  attrIDFromName(name: string): string | undefined {
    const attr = self.dataSet.attrFromName(name);
    return attr ? attr.id : undefined;
  }
}))
.views(self => ({
  getCollectionForAttributes(attributeIds: string[]) {
    self.validateCases();
    return self.defaultCollection;
  },
}))
.views(self => ({
  getCasesForAttributes(attributeIds: string[]): IFormulaCase[] {
    // Because CLUE doesn't support collections, we just return all of the cases
    return self.allICases;
  },
}))
.actions(self => ({
  setCaseValues(cases: IFormulaCase[]) {
    // TODO: the formula system works with strings, numbers, booleans, dates, and undefined values
    // but CLUE only supports strings, numbers, and undefined values.
    // We should sanitize the cases to ensure they are valid for CLUE.
    self.dataSet.setCanonicalCaseValues(cases as ICase[]);
  },
  updateFilterFormulaResults() {
    // This is a no-op in CLUE, and it shouldn't be called so
    // log a warning if it is
    console.warn("updateFilterFormulaResults is not implemented in formula data set proxy");
  },
  setFilterFormulaError(error: string) {
    // This is a no-op in CLUE, and it shouldn't be called so
    // log a warning if it is
    console.warn("setFilterFormulaError is not implemented in formula data set proxy");
  },
}));

// The Formula system expects the data set to be an MST object,
// so we create a MST object that proxies the CLUE data set and implements
// all of the methods that the formula system expects.
export function createFormulaDataSetProxy(dataSet: IDataSet): IFormulaDataSet {
  const formulaDataSet = FormulaDataSetProxy.create();
  formulaDataSet.setCLUEDataSet(dataSet);
  return formulaDataSet;
}
