import React, { FunctionComponent, SVGProps } from "react";

import {
  kEMGKey, kGripperKey, kPressureKey
} from "../../../../shared/simulations/brainwaves-gripper/brainwaves-gripper";
import { kTemperatureKey } from "../../../../shared/simulations/shared/const";

import EMGIcon from "./dataflow/sensor/sensor-emg-icon.svg";
import FanIcon from "./dataflow/output/fan.svg";
import GripperIcon from "./dataflow/output/grabber.svg";
import HumidifierIcon from "./dataflow/output/humid.svg";
import HeatLampIcon from "./dataflow/output/light-bulb.svg";
import HumidityIcon from "./dataflow/sensor/humidity.svg";
import PressureIcon from "./dataflow/sensor/pressure.svg";
import TemperatureIcon from "./dataflow/sensor/temperature.svg";
import PotentiometerIcon from "./dataflow/sensor/potentiometer.svg";
import ServoIcon from "./dataflow/output/servo.svg";
import SignalIcon from "./dataflow/control/signal.svg";

const kIconPrefix = "ccicon";

// Terrarium simulation
export const kFanKey = "fan_key";
export const kHeatLampKey = "heat_lamp_key";
export const kHumidifierKey = "humidifier_key";
export const kHumidityKey = "humidity_key";

// Potentiometer & Servo simulation
export const kPotentiometerKey = "potentiometer_key";
export const kServoKey = "servo_key";
export const kSignalKey = "signal_key";

const icons: Record<string, FunctionComponent<SVGProps<SVGSVGElement>>> = {
  [kEMGKey]: EMGIcon,
  [kFanKey]: FanIcon,
  [kGripperKey]: GripperIcon,
  [kHeatLampKey]: HeatLampIcon,
  [kHumidifierKey]: HumidifierIcon,
  [kHumidityKey]: HumidityIcon,
  [kPressureKey]: PressureIcon,
  [kTemperatureKey]: TemperatureIcon,
  [kPotentiometerKey]: PotentiometerIcon,
  [kServoKey]: ServoIcon,
  [kSignalKey]: SignalIcon
};

export function iconUrl(id: string) {
  return `${kIconPrefix}://${id}`;
}

function isIconUrl(url: string) {
  return url.startsWith(`${kIconPrefix}://`);
}

function getIconId(url: string) {
  return url.slice(kIconPrefix.length + 3);
}

export function getIcon(url?: string) {
  if (url === undefined) return null;

  if (isIconUrl(url)) {
    const id = getIconId(url);
    const Icon = icons[id];
    if (Icon) return <Icon />;
  }
}
