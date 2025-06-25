import {
  IDataSet as IFormulaDataSet
} from "@concord-consortium/codap-formulas-react17/models/data/data-set";
import {
  CaseInfo, ICase, IItem
} from "@concord-consortium/codap-formulas-react17/models/data/data-set-types";
import {
  IAttribute as IFormulaAttribute
} from "@concord-consortium/codap-formulas-react17/models/data/attribute";
import { observable } from "mobx";
import { IAttribute } from "./attribute";
import { IDataSet } from "./data-set";

export function createFormulaDataSetProxy(dataSet: IDataSet): IFormulaDataSet {
  const attrNameMap = observable.map<string, string>({}, { name: "attrNameMap" });
  dataSet.attributes.forEach(attr => {
    attrNameMap.set(attr.name, attr.id);
  });

  function getFormulaAttribute(attr: IAttribute): IFormulaAttribute {
    return  {
      id: attr.id,
      name: attr.name || "",
      title: attr.name || "",
      hasFormula: attr.formula != null,
      // FIXME: need to validate the formula
      hasValidFormula: attr.formula != null,
      strValues: attr.strValues,
      numValue: attr.numValue
    };
  }

  const _itemIds = dataSet.cases?.map(({ __id__ }) => __id__) ?? [];
  // CODAP has a concept of hidden items, CLUE does not.
  const items: readonly IItem[] = _itemIds.map(id => ({ __id__: id }));
  // const itemInfoMap = new Map<string, { index: number }>();
  // _itemIds.forEach((itemId, index) => {
  //   itemInfoMap.set(itemId, { index  });
  // });

  return {
    id: dataSet.id,
    name: dataSet.name || "",
    title: dataSet.name || "",
    // The formula system doesn't seem to use this
    // but perhaps it does use it for comparison.
    itemIdsHash: null,
    attrNameMap,
    collections: [],
    attributes: dataSet.attributes.map(getFormulaAttribute),
    getValue: dataSet.getValue,
    attrFromID: (attrId: string) => {
      const attr = dataSet.attrFromID(attrId);
      return attr ? getFormulaAttribute(attr) : undefined;
    },
    // FIXME: need to see what we should actually do here
    validateCases: () => undefined,
    getAttribute: (id: string) => {
      const attr = dataSet.attrFromID(id);
      return attr ? getFormulaAttribute(attr) : undefined;
    },
    // CHECKME: is the -1 return correct here?
    getCollectionIndex: (collectionId?: string) => -1,
    // CHECKME: do we need to return something here?
    getCollectionForAttribute: (attributeId: string) => undefined,
    getCollectionForCase: (caseId: string) => undefined,
    // CHECKME: do we need to return something here?
    caseInfoMap: new Map<string, CaseInfo>(),
    getItemIndex: (itemId: string) => _itemIds.indexOf(itemId),
    // FIXME: this probably needs to return numeric values when
    // that is what CODAP would do
    getValueAtItemIndex: (index: number, attributeID: string) => {
      const attr = dataSet.attrFromID(attributeID);
      if (attr) {
        return attr.strValues[index];
      }
      return undefined;
    },
    items,
    // FIXME: need to implement this
    setCaseValues: (cases: ICase[]) => {
      // This is a no-op in the formula system
      console.warn("setCaseValues is not implemented in formula data set proxy");
    },
    // FIXME: need to implement this
    getCasesForAttributes: (attributeIds: string[]) => {
      // This is a no-op in the formula system
      console.warn("getCasesForAttributes is not implemented in formula data set proxy");
      return [];
    },
    hasFilterFormula: false,
    updateFilterFormulaResults: () => {
      // This is a no-op in CLUE, and it shouldn't be called so
      // log a warning if it is
      console.warn("updateFilterFormulaResults is not implemented in formula data set proxy");
    },
    itemsNotSetAside: _itemIds,
    // FIXME: I think this needs to create an item from all of the
    // attributes of this data set. This item has keys of the attribute
    // ids (or maybe names) as well as the __id__ key.
    // Its possible though that the formula system doesn't really use
    // the attribute parts.
    getItem: (itemId: string) => {
      console.warn("getItem is not implemented in formula data set proxy");
      return undefined;
    },
    setFilterFormulaError: (error: string) => {
      // This is a no-op in CLUE, and it shouldn't be called so
      // log a warning if it is
      console.warn("setFilterFormulaError is not implemented in formula data set proxy");
    },
    filterFormula: undefined,
    getAttributeByName: (name: string) => {
      const attr = dataSet.attrFromName(name) || undefined;
      return attr ? getFormulaAttribute(attr) : undefined;
    },
    attrIDFromName: (name: string) => {
      const attr = dataSet.attrFromName(name);
      return attr ? attr.id : undefined;
    }
  };
}
