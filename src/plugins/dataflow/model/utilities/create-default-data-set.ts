import { addAttributeToDataSet, DataSet } from "../../../../models/data/data-set";

export function createDefaultDataSet(title: string | undefined){
  const dataSet = DataSet.create({ name: title });
  addAttributeToDataSet(dataSet, { name: "x" });
  addAttributeToDataSet(dataSet, { name: "y" });
  return dataSet;
}
