import React, { useState } from "react";
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


export const kPotentiometerServoKey = "potentiometer_chip_servo";

const minPotAngle = 0;
const maxPotAngle = 270;
const minServoAngle = 0;
const maxServoAngle = 180;
const minResistReading = 0;
const maxResistReading = 1023;

const kPotAngleKey = "pot_angle_key";
const kResistReadingKey = "resist_reading_key";
const kServoAngleKey = "servo_angle_key";


function PotentiometerAndServoComponent({ frame, variables }: ISimulationProps) {
  const [collapsed, setMinimized] = useState(false);

  const potAngleVar = findVariable(kPotAngleKey, variables);
  const potAngleBaseValue = potAngleVar?.currentValue ?? 0;
  const visiblePotAngle = potAngleBaseValue - 135; // We use 0 - 270 degrees, but we want to render visible -135 - 135
  const potRotationString = `rotate(${visiblePotAngle ?? 0}deg)`;

  const servoAngleVar = findVariable(kServoAngleKey, variables);
  const servoAngleBaseValue = servoAngleVar?.currentValue ?? 0;
  const visibleServoAngle = servoAngleBaseValue - 90; // We use 0 - 180 degrees, but we want to render visible -90 - 90
  const servoRotationString = `rotate(${visibleServoAngle}deg)`;

  const potServoClasses = classNames('pot-servo-component', { collapsed, "expanded": !collapsed });

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
            alt="Board"
          />
          <div className="output wire"></div>
          <img
            className="servo-arm"
            src={servoArm}
            style={{ transform: servoRotationString }}
            alt="Potentiometer Dial"
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

  // set servo angle to value of servo angle variable
  const servoAngleVar = findVariable(kServoAngleKey, variables);
  const currentAngle = servoAngleVar?.currentValue || 0;
  const isValid = (currentAngle <= maxServoAngle) && (currentAngle >= minServoAngle);
  if (isValid) servoAngleVar?.setValue(currentAngle);
}

export const potentiometerAndServoSimulation: ISimulation = {
  component: PotentiometerAndServoComponent,
  delay: 67, // between steps
  step,
  variables: [
    {
      displayName: "Potentiometer",
      labels: ["input", "physical", "decimalPlaces:0"],
      icon: iconUrl(kPotentiometerKey),
      name: kPotAngleKey,
      value: minPotAngle,
      unit: "deg"
    },
    {
      displayName: "Resistance",
      labels: ["input", "reading", "decimalPlaces:0"],
      icon: iconUrl(kSignalKey),
      name: kResistReadingKey,
      value: minResistReading
    },
    {
      displayName: "Servo",
      labels: ["output", "physical", "decimalPlaces:0"],
      icon: iconUrl(kServoKey),
      name: kServoAngleKey,
      value: minServoAngle,
      unit: "deg"
    }
  ],
  values: {}
};
