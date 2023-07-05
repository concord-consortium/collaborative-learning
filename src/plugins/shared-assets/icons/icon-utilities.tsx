import React, { FunctionComponent, SVGProps } from "react";

import EMGIcon from "./dataflow/control/signal.svg";
import GripperIcon from "./dataflow/output/grabber.svg";
import PressureIcon from "./dataflow/sensor/pressure.svg";

const kIconPrefix = "ccicon";

// Brainwaves gripper simulation
export const kEMGKey = "emg_key";
export const kGripperKey = "gripper_key";
export const kPressureKey = "pressure_key";

// Terrarium simulation
export const kFanKey = "fan_key";
export const kHeatLampKey = "heat-lamp_key";
export const kHumidifierKey = "humidifier_key";
export const kHumidityKey = "humidity_key";
export const kTemperatureKey = "temperature_key";

const icons: Record<string, FunctionComponent<SVGProps<SVGSVGElement>>> = {
  [kEMGKey]: EMGIcon,
  [kGripperKey]: GripperIcon,
  [kPressureKey]: PressureIcon
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
