import React, { useRef, useState } from "react";
import classNames from "classnames";
import { ISimulation, ISimulationProps } from "../simulation-types";
import { iconUrl, kPotentiometerKey, kServoKey, kSignalKey
} from "../../../shared-assets/icons/icon-utilities";
import { VariableSlider } from "@concord-consortium/diagram-view";
import { findVariable } from "../simulation-utilities";
import potDial from "./assets/pot-top.png";
import servoArm from "./assets/servo-arm.png";
import assemblyExpanded from "./assets/assembly-expanded.png";
import assemblyCollapsed from "./assets/assembly-collapsed.png";
import ExpandIcon from "./assets/expand-arduino.svg";
import MinimizeIcon from "./assets/minimize-arduino.svg";

import "./potentiometer-servo.scss";
import { SharedDataSetType } from "../../../../models/shared/shared-data-set";

export const kPotentiometerServoKey = "potentiometer_chip_servo";

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

function PotentiometerAndServoComponent({ frame, variables, dataSet }: ISimulationProps) {
  const [collapsed, setMinimized] = useState(false);
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

  const potServoClasses = classNames('pot-servo-component', { collapsed, "expanded": !collapsed });
  const boardClasses = classNames('board', { collapsed, "expanded": !collapsed });

  function getNodeValue(nodeRep: string[]) {
    console.log("| getNodeValue from nodeRep", nodeRep, dataSet);
    return 42;
  }

  function getMiniNodesData(ds: SharedDataSetType) {
    const encodedNodes = Object.keys(ds.dataSet.attrNameMap).filter(key => key !== "Time (sec)");

    const nodesAsArraysOfStringifiedKV = encodedNodes.map(node => node.split("&"));

    const theData = nodesAsArraysOfStringifiedKV.map(nodeRep => {
      const name = nodeRep[0];
      const value = getNodeValue(nodeRep);
      const metaValue = nodeRep[nodeRep.length - 1].split("=")[1];

      return { name, metaValue, value };
    });

    return theData;
  }

  const miniNodesData = dataSet ? getMiniNodesData(dataSet) : [];

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
            src={collapsed ? assemblyCollapsed : assemblyExpanded}
            className={boardClasses}
            alt="Board"
          />
          <div className="mini-nodes">
            {
              miniNodesData.map((node, index) => (
                <div key={index} className="mini-node">
                  <div className="node-name">{node.name}:  {node.metaValue}</div>
                  <div className="node-value">{node.value}</div>
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
        <div className="size-toggle area">
          <button
            className="expand-toggle"
            onClick={() => setMinimized(!collapsed)}
          >
            { collapsed
              ? <div>
                  <ExpandIcon />
                  <span>Expand</span>
                </div>
              : <div>
                  <MinimizeIcon />
                  <span>Minimize</span>
                </div>
            }
          </button>
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
