import React from "react";
import { ISimulation, ISimulationProps } from "../simulation-types";

import "./potentiometer-servo.scss";
import { iconUrl, kPotentiometerKey, kPressureKey, kServoKey } from "../../../shared-assets/icons/icon-utilities";
import { VariableSlider } from "@concord-consortium/diagram-view";
import { findVariable } from "../simulation-utilities";
import { boardImages, potentiometerImages, servoImages } from "./potentiometer-servo-assets";

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

  const potAngleVar = findVariable(kPotAngleKey, variables);
  const potAngleBaseValue = potAngleVar?.currentValue ?? 0;
  const visibleAngle = potAngleBaseValue - 135; // We use 0 - 270 degrees, but we want to display -135 - 135
  const rotationString = `rotate(${visibleAngle ?? 0}deg)`;

  return (
    <div className="potentiometer-servo-component">
      <div className="hardware">
        <div className="potentiometer-area">
          <img className="pot-base" src={potentiometerImages.baseExpanded} alt="Potentiometer" />
          <img
            className="pot-dial foo"
            src={potentiometerImages.dial}
            style={{ transform: rotationString }}
            alt="Potentiometer Dial"
          />
        </div>
        <div className="board-area">
          <img className="board" src={boardImages.backExpanded} alt="Board" />
        </div>
        <div className="servo-area">
          <img className="servo-base" src={servoImages.baseExpanded} alt="Servo" />
        </div>
      </div>
      <div className="controls">
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
        <div className="center-controls">
          <button className="expand-toggle">Expand</button>
        </div>
        <div className="right-controls">

        </div>
      </div>
    </div>
  );
}

function step({ frame, variables }: ISimulationProps) {
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
      displayName: "Potentiometer Position",
      labels: ["input", "decimalPlaces:0"],
      icon: iconUrl(kPotentiometerKey),
      name: kPotAngleKey,
      value: minPotAngle,
    },
    {
      displayName: "Resistance Reading",
      labels: ["input", "decimalPlaces:0"],
      icon: iconUrl(kPressureKey),
      name: kResistReadingKey,
      value: minResistReading,
    },
    {
      displayName: "Servo Angle",
      labels: ["output", "decimalPlaces:0"],
      icon: iconUrl(kServoKey),
      name: kServoAngleKey,
      value: minServoAngle,
    }
  ],
  values: {}
};
