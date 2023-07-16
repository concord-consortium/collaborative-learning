import { Node } from "rete";
import { IDataSet } from "../../../models/data/data-set";
import { kMaxNodeValues } from "../model/utilities/node";
import { ValueControl } from "../nodes/controls/value-control";
import { ICaseCreation } from "../../../models/data/data-set-types";
import { SensorValueControl } from "../nodes/controls/sensor-value-control";
import { InputValueControl } from "../nodes/controls/input-value-control";
import { DemoOutputControl } from "../nodes/controls/demo-output-control";

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

export function calculatedRecentValues(dataSet: IDataSet, playbackIndex: number, attrId: string ){
  const vals: number[] = [];
  const priorCases = getPriorCases(dataSet, playbackIndex) as ICaseCreation[];
  const priorCasesIds = priorCases.map((c: ICaseCreation) => c.__id__);
  priorCasesIds.forEach((c) => {
    const caseNodeValue = dataSet.getValue(c as string, attrId) as number;
    if (isFinite(caseNodeValue)) vals.push(caseNodeValue);
  });
  return { "nodeValue": vals };
}

export function updatePlaybackValueControl(node: Node, value: string | number){
  if (typeof value === "number") valueControl(node).setValue(value);
  if (typeof value === "string") valueControl(node).setSentence(value);
}

export function updatePlaybackValueControlWithOnOff(valForNode: number, node: Node){
  valueControl(node).setSentence(binaryToOnOff(valForNode));
}

export function updatePlaybackValueControlSpecialCases(node: Node, valForNode: number){
  let nodeControl;
  switch (node.name){
    case "Transform":
      nodeControl = node.controls.get("nodeValue") as ValueControl;
      nodeControl.setSentence(` → ${valForNode}`);
      break;
    case "Sensor":
      nodeControl = node.controls.get("nodeValue") as SensorValueControl;
      nodeControl.setValue(valForNode);
      break;
    case "Timer":
      nodeControl = node.controls.get("nodeValue") as ValueControl;
      nodeControl.setSentence(valForNode === 0 ? "off" : "on");
      break;
    case "Math":
      nodeControl = node.controls.get("nodeValue") as ValueControl;
      nodeControl.setSentence(` → ${valForNode}`);
      break;
    case "Logic":
      nodeControl = node.controls.get("nodeValue") as ValueControl;
      nodeControl.setSentence(valForNode === 0 ? " ⇒ 0" : " ⇒ 1");
      break;
    case "Control":
      nodeControl = node.controls.get("nodeValue") as ValueControl;
      nodeControl.setSentence(` → ${valForNode}`);
      break;
    case "Demo Output":
      nodeControl = node.controls.get("demoOutput") as DemoOutputControl;
      nodeControl.setValue(valForNode);
      nodeControl = node.inputs.get("nodeValue")?.control as InputValueControl;
      nodeControl.setDisplayMessage(`${valForNode}`);
      break;
    case "Live Output":
      nodeControl = node.inputs.get("nodeValue")?.control as InputValueControl;
      nodeControl.setDisplayMessage(valForNode === 0 ? "off" : "on");
      break;
    default:
  }
}

export function runNodePlaybackUpdates(node: Node, valForNode: number){
  if (["Number", "Generator"].includes(node.name)){
    updatePlaybackValueControl(node, valForNode);
  } else {
    updatePlaybackValueControlSpecialCases(node, valForNode);
  }
}
