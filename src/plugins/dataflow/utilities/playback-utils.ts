import { Node } from "rete";
import { IDataSet } from "../../../models/data/data-set";
import { kMaxNodeValues } from "../model/utilities/node";
import { ValueControl } from "../nodes/controls/value-control";
import { ICaseCreation } from "../../../models/data/data-set-types";

const valueControl = (node: Node) => node.controls.get("nodeValue") as ValueControl;
const binaryToOnOff = (val: number) => val === 0 ? "off" : "on";

function getPriorCases(dataSet: IDataSet, playhead: number){
  // kMaxNodeValues determines how many datapoints are plotted each time
  const offset = 1;
  const maxValues = kMaxNodeValues + offset;
  const pastCalc = playhead - maxValues;
  const regionStart = pastCalc < 0 ? 0 : pastCalc;
  const countOfCasesToGet = playhead < maxValues ? playhead : maxValues;
  return dataSet.getCasesAtIndices(regionStart, countOfCasesToGet);
}

export function getRecentValuesForNode(dataSet: IDataSet, playbackIndex: number, attrId: string ){
  const calculatedRecentValues: number[] = [];
  const priorCases = getPriorCases(dataSet, playbackIndex) as ICaseCreation[];
  const priorCasesIds = priorCases.map((c: ICaseCreation) => c.__id__);
  priorCasesIds.forEach((c) => {
    const caseNodeValue = dataSet.getValue(c as string, attrId) as number;
    if (isFinite(caseNodeValue)) calculatedRecentValues.push(caseNodeValue);
  });
  return calculatedRecentValues;
}

export function updatePlaybackValueControl(node: Node, value: string | number){
  if (typeof value === "number") valueControl(node).setValue(value);
  if (typeof value === "string") valueControl(node).setSentence(value);
}

export function updatePlaybackValueControlWithOnOff(valForNode: number, node: Node){
  valueControl(node).setSentence(binaryToOnOff(valForNode));
}
