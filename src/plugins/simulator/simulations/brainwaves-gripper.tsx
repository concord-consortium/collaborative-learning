import React from "react";

import { arduinoFrames, armFrames, gripperFrames } from "./brainwaves-gripper-assets";
import { ISimulation, ISimulationProps } from "./simulation-types";
import { findVariable, getFrame } from "./simulation-utilities";
import { demoStreams } from "../../shared-assets/data/dataflow/demo-data";
import { iconUrl, kEMGKey, kGripperKey, kPressureKey } from "../../shared-assets/icons/icon-utilities";

import "./brainwaves-gripper.scss";

export const kBrainwavesKey = "EMG_and_claw";

function BrainwavesGripperComponent({ frame, variables }: ISimulationProps) {
  const emgVariable = findVariable(kEMGKey, variables);
  const normalizedEmgValue = Math.min((emgVariable?.value ?? 0) / 450, 1);
  const armFrame = getFrame(normalizedEmgValue, armFrames.length);

  const gripperVariable = findVariable(kGripperKey, variables);
  const normalizedGripperValue = (gripperVariable?.value ?? 0) / 100;
  const gripperFrame = getFrame(normalizedGripperValue, gripperFrames.length);
  return (
    <div className="bwg-component">
      <img
        src={ armFrames[armFrame] }
        className="arm-image"
      />
      <img
        src={ arduinoFrames[0] }
        className="arduino-image"
      />
      <img
        src={ gripperFrames[gripperFrame] }
        className="gripper-image"
      />
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
      icon: iconUrl(kEMGKey),
      id: kEMGKey,
      value: 0
    },
    {
      displayName: "Surface Pressure",
      labels: ["input", "sensor:fsr-reading", "className:long-name"],
      icon: iconUrl(kPressureKey),
      id: kPressureKey,
      value: 0,
      unit: "mPa"
    },
    {
      displayName: "Gripper",
      labels: ["output", "live-output:Grabber", "live-output:Gripper 2.0"],
      icon: iconUrl(kGripperKey),
      id: kGripperKey,
      value: 0
    }
  ],
  values: {
    [kEMGKey]: demoStreams.emgLongHold
  }
};
