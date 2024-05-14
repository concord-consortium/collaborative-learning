import { DataflowContentModelType } from "../dataflow-content";
import { addCanonicalCasesToDataSet, IDataSet } from "../../../../models/data/data-set";
import { ICaseCreation } from "../../../../models/data/data-set-types";

// this function adds one to index to skip time attribute
export function getAttributeIdForNode(dataSet: IDataSet, nodeIndex: number) {
  // The table might have been modified by the user so the attributes might
  // not exist or match up. We do not currently check if the attributes match
  // up, but we handle when the index is out of bounds or if the attribute
  // has become undefined somehow.
  const attrIndex = nodeIndex + 1;
  if (attrIndex >= dataSet.attributes.length) return undefined;
  return dataSet.attributes[attrIndex]?.id;
}

export function recordCase(content: DataflowContentModelType, recordIndex: number) {
  const { dataSet, programDataRate, program } = content;

  //Attributes look like Time (quantized) as col 1 followed by all nodes
  const aCase: ICaseCreation = {};

  //Quantize and write time
  const timeQuantizedKey = dataSet.attributes[0].id;
  const recordTimeQuantized = (recordIndex * programDataRate) / 1000; //in seconds
  aCase[timeQuantizedKey] = recordTimeQuantized;

  //loop through attribute (nodes) and write each value
  let idx = 0;
  program.nodes.forEach((node) => {
    const key = getAttributeIdForNode(dataSet, idx);

    // The user might have deleted an attribute while the data is recording.
    // In this case we'll continue recording and not crash. The data will
    // go in the wrong columns if the user deleted an attribute other than the
    // last one.
    if (!key) return;

    const { nodeValue } =  node.data;
    // TODO: This approach will show NaN as "NaN" in the table.
    // That is what was happening before.
    // Perhaps we want to show it as an empty value instead:
    // aCase[key] = nodeValue == null || isNaN(nodeValue) ? null : nodeValue;
    aCase[key] = nodeValue;
    idx++;
  });
  addCanonicalCasesToDataSet(dataSet, [aCase]);
}
