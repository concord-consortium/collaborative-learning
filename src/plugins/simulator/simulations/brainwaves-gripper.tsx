import classNames from "classnames";
import React from "react";

import { ISimulation, ISimulationProps } from "./simulation-types";
import { demoStreams } from "../../dataflow/model/utilities/demo-data";

import "./brainwaves-gripper.scss";

export const kBrainwavesKey = "EMG_and_claw";
const kEMGKey = "input_EMG";

function BrainwavesGripperComponent({ frame, variables }: ISimulationProps) {
  const lightbulbVariable = variables.find(v => v.name === "output_LightBulb");
  const lightbulbClass = classNames("lightbulb", lightbulbVariable?.value === 1 ? "on" : "off");

  const emgVariable = variables.find(v => v.name === "input_EMG");
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

export const brainwavesGripperSimulation: ISimulation = {
  component: BrainwavesGripperComponent,
  delay: 17,
  variables: [
    {
      name: kEMGKey,
      value: 0
    },
    {
      name: "output_LightBulb",
      value: 0
    }
  ],
  values: {
    [kEMGKey]: demoStreams.emgLongHold
  }
};
