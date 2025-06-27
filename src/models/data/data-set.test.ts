// import { applyAction, clone, destroy, getEnv, getSnapshot, onAction } from 'mobx-state-tree';
import { applyAction, clone, destroy, getSnapshot, onAction } from "mobx-state-tree";
import { addAttributeToDataSet, addCanonicalCasesToDataSet, addCasesToDataSet,
          CaseID, ICaseID, ICase, DataSet, IDataSet } from "./data-set";
import { v4 as uuid } from "uuid";

test("CaseID functionality", () => {
  const caseID = CaseID.create({ __id__: "0" });
  expect(caseID.__id__).toBeDefined();

  const copy = clone(caseID);
  expect(copy.__id__).toBe(caseID.__id__);

  const caseID2 = CaseID.create({} as any);
  expect(caseID2.__id__).toBeDefined();
});

test("DataSet basic functionality", () => {
  const dataset = DataSet.create({ name: "data" } as any);
  expect(dataset.id).toBeDefined();

  expect(dataset.isInTransaction).toBe(false);
  dataset.beginTransaction();
  expect(dataset.isInTransaction).toBe(true);
  dataset.endTransaction();
  expect(dataset.isInTransaction).toBe(false);

  // add numeric attribute
  addAttributeToDataSet(dataset, { name: "num" });
  const numAttr = dataset.attrFromName("num");
  const numAttrID = dataset.attributes[0].id;
  expect(dataset.attributes.length).toBe(1);
  expect(numAttr && numAttr.id).toBe(numAttrID);
  expect(dataset.attributes[0].length).toBe(0);

  // add string attribute before numeric attribute
  addAttributeToDataSet(dataset, { name: "str" }, numAttrID);
  let strAttr = dataset.attrFromName("str");
  const strAttrID = dataset.attributes[0].id;
  expect(dataset.attributes.length).toBe(2);
  expect(strAttr && strAttr.id).toBe(strAttrID);
  expect(dataset.attributes[0].length).toBe(0);
  expect(dataset.attributes[0].name).toBe("str");
  expect(dataset.attributes[1].name).toBe("num");

  // rename attribute
  dataset.setAttributeName(strAttrID, "str2");
  expect(dataset.attributes[0].name).toBe("str2");
  dataset.setAttributeName(strAttrID, "str");
  expect(dataset.attributes[0].name).toBe("str");
  dataset.setAttributeName("foo", "bar");

  // add/remove attribute
  addAttributeToDataSet(dataset, { id: uuid(), name: "redShirt" }, numAttrID);
  const redShirtID = dataset.attributes[1].id;
  expect(dataset.attributes.length).toBe(3);
  const redShirt = dataset.attrFromID(redShirtID);
  expect(redShirt.name).toBe("redShirt");
  dataset.removeAttribute(redShirtID);
  expect(dataset.attributes.length).toBe(2);
  expect(dataset.attrFromID(redShirtID)).toBeUndefined();
  expect(dataset.attrFromName("redShirt")).toBeUndefined();
  // removing a non-existent attribute is a no-op
  dataset.removeAttribute("");
  expect(dataset.attributes.length).toBe(2);

  // move first attribute to the end
  dataset.moveAttribute(strAttrID);
  expect(dataset.attributes[0].name).toBe("num");
  expect(dataset.attributes[1].name).toBe("str");
  // move second attribute before the first
  dataset.moveAttribute(strAttrID, numAttrID);
  expect(dataset.attributes[0].name).toBe("str");
  expect(dataset.attributes[1].name).toBe("num");
  strAttr = dataset.attrFromName("str");
  expect(strAttr && strAttr.id).toBe(strAttrID);
  // moving a non-existent attribute is a no-op
  dataset.moveAttribute("");
  expect(dataset.attributes[0].name).toBe("str");
  expect(dataset.attributes[1].name).toBe("num");

  // validate attribute indices
  dataset.attributes.forEach((attr, index) => {
    expect(dataset.attrIndexFromID(attr.id)).toBe(index);
  });

  expect(dataset.getCase("")).toBeUndefined();
  dataset.setCaseValues([{ __id__: "" }]);

  // should ignore if id not specified
  dataset.addCasesWithIDs([{ str: "d", num: 4 } as any]);
  expect(dataset.cases.length).toBe(0);

  // add new case
  addCasesToDataSet(dataset, [{ str: "d", num: 4 }]);
  const caseD4ID = dataset.cases[0].__id__;
  expect(dataset.getCaseAtIndex(-1)).toBeUndefined();
  expect(dataset.getCaseAtIndex(0)).toEqual({ __id__: caseD4ID, str: "d", num: 4 });
  expect(dataset.getCase(caseD4ID)).toEqual({ __id__: caseD4ID, str: "d", num: 4 });
  expect(dataset.cases.length).toBe(1);
  expect(caseD4ID).toBeDefined();
  expect(dataset.attributes[0].value(0)).toBe("d");
  expect(dataset.attributes[1].value(0)).toBe(4);

  // add new case before first case
  addCasesToDataSet(dataset, [{ str: "c", num: 3 }], caseD4ID);
  const caseC3ID = dataset.cases[0].__id__;
  expect(dataset.cases.length).toBe(2);
  expect(caseC3ID).toBeDefined();
  expect(caseC3ID).not.toBe(caseD4ID);
  expect(dataset.nextCaseID("")).toBeUndefined();
  expect(dataset.nextCaseID(caseC3ID)).toBe(caseD4ID);
  expect(dataset.cases[1].__id__).toBe(caseD4ID);
  expect(dataset.attributes[0].value(0)).toBe("c");
  expect(dataset.attributes[1].value(0)).toBe(3);

  // add multiple new cases
  addCasesToDataSet(dataset, [{ str: "a", num: 1 }, { str: "b", num: 2 }], caseC3ID);
  const caseA1ID = dataset.cases[0].__id__,
        caseB2ID = dataset.cases[1].__id__;
  expect(dataset.cases.length).toBe(4);
  expect(dataset.attributes[0].value(0)).toBe("a");
  expect(dataset.attributes[1].value(0)).toBe(1);
  expect(dataset.attributes[0].value(1)).toBe("b");
  expect(dataset.attributes[1].value(1)).toBe(2);
  expect(dataset.getValue(caseA1ID, "foo")).toBeUndefined();
  expect(dataset.getValue("foo", "bar")).toBeUndefined();
  expect(dataset.getCase(caseA1ID)).toEqual({ __id__: caseA1ID, str: "a", num: 1 });
  expect(dataset.getCase(caseB2ID)).toEqual({ __id__: caseB2ID, str: "b", num: 2 });
  expect(dataset.getCanonicalCase(caseA1ID))
    .toEqual({ __id__: caseA1ID, [strAttrID]: "a", [numAttrID]: 1 });
  expect(dataset.getCanonicalCase(caseB2ID))
    .toEqual({ __id__: caseB2ID, [strAttrID]: "b", [numAttrID]: 2 });
  expect(dataset.getCanonicalCases([caseA1ID, caseB2ID]))
    .toEqual([{ __id__: caseA1ID, [strAttrID]: "a", [numAttrID]: 1 },
              { __id__: caseB2ID, [strAttrID]: "b", [numAttrID]: 2 }]);
  expect(dataset.getCasesAtIndices().length).toBe(4);
  expect(dataset.getCasesAtIndices(2).length).toBe(2);
  // add null/undefined values
  addCasesToDataSet(dataset, [{ str: undefined }]);
  const nullCaseID = dataset.cases[dataset.cases.length - 1].__id__;
  expect(dataset.getCase(nullCaseID))
    .toEqual({ __id__: nullCaseID, str: undefined, num: undefined });
  expect(dataset.getCanonicalCases([""])).toEqual([]);
  // validate that caseIDMap is correct
  dataset.cases.forEach((aCase: ICaseID) => {
    const caseIndex = dataset.caseIndexFromID(aCase.__id__);
    expect((caseIndex >= 0) ? dataset.cases[caseIndex].__id__ : "").toBe(aCase.__id__);
  });

  // setCaseValues
  dataset.setCaseValues([{ __id__: caseA1ID, str: "A", num: 10 }]);
  expect(dataset.getCase(caseA1ID)).toEqual({ __id__: caseA1ID, str: "A", num: 10 });
  dataset.setCaseValues([{ __id__: caseB2ID, str: "B", num: 20 },
                          { __id__: caseC3ID, str: "C", num: 30 }]);
  expect(dataset.getCase(caseB2ID)).toEqual({ __id__: caseB2ID, str: "B", num: 20 });
  expect(dataset.getValue(caseC3ID, strAttrID)).toBe("C");
  expect(dataset.getValue(caseC3ID, numAttrID)).toBe(30);
  dataset.setCaseValues([{ __id__: caseA1ID, foo: "bar" }]);
  expect(dataset.getCase(caseA1ID)).toEqual({ __id__: caseA1ID, str: "A", num: 10 });
  dataset.setCaseValues([{ __id__: caseA1ID, num: undefined }]);
  expect(dataset.getCase(caseA1ID)).toEqual({ __id__: caseA1ID, str: "A", num: undefined });

  const cases = dataset.getCases([caseB2ID, caseC3ID, ""]);
  expect(cases.length).toBe(2);
  expect(cases[0]).toEqual({ __id__: caseB2ID, str: "B", num: 20 });
  expect(cases[1]).toEqual({ __id__: caseC3ID, str: "C", num: 30 });

  // const bIndex = dataset.caseIndexFromID(caseB2ID);
  // const cases2 = dataset.getCasesAtIndices(bIndex, 2);
  expect(cases.length).toBe(2);
  expect(cases[0]).toEqual({ __id__: caseB2ID, str: "B", num: 20 });
  expect(cases[1]).toEqual({ __id__: caseC3ID, str: "C", num: 30 });

  const copy = clone(dataset);
  expect(copy.id).toBe(dataset.id);
  expect(copy.name).toBe(dataset.name);
  copy.setName("copy");
  expect(copy.name).toBe("copy");
  expect(copy.attributes.length).toBe(dataset.attributes.length);
  expect(copy.cases.length).toBe(dataset.cases.length);

  dataset.removeCases([nullCaseID]);
  expect(dataset.cases.length).toBe(4);
  dataset.removeCases([caseA1ID, caseB2ID]);
  expect(dataset.cases.length).toBe(2);
  // validate that caseIDMap is correct
  dataset.cases.forEach((aCase: ICaseID) => {
    const caseIndex = dataset.caseIndexFromID(aCase.__id__);
    expect((caseIndex >= 0) ? dataset.cases[caseIndex].__id__ : "").toBe(aCase.__id__);
  });
  dataset.removeCases([""]);
  expect(dataset.cases.length).toBe(2);
  destroy(dataset);
});

test("Canonical case functionality", () => {
  const dataset = DataSet.create({
                    name: "data",
                    attributes: [
                      { name: "str" } as any,
                      { name: "num" } as any
                    ]
                  } as any),
        strAttrID = dataset.attributes[0].id,
        numAttrID = dataset.attributes[1].id;

  // validate attribute indices
  dataset.attributes.forEach((attr, index) => {
    expect(dataset.attrIndexFromID(attr.id)).toBe(index);
  });
  expect(dataset.attrIndexFromID("foo")).toBeUndefined();

  // add new case
  addCanonicalCasesToDataSet(dataset, [{ [strAttrID]: "d", [numAttrID]: 4 }]);
  const caseD4ID = dataset.cases[0].__id__;
  expect(dataset.getCaseAtIndex(-1)).toBeUndefined();
  expect(dataset.getCanonicalCaseAtIndex(0)).toEqual({ __id__: caseD4ID, [strAttrID]: "d", [numAttrID]: 4 });
  expect(dataset.getCaseAtIndex(0)).toEqual({ __id__: caseD4ID, str: "d", num: 4 });
  expect(dataset.getCase(caseD4ID)).toEqual({ __id__: caseD4ID, str: "d", num: 4 });
  expect(dataset.cases.length).toBe(1);
  expect(caseD4ID).toBeDefined();
  expect(dataset.attributes[0].value(0)).toBe("d");
  expect(dataset.attributes[1].value(0)).toBe(4);

  // add new case before first case
  addCanonicalCasesToDataSet(dataset, [{ [strAttrID]: "c", [numAttrID]: 3 }], caseD4ID);
  const caseC3ID = dataset.cases[0].__id__;
  expect(dataset.cases.length).toBe(2);
  expect(caseC3ID).toBeDefined();
  expect(caseC3ID).not.toBe(caseD4ID);
  expect(dataset.nextCaseID("")).toBeUndefined();
  expect(dataset.nextCaseID(caseC3ID)).toBe(caseD4ID);
  expect(dataset.cases[1].__id__).toBe(caseD4ID);
  expect(dataset.attributes[0].value(0)).toBe("c");
  expect(dataset.attributes[1].value(0)).toBe(3);

  // add multiple new cases
  addCanonicalCasesToDataSet(dataset, [ { [strAttrID]: "a", [numAttrID]: 1 },
                                        { [strAttrID]: "b", [numAttrID]: 2 }], caseC3ID);
  const caseA1ID = dataset.cases[0].__id__,
        caseB2ID = dataset.cases[1].__id__;
  expect(dataset.cases.length).toBe(4);
  expect(dataset.attributes[0].value(0)).toBe("a");
  expect(dataset.attributes[1].value(0)).toBe(1);
  expect(dataset.attributes[0].value(1)).toBe("b");
  expect(dataset.attributes[1].value(1)).toBe(2);
  expect(dataset.getCase(caseA1ID)).toEqual({ __id__: caseA1ID, str: "a", num: 1 });
  expect(dataset.getCase(caseB2ID)).toEqual({ __id__: caseB2ID, str: "b", num: 2 });
  expect(dataset.getCanonicalCase(caseA1ID))
    .toEqual({ __id__: caseA1ID, [strAttrID]: "a", [numAttrID]: 1 });
  expect(dataset.getCanonicalCase(caseB2ID))
    .toEqual({ __id__: caseB2ID, [strAttrID]: "b", [numAttrID]: 2 });
  expect(dataset.getCanonicalCases([caseA1ID, caseB2ID]))
    .toEqual([{ __id__: caseA1ID, [strAttrID]: "a", [numAttrID]: 1 },
              { __id__: caseB2ID, [strAttrID]: "b", [numAttrID]: 2 }]);
  expect(dataset.getCanonicalCasesAtIndices(0, 2))
    .toEqual([{ __id__: caseA1ID, [strAttrID]: "a", [numAttrID]: 1 },
              { __id__: caseB2ID, [strAttrID]: "b", [numAttrID]: 2 }]);
  expect(dataset.getCanonicalCaseAtIndex(-1)).toBeUndefined();
  expect(dataset.getCanonicalCasesAtIndices().length).toBe(4);
  expect(dataset.getCanonicalCasesAtIndices(2).length).toBe(2);
  // add null/undefined values
  addCanonicalCasesToDataSet(dataset, [{ [strAttrID]: undefined }]);
  // add invalid cases
  const nullCaseID = dataset.cases[dataset.cases.length - 1].__id__;
  expect(dataset.getCase(nullCaseID))
    .toEqual({ __id__: nullCaseID, str: undefined, num: undefined });
  expect(dataset.getCanonicalCases([""])).toEqual([]);
  // validate that caseIDMap is correct
  dataset.cases.forEach((aCase: ICaseID) => {
    const caseIndex = dataset.caseIndexFromID(aCase.__id__);
    expect((caseIndex >= 0) ? dataset.cases[caseIndex].__id__ : "").toBe(aCase.__id__);
  });
  addCanonicalCasesToDataSet(dataset, [{ __id__: "12345", [strAttrID]: "e", [numAttrID]: 5 }]);
  dataset.removeCases(["12345"]);

  // setCanonicalCaseValues
  dataset.setCanonicalCaseValues([{ __id__: caseA1ID, [strAttrID]: "A", [numAttrID]: 10 }]);
  expect(dataset.getCase(caseA1ID)).toEqual({ __id__: caseA1ID, str: "A", num: 10 });
  dataset.setCanonicalCaseValues([{ __id__: caseB2ID, [strAttrID]: "B", [numAttrID]: 20 },
                                  { __id__: caseC3ID, [strAttrID]: "C", [numAttrID]: 30 }]);
  expect(dataset.getCase(caseB2ID)).toEqual({ __id__: caseB2ID, str: "B", num: 20 });
  expect(dataset.getValue(caseC3ID, strAttrID)).toBe("C");
  expect(dataset.getValue(caseC3ID, numAttrID)).toBe(30);
  dataset.setCanonicalCaseValues([{ __id__: caseA1ID, foo: "bar" }]);
  expect(dataset.getCase(caseA1ID)).toEqual({ __id__: caseA1ID, str: "A", num: 10 });
  dataset.setCanonicalCaseValues([{ __id__: caseA1ID, [numAttrID]: undefined }]);
  expect(dataset.getCase(caseA1ID)).toEqual({ __id__: caseA1ID, str: "A", num: undefined });

  const cases = dataset.getCases([caseB2ID, caseC3ID, ""]);
  expect(cases.length).toBe(2);
  expect(cases[0]).toEqual({ __id__: caseB2ID, str: "B", num: 20 });
  expect(cases[1]).toEqual({ __id__: caseC3ID, str: "C", num: 30 });

  dataset.removeCases([nullCaseID]);
  expect(dataset.cases.length).toBe(4);
  dataset.removeCases([caseA1ID, caseB2ID]);
  expect(dataset.cases.length).toBe(2);
  // validate that caseIDMap is correct
  dataset.cases.forEach((aCase: ICaseID) => {
    const caseIndex = dataset.caseIndexFromID(aCase.__id__);
    expect((caseIndex >= 0) ? dataset.cases[caseIndex].__id__ : "").toBe(aCase.__id__);
  });
  dataset.removeCases([""]);
  expect(dataset.cases.length).toBe(2);
  destroy(dataset);
});

test("Derived DataSet functionality", () => {
  const dataset = DataSet.create({ name: "data" } as any);

  // add attributes and cases
  addAttributeToDataSet(dataset, { name: "str" });
  addAttributeToDataSet(dataset, { name: "num" });
  const strAttrID = dataset.attributes[0].id;
  addCasesToDataSet(dataset, [{ str: "a", num: 1 },
                              { str: "b", num: 2 },
                              { str: "c", num: 3 }]);

  const derived = dataset.derive("derived");
  expect(derived.name).toBe("derived");
  expect(derived.attributes.length).toBe(2);
  expect(derived.cases.length).toBe(3);
  const derivedCase0ID = derived.cases[0].__id__,
        derivedCase1ID = derived.cases[1].__id__,
        derivedCases = derived.getCases([derivedCase0ID, derivedCase1ID]);
  expect(derivedCases[0]).toEqual({ __id__: derivedCase0ID, str: "a", num: 1 });
  expect(derivedCases[1]).toEqual({ __id__: derivedCase1ID, str: "b", num: 2 });

  const derived2 = dataset.derive("derived2", { attributeIDs: [strAttrID, ""] });
  expect(derived2.name).toBe("derived2");
  expect(derived2.attributes.length).toBe(1);
  expect(derived.cases.length).toBe(3);
  const derived2Case0ID = derived2.cases[0].__id__,
        derived2Case1ID = derived2.cases[1].__id__,
        derived2Cases = derived2.getCases([derived2Case0ID, derived2Case1ID]);
  expect(derived2Cases[0]).toEqual({ __id__: derived2Case0ID, str: "a" });
  expect(derived2Cases[1]).toEqual({ __id__: derived2Case1ID, str: "b" });

  const filter = (aCase: ICase) => {
          const num = aCase && aCase.num;
          return (num != null) && (num >= 3) ? aCase : undefined;
        },
        derived3 = dataset.derive("derived3", { filter });
  expect(derived3.name).toBe("derived3");
  expect(derived3.attributes.length).toBe(2);
  expect(derived3.cases.length).toBe(1);
  const derived3Case0ID = derived3.cases[0].__id__,
        derived3Cases = derived3.getCases([derived3Case0ID]);
  expect(derived3Cases[0]).toEqual({ __id__: derived3Case0ID, str: "c", num: 3 });

  const derived4 = dataset.derive();
  expect(derived4.name).toBe("data");
});

function createDataSet(name: string) {
  const ds = DataSet.create({ name } as any);
  // add attributes and cases
  addAttributeToDataSet(ds, { name: "str" });
  addAttributeToDataSet(ds, { name: "num" });
  addCasesToDataSet(ds, [ { str: "a", num: 1 },
                          { str: "b", num: 2 },
                          { str: "c", num: 3 },
                          { str: "d", num: 4 },
                          { str: "e", num: 5 }]);
  return ds;
}

function createOdds(source: IDataSet) {
  const numAttr = source.attrFromName("num"),
        numAttrID = numAttr && numAttr.id || "";
  return source.derive("odds", {
                        attributeIDs: [numAttrID],
                        filter: (aCase: ICase) => {
                          const num: number = Number(aCase && aCase.num) || 0;
                          return num % 2 ? aCase : undefined;
                        },
                        synchronize: true
                      });
}

function createEvens(source: IDataSet) {
  return source.derive("evens", {
                        filter: (aCase: ICase) => {
                          const num: number = Number(aCase && aCase.num) || 0;
                          return num % 2 === 0 ? aCase : undefined;
                        },
                        synchronize: true
                      });
}

test("Selection", () => {
  const ds = createDataSet("source");

  // Select and deselect all cases
  expect(ds.selectedCaseIds.length).toBe(0);
  ds.selectAllCases();
  expect(ds.selectedCaseIds.length).toBe(5);
  ds.selectAllCases(false);
  expect(ds.selectedCaseIds.length).toBe(0);

  // Select and deselect all attributes
  expect(ds.selectedAttributeIds.length).toBe(0);
  ds.selectAllAttributes();
  expect(ds.selectedAttributeIds.length).toBe(2);
  ds.selectAllAttributes(false);
  expect(ds.selectedAttributeIds.length).toBe(0);

  // Select and deselect all cells
  expect(ds.selectedCells.length).toBe(0);
  ds.selectAllCells();
  expect(ds.selectedCells.length).toBe(10);
  ds.selectAllCells(false);
  expect(ds.selectedCells.length).toBe(0);

  // Select cases
  const caseId = ds.caseIDFromIndex(0) ?? "caseId";
  expect(ds.selectedCaseIds.length).toBe(0);
  ds.selectCases([caseId]);
  expect(ds.selectedCaseIds.length).toBe(1);
  ds.selectCases([caseId], false);
  expect(ds.selectedCaseIds.length).toBe(0);

  // Select attributes
  const attributeId = ds.attrIDFromIndex(0) ?? "attributeId";
  expect(ds.selectedAttributeIds.length).toBe(0);
  ds.selectAttributes([attributeId]);
  expect(ds.selectedAttributeIds.length).toBe(1);
  ds.selectAttributes([attributeId], false);
  expect(ds.selectedAttributeIds.length).toBe(0);

  // Select cell
  const cell = { attributeId, caseId };
  expect(ds.isAnyCellSelected).toBe(false);
  ds.selectCells([cell]);
  expect(ds.isAnyCellSelected).toBe(true);
  ds.selectCells([cell], false);
  expect(ds.isAnyCellSelected).toBe(false);
});

test("Derived DataSet synchronization (subset attributes)", () => {
  const source = createDataSet("source"),
        odds = createOdds(source);

  expect(odds.attributes.length).toBe(1);

  const bCaseID = source.cases[1].__id__,
        cCaseID = source.cases[2].__id__,
        dCaseID = source.cases[3].__id__,
        eCaseID = source.cases[4].__id__;
  let abCaseID: string,
      cdCaseID: string,
      gCaseID: string;
  addAttributeToDataSet(source, { name: "foo" });
  const fooAttrID = source.attributes[2].id;

  return odds.onSynchronized()
    .then(() => {
      expect(odds.isSynchronizing).toBe(false);
      expect(odds.attributes.length).toBe(1);

      source.removeAttribute(fooAttrID);
      return odds.onSynchronized();
    })
    .then(() => {
      expect(odds.attributes.length).toBe(1);

      addCasesToDataSet(source, [{ str: "f", num: 6 }, { str: "g", num: 7 }]);
      gCaseID = source.cases[6].__id__;
      return odds.onSynchronized();
    })
    .then(() => {
      expect(odds.cases.length).toBe(4);
      expect(odds.getCase(gCaseID)).toEqual({ __id__: gCaseID, num: 7 });

      addCasesToDataSet(source, [{ str: "ab", num: -3 }, { str: "cd", num: -1 }], [bCaseID, dCaseID]);
      abCaseID = source.cases[1].__id__;
      expect(source.getCase(abCaseID)).toEqual({ __id__: abCaseID, str: "ab", num: -3 });
      cdCaseID = source.cases[4].__id__;
      expect(source.getCase(cdCaseID)).toEqual({ __id__: cdCaseID, str: "cd", num: -1 });
      return odds.onSynchronized();
    })
    .then(() => {
      expect(odds.cases.length).toBe(6);
      expect(odds.getCase(abCaseID)).toEqual({ __id__: abCaseID, num: -3 });
      expect(odds.nextCaseID(abCaseID)).toBe(cCaseID);
      expect(odds.getCase(cdCaseID)).toEqual({ __id__: cdCaseID, num: -1 });
      expect(odds.nextCaseID(cdCaseID)).toBe(eCaseID);
      // setCaseValues: changing odd value to even should result in removing case
      source.setCaseValues([{ __id__: cCaseID, num: 2 }]);
      return odds.onSynchronized();
    })
    .then(() => {
      expect(odds.cases.length).toBe(5);
      source.setCaseValues([{ __id__: cCaseID, num: 3 }]);
      return odds.onSynchronized();
    })
    .then(() => {
      expect(odds.cases.length).toBe(6);
      expect(odds.nextCaseID(cCaseID)).toBe(cdCaseID);
      source.setCaseValues([{ __id__: bCaseID, num: 3 }, { __id__: dCaseID, num: 5 }]);
      return odds.onSynchronized();
    })
    .then(() => {
      expect(odds.cases.length).toBe(8);
      expect(odds.nextCaseID(bCaseID)).toBe(cCaseID);
      expect(odds.nextCaseID(dCaseID)).toBe(eCaseID);
      return odds.onSynchronized();
    })
    .then(() => {
      // test destruction
      destroy(odds);
    });
});

test("Derived DataSet synchronization (all attributes)", () => {
  const source = createDataSet("source"),
        evens = createEvens(source),
        bCaseID = evens.cases[1].__id__;

  expect(evens.attributes.length).toBe(2);

  let a1CaseID: string, a2CaseID;
  addAttributeToDataSet(source, { name: "foo" });
  const fooAttrID = source.attributes[2].id;

  return evens.onSynchronized()
    .then(() => {
      expect(evens.isSynchronizing).toBe(false);
      expect(evens.attributes.length).toBe(3);

      source.removeAttribute(fooAttrID);
      return evens.onSynchronized();
    })
    .then(() => {
      expect(evens.attributes.length).toBe(2);

      addCasesToDataSet(source, [{ str: "a1", num: -4 }, { str: "a2", num: -2 }], bCaseID);
      return evens.onSynchronized();
    })
    .then(() => {
      expect(evens.cases.length).toBe(4);
      a1CaseID = evens.cases[1].__id__;
      a2CaseID = evens.cases[2].__id__;
      expect(evens.getCase(a1CaseID)).toEqual({ __id__: a1CaseID, str: "a1", num: -4 });
      expect(evens.nextCaseID(a1CaseID)).toBe(a2CaseID);
      expect(evens.getCase(a2CaseID)).toEqual({ __id__: a2CaseID, str: "a2", num: -2 });
      expect(evens.nextCaseID(a2CaseID)).toBe(bCaseID);
      return evens.onSynchronized();
    })
    .then(() => {
      // test invalid setCaseValues handling
      source.setCaseValues([{} as ICase]);
      // test invalid setCanonicalCaseValues handling
      source.setCanonicalCaseValues([{} as ICase]);
      // test multiple setCaseValues
      source.setCaseValues([{ __id__: a1CaseID, num: -3 }]);
      source.setCaseValues([{ __id__: a1CaseID, num: -2 }]);
      return evens.onSynchronized();
    })
    .then(() => {
      // test destruction
      destroy(evens);
    });
});

test("Derived DataSet synchronization (no filter)", () => {
  const source = createDataSet("source"),
        derived = source.derive("derived", { synchronize: true });

  addCasesToDataSet(source, [{ str: "g", num: 7 }]);
  expect(source.cases.length).toBe(6);
  let fCaseID: string;
  const gCaseID = source.cases[5].__id__;
  derived.onSynchronized()
    .then(() => {
      expect(derived.cases.length).toBe(6);
      expect(derived.getCase(gCaseID)).toEqual({ __id__: gCaseID, str: "g", num: 7 });
      addCasesToDataSet(source, [{ str: "f", num: 7 }], gCaseID);
      fCaseID = source.cases[5].__id__;
      return derived.onSynchronized();
    })
    .then(() => {
      expect(derived.cases.length).toBe(7);
      expect(derived.getCaseAtIndex(5)).toEqual({ __id__: fCaseID, str: "f", num: 7 });
      source.setCaseValues([{ __id__: fCaseID, num: 6 }]);
      return derived.onSynchronized();
    })
    .then(() => {
      expect(derived.getCase(fCaseID)).toEqual({ __id__: fCaseID, str: "f", num: 6 });
      destroy(derived);
    });
});

// This is failing because the formula of attributes now has an id.
// This id will change when the addAttributeWithID is replayed.
// In CODAP attribute.formula defaults to be undefined so this isn't
// a problem. If perfect synchronization is required then this test
// is now detecting a problem we need to fix. However it doesn't seem
// like synchronization is used by CLUE.
test.skip("DataSet client synchronization", (done) => {
  const src = DataSet.create({ name: "source" } as any),
        dst = clone(src),
        dst2 = clone(dst);
  let srcActionCount = 0,
      dstActionCount = 0;
  // should initially be equivalant
  expect(getSnapshot(src)).toEqual(getSnapshot(dst));
  expect(getSnapshot(dst)).toEqual(getSnapshot(dst2));
  // keep dst in sync with src
  onAction(src, (action) => {
    ++srcActionCount;
    // console.log(`onSrcAction [pre]: count: ${srcActionCount}, action: ${JSON.stringify(action)}`);
    // have to use setTimeout otherwise subsequent actions don't trigger
    // perhaps the code that suppresses actions within actions
    setTimeout(() => {
      --srcActionCount;
      // console.log(`onSrcAction [run]: count: ${srcActionCount}, action: ${JSON.stringify(action)}`);
      applyAction(dst, action);
      if ((srcActionCount <= 0) && (dstActionCount <= 0)) {
        expect(getSnapshot(dst)).toEqual(getSnapshot(src));
        done();
      }
    });
  });
  // keep dst2 in sync with dst
  onAction(dst, (action) => {
    ++dstActionCount;
    // console.log(`onDstAction [pre]: count: ${dstActionCount}, action: ${JSON.stringify(action)}`);
    setTimeout(() => {
      --dstActionCount;
      // console.log(`onDstAction [run]: count: ${dstActionCount}, action: ${JSON.stringify(action)}`);
      applyAction(dst2, action);
      if ((srcActionCount <= 0) && (dstActionCount <= 0)) {
        expect(getSnapshot(dst2)).toEqual(getSnapshot(dst));
        done();
      }
    });
  });

  addAttributeToDataSet(src, { name: "str" });
  addAttributeToDataSet(src, { name: "num" });
  addCasesToDataSet(src, [{ str: "a", num: 1 }]);
  addCasesToDataSet(src, [{ str: "b", num: 2 }, { str: "c", num: 3 }]);
  src.removeAttribute(src.attributes[0].id);
});

test("DataSet sortByAttribute handles empty dataset", () => {
  const dataset = DataSet.create({ name: "Empty", attributes: [], cases: [] });
  // Should not throw or change anything
  expect(() => dataset.sortByAttribute("nonexistent")).not.toThrow();
  expect(dataset.cases.length).toBe(0);
});

test("DataSet sortByAttribute with missing attribute values", () => {
  const dataset = DataSet.create({ name: "Missing", attributes: [], cases: [] });
  const attrA = addAttributeToDataSet(dataset, { id: "a", name: "A", values: [] });
  addCasesToDataSet(dataset, [
    { __id__: "1", A: "x" },
    { __id__: "2" }, // missing value for A
    { __id__: "3", A: "y" }
  ]);
  dataset.sortByAttribute(attrA.id, "ASC");
  // Case "2" (missing value) should sort before "1" and "3"
  expect(dataset.cases.map(c => c.__id__)).toEqual(["1", "3", "2"]);
});

test("DataSet sortByAttribute is stable for equal values", () => {
  const dataset = DataSet.create({ name: "Stable", attributes: [], cases: [] });
  const attrA = addAttributeToDataSet(dataset, { id: "a", name: "A", values: [] });
  addCasesToDataSet(dataset, [
    { __id__: "1", A: "same" },
    { __id__: "2", A: "same" },
    { __id__: "3", A: "same" }
  ]);
  dataset.sortByAttribute(attrA.id, "ASC");
  // Order should be preserved
  expect(dataset.cases.map(c => c.__id__)).toEqual(["1", "2", "3"]);
});

test("DataSet sortByAttribute returns correct index mapping", () => {
  const dataset = DataSet.create({ name: "Mapping", attributes: [], cases: [] });
  const attrA = addAttributeToDataSet(dataset, { id: "a", name: "A", values: [] });
  addCasesToDataSet(dataset, [
    { __id__: "1", A: "c" },
    { __id__: "2", A: "a" },
    { __id__: "3", A: "b" }
  ]);
  const mapping = dataset.sortByAttribute(attrA.id, "ASC");
  expect(mapping).toEqual({
    "2": { beforeIndex: 1, afterIndex: 0 },
    "3": { beforeIndex: 2, afterIndex: 1 },
    "1": { beforeIndex: 0, afterIndex: 2 }
  });
});

test("DataSet sortByAttribute does not mutate attribute values if already sorted", () => {
  const dataset = DataSet.create({ name: "NoMutation", attributes: [], cases: [] });
  const attrA = addAttributeToDataSet(dataset, { id: "a", name: "A", values: [] });
  addCasesToDataSet(dataset, [
    { __id__: "1", A: "a" },
    { __id__: "2", A: "b" }
  ]);
  const origValues = dataset.attributes[0].values.slice();
  dataset.sortByAttribute(attrA.id, "ASC");
  expect(dataset.attributes[0].values).toEqual(origValues);
});
