import React, { useRef } from "react";
import classNames from "classnames";
import { ISimulation, ISimulationProps } from "../simulation-types";
import { iconUrl, kPotentiometerKey, kServoKey, kSignalKey
} from "../../../shared-assets/icons/icon-utilities";
import { VariableSlider } from "@concord-consortium/diagram-view";
import { findVariable } from "../simulation-utilities";
import potDial from "./assets/pot-top.png";
import servoArm from "./assets/servo-arm.png";
import assemblyExpanded from "./assets/assembly-expanded.png";

import "./potentiometer-servo.scss";
import { ISharedProgramNode, SharedProgramDataType } from "../../../dataflow/model/shared-program-data";

export const kPotentiometerServoKey = "potentiometer_chip_servo";

interface IMiniNodeData {
  id: string;
  icon: string;
  label: string;
  value: string;
  type: string;
  category: string;
}

interface IMiniNodesDataPack {
  inputNodesArr: IMiniNodeData[];
  operatorNodesArr: IMiniNodeData[];
  outputNodesArr: IMiniNodeData[];
  extraCount: number;
}

const potVisibleOffset = 135;
const servoVisibleOffset = 90;
const minPotAngle = 0;
const maxPotAngle = 270;
const minServoAngle = 0;
const minResistReading = 0;
const maxResistReading = 675; // our wired assembly sends 3.3V to pot, so max reading is 675

const kPotAngleKey = "pot_angle_key";
const kResistReadingKey = "resist_reading_key";
const kServoAngleKey = "servo_angle_key";

function getTweenedServoAngle(realValue: number, lastVisibleValue: number) {
  const delta = realValue - lastVisibleValue;
  const steps = 5;
  const maxDelta = 40;
  if (Math.abs(delta) > maxDelta) {
    return (lastVisibleValue + Math.sign(delta) * steps);
  }
  return realValue;
}

function getMiniNodeIcon(node: ISharedProgramNode) {
  const nodeTypeToIcon = {
    "Sensor": " ",
    "Generator": " ",
    "Number": " ",
    "Math": " ",
    "Logic": " ",
    "Control": " ",
    "Transform": " ",
    "Demo Output": " ",
    "Live Output": " ",
    "Timer": " "
  };
  return (nodeTypeToIcon as Record<string, any>)[node.nodeType] || "?";
}

function getMiniNodeLabelString(sharedNode: ISharedProgramNode): string {
  const nodeTypeToLabel = {
    "Sensor": (node: ISharedProgramNode) => node.nodeState.sensorType,
    "Generator": (node: ISharedProgramNode) => node.nodeState.generatorType,
    "Number": (node: ISharedProgramNode) => "Number",
    "Math": (node: ISharedProgramNode) => node.nodeState.mathOperator,
    "Logic": (node: ISharedProgramNode) => node.nodeState.logicOperator,
    "Control": (node: ISharedProgramNode) => node.nodeState.controlOperator,
    "Transform": (node: ISharedProgramNode) => node.nodeState.transformOperator,
    "Demo Output": (node: ISharedProgramNode) => node.nodeState.outputType,
    "Live Output": (node: ISharedProgramNode) => node.nodeState.hubSelect,
    "Timer": (node: ISharedProgramNode) => "Timer",
  };

  const getLabelFunc = nodeTypeToLabel[sharedNode.nodeType as keyof typeof nodeTypeToLabel];
  const formattable = getLabelFunc ? getLabelFunc(sharedNode) : "?";
  const capitalSpaced = formattable.charAt(0).toUpperCase() + formattable.slice(1).replace(/-/g, " ");
  const truncated = capitalSpaced.length > 7 ? `${capitalSpaced.slice(0, 7)}...` : capitalSpaced;
  return truncated;
}

function getMiniNodesDisplayData(programData?: SharedProgramDataType) {
  if (!programData ) return;
  const arr = [...programData.programNodes.values()];

  const formattedData = arr.map(node => {
    const val = node.nodeValue;
    const formattedNum = Number.isInteger(val) ? val : val.toFixed(2);
    const asString = formattedNum.toString();
    return {
      id: node.id,
      icon: getMiniNodeIcon(node),
      label: getMiniNodeLabelString(node) as string,
      value: asString,
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

const miniNodeClasses = (node: IMiniNodeData, index:number, length:number) => {
  return classNames(
    'mini-node',
    { 'first': index === 0 },
    { 'last': index === length - 1 },
    `category-${node.category}`,
    `type-${node.type}`
  );
};

function PotentiometerAndServoComponent({ frame, variables, programData }: ISimulationProps) {
  const tweenedServoAngle = useRef(0);
  const lastTweenedAngle = tweenedServoAngle.current;

  const potAngleVar = findVariable(kPotAngleKey, variables);
  const potAngleBaseValue = potAngleVar?.currentValue ?? 0;
  const visiblePotAngle = potAngleBaseValue - potVisibleOffset;
  const potRotationString = `rotate(${visiblePotAngle ?? 0}deg)`;

  const servoAngleVar = findVariable(kServoAngleKey, variables);
  const servoAngleBaseValue = servoAngleVar?.currentValue ?? 0;
  tweenedServoAngle.current = getTweenedServoAngle(servoAngleBaseValue, lastTweenedAngle);
  const valueForRotation = 180 - (tweenedServoAngle.current - servoVisibleOffset);
  const servoRotationString = `rotate(${valueForRotation}deg)`;

  const potServoClasses = classNames('pot-servo-component');
  const boardClasses = classNames('board');

  const miniNodesDataPack = getMiniNodesDisplayData(programData) as IMiniNodesDataPack;
  const { inputNodesArr, operatorNodesArr, outputNodesArr, extraCount } = miniNodesDataPack;

  return (
    <div className={potServoClasses}>
      <div className="hardware">
          <div className="heading-area">
            <div className="sample-rate">100ms</div>
            <div className="arduino-label">Microprocessor</div>
            { extraCount > 0 && (
              <div className="hidden-nodes-count">+{extraCount} more</div>
            )}
          </div>
          <img
            className="pot-dial"
            src={potDial}
            style={{ transform: potRotationString }}
            alt="Potentiometer Dial"
          />
          <div className="input wire"></div>
          <img
            src={assemblyExpanded}
            className={boardClasses}
            alt="Board"
          />

          <div className={"mini-nodes-column-wrapper"}>
            <div className="mini-nodes-col inputs">
              {
                inputNodesArr.map((miniNode, index) => (
                  <div key={miniNode.id} className={miniNodeClasses(miniNode, index, inputNodesArr.length)}>
                    <div className="node-info">
                      <div className="node-icon">{miniNode.icon}</div>
                      <div className="node-label">{miniNode.label}</div>
                    </div>
                    <div className="node-value">
                      {miniNode.value}
                    </div>
                  </div>
                ))
              }
              <div className="category-label">Inputs</div>
            </div>

            <div className="mini-nodes-col operators">
              {
                operatorNodesArr.map((miniNode, index) => (
                  <div key={miniNode.id} className={miniNodeClasses(miniNode, index, operatorNodesArr.length)}>
                    <div className="node-info">
                      <div className="node-icon">{miniNode.icon}</div>
                      <div className="node-label">{miniNode.label}</div>
                    </div>
                    <div className="node-value">
                      {miniNode.value}
                    </div>
                  </div>
                ))
              }
              <div className="category-label">Operators</div>
            </div>

            <div className="mini-nodes-col outputs">
              {
                outputNodesArr.map((miniNode, index) => (
                  <div key={miniNode.id} className={miniNodeClasses(miniNode, index, outputNodesArr.length)}>
                    <div className="node-info">
                      <div className="node-icon">{miniNode.icon}</div>
                      <div className="node-label">{miniNode.label}</div>
                    </div>
                    <div className="node-value">
                      {miniNode.value}
                    </div>
                  </div>
                ))
              }
              <div className="category-label">Outputs</div>
            </div>
          </div>

          <div className="output wire"></div>
          <img
            className="servo-arm"
            src={servoArm}
            style={{ transform: servoRotationString }}
            alt="Servo Arm"
          />
      </div>
      <div className="controls">
        <div className="slider area">
          <div className="slider-wrapper">
            <VariableSlider
              className="pot-slider"
              max={maxPotAngle}
              min={minPotAngle}
              step={5}
              variable={potAngleVar}
            />
            <div className="slider-labels">
              <div className="low">low</div>
              <div className="high">high</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function step({ frame, variables }: ISimulationProps) {
  // calculate resistance based on potentiometer angle
  const potAngleVar = findVariable(kPotAngleKey, variables);
  const potAngle = potAngleVar?.currentValue || 0;
  const resistance = Math.round((potAngle / maxPotAngle) * maxResistReading);
  const resistanceVar = findVariable(kResistReadingKey, variables);
  resistanceVar?.setValue(resistance);
}

export const potentiometerAndServoSimulation: ISimulation = {
  component: PotentiometerAndServoComponent,
  delay: 67, // between steps
  step,
  variables: [
    {
      displayName: "Potentiometer",
      labels: ["input", "position", "decimalPlaces:0"],
      icon: iconUrl(kPotentiometerKey),
      name: kPotAngleKey,
      value: minPotAngle,
      unit: "deg"
    },
    {
      displayName: "Pin",
      labels: ["input", "reading", "sensor:pin-reading", "decimalPlaces:0"],
      icon: iconUrl(kSignalKey),
      name: kResistReadingKey,
      value: minResistReading
    },
    {
      displayName: "Servo",
      labels: ["output", "position", "live-output:Servo", "decimalPlaces:0"],
      icon: iconUrl(kServoKey),
      name: kServoAngleKey,
      value: minServoAngle,
      unit: "deg"
    }
  ],
  values: {}
};
