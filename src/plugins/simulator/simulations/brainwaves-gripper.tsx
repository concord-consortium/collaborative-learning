import classNames from "classnames";
import React from "react";

import { ISimulation, ISimulationProps } from "./simulation-types";

import "./brainwaves-gripper.scss";

export const kBrainwavesKey = "EMG_and_claw";
const kEMGKey = "input_EMG";

function BrainwavesGripperComponent({ frame, variables }: ISimulationProps) {
  const lightbulbVariable = variables.find(v => v.name === "output_LightBulb");
  const lightbulbClass = classNames("lightbulb", lightbulbVariable?.value === 1 ? "on" : "off");

  const emgVariable = variables.find(v => v.name === "input_EMG");
  const emgStyle = { left: `${65 + 75 * (emgVariable?.value || 0)}px` };
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
  delay: 200,
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
    [kEMGKey]: [
      0, 0.3090169943749474, 0.5877852522924731, 0.8090169943749475, 0.9510565162951535,
      1, 0.9510565162951536, 0.8090169943749475, 0.5877852522924732, 0.3090169943749475,
      1.2246467991473532e-16, -0.30901699437494773, -0.587785252292473, -0.8090169943749473,
      -0.9510565162951535, -1, -0.9510565162951536, -0.8090169943749476, -0.5877852522924734,
      -0.3090169943749477, -2.4492935982947064e-16
    ]
  }
};
