import { addAttributeToDataSet, IDataSet, addCasesToDataSet } from "./data-set";

export function mergeTwoDataSets(source: IDataSet, target: IDataSet) {
    const sourceAttrNames = source.attributes.map((attrObj: any) => attrObj.name);
    sourceAttrNames.forEach((name) => {
      if (!target.attrNameMap[name]) {
        addAttributeToDataSet(target, { name });
      }
    });
    const sourceCases: any[] = [];
    source.cases.forEach((aCase, idx) => {
      const newCase: any = {};
      source.attributes.forEach((attr) => {
        const attrName = attr.name as keyof typeof newCase;
        newCase[attrName] = attr.values[idx];
      });
      sourceCases.push(newCase);
    });
    addCasesToDataSet(target, sourceCases);
}
