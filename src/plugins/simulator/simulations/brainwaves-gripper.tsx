import classNames from "classnames";
import React from "react";

import { ISimulation, ISimulationProps } from "./simulation-types";
import { findVariable } from "./simulation-utilities";
import { demoStreams } from "../../dataflow/model/utilities/demo-data";

import "./brainwaves-gripper.scss";

export const kBrainwavesKey = "EMG_and_claw";
export const kEMGKey = "input_EMG";
export const kGripperKey = "output_Grabber";
export const kPressureKey = "input_Surface_Pressure";

function BrainwavesGripperComponent({ frame, variables }: ISimulationProps) {
  const gripperVariable = findVariable(kGripperKey, variables);
  const pressureVariable = findVariable(kPressureKey, variables);
  const pressure = pressureVariable?.value && pressureVariable.value >= 1000;
  const gripperScaler = (gripperVariable?.value ?? 0) / 100 * 0xFF;
  const backgroundColor = `rgb(${gripperScaler}, ${gripperScaler}, ${gripperScaler})`;
  const gripperClass = classNames("gripper", { pressure });
  const gripperStyle = { backgroundColor };

  const emgVariable = findVariable(kEMGKey, variables);
  const normalizedValue = Math.min((emgVariable?.value ?? 0) / 500, 1);
  const emgStyle = { left: `${150 * normalizedValue - 10}px` };
  return (
    <div className="bwg-component">
      <div className={gripperClass} style={gripperStyle} />
      <div className="emg-track">
        <div className="emg" style={emgStyle} />
      </div>
    </div>
  );
}

function step({ frame, variables }: ISimulationProps) {
  const gripperVariable = findVariable(kGripperKey, variables);
  const pressureVariable = findVariable(kPressureKey, variables);
  if (gripperVariable && pressureVariable) {
    const minPressureValue = 60;
    const gripperValue = gripperVariable.value;
    const pressureValue = gripperValue && gripperValue > minPressureValue
      ? (gripperValue - minPressureValue) * 100
      : 0;
    pressureVariable.setValue(pressureValue);
  }
}

export const brainwavesGripperSimulation: ISimulation = {
  component: BrainwavesGripperComponent,
  delay: 67,
  step,
  variables: [
    {
      displayName: "EMG",
      labels: ["input", "sensor:emg-reading"],
      name: kEMGKey,
      value: 0
    },
    {
      displayName: "Surface Pressure",
      labels: ["input", "sensor:fsr-reading"],
      name: kPressureKey,
      value: 0,
      unit: "mPa"
    },
    {
      displayName: "Gripper",
      labels: ["output", "live-output:Grabber"],
      name: kGripperKey,
      value: 0
    }
  ],
  values: {
    [kEMGKey]: demoStreams.emgLongHold
  }
};
