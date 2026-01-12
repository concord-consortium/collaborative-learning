import React, { useRef } from "react";

import { stepDuration, terrariumValues } from "../../../../../shared/simulations/terrarium/terrarium";
import { ISimulation, ISimulationProps } from "../simulation-types";
import { findVariable, getFrame } from "../simulation-utilities";
import { iconUrl } from "../../../shared-assets/icons/icon-utilities";

import display from "./assets/display/display.png";
import jarForeground from "./assets/jar_foreground/jar_foreground.png";
import lampOff from "./assets/lamp_frames/lamp_00000.png";
import lampOn from "./assets/lamp_frames/lamp_00001.png";
import { condensationFrames, fanFrames, geckoFrames, humidifierFrames, jarBackgroundFrames } from "./terrarium-assets";

import "./terrarium.scss";

// Variable names
const temperatureKey = terrariumValues.temperatureKey.value;
const rawTemperatureKey = terrariumValues.rawTemperatureKey.value;
const fanKey = terrariumValues.fanKey.value;
const heatLampKey = terrariumValues.heatLampKey.value;
const humidifierKey = terrariumValues.humidifierKey.value;
const humidityKey = terrariumValues.humidityKey.value;

// Constants
const tickDuration = 100; // This sim "ticks" more often than it "steps" to make the animation more smooth
const ticksPerStep = stepDuration / tickDuration;
const minHumidity = terrariumValues.minHumidity.value;
const startHumidity = terrariumValues.startHumidity.value;
const maxHumidity = terrariumValues.maxHumidity.value;
const minTemperature = terrariumValues.minTemperature.value;
const maxTemperature = terrariumValues.maxTemperature.value;
const baseHumidityImpactPerStep = terrariumValues.baseHumidityImpactPerStep.value;

function TerrariumComponent({ frame, variables }: ISimulationProps) {
  const humidifierFrameRef = useRef(0);
  const geckoFrameRef = useRef(0);
  const geckoDirectionRef = useRef(1);

  // Determine temperature reading
  const temperatureVariable = findVariable(temperatureKey, variables);
  const temperatureValue = temperatureVariable?.currentValue ?? 0;
  const temperatureDisplay = `${Math.round(temperatureValue)}°C`;

  // Determine humidity reading
  const humidityVariable = findVariable(humidityKey, variables);
  const humidityValue = humidityVariable?.currentValue ?? startHumidity;
  const humidityDisplay = `${Math.round(humidityValue)}%`;

  // Determine jar background and condensation foreground frame based on humidity percent
  const humidityPercent = (humidityValue - minHumidity) / (maxHumidity - minHumidity);
  const condensationFrame = getFrame(humidityPercent, condensationFrames.length);
  const jarBackgroundFrame = getFrame(humidityPercent, jarBackgroundFrames.length);

  // Determine blur for items in the jar based on humidity percent
  const maxBlur = 1.25;
  const condensationStyle = { filter: `blur(${humidityPercent * maxBlur}px)`};

  // Update gecko if the humidity and temperature are within range
  if (
    humidityValue >= terrariumValues.minGeckoHumidity.value &&
    temperatureValue <= terrariumValues.maxGeckoTemperature.value
  ) {
    geckoFrameRef.current = geckoFrameRef.current + geckoDirectionRef.current;
  }

  // Turn the gecko around if it's at the end of the frames
  if (geckoFrameRef.current >= geckoFrames.length) {
    geckoFrameRef.current = geckoFrames.length - 1;
    geckoDirectionRef.current = -1;
  } else if (geckoFrameRef.current < 0) {
    geckoFrameRef.current = 0;
    geckoDirectionRef.current = 1;
  }

  // Update humidifier
  const humidifierVariable = findVariable(humidifierKey, variables);
  const humidifierOn = !!humidifierVariable?.currentValue;
  // Continue the animation if we've already started
  if (humidifierFrameRef.current > 0) {
    humidifierFrameRef.current = (humidifierFrameRef.current + 1) % humidifierFrames.length;
  // Start the animation if we haven't started and the humidifier is on
  } else if (humidifierOn) {
    humidifierFrameRef.current++;
  }

  const fanVariable = findVariable(fanKey, variables);
  const fanOn = !!fanVariable?.currentValue;

  const heatLampVariable = findVariable(heatLampKey, variables);
  const heatLampOn = !!heatLampVariable?.currentValue;
  return (
    <div className="terrarium-component">
      <img className="animation-image jar-background" src={jarBackgroundFrames[jarBackgroundFrame]} />
      <div className="display-container" style={condensationStyle} >
        <img className="animation-image display" src={display} />
        <div className="display-message-container">
          <div className="display-message">{temperatureDisplay}</div>
          <div className="display-message">{humidityDisplay}</div>
        </div>
      </div>
      <img
        className="animation-image gecko"
        src={geckoFrames[geckoFrameRef.current]}
        style={condensationStyle}
      />
      <img
        className="animation-image humidifier"
        src={humidifierFrames[humidifierFrameRef.current]}
        style={condensationStyle}
      />
      <img className="animation-image jar-foreground" src={jarForeground} />
      <img className="animation-image condensation" src={condensationFrames[condensationFrame]} />
      <img className="animation-image fan" src={fanFrames[fanOn ? frame % fanFrames.length : 0]} />
      <img className="animation-image heat-lamp" src={heatLampOn ? lampOn : lampOff} />
    </div>
  );
}

function step({ frame, variables }: ISimulationProps) {
  if (frame % ticksPerStep !== 0) return; // Don't actually step every tick.

  const rawTemperatureVariable = findVariable(rawTemperatureKey, variables);
  const humidifierVariable = findVariable(humidifierKey, variables);
  const fanVariable = findVariable(fanKey, variables);
  const heatLampVariable = findVariable(heatLampKey, variables);
  const humidityVariable = findVariable(humidityKey, variables);
  const temperatureVariable = findVariable(temperatureKey, variables);

  const fanOn = !!fanVariable?.value;
  const fanHumidityImpact = fanOn ? terrariumValues.fanHumidityImpactPerStep.value : 0;
  const fanTemperatureImpact = fanOn ? terrariumValues.fanTemperatureImpactPerStep.value : 0;

  const heatLampOn = !!heatLampVariable?.value;
  const heatLampTemperatureImpact = heatLampOn ? terrariumValues.heatLampTemperatureImpactPerStep.value : 0;

  const humidifierOn = !!humidifierVariable?.value;
  const humidifierHumidityImpact = humidifierOn ? terrariumValues.humidifierHumidityImpactPerStep.value : 0;

  if (humidityVariable?.value !== undefined) {
    const humidity = Math.min(maxHumidity, Math.max(minHumidity,
      humidityVariable.value + baseHumidityImpactPerStep + fanHumidityImpact + humidifierHumidityImpact));
    humidityVariable.setValue(humidity);
  }

  if (rawTemperatureVariable?.value) {
    const rawTemperature = Math.min(maxTemperature, Math.max(minTemperature,
      rawTemperatureVariable.value + fanTemperatureImpact + heatLampTemperatureImpact));
    rawTemperatureVariable.setValue(rawTemperature);

    // Temperature is random between rawTemperature - .05 and rawTemperature + .05
    temperatureVariable?.setValue(rawTemperature + Math.random() * .1 - .05);
  }
}

export const terrariumSimulation: ISimulation = {
  component: TerrariumComponent,
  delay: tickDuration,
  step,
  variables: [
    {
      displayName: "Temperature",
      labels: ["input", "sensor:temperature"],
      icon: iconUrl(temperatureKey),
      name: temperatureKey,
      value: minTemperature,
      unit: "°C"
    },
    {
      displayName: "Humidity",
      labels: ["input", "sensor:humidity"],
      icon: iconUrl(humidityKey),
      name: humidityKey,
      value: startHumidity,
      unit: "%"
    },
    {
      displayName: "Raw Temperature",
      name: rawTemperatureKey,
      value: minTemperature
    },
    {
      displayName: "Fan",
      labels: ["output", "live-output:Fan", "decimalPlaces:0"],
      icon: iconUrl(fanKey),
      name: fanKey,
      value: 0
    },
    {
      displayName: "Heat Lamp",
      labels: ["output", "live-output:Heat Lamp", "decimalPlaces:0"],
      icon: iconUrl(heatLampKey),
      name: heatLampKey,
      value: 0
    },
    {
      displayName: "Humidifier",
      labels: ["output", "live-output:Humidifier", "decimalPlaces:0"],
      icon: iconUrl(humidifierKey),
      name: humidifierKey,
      value: 0
    },
  ],
  values: {}
};
