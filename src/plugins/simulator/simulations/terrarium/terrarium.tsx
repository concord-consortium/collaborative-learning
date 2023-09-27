import React from "react";

import { ISimulation, ISimulationProps } from "../simulation-types";
import { findVariable } from "../simulation-utilities";
import {
  iconUrl, kFanKey, kHeatLampKey, kHumidifierKey, kHumidityKey, kTemperatureKey
} from "../../../shared-assets/icons/icon-utilities";

import jarForeground from "./assets/jar_foreground/jar_foreground.png";
import lampOff from "./assets/lamp_frames/lamp_00000.png";
import lampOn from "./assets/lamp_frames/lamp_00001.png";
import { fanFrames, jarFrames } from "./terrarium-assets";

import "./terrarium.scss";

export const kTerrariumKey = "terrarium";

const kRawTemperatureKey = "raw_temperature_key";
const tickDuration = 50; // This sim "ticks" more often than it "steps" to make the animation more smooth
const stepDuration = 1000;
const ticksPerStep = stepDuration / tickDuration;
const minHumidity = 0;
const startHumidity = 20;
const maxHumidity = 90;
const minTemperature = 21;
const maxTemperature = 27;
const baseHumidityImpactPerStep = -10 / 600000 * stepDuration; // -10%/10 minutes
const fanHumidityImpactPerStep = -5 / 60000 * stepDuration; // -5%/minute
const fanTemperatureImpactPerStep = -1 / 60000 * stepDuration; // -1 degree/minute
const heatLampTemperatureImpactPerStep = 1 / 60000 * stepDuration; // +1 degree/minute
const humidifierHumidityImpactPerStep = 15 / 60000 * stepDuration; // +15%/minute

function TerrariumComponent({ frame, variables }: ISimulationProps) {
  const fanVariable = findVariable(kFanKey, variables);
  const fanOn = !!fanVariable?.currentValue;
  const heatLampVariable = findVariable(kHeatLampKey, variables);
  const heatLampOn = !!heatLampVariable?.currentValue;
  const jarFrame = frame % jarFrames.length;
  return (
    <div className="terrarium-component">
      <img className="animation-image jar" src={jarFrames[jarFrame]} />
      <img className="animation-image fan" src={fanFrames[fanOn ? frame % fanFrames.length : 0]} />
      <img className="animation-image jar-foreground" src={jarForeground} />
      <img className="animation-image heat-lamp" src={heatLampOn ? lampOn : lampOff} />
    </div>
  );
}

function step({ frame, variables }: ISimulationProps) {
  if (frame % ticksPerStep !== 0) return; // Don't actually step every tick.

  const rawTemperatureVariable = findVariable(kRawTemperatureKey, variables);
  const humidifierVariable = findVariable(kHumidifierKey, variables);
  const fanVariable = findVariable(kFanKey, variables);
  const heatLampVariable = findVariable(kHeatLampKey, variables);
  const humidityVariable = findVariable(kHumidityKey, variables);
  const temperatureVariable = findVariable(kTemperatureKey, variables);

  const fanOn = !!fanVariable?.value;
  const fanHumidityImpact = fanOn ? fanHumidityImpactPerStep : 0;
  const fanTemperatureImpact = fanOn ? fanTemperatureImpactPerStep : 0;

  const heatLampOn = !!heatLampVariable?.value;
  const heatLampTemperatureImpact = heatLampOn ? heatLampTemperatureImpactPerStep : 0;

  const humidifierOn = !!humidifierVariable?.value;
  const humidifierHumidityImpact = humidifierOn ? humidifierHumidityImpactPerStep : 0;

  if (humidityVariable?.value) {
    const humidity = Math.min(maxHumidity, Math.max(minHumidity,
      humidityVariable.value + baseHumidityImpactPerStep + fanHumidityImpact + humidifierHumidityImpact));
    humidityVariable.setValue(humidity);
  }

  if (rawTemperatureVariable?.value) {
    const rawTemperature = Math.min(maxTemperature, Math.max(minTemperature,
      rawTemperatureVariable.value + fanTemperatureImpact + heatLampTemperatureImpact));
    rawTemperatureVariable.setValue(rawTemperature);

    // Temperature is random between rawTemperature - .5 and rawTemperature + .5
    temperatureVariable?.setValue(rawTemperature + Math.random() - .5);
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
      icon: iconUrl(kTemperatureKey),
      name: kTemperatureKey,
      value: minTemperature
    },
    {
      displayName: "Humidity",
      labels: ["input", "sensor:humidity"],
      icon: iconUrl(kHumidityKey),
      name: kHumidityKey,
      value: startHumidity
    },
    {
      displayName: "Raw Temperature",
      name: kRawTemperatureKey,
      value: minTemperature
    },
    {
      displayName: "Fan",
      labels: ["output", "live-output:Fan"],
      icon: iconUrl(kFanKey),
      name: kFanKey,
      value: 0
    },
    {
      displayName: "Heat Lamp",
      labels: ["output", "live-output:Heat Lamp"],
      icon: iconUrl(kHeatLampKey),
      name: kHeatLampKey,
      value: 0
    },
    {
      displayName: "Humidifier",
      labels: ["output", "live-output:Humidifier"],
      icon: iconUrl(kHumidifierKey),
      name: kHumidifierKey,
      value: 0
    },
  ],
  values: {}
};
