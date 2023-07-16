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

const asStrings = ["Generator", "Transform", "Math", "Control", "Timer", "Logic"];
const asNumbers = ["Number", "Sensor"];
const asOutputs = ["Demo Output", "Live Output"];

export function runNodePlaybackUpdates(node: Node, valForNode: number){
  if (asStrings.includes(node.name)){
    const nodeControl = node.controls.get("nodeValue") as ValueControl;
    switch (node.name){
      case "Generator": nodeControl.setSentence(`${valForNode}`); break;
      case "Transform": nodeControl.setSentence(` → ${valForNode}`); break;
      case "Math":      nodeControl.setSentence(` → ${valForNode}`); break;
      case "Control":   nodeControl.setSentence(` → ${valForNode}`); break;
      case "Timer":     nodeControl.setSentence(valForNode === 0 ? "off" : "on"); break;
      case "Logic":     nodeControl.setSentence(valForNode === 0 ? " ⇒ 0" : " ⇒ 1"); break;
    }
  }

  if (asNumbers.includes(node.name)){
    const nodeControl = node.controls.get("nodeValue") as ValueControl;
    nodeControl.setValue(valForNode);
  }

  if(asOutputs.includes(node.name)){
    const inputControl = node.inputs.get("nodeValue")?.control as InputValueControl;
    if (node.name === "Demo Output"){
      const nodeControl = node.controls.get("demoOutput") as DemoOutputControl;
      nodeControl.setValue(valForNode);
      inputControl.setDisplayMessage(`${valForNode}`);
    }
    if (node.name === "Live Output"){
      inputControl.setDisplayMessage(valForNode === 0 ? "off" : "on");
    }
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
