import { Node } from "rete";
import { IDataSet } from "../../../models/data/data-set";
import { kMaxNodeValues } from "../model/utilities/node";
import { ValueControl } from "../nodes/controls/value-control";
import { NumControl } from "../nodes/controls/num-control";
import { SensorValueControl } from "../nodes/controls/sensor-value-control";

const valueControl = (node: Node) => node.controls.get("nodeValue") as ValueControl;
const inputControl = (node: Node) => node.controls.get("inputValue") as NumControl;

const binaryToOnOff = (val: number) => val === 0 ? "off" : "on";
const arrowedNumber = (val: number) => ` → ${val}`;

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
  const priorCases = getPriorCases(dataSet, playbackIndex);
  const calculatedRecentValues: number[] = [];
  priorCases.forEach((c: any) => {
    const caseNodeValue = dataSet.getValue(c.__id__, attrId) as number;
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
