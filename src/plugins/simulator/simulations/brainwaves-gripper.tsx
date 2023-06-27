import React from "react";

import { ISimulation, ISimulationProps } from "./simulation-types";
import { findVariable } from "./simulation-utilities";
import { demoStreams } from "../../dataflow/model/utilities/demo-data";

import "./brainwaves-gripper.scss";

export const kBrainwavesKey = "EMG_and_claw";
const kEMGKey = "input_EMG";
const kGripperKey = "output_Grabber";
export const kPressureKey = "input_Surface_Pressure";

function BrainwavesGripperComponent({ frame, variables }: ISimulationProps) {
  const gripperVariable = findVariable(kGripperKey, variables);
  const gripperScaler = (gripperVariable?.value ?? 0) / 100 * 0xFF;
  const backgroundColor = `rgb(${gripperScaler}, ${gripperScaler}, ${gripperScaler})`;
  const gripperStyle = { backgroundColor };

  const emgVariable = findVariable(kEMGKey, variables);
  const normalizedValue = Math.min((emgVariable?.value ?? 0) / 500, 1);
  const emgStyle = { left: `${150 * normalizedValue - 10}px` };
  return (
    <div className="bwg-component">
      <div className="gripper" style={gripperStyle} />
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
    pressureVariable.setValue(gripperVariable.value);
  }
}

export const brainwavesGripperSimulation: ISimulation = {
  component: BrainwavesGripperComponent,
  delay: 17,
  step,
  variables: [
    {
      name: kEMGKey,
      value: 0
    },
    {
      name: kPressureKey,
      value: 0
    },
    {
      name: kGripperKey,
      value: 0
    }
  ],
  values: {
    [kEMGKey]: demoStreams.emgLongHold
  }
};
