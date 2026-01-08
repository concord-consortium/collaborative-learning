import { VariableSlider } from "@concord-consortium/diagram-view";
import React from "react";

import { demoStreams } from "../../../../../shared/assets/data/dataflow/demo-data";
import {
  brainwavesGripperData, kEMGKey, kGripperKey, kPressureKey
} from "../../../../../shared/simulations/brainwaves-gripper/brainwaves-gripper";
import { kTemperatureKey } from "../../../../../shared/simulations/shared/const";
import { iconUrl } from "../../../shared-assets/icons/icon-utilities";
import { SelectionButton } from "../../components/ui/selection-button";
import { ISimulation, ISimulationProps } from "../simulation-types";
import { findVariable, getFrame } from "../simulation-utilities";
import {
  arduinoFrames, armFrames, gripperFrames, panFrames, steamFrames, temperatureGripperFrames
} from "./brainwaves-gripper-assets";

// We shouldn't need to import the rc-slider css, but for some reason we do.
import "rc-slider/assets/index.css";
import "./brainwaves-gripper.scss";

export const kBrainwavesKey = "EMG_and_claw";

const maxPressure = brainwavesGripperData.values.maxPressure.value;
const maxGripperValue = brainwavesGripperData.values.maxGripperValue.value;

const minGripperCupValue = brainwavesGripperData.values.minGripperCupValue.value;
const gripperCupRange = maxGripperValue - minGripperCupValue;

const kPanTemperatureKey = brainwavesGripperData.values.kPanTemperatureKey.value;
const kSimulationModeKey = brainwavesGripperData.values.kSimulationModeKey.value;
const kTargetEMGKey = brainwavesGripperData.values.kTargetEMGKey.value;
const emgDropFactor = brainwavesGripperData.values.emgDropFactor.value;

const kSimulationModePressure = brainwavesGripperData.values.kSimulationModePressure.value;
const kSimulationModeTemperature = brainwavesGripperData.values.kSimulationModeTemperature.value;
const baseTemperature = brainwavesGripperData.values.baseTemperature.value;
const maxTemperature = brainwavesGripperData.values.maxTemperature.value;
const minGripperPanValue = brainwavesGripperData.values.minGripperPanValue.value;
const gripperPanRange = maxGripperValue - minGripperPanValue;

interface IAnimationProps extends ISimulationProps {
  mode: number;
}
function BrainwavesGripperAnimation({ frame, mode, variables }: IAnimationProps) {
  const targetEMGVariable = findVariable(kTargetEMGKey, variables);
  const normalizedEmgValue = Math.min((targetEMGVariable?.currentValue ?? 0) / 450, 1);
  const armFrame = getFrame(normalizedEmgValue, armFrames.length);

  const gripperVariable = findVariable(kGripperKey, variables);
  const normalizedGripperValue = (gripperVariable?.currentValue ?? 0) / 100;
  const gripperFrame = getFrame(normalizedGripperValue, gripperFrames.length);

  const rawTemperatureVariable = findVariable(kPanTemperatureKey, variables);
  const rawTemperature = rawTemperatureVariable?.currentValue;
  const normalizedRawTemperatureValue = ((rawTemperature ?? baseTemperature) - baseTemperature)
    / (maxTemperature - baseTemperature);
  const panFrame = getFrame(normalizedRawTemperatureValue, panFrames.length);

  const firstSteamFrame = demoStreams.fastBoil.length - 5 * steamFrames.length;
  const currentTempFrame = frame % demoStreams.fastBoil.length;
  const steamFrame = currentTempFrame >= firstSteamFrame
    ? (currentTempFrame - firstSteamFrame) % steamFrames.length : -1;
  return (
    <div className="animation">
      <img
        src={ armFrames[armFrame] }
        className="animation-image arm-image"
      />
      <img
        src={ arduinoFrames[0] }
        className="animation-image arduino-image"
      />
      { mode === kSimulationModePressure
        ? (
          <img
            src={ gripperFrames[gripperFrame] }
            className="animation-image gripper-image"
          />
        ) : (
          <div className="temperature-part">
            <img
              src={ panFrames[panFrame] }
              className="animation-image"
            />
            <img
              src={ temperatureGripperFrames[gripperFrame] }
              className="animation-image"
            />
            { steamFrame >= 0 && (
              <img
                src={ steamFrames[steamFrame] }
                className="animation-image steam-image"
              />
            )}
          </div>
        )
      }
    </div>
  );
}

function BrainwavesGripperComponent({ frame, variables }: ISimulationProps) {
  const modeVariable = findVariable(kSimulationModeKey, variables);
  const targetEMGVariable = findVariable(kTargetEMGKey, variables);

  return (
    <div className="bwg-component">
      <BrainwavesGripperAnimation
        frame={frame}
        mode={modeVariable?.currentValue ?? 0}
        variables={variables}
      />
      <div className="controls">
        <div className="slider-wrapper">
          <VariableSlider
            className="emg-slider"
            max={440}
            min={40}
            step={40}
            variable={targetEMGVariable}
          />
          <div className="slider-labels">
            <div className="open">relaxed</div>
            <div className="closed">flexed</div>
          </div>
        </div>
        <div className="mode-selection-container">
          <SelectionButton
            onClick={() => modeVariable?.setValue(kSimulationModePressure)}
            position="left"
            selected={modeVariable?.currentValue === kSimulationModePressure}
          >
            Pressure
          </SelectionButton>
          <SelectionButton
            onClick={() => modeVariable?.setValue(kSimulationModeTemperature)}
            position="right"
            selected={modeVariable?.currentValue === kSimulationModeTemperature}
          >
            Temperature
          </SelectionButton>
        </div>
      </div>
    </div>
  );
}

function step({ frame, variables }: ISimulationProps) {
  // Set the adjustedEMGValue based on the targetEMGValue minus a random offset
  const targetEMGVariable = findVariable(kTargetEMGKey, variables);
  const EMGVariable = findVariable(kEMGKey, variables);
  if (targetEMGVariable && EMGVariable) {
    const targetEMGValue = targetEMGVariable.currentValue;
    if (targetEMGValue !== undefined){
      const adjustedEMGValue = Math.round(targetEMGValue - Math.random() * emgDropFactor * targetEMGValue);
      EMGVariable.setValue(adjustedEMGValue);
    }
  }

  const modeVariable = findVariable(kSimulationModeKey, variables);
  const gripperVariable = findVariable(kGripperKey, variables);
  const pressureVariable = findVariable(kPressureKey, variables);
  if (gripperVariable && pressureVariable) {
    // Update the pressure
    const gripperValue = gripperVariable.value;
    const getPressureValue = () => {
      if (!gripperValue) return 0;
      if (modeVariable?.currentValue === kSimulationModeTemperature) {
        // Use the pan to determine pressure for the temperature simulation
        return gripperValue > minGripperPanValue
          // If the gripper is closed enough to feel the pan, set its pressure to between 0 and maxPressure
          ? Math.round((gripperValue - minGripperPanValue) / gripperPanRange * maxPressure)
          // Otherwise it should be 0
          : 0;
      } else {
        // Otherwise use the cup to determine pressure
        return gripperValue > minGripperCupValue
          // If the gripper is closed enough to feel the cup, set its pressure to between 0 and maxPressure
          ? Math.round((gripperValue - minGripperCupValue) / gripperCupRange * maxPressure)
          // Otherwise it should be 0
          : 0;
      }
    };
    pressureVariable.setValue(getPressureValue());

    // Update the temperature
    const panTemperatureVariable = findVariable(kPanTemperatureKey, variables);
    const temperatureVariable = findVariable(kTemperatureKey, variables); // sensor temperature
    const gripperFeeling = gripperValue && gripperValue > minGripperPanValue;
    if (modeVariable?.currentValue === kSimulationModeTemperature && gripperFeeling
      && panTemperatureVariable && temperatureVariable) {
      // The gripper can feel the pan's temperature if it's the temperature simulation and the gripper is closed enough
      temperatureVariable.setValue(panTemperatureVariable.currentValue);
    } else {
      // Otherwise the gripper feels the ambient temperature
      temperatureVariable?.setValue(baseTemperature);
    }
  }
}

export const brainwavesGripperSimulation: ISimulation = {
  component: BrainwavesGripperComponent,
  delay: 67,
  step,
  variables: [
    {
      // This is the EMG set by the slider
      displayName: "Target EMG",
      name: kTargetEMGKey,
      value: 40
    },
    {
      // This is the target EMG minus a random amount on every frame to simulate imperfect EMG data
      displayName: "EMG",
      labels: ["input", "sensor:emg-reading", "decimalPlaces:0"],
      icon: iconUrl(kEMGKey),
      name: kEMGKey,
      value: 40,
      unit: "mV"
    },
    {
      displayName: "Surface Pressure",
      labels: ["input", "sensor:fsr-reading", "className:long-name", "decimalPlaces:0"],
      icon: iconUrl(kPressureKey),
      name: kPressureKey,
      value: 0,
      unit: "psi"
    },
    {
      displayName: "Gripper",
      labels: ["output", "live-output:Grabber", "live-output:Gripper 2.0", "decimalPlaces:0"],
      icon: iconUrl(kGripperKey),
      name: kGripperKey,
      value: 0,
      unit: "% closed"
    },
    {
      // This is the true temperature of the pan
      displayName: "Pan Temperature",
      name: kPanTemperatureKey,
      value: baseTemperature
    },
    {
      // This is the temperature sensed by the gripper's sensors
      displayName: "Temperature",
      labels: ["input", "sensor:temperature"],
      icon: iconUrl(kTemperatureKey),
      name: kTemperatureKey,
      value: baseTemperature,
      unit: "°C"
    },
    {
      displayName: "Simulation Mode",
      name: kSimulationModeKey,
      value: kSimulationModePressure
    }
  ],
  values: {
    [kPanTemperatureKey]: demoStreams.fastBoil
  }
};
