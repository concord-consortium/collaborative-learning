import { addAttributeToDataSet, IDataSet, addCasesToDataSet, IDataSetSnapshot, ICaseCreation } from "./data-set";

export function mergeTwoDataSets(source: IDataSetSnapshot, target: IDataSet) {
    console.log("| attempting... |", source, target);
    const sourceAttrNames = source.attributes.map((attrObj) => attrObj.name);
    sourceAttrNames.forEach((name) => {
      if (!target.attrNameMap[name]) {
        addAttributeToDataSet(target, { name });
      }
    });
    const sourceCases: ICaseCreation[] = [];
    source.cases.forEach((aCase, idx) => {
      const newCase: ICaseCreation = {};
      source.attributes.forEach((attr) => {
        const attrName = attr.name;
        newCase[attrName] = attr.values[idx];
      });
      sourceCases.push(newCase);
    });
    addCasesToDataSet(target, sourceCases);
}
