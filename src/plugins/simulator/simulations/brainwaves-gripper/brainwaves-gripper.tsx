import { VariableSlider } from "@concord-consortium/diagram-view";
import React from "react";

import ToggleControl from "../../../../components/utilities/toggle-control";
import { iconUrl, kEMGKey, kGripperKey, kPressureKey, kTemperatureKey } from "../../../shared-assets/icons/icon-utilities";
import { ISimulation, ISimulationProps } from "../simulation-types";
import { findVariable, getFrame } from "../simulation-utilities";
import { arduinoFrames, armFrames, gripperFrames } from "./brainwaves-gripper-assets";

import "rc-slider/assets/index.css";
import "./brainwaves-gripper.scss";

export const kBrainwavesKey = "EMG_and_claw";

const kSimulationModeKey = "simulation_mode_key";
const kSimulationModePressure = 0;
const kSimulationModeTemperature = 1;
const baseTemperature = 60;

function BrainwavesGripperComponent({ frame, variables }: ISimulationProps) {
  const modeVariable = findVariable(kSimulationModeKey, variables);
  const emgVariable = findVariable(kEMGKey, variables);
  const normalizedEmgValue = Math.min((emgVariable?.currentValue ?? 0) / 450, 1);
  const armFrame = getFrame(normalizedEmgValue, armFrames.length);

  const gripperVariable = findVariable(kGripperKey, variables);
  const normalizedGripperValue = (gripperVariable?.currentValue ?? 0) / 100;
  const gripperFrame = getFrame(normalizedGripperValue, gripperFrames.length);
  return (
    <div className="bwg-component">
      <div className="animation">
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
      <div className="controls">
        <VariableSlider
          className="emg-slider"
          max={440}
          min={40}
          step={40}
          variable={emgVariable}
        />
        <div className="toggle-container">
          <div>Pressure</div>
          <ToggleControl
            className="mode-toggle"
            initialValue={!!modeVariable?.currentValue}
            onChange={(value: boolean) => modeVariable?.setValue(value ? kSimulationModeTemperature : kSimulationModePressure)}
          />
          <div>Temperature</div>
        </div>
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
      icon: iconUrl(kEMGKey),
      name: kEMGKey,
      value: 40
    },
    {
      displayName: "Surface Pressure",
      labels: ["input", "sensor:fsr-reading", "className:long-name"],
      icon: iconUrl(kPressureKey),
      name: kPressureKey,
      value: 0,
      unit: "mPa"
    },
    {
      displayName: "Gripper",
      labels: ["output", "live-output:Grabber", "live-output:Gripper 2.0"],
      icon: iconUrl(kGripperKey),
      name: kGripperKey,
      value: 0
    },
    {
      displayName: "Temperature",
      labels: ["input", "sensor:temperature"],
      icon: iconUrl(kTemperatureKey),
      name: kTemperatureKey,
      value: baseTemperature
    },
    {
      displayName: "Simulation Mode",
      name: kSimulationModeKey,
      value: kSimulationModePressure
    }
  ],
  values: {}
};
