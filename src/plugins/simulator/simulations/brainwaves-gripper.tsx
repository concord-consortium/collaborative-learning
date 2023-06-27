import classNames from "classnames";
import React from "react";

import { ISimulation, ISimulationProps } from "./simulation-types";
import { findVariable } from "./simulation-utilities";
import { demoStreams } from "../../dataflow/model/utilities/demo-data";

import "./brainwaves-gripper.scss";

export const kBrainwavesKey = "EMG_and_claw";
const kEMGKey = "input_EMG";
export const kPressureKey = "input_Surface_Pressure";
const kLightBulbKey = "output_LightBulb";

function BrainwavesGripperComponent({ frame, variables }: ISimulationProps) {
  const lightbulbVariable = variables.find(v => v.name === kLightBulbKey);
  const lightbulbClass = classNames("lightbulb", lightbulbVariable?.value === 1 ? "on" : "off");

  const emgVariable = variables.find(v => v.name === kEMGKey);
  const normalizedValue = Math.min((emgVariable?.value ?? 0) / 500, 1);
  const emgStyle = { left: `${150 * normalizedValue - 10}px` };
  return (
    <div className="bwg-component">
      <div className={lightbulbClass} />
      <div className="emg-track">
        <div className="emg" style={emgStyle} />
      </div>
    </div>
  );
}

function step({ frame, variables }: ISimulationProps) {
  const lightBulbVariable = findVariable(kLightBulbKey, variables);
  const pressureVariable = findVariable(kPressureKey, variables);
  if (lightBulbVariable && pressureVariable) {
    pressureVariable.setValue(lightBulbVariable.value);
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
      name: kLightBulbKey,
      value: 0
    }
  ],
  values: {
    [kEMGKey]: demoStreams.emgLongHold
  }
};
