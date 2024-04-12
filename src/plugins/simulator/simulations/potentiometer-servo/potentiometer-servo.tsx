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
  switch (node.nodeType) {
    case "Sensor":
      return "S";
    case "Generator":
      return "G";
    case "Number":
      return "#";
    case "Math":
      return "M";
    case "Logic":
      return "L";
    case "Control":
      return "C";
    case "Transform":
      return "T";
    case "Demo Output":
      return "D";
    case "Live Output":
      return "O";
    case "Timer":
      return "T";
    default:
      return "?";
  }
}

function getMiniNodeLabelString(node: ISharedProgramNode): string {
  let label;

  switch (node.nodeType) {
    case "Sensor":
      label = node.nodeState.sensorType;
      break;
    case "Generator":
      label = node.nodeState.generatorType;
      break;
    case "Number":
      label = "Number";
      break;
    case "Math":
      label = node.nodeState.mathOperator;
      break;
    case "Logic":
      label = node.nodeState.logicOperator;
      break;
    case "Control":
      label = node.nodeState.controlOperator;
      break;
    case "Transform":
      label = node.nodeState.transformOperator;
      break;
    case "Demo Output":
      label = node.nodeState.outputType;
      break;
    case "Live Output":
      label = node.nodeState.hubSelect;
      break;
    case "Timer":
      label = "Timer";
      break;
    default:
      label = "?";
  }

  return label.toString();
}

function getMiniNodesDisplayData(programData?: SharedProgramDataType): IMiniNodeData[] {
  if (!programData ) return [];
  const arr = [...programData.programNodes.values()];

  return arr.map(node => {
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

  const miniNodesData = getMiniNodesDisplayData(programData);

  // console.log("\n\n| miniNodesData: \n");
  // miniNodesData.forEach(node => {
  //   console.log("|     ", node);
  // } );

  return (
    <div className={potServoClasses}>
      <div className="hardware">
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
          <div className="mini-nodes">
            {
              miniNodesData.map((miniNode, index) => (
                <div key={miniNode.id} className={miniNodeClasses(miniNode, index, miniNodesData.length)}>
                  <div className="info">
                    <div className="icon">

                    </div>
                    <div className="label">
                    [{miniNode.icon}] {miniNode.label}
                    </div>
                  </div>
                  <div className="value">
                    {miniNode.value}
                  </div>
                </div>
              ))
            }
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
