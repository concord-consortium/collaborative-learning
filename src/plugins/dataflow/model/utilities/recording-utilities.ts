import { NodeEditor } from "rete";

import { DataflowContentModelType } from "../dataflow-content";
import { addCanonicalCasesToDataSet, IDataSet } from "../../../../models/data/data-set";
import { ICaseCreation } from "../../../../models/data/data-set-types";

// this function adds one to index to skip time attribute
export function getAttributeIdForNode(dataSet: IDataSet, nodeIndex: number) {
  return dataSet.attributes[nodeIndex + 1].id;
}

export function recordCase(content: DataflowContentModelType, editor: NodeEditor, recordIndex: number) {
  const { dataSet, programDataRate } = content;

  //Attributes look like Time (quantized) as col 1 followed by all nodes
  const aCase: ICaseCreation = {};

  //Quantize and write time
  const timeQuantizedKey = dataSet.attributes[0].id;
  const recordTimeQuantized = (recordIndex * programDataRate) / 1000; //in seconds
  aCase[timeQuantizedKey] = recordTimeQuantized;

  //loop through attribute (nodes) and write each value
  editor.nodes.forEach((node, idx) => {
    const key = getAttributeIdForNode(dataSet, idx);
    aCase[key] = node.data.nodeValue as string;
  });
  addCanonicalCasesToDataSet(dataSet, [aCase]);
}
