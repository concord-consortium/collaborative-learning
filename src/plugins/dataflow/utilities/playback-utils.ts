import { Node } from "rete";
import { IDataSet } from "../../../models/data/data-set";
import { kMaxNodeValues } from "../model/utilities/node";
import { ValueControl } from "../nodes/controls/value-control";
import { ICaseCreation } from "../../../models/data/data-set-types";
import { InputValueControl } from "../nodes/controls/input-value-control";
import { DemoOutputControl } from "../nodes/controls/demo-output-control";

function getPriorCases(dataSet: IDataSet, playhead: number){
  const offset = 1;
  const maxValues = kMaxNodeValues + offset;
  const pastCalc = playhead - maxValues;
  const regionStart = pastCalc < 0 ? 0 : pastCalc;
  const countOfCasesToGet = playhead < maxValues ? playhead : maxValues;
  return dataSet.getCasesAtIndices(regionStart, countOfCasesToGet);
}

export function runNodePlaybackUpdates(node: Node, valForNode: number){
  let nodeControl;
  switch (node.name){
    case "Generator":
      nodeControl = node.controls.get("nodeValue") as ValueControl;
      nodeControl.setSentence(`${valForNode}`);
      break;
    case "Transform":
      nodeControl = node.controls.get("nodeValue") as ValueControl;
      nodeControl.setSentence(` → ${valForNode}`);
      break;
    case "Math":
      nodeControl = node.controls.get("nodeValue") as ValueControl;
      nodeControl.setSentence(` → ${valForNode}`);
      break;
    case "Control":
      nodeControl = node.controls.get("nodeValue") as ValueControl;
      nodeControl.setSentence(` → ${valForNode}`);
      break;
    case "Timer":
      nodeControl = node.controls.get("nodeValue") as ValueControl;
      nodeControl.setSentence(valForNode === 0 ? "off" : "on");
      break;
    case "Logic":
      nodeControl = node.controls.get("nodeValue") as ValueControl;
      nodeControl.setSentence(valForNode === 0 ? " ⇒ 0" : " ⇒ 1");
      break;
    case "Number":
      nodeControl = node.controls.get("nodeValue") as ValueControl;
      nodeControl.setValue(valForNode);
      break;
    case "Sensor":
      nodeControl = node.controls.get("nodeValue") as ValueControl;
      nodeControl.setValue(valForNode);
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
