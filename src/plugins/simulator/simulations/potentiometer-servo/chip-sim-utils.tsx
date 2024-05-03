import React from 'react';
import { ISharedProgramNode, SharedProgramDataType } from '../../../shared-program-data/shared-program-data';

import SineIcon from "../../../shared-assets/icons/dataflow/generator/sine.svg";
import SquareIcon from "../../../shared-assets/icons/dataflow/generator/square.svg";
import TriangleIcon from "../../../shared-assets/icons/dataflow/generator/triangle.svg";

import AndIcon from "../../../shared-assets/icons/dataflow/logic/and.svg";
import EqualIcon from "../../../shared-assets/icons/dataflow/logic/equal.svg";
import GreaterThanOrEqualToIcon from "../../../shared-assets/icons/dataflow/logic/greater-than-or-equal-to.svg";
import GreaterThanIcon from "../../../shared-assets/icons/dataflow/logic/greater-than.svg";
import LessThanOrEqualToIcon from "../../../shared-assets/icons/dataflow/logic/less-than-or-equal-to.svg";
import LessThanIcon from "../../../shared-assets/icons/dataflow/logic/less-than.svg";
import NandIcon from "../../../shared-assets/icons/dataflow/logic/nand.svg";
import NotEqualIcon from "../../../shared-assets/icons/dataflow/logic/not-equal.svg";
import OrIcon from "../../../shared-assets/icons/dataflow/logic/or.svg";
import XorIcon from "../../../shared-assets/icons/dataflow/logic/xor.svg";

import AddIcon from "../../../shared-assets/icons/dataflow/math/add.svg";
import SubtractIcon from "../../../shared-assets/icons/dataflow/math/subtract.svg";
import MultiplyIcon from "../../../shared-assets/icons/dataflow/math/multiply.svg";
import DivideIcon from "../../../shared-assets/icons/dataflow/math/divide.svg";

import LightBulbIcon from "../../../shared-assets/icons/dataflow/output/light-bulb.svg";
import GrabberIcon from "../../../shared-assets/icons/dataflow/output/grabber.svg";
import HumidIcon from "../../../shared-assets/icons/dataflow/output/humid.svg";
import FanIcon from "../../../shared-assets/icons/dataflow/output/fan.svg";

import TemperatureIcon from "../../../shared-assets/icons/dataflow/sensor/temperature.svg";
import CO2Icon from "../../../shared-assets/icons/dataflow/sensor/co2.svg";
import HumidityIcon from "../../../shared-assets/icons/dataflow/sensor/humidity.svg";
import SignalIcon from "../../../shared-assets/icons/dataflow/control/signal.svg";
import EMGIcon from "../../../shared-assets/icons/dataflow/sensor/sensor-emg-icon.svg";
import PressureIcon from "../../../shared-assets/icons/dataflow/sensor/pressure.svg";
import ServoIcon from "../../../shared-assets/icons/dataflow/output/servo.svg";

import AbsoluteValueIcon from "../../../shared-assets/icons/dataflow/transform/absolute-value.svg";
import NegationIcon from "../../../shared-assets/icons/dataflow/transform/negation.svg";
import NotIcon from "../../../shared-assets/icons/dataflow/transform/not.svg";

import TimerIcon from "../potentiometer-servo/assets/stopwatch.svg";
import { IOffsetModel } from '../../../../models/annotations/clue-object';

const kBoardImageLeftEdge = 132;
const kBoardImageRightEdge = 407;
const kBoardImageTopEdge = 54;
const kBoardImagePinSpacing = 16;
const kBoardImageLabelWidth = 40;

export function getTweenedServoAngle(realValue: number, lastVisibleValue: number) {
  const delta = realValue - lastVisibleValue;
  const steps = 5;
  const maxDelta = 40;
  if (Math.abs(delta) > maxDelta) {
    return (lastVisibleValue + Math.sign(delta) * steps);
  }
  return realValue;
}

export interface IMiniNodeData {
  id: string;
  iconKey: string;
  label: string;
  value: string;
  type: string;
  category: string;
}
export interface IMiniNodesDataPack {
  inputNodesArr: IMiniNodeData[];
  operatorNodesArr: IMiniNodeData[];
  outputNodesArr: IMiniNodeData[];
  extraCount: number;
}

// this is an svg path that represents a wire connecting a potentiometer to the A1 pin
// the "shases" version is a dashed line that animates when the wire is active
// in the future, if a user can connect a potentiometer to a different pin, we would specifiy additional wires
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
  "timer": <TimerIcon/>,
  "sine": <SineIcon/>,
  "square": <SquareIcon/>,
  "triangle": <TriangleIcon/>,
  "add": <AddIcon/>,
  "subtract": <SubtractIcon/>,
  "multiply": <MultiplyIcon/>,
  "divide": <DivideIcon/>,
  "servo": <ServoIcon/>,
  "emg": <EMGIcon/>,
  "pressure": <PressureIcon/>,
  "temperature": <TemperatureIcon/>,
  "co2": <CO2Icon/>,
  "humidity": <HumidityIcon/>,
  "light-bulb": <LightBulbIcon/>,
  "gripper": <GrabberIcon/>,
  "fan": <FanIcon/>,
  "humidifier": <HumidIcon/>,
  "greater-than": <GreaterThanIcon/>,
  "less-than": <LessThanIcon/>,
  "greater-than-or-equal-to": <GreaterThanOrEqualToIcon/>,
  "less-than-or-equal-to": <LessThanOrEqualToIcon/>,
  "equal": <EqualIcon/>,
  "not-equal": <NotEqualIcon/>,
  "and": <AndIcon/>,
  "or": <OrIcon/>,
  "nand": <NandIcon/>,
  "xor": <XorIcon/>,
  "absolute-value": <AbsoluteValueIcon/>,
  "negation": <NegationIcon/>,
  "not": <NotIcon/>,
};

const labelStringToIconKey: { [key: string]: string } = {
  "Number": "signal",
  "Timer": "timer",
  "Sine": "sine",
  "Square": "square",
  "Triangle": "triangle",
  "Add": "add",
  "Subtract": "subtract",
  "Multiply": "multiply",
  "Divide": "divide",
  "Servo": "servo",
  "Physical Servo": "servo",
  "pin-reading": "signal",
  "emg-reading": "emg",
  "fsr-reading": "pressure",
  "temperature": "temperature",
  "CO2": "co2",
  "humidity": "humidity",
  "Hold Current": "signal",
  "Hold Prior": "signal",
  "Output Zero": "signal",
  "Light Bulb": "light-bulb",
  "Grabber": "gripper",
  "Physical Gripper": "gripper",
  "Advanced Grabber": "gripper",
  "Fan": "fan",
  "Humidifier": "humidifier",
  "Greater Than": "greater-than",
  "Less Than": "less-than",
  "Greater Than or Equal To": "greater-than-or-equal-to",
  "Less Than or Equal To": "less-than-or-equal-to",
  "Equal": "equal",
  "Not Equal": "not-equal",
  "And": "and",
  "Or": "or",
  "Nand": "nand",
  "Xor": "xor",
  "Absolute Value": "absolute-value",
  "Negation": "negation",
  "Not": "not",
  "Round": "signal",
  "Floor": "signal",
  "Ceiling": "signal",
  "Ramp": "signal"
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

export function getMiniNodesDisplayData(programData?: SharedProgramDataType): IMiniNodesDataPack {
  if (!programData ) {
    return {
      inputNodesArr: [],
      operatorNodesArr: [],
      outputNodesArr: [],
      extraCount: 0
    };
  }
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

export function getNodeBoundingBox (objectId: string, tileElt: HTMLElement) {
  // Find the HTML object representing this node
  const elt = tileElt.querySelector(`.node-${objectId}`);
  // console.log('tileElt', tileElt, 'elt:', elt, 'rect:', elt?.getBoundingClientRect());
  const tileRect = tileElt.getBoundingClientRect();
  const nodeRect = elt?.getBoundingClientRect();
  if (tileRect && nodeRect) {
    return {
      left: nodeRect.left-tileRect.left,
      top: nodeRect.top-tileRect.top,
      width: nodeRect.width,
      height: nodeRect.height
    };
  } else {
    return undefined;
  }
}

export function getPinBoundingBox(objectId: string, tileElt: HTMLElement) {
  // Find the position of the image with the pins on it
  const elt = tileElt.querySelector(`.board`);
  const tileRect = tileElt.getBoundingClientRect();
  const imgRect = elt?.getBoundingClientRect();

  if (tileRect && imgRect) {
    const side = objectId.substring(0, 1);  // L or R
    const pinNumber = Number(objectId.substring(1));
    return {
      left: side === 'L'
        ? imgRect.left - tileRect.left + kBoardImageLeftEdge
        : imgRect.left - tileRect.left + kBoardImageRightEdge - kBoardImageLabelWidth,
      top: imgRect.top - tileRect.top + kBoardImageTopEdge + pinNumber*kBoardImagePinSpacing,
      width: kBoardImageLabelWidth,
      height: kBoardImagePinSpacing-2
    };
  } else {
    return undefined;
  }
}

export function setPinOffsets(objectId: string, offsets: IOffsetModel) {
  const side = objectId.substring(0, 1);
  offsets.setDx(side === "L" ? -kBoardImageLabelWidth/2 : kBoardImageLabelWidth/2);
  return offsets;
}
