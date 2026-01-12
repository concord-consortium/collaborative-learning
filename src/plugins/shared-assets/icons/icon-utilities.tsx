import React, { FunctionComponent, SVGProps } from "react";

import { brainwavesGripperValues } from "../../../../shared/simulations/brainwaves-gripper/brainwaves-gripper";
import { potentiometerAndServoValues } from "../../../../shared/simulations/potentiometer-servo/potentiometer-servo";
import { terrariumValues } from "../../../../shared/simulations/terrarium/terrarium";

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

const icons: Record<string, FunctionComponent<SVGProps<SVGSVGElement>>> = {
  [brainwavesGripperValues.emgKey.value]: EMGIcon,
  [terrariumValues.fanKey.value]: FanIcon,
  [brainwavesGripperValues.gripperKey.value]: GripperIcon,
  [terrariumValues.heatLampKey.value]: HeatLampIcon,
  [terrariumValues.humidifierKey.value]: HumidifierIcon,
  [terrariumValues.humidityKey.value]: HumidityIcon,
  [brainwavesGripperValues.pressureKey.value]: PressureIcon,
  [terrariumValues.temperatureKey.value]: TemperatureIcon,
  [potentiometerAndServoValues.potAngleKey.value]: PotentiometerIcon,
  [potentiometerAndServoValues.servoAngleKey.value]: ServoIcon,
  [potentiometerAndServoValues.resistReadingKey.value]: SignalIcon
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
