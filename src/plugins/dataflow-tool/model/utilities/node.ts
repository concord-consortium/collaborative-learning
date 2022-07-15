// import NoiseIcon from "../../assets/icons/generator/noise.svg";
import SineIcon from "../../assets/icons/generator/sine.svg";
import SquareIcon from "../../assets/icons/generator/square.svg";
import TriangleIcon from "../../assets/icons/generator/triangle.svg";

import AndIcon from "../../assets/icons/logic/and.svg";
import EqualIcon from "../../assets/icons/logic/equal.svg";
import GreaterThanOrEqualToIcon from "../../assets/icons/logic/greater-than-or-equal-to.svg";
import GreaterThanIcon from "../../assets/icons/logic/greater-than.svg";
import LessThanOrEqualToIcon from "../../assets/icons/logic/less-than-or-equal-to.svg";
import LessThanIcon from "../../assets/icons/logic/less-than.svg";
import NandIcon from "../../assets/icons/logic/nand.svg";
import NotEqualIcon from "../../assets/icons/logic/not-equal.svg";
import OrIcon from "../../assets/icons/logic/or.svg";
import XorIcon from "../../assets/icons/logic/xor.svg";

import AddIcon from "../../assets/icons/math/add.svg";
import SubtractIcon from "../../assets/icons/math/subtract.svg";
import MultiplyIcon from "../../assets/icons/math/multiply.svg";
import DivideIcon from "../../assets/icons/math/divide.svg";

import LightBulbIcon from "../../assets/icons/output/light-bulb.svg";
import BackyardClawIcon from "../../assets/icons/output/backyard-claw.svg";
import GrabberIcon from "../../assets/icons/output/grabber.svg";

import TemperatureIcon from "../../assets/icons/sensor/temperature.svg";
import CO2Icon from "../../assets/icons/sensor/co2.svg";
import HumidityIcon from "../../assets/icons/sensor/humidity.svg";
import LightIcon from "../../assets/icons/sensor/light.svg";
import O2Icon from "../../assets/icons/sensor/o2.svg";
import ParticulatesIcon from "../../assets/icons/sensor/particulates.svg";
import MoistureIcon from "../../assets/icons/sensor/moisture.svg";
import EmgIcon from "../../assets/icons/sensor/emg.svg"
import PressureIcon from "../../assets/icons/sensor/pressure.svg"

import AbsoluteValueIcon from "../../assets/icons/transform/absolute-value.svg";
import NegationIcon from "../../assets/icons/transform/negation.svg";
import NotIcon from "../../assets/icons/transform/not.svg";

export interface NodeType {
  name: string;
  displayName: string;
}

export const NodeTypes: NodeType[] = [
  {
    name: "Sensor",
    displayName: "Sensor",
  },
  {
    name: "Number",
    displayName: "Number",
  },
  {
    name: "Generator",
    displayName: "Generator",
  },
  {
    name: "Timer",
    displayName: "Timer (on/off)"
  },
  {
    name: "Math",
    displayName: "Math",
  },
  {
    name: "Logic",
    displayName: "Logic",
  },
  {
    name: "Transform",
    displayName: "Transform",
  },
  {
    name: "Relay",
    displayName: "Relay",
  },
  {
    name: "Demo Output",
    displayName: "Demo Output",
  },
  {
    name: "Data Storage",
    displayName: "Data Storage",
  },
];

export const NodeOperationTypes = [
  {
    name: "Add",
    type: "math",
    method: (n1: number, n2: number) => n1 + n2,
    numberSentence: (n1: string, n2: string) => `${n1} + ${n2} = `,
    icon: AddIcon
  },
  {
    name: "Subtract",
    type: "math",
    method: (n1: number, n2: number) => n1 - n2,
    numberSentence: (n1: string, n2: string) => `${n1} - ${n2} = `,
    icon: SubtractIcon
  },
  {
    name: "Multiply",
    type: "math",
    method: (n1: number, n2: number) => n1 * n2,
    numberSentence: (n1: string, n2: string) => `${n1} * ${n2} = `,
    icon: MultiplyIcon
  },
  {
    name: "Divide",
    type: "math",
    method: (n1: number, n2: number) => n1 / n2,
    numberSentence: (n1: string, n2: string) => `${n1} / ${n2} = `,
    icon: DivideIcon
  },

  {
    name: "Absolute Value",
    type: "transform",
    method: (n1: number, n2: number) => Math.abs(n1),
    numberSentence: (n1: string, n2: string) => `|${n1}| = `,
    icon: AbsoluteValueIcon
  },
  {
    name: "Negation",
    type: "transform",
    method: (n1: number, n2: number) => 0 - n1,
    numberSentence: (n1: string, n2: string) => `-(${n1}) = `,
    icon: NegationIcon
  },
  {
    name: "Not",
    type: "transform",
    method: (n1: number, n2: number) => n1 ? 0 : 1,
    numberSentence: (n1: string, n2: string) => `!${n1} ⇒ `,
    icon: NotIcon
  },

  {
    name: "Greater Than",
    type: "logic",
    method: (n1: number, n2: number) => +(n1 > n2),
    numberSentence: (n1: string, n2: string) => `${n1} > ${n2} ⇒ `,
    icon: GreaterThanIcon
  },
  {
    name: "Less Than",
    type: "logic",
    method: (n1: number, n2: number) => +(n1 < n2),
    numberSentence: (n1: string, n2: string) => `${n1} < ${n2} ⇒ `,
    icon: LessThanIcon
  },
  {
    name: "Greater Than Or Equal To",
    type: "logic",
    method: (n1: number, n2: number) => +(n1 >= n2),
    numberSentence: (n1: string, n2: string) => `${n1} >= ${n2} ⇒ `,
    icon: GreaterThanOrEqualToIcon
  },
  {
    name: "Less Than Or Equal To",
    type: "logic",
    method: (n1: number, n2: number) => +(n1 <= n2),
    numberSentence: (n1: string, n2: string) => `${n1} <= ${n2} ⇒ `,
    icon: LessThanOrEqualToIcon
  },
  {
    name: "Equal",
    type: "logic",
    method: (n1: number, n2: number) => +(n1 === n2),
    numberSentence: (n1: string, n2: string) => `${n1} == ${n2} ⇒ `,
    icon: EqualIcon
  },
  {
    name: "Not Equal",
    type: "logic",
    method: (n1: number, n2: number) => +(n1 !== n2),
    numberSentence: (n1: string, n2: string) => `${n1} != ${n2} ⇒ `,
    icon: NotEqualIcon
  },
  {
    name: "And",
    type: "logic",
    method: (n1: number, n2: number) => n1 && n2 ? 1 : 0,
    numberSentence: (n1: string, n2: string) => `${n1} && ${n2} ⇒ `,
    icon: AndIcon
  },
  {
    name: "Or",
    type: "logic",
    method: (n1: number, n2: number) => n1 || n2 ? 1 : 0,
    numberSentence: (n1: string, n2: string) => `${n1} || ${n2} ⇒ `,
    icon: OrIcon
  },
  {
    name: "Nand",
    type: "logic",
    method: (n1: number, n2: number) => +(!(n1 && n2 ? 1 : 0)),
    numberSentence: (n1: string, n2: string) => `${n1} nand ${n2} ⇒ `,
    icon: NandIcon
  },
  {
    name: "Xor",
    type: "logic",
    method: (n1: number, n2: number) => +((n1 ? 1 : 0) !== (n2 ? 1 : 0)),
    numberSentence: (n1: string, n2: string) => `${n1} xor ${n2} ⇒ `,
    icon: XorIcon
  }
];

export const NodeSensorTypes = [
  {
    name: "Temperature",
    type: "temperature",
    units: "°C",
    icon: TemperatureIcon
  },
  {
    name: "Humidity",
    type: "humidity",
    units: "%",
    icon: HumidityIcon
  },
  {
    name: "CO₂",
    type: "CO2",
    units: "PPM",
    icon: CO2Icon
  },
  {
    name: "O₂",
    type: "O2",
    units: "%",
    icon: O2Icon
  },
  {
    name: "Light",
    type: "light",
    units: "lux",
    icon: LightIcon
  },
  {
    name: "Soil Moisture",
    type: "soil-moisture",
    units: "",
    icon: MoistureIcon
  },
  {
    name: "Particulates",
    type: "particulates",
    units: "PM2.5",
    icon: ParticulatesIcon
  },
  {
    name: "EMG",
    type: "emg-reading",
    units: "f(mv)",
    icon: EmgIcon
  },
  {
    name: "Surface Pressure",
    type: "fsr-reading",
    units: "f(n)",
    icon: PressureIcon
  }
];

export const NodeDemoOutputTypes = [
  {
    name: "Light Bulb",
    icon: LightBulbIcon
  },
  {
    name: "Backyard Claw",
    icon: BackyardClawIcon
  },
  {
    name: "Grabber",
    icon: GrabberIcon
  }
];

export const NodeGeneratorTypes = [
  {
    name: "Sine",
    method: (t: number, p: number, a: number) => Math.round(Math.sin(t * Math.PI / (p / 2)) * a * 100) / 100,
    icon: SineIcon
  },
  {
    name: "Square",
    method: (t: number, p: number, a: number) => t % p < p / 2 ? 1 * a : 0,
    icon: SquareIcon
  },
  {
    name: "Triangle",
    method: (t: number, p: number, a: number) => (2 * a / p) * Math.abs(t % p - p / 2),
    icon: TriangleIcon
  },
  /*
  {
    name: "Noise",
    method: (t: number, p: number, a: number) => Math.random() * a,
    icon: NoiseIcon
  },
  */
];

export const NodePeriodUnits = [
  {
    unit: "sec",
    lengthInSeconds: 1
  },
  {
    unit: "min",
    lengthInSeconds: 60
  },
  {
    unit: "hour",
    lengthInSeconds: 3600
  },
];

export const NodeTimerInfo =
{
  method: (t: number, tOn: number, tOff: number) => t % (tOn + tOff) < tOn ? 1 : 0,
};

export interface NodeChannelInfo {
  hubId: string;
  hubName: string;
  channelId: string;
  missing: boolean;
  type: string;
  units: string;
  plug: number;
  value: number;
  name: string;
  virtual?: boolean;
  virtualValueMethod?: (t: number) => number;
  usesSerial?:boolean;
  serialConnected?:boolean | null;
}

export const roundNodeValue = (n: number) => {
  return Math.round(n * 1000) / 1000;
};

export const ChartPlotColors = ["#d51eff", "#17ddd7", "#d3d114", "#3974ff", "#ff3d3d",
                               "#49d381", "#b05ecb", "#ffd56d", "#ffa56d", "#f57676",
                               "#fa73b0", "#eb80dc", "#cd88e4", "#d49600", "#d45200",
                               "#c60e0e", "#cc0860", "#b81da1", "#8d27ad", "#8b989f",
                               "#5dd581", "#3cc8f5", "#aeb9bf", "#92e3aa", "#7ad9f8",
                               "#5d6e77", "#31bc5a", "#0caadd"];
export const NodePlotColor = "#969696";
export const NodePlotBlue = ChartPlotColors[3];
export const NodePlotRed = ChartPlotColors[4];

export interface ProgramDataRate {
  text: string;
  val: number;
  disabled?: boolean;
}
export const DEFAULT_DATA_RATE = 1000;
export const ProgramDataRates: ProgramDataRate[] = [
  {
    text: "50ms",
    val: 50
  },
  {
    text: "100ms",
    val: 100
  },
  {
    text: "500ms",
    val: 500
  },
  {
    text: "1 sec",
    val: 1000
  },
  {
    text: "10 sec",
    val: 10000
  },
  {
    text: "1 min",
    val: 60000
  }
];

export interface ProgramRunTime {
  text: string;
  val: number;
  disabled?: boolean;
}
export interface IntervalTime extends ProgramRunTime {
  maxProgramRunTime: number;
}

export const IntervalTimes: IntervalTime[] = [
  {
    text: "1 second",
    val: 1,
    maxProgramRunTime: 3600
  },
  {
    text: "5 seconds",
    val: 5,
    maxProgramRunTime: 21600
  },
  {
    text: "10 seconds",
    val: 10,
    maxProgramRunTime: 21600
  },
  {
    text: "15 seconds",
    val: 15,
    maxProgramRunTime: 86400
  },
  {
    text: "1 minute",
    val: 60,
    maxProgramRunTime: 432000
  },
  {
    text: "5 minutes",
    val: 300,
    maxProgramRunTime: 432000
  },
  {
    text: "10 minutes",
    val: 600,
    maxProgramRunTime: 2592000
  },
  {
    text: "1 hour",
    val: 3600,
    maxProgramRunTime: 2592000
  }
];

export const kRelaySelectMessage = "Select a relay";
export const kSensorSelectMessage = "Select a sensor";
export const kRelayMissingMessage = "Finding";
export const kSensorMissingMessage = "Finding";

const virtualTempChannel: NodeChannelInfo = {
  hubId: "00000-VIRTUAL-HUB", hubName: "Virtual Sensor", name: "Temperature", channelId: "00001-VIR",
  missing: false, type: "temperature", units: "°C", plug: 1, value: 0, virtual: true,
  virtualValueMethod: (t: number) => {
    const vals = [20, 20, 20, 21, 21, 21, 20, 20, 21, 21, 21, 21, 21, 21, 21];
    return vals[t % vals.length];
  } };
const virtualHumidChannel: NodeChannelInfo = {
  hubId: "00000-VIRTUAL-HUB", hubName: "Virtual Sensor", name: "Humidity", channelId: "00002-VIR",
  missing: false, type: "humidity", units: "%", plug: 2, value: 0, virtual: true,
  virtualValueMethod: (t: number) => {
    const vals = [60, 60, 60, 61, 61, 61, 62, 62, 62, 61, 61, 61, 61, 61, 61, 61];
    return vals[t % vals.length];
  } };
const virtualCO2Channel: NodeChannelInfo = {
  hubId: "00000-VIRTUAL-HUB", hubName: "Virtual Sensor", name: "CO2", channelId: "00003-VIR",
  missing: false, type: "CO2", units: "PPM", plug: 3, value: 0, virtual: true,
  virtualValueMethod: (t: number) => {
    const vals = [409, 409, 410, 410, 410, 410, 411, 411, 410, 410, 410, 409, 409, 411, 411];
    return vals[t % vals.length];
  } };
const virtualO2Channel: NodeChannelInfo = {
  hubId: "00000-VIRTUAL-HUB", hubName: "Virtual Sensor", name: "O2", channelId: "00004-VIR",
  missing: false, type: "O2", units: "PPM", plug: 4, value: 0, virtual: true,
  virtualValueMethod: (t: number) => {
    const vals = [21, 21, 21, 22, 22, 22, 21, 21, 21, 21, 22, 22, 22, 22, 22];
    return vals[t % vals.length];
  } };
const virtualLightChannel: NodeChannelInfo = {
  hubId: "00000-VIRTUAL-HUB", hubName: "Virtual Sensor", name: "Light", channelId: "00005-VIR",
  missing: false, type: "light", units: "lux", plug: 5, value: 0, virtual: true,
  virtualValueMethod: (t: number) => {
    const vals = [9000, 9000, 9001, 9001, 9002, 9002, 9002, 9001, 9001, 9001, 9000, 9001, 9001, 9002, 9002];
    return vals[t % vals.length];
  } };
const virtualPartChannel: NodeChannelInfo = {
  hubId: "00000-VIRTUAL-HUB", hubName: "Virtual Sensor", name: "Particulates", channelId: "00006VIR",
  missing: false, type: "particulates", units: "PM2.5", plug: 7, value: 0, virtual: true,
  virtualValueMethod: (t: number) => {
    const vals = [10, 10, 10, 10, 10, 10, 11, 11, 11, 11, 11, 11, 11, 11, 11];
    return vals[t % vals.length];
  } };
const virtualEmgChannel: NodeChannelInfo = {
  hubId: "00000-VIRTUAL-HUB", hubName: "Virtual Sensor", name: "EMG", channelId: "00007VIR",
  missing: false, type: "emg-reading", units: "f(mv)", plug: 8, value: 0, virtual: true,
  virtualValueMethod: (t: number) => {
    const vals = [70, 72, 74, 103, 106, 120, 121, 122, 124, 140, 144, 143, 120, 145, 151, 167, 130, 118, 71, 70, 70];
    return vals[t % vals.length];
} };

export const virtualSensorChannels: NodeChannelInfo[] = [
  virtualTempChannel, virtualHumidChannel, virtualCO2Channel, virtualO2Channel,
  virtualLightChannel, virtualPartChannel, virtualEmgChannel ];
