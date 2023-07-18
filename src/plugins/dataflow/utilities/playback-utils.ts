import { Node } from "rete";
import { IDataSet } from "../../../models/data/data-set";
import { kMaxNodeValues } from "../model/utilities/node";
import { ValueControl } from "../nodes/controls/value-control";
import { ICase } from "../../../models/data/data-set-types";
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

const binaryToOnOff = (val: number) => (val === 0 ? "off" : "on");
const binaryToBinStr = (val: number) => (val === 0 ? " ⇒ 0" : " ⇒ 1");

// Playback currently is a limited representation of the node value recorded during execution
// Rather than being calcualted by rete, the value and prior 17 recents are retrieved from the dataset
// We do not currently record, and thus do not display the input values during playback
// If the original recorded value was derived from input values, we add an -> to indicate that
// If the original recorded value is a binary displayed as a string (e.g. "on" or "off"), we display it as such
// (Note that in Demo and Live nodes, InputValueControl manages node value like a ValueControl)
export function runNodePlaybackUpdates(node: Node, valForNode: number){
  let nodeControl;
  switch (node.name){
    case "Generator":
      nodeControl = node.controls.get("nodeValue") as ValueControl;
      nodeControl.setSentence(`${valForNode}`);
      break;
    case "Transform":
    case "Math":
    case "Control":
      nodeControl = node.controls.get("nodeValue") as ValueControl;
      nodeControl.setSentence(` → ${valForNode}`);
      break;
    case "Timer":
      nodeControl = node.controls.get("nodeValue") as ValueControl;
      nodeControl.setSentence(binaryToOnOff(valForNode));
      break;
    case "Logic":
      nodeControl = node.controls.get("nodeValue") as ValueControl;
      nodeControl.setSentence(binaryToBinStr(valForNode));
      break;
    case "Number":
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
      nodeControl.setDisplayMessage(binaryToOnOff(valForNode));
      break;
    default:
  }
}

export function calculatedRecentValues(dataSet: IDataSet, playbackIndex: number, attrId: string ){
  const vals: number[] = [];
  const priorCases = getPriorCases(dataSet, playbackIndex);
  priorCases.forEach((c: ICase | undefined) => {
    if (c) {
      const caseNodeValue = dataSet.getValue(c.__id__, attrId) as number;
      if (isFinite(caseNodeValue)) vals.push(caseNodeValue);
    }
  });
  return { "nodeValue": vals };
}
