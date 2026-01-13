import { VariableSlider } from "@concord-consortium/diagram-view";
import React from "react";

import { demoStreams } from "../../../../../shared/assets/data/dataflow/demo-data";
import { brainwavesGripperValues } from "../../../../../shared/simulations/brainwaves-gripper/brainwaves-gripper";
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

// Variable names
const gripperKey = brainwavesGripperValues.gripperKey.value;
const pressureKey = brainwavesGripperValues.pressureKey.value;
const temperatureKey = brainwavesGripperValues.temperatureKey.value;
const panTemperatureKey = brainwavesGripperValues.panTemperatureKey.value;
const simulationModeKey = brainwavesGripperValues.simulationModeKey.value;
const emgKey = brainwavesGripperValues.emgKey.value;
const targetEMGKey = brainwavesGripperValues.targetEMGKey.value;

// Simulation modes
const simulationModePressure = brainwavesGripperValues.simulationModePressure.value;
const simulationModeTemperature = brainwavesGripperValues.simulationModeTemperature.value;

// General constants
const maxPressure = brainwavesGripperValues.maxPressure.value;
const maxGripperValue = brainwavesGripperValues.maxGripperValue.value;
const emgDropFactor = brainwavesGripperValues.emgDropFactor.value;

// Cup constants
const minGripperCupValue = brainwavesGripperValues.minGripperCupValue.value;
const gripperCupRange = maxGripperValue - minGripperCupValue;

// Pan constants
const baseTemperature = brainwavesGripperValues.baseTemperature.value;
const minGripperPanValue = brainwavesGripperValues.minGripperPanValue.value;
const gripperPanRange = maxGripperValue - minGripperPanValue;

interface IAnimationProps extends ISimulationProps {
  mode: number;
}
function BrainwavesGripperAnimation({ frame, mode, variables }: IAnimationProps) {
  const targetEMGVariable = findVariable(targetEMGKey, variables);
  const normalizedEmgValue = Math.min((targetEMGVariable?.currentValue ?? 0) / 450, 1);
  const armFrame = getFrame(normalizedEmgValue, armFrames.length);

  const gripperVariable = findVariable(gripperKey, variables);
  const normalizedGripperValue = (gripperVariable?.currentValue ?? 0) / 100;
  const gripperFrame = getFrame(normalizedGripperValue, gripperFrames.length);

  const rawTemperatureVariable = findVariable(panTemperatureKey, variables);
  const rawTemperature = rawTemperatureVariable?.currentValue;
  const normalizedRawTemperatureValue = ((rawTemperature ?? baseTemperature) - baseTemperature)
    / (brainwavesGripperValues.maxTemperature.value - baseTemperature);
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
      { mode === simulationModePressure
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
  const modeVariable = findVariable(simulationModeKey, variables);
  const targetEMGVariable = findVariable(targetEMGKey, variables);

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
            onClick={() => modeVariable?.setValue(simulationModePressure)}
            position="left"
            selected={modeVariable?.currentValue === simulationModePressure}
          >
            Pressure
          </SelectionButton>
          <SelectionButton
            onClick={() => modeVariable?.setValue(simulationModeTemperature)}
            position="right"
            selected={modeVariable?.currentValue === simulationModeTemperature}
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
  const targetEMGVariable = findVariable(targetEMGKey, variables);
  const EMGVariable = findVariable(emgKey, variables);
  if (targetEMGVariable && EMGVariable) {
    const targetEMGValue = targetEMGVariable.currentValue;
    if (targetEMGValue !== undefined){
      const adjustedEMGValue = Math.round(targetEMGValue - Math.random() * emgDropFactor * targetEMGValue);
      EMGVariable.setValue(adjustedEMGValue);
    }
  }

  const modeVariable = findVariable(simulationModeKey, variables);
  const gripperVariable = findVariable(gripperKey, variables);
  const pressureVariable = findVariable(pressureKey, variables);
  if (gripperVariable && pressureVariable) {
    // Update the pressure
    const gripperValue = gripperVariable.value;
    const getPressureValue = () => {
      if (!gripperValue) return 0;
      if (modeVariable?.currentValue === simulationModeTemperature) {
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
    const panTemperatureVariable = findVariable(panTemperatureKey, variables);
    const temperatureVariable = findVariable(temperatureKey, variables); // sensor temperature
    const gripperFeeling = gripperValue && gripperValue > minGripperPanValue;
    if (modeVariable?.currentValue === simulationModeTemperature && gripperFeeling
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
      name: targetEMGKey,
      value: 40
    },
    {
      // This is the target EMG minus a random amount on every frame to simulate imperfect EMG data
      displayName: "EMG",
      labels: ["input", "sensor:emg-reading", "decimalPlaces:0"],
      icon: iconUrl(emgKey),
      name: emgKey,
      value: 40,
      unit: "mV"
    },
    {
      displayName: "Surface Pressure",
      labels: ["input", "sensor:fsr-reading", "className:long-name", "decimalPlaces:0"],
      icon: iconUrl(pressureKey),
      name: pressureKey,
      value: 0,
      unit: "psi"
    },
    {
      displayName: "Gripper",
      labels: ["output", "live-output:Grabber", "live-output:Gripper 2.0", "decimalPlaces:0"],
      icon: iconUrl(gripperKey),
      name: gripperKey,
      value: 0,
      unit: "% closed"
    },
    {
      // This is the true temperature of the pan
      displayName: "Pan Temperature",
      name: panTemperatureKey,
      value: baseTemperature
    },
    {
      // This is the temperature sensed by the gripper's sensors
      displayName: "Temperature",
      labels: ["input", "sensor:temperature"],
      icon: iconUrl(temperatureKey),
      name: temperatureKey,
      value: baseTemperature,
      unit: "°C"
    },
    {
      displayName: "Simulation Mode",
      name: simulationModeKey,
      value: simulationModePressure
    }
  ],
  values: {
    [panTemperatureKey]: demoStreams.fastBoil
  }
};
