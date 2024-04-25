import React from 'react';
import SineIcon from "../../../shared-assets/icons/dataflow/generator/sine.svg";


import AddIcon from "../../../shared-assets/icons/dataflow/math/add.svg";
import MultiplyIcon from "../../../shared-assets/icons/dataflow/math/multiply.svg";
import DivideIcon from "../../../shared-assets/icons/dataflow/math/divide.svg";


import SignalIcon from "../../../shared-assets/icons/dataflow/control/signal.svg";
import ServoIcon from "../../../shared-assets/icons/dataflow/output/servo.svg";


import { ISharedProgramNode, SharedProgramDataType } from '../../../shared-program-data/shared-program-data';

export function getTweenedServoAngle(realValue: number, lastVisibleValue: number) {
  const delta = realValue - lastVisibleValue;
  const steps = 5;
  const maxDelta = 40;
  if (Math.abs(delta) > maxDelta) {
    return (lastVisibleValue + Math.sign(delta) * steps);
  }
  return realValue;
}
export const wireToA1 = () => (
  <>
    <svg className="pot-to-a1 line" width="59px" height="20px" viewBox="0 0 59 20" version="1.1">
      <title>path-4</title>
      <g id="Page-1" stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
          <g id="Path-2-Copy-3" transform="translate(0.5, 1.6704)" strokeWidth="3">
              <g id="path-4-link-line">
                  <path
                    d="M0,16 L4.5,16
                    C10.0228475,16 12.5,13.522847 12.5,8 C12.5,2.477152 14.9771525,0 20.5,0 L57.8783423,0"
                    className="path-to-a1 line"
                    transform="translate(28.9392, 8) scale(1, -1) translate(-28.9392, -8)">
                  </path>
              </g>
          </g>
      </g>
    </svg>
    <svg className="pot-to-a1 dashes" width="59px" height="20px" viewBox="0 0 59 20" version="1.1">
      <title>path-4</title>
      <g id="Page-1" stroke="none" strokeWidth="1" fill="none" fillRule="evenodd">
          <g id="Path-2-Copy-3" transform="translate(0.5, 1.6704)" strokeWidth="3">
              <g id="path-4-link-dashes">
                  <path
                    d="M0,16 L4.5,16
                    C10.0228475,16 12.5,13.522847 12.5,8 C12.5,2.477152 14.9771525,0 20.5,0 L57.8783423,0"
                    className="path-to-a1 dashes"
                    transform="translate(28.9392, 8) scale(1, -1) translate(-28.9392, -8)">
                  </path>
              </g>
          </g>
      </g>
    </svg>
  </>
);

const iconMap: { [key: string]: JSX.Element } = {
  "signal": <SignalIcon/>,
  "sine": <SineIcon/>,
  "servo": <ServoIcon/>,
  "multiply": <MultiplyIcon/>,
  "add": <AddIcon/>,
  "divide": <DivideIcon/>,
};

const labelStringToIconKey: { [key: string]: string } = {
  "Number": "signal",
  "Multiply": "multiply",
  "Divide": "divide",
  "Servo": "servo",
  "Add": "add",
  "pin-reading": "signal"
};

export const getMiniNodeIcon = (str: string) => {
  return iconMap[str];
};

export function getIconKeyFromLabel(label: string) {
  return labelStringToIconKey[label];
}

export function getMiniNodeLabelContent(sharedNode: ISharedProgramNode): {truncatedLabel: string, iconKey: string} {
  const nodeTypeToLabel = {
    "Sensor": (node: ISharedProgramNode) => node.nodeState.sensorType,
    "Generator": (node: ISharedProgramNode) => node.nodeState.generatorType,
    "Number": (node: ISharedProgramNode) => "Number",
    "Math": (node: ISharedProgramNode) => node.nodeState.mathOperator,
    "Logic": (node: ISharedProgramNode) => node.nodeState.logicOperator,
    "Control": (node: ISharedProgramNode) => node.nodeState.controlOperator,
    "Transform": (node: ISharedProgramNode) => node.nodeState.transformOperator,
    "Demo Output": (node: ISharedProgramNode) => node.nodeState.outputType,
    "Live Output": (node: ISharedProgramNode) => node.nodeState.hubSelect.replace("Simulated ", ""),
    "Timer": (node: ISharedProgramNode) => "Timer",
  };

  const getLabelFunc = nodeTypeToLabel[sharedNode.nodeType as keyof typeof nodeTypeToLabel];
  const formattable = getLabelFunc ? getLabelFunc(sharedNode) : " ";
  const iconKey = getIconKeyFromLabel(formattable);
  const capitalSpaced = formattable.charAt(0).toUpperCase() + formattable.slice(1).replace(/-/g, " ");
  const truncatedLabel = capitalSpaced.length > 7 ? `${capitalSpaced.slice(0, 7)}...` : capitalSpaced;
  return { truncatedLabel, iconKey };
}

export function getMiniNodesDisplayData(programData?: SharedProgramDataType) {
  if (!programData ) return;
  const arr = [...programData.programNodes.values()];

  const formattedData = arr.map(node => {
    const { truncatedLabel, iconKey } = getMiniNodeLabelContent(node);
    const val = node.nodeValue;
    const valAsNum = Number.isInteger(val) ? val : val.toFixed(2);
    const valAsString = valAsNum.toString();

    return {
      id: node.id,
      iconKey,
      label: truncatedLabel,
      value: valAsString,
      type: node.nodeType.toLowerCase(),
      category: node.nodeCategory.toLowerCase() ?? "unknown"
    };
  });

  // split up formattedData into three arrays.  One for each category.
  // limit visible nodes to a max of 5 per category
  // count the total hidden nodes
  const inputNodes = formattedData.filter(node => node.category === "input");
  const operatorNodes = formattedData.filter(node => node.category === "operator");
  const outputNodes = formattedData.filter(node => node.category === "output");

  const extraCount =
    (inputNodes.length > 5 ? inputNodes.length - 5 : 0) +
    (operatorNodes.length > 5 ? operatorNodes.length - 5 : 0) +
    (outputNodes.length > 5 ? outputNodes.length - 5 : 0);

  const inputNodesArr = inputNodes.slice(0, 5);
  const operatorNodesArr = operatorNodes.slice(0, 5);
  const outputNodesArr = outputNodes.slice(0, 5);

  return { inputNodesArr, operatorNodesArr, outputNodesArr, extraCount };
}

