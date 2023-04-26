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
import GrabberIcon from "../../assets/icons/output/grabber.svg";
import AdvancedGrabberIcon from "../../assets/icons/output/advanced-grabber.svg";

import TemperatureIcon from "../../assets/icons/sensor/temperature.svg";
import CO2Icon from "../../assets/icons/sensor/co2.svg";
import HumidityIcon from "../../assets/icons/sensor/humidity.svg";
import LightIcon from "../../assets/icons/sensor/light.svg";
import O2Icon from "../../assets/icons/sensor/o2.svg";
import ParticulatesIcon from "../../assets/icons/sensor/particulates.svg";
import MoistureIcon from "../../assets/icons/sensor/moisture.svg";
import EmgIcon from "../../assets/icons/sensor/emg.svg";
import PressureIcon from "../../assets/icons/sensor/pressure.svg";

import AbsoluteValueIcon from "../../assets/icons/transform/absolute-value.svg";
import NegationIcon from "../../assets/icons/transform/negation.svg";
import NotIcon from "../../assets/icons/transform/not.svg";

import CurrentValueIcon from "../../assets/icons/control/control-current-value.svg";
import PreviousValueIcon from "../../assets/icons/control/control-previous-value.svg";
import ZeroValueIcon from "../../assets/icons/control/control-zero-value.svg";

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
    name: "Control",
    displayName: "Control",
  },
  {
    name: "Demo Output",
    displayName: "Demo Output",
  },
  {
    name: "Live Output",
    displayName: "Live Output",
  }
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

export const NodeControlTypes = [
  {
    name: "Hold Current",
    type: "control",
    icon: CurrentValueIcon
  },
  {
    name: "Hold Prior",
    type: "control",
    icon: PreviousValueIcon
  },
  {
    name: "Output Zero",
    type: "control",
    icon: ZeroValueIcon
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
    name: "Grabber",
    icon: GrabberIcon
  },
  {
    name: "Advanced Grabber",
    icon: AdvancedGrabberIcon
  },
  {
    name: "Fan",
    icon: LightBulbIcon
  },
  {
    name: "Humidifier",
    icon: LightBulbIcon
  }
];

export const NodeLiveOutputTypes = [
  {
    name: "Light Bulb",
    icon: LightBulbIcon
  },
  {
    name: "Grabber",
    icon: GrabberIcon
  },
  {
    name: "Humidifier",
    icon: GrabberIcon,
    relayIndex: 2
  },
  {
    name: "Fan",
    icon: GrabberIcon,
    relayIndex: 1
  },
  {
    name: "Heat Lamp",
    icon: GrabberIcon,
    relayIndex: 0
  }
];


export const NodeMicroBitHubs = [
  {
    id: 'a',
    name: "micro:bit hub a",
    icon: LightIcon,
    active: false
  },
  {
    id: 'b',
    name: "micro:bit hub b",
    icon: LightIcon,
    active: false
  },
  {
    id: 'c',
    name: "micro:bit hub c",
    icon: LightIcon,
    active: false
  },
  {
    id: 'd',
    name: "micro:bit hub d",
    icon: LightIcon,
    active: false
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
  }
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

export const kSensorSelectMessage = "Select a sensor";
export const kSensorMissingMessage = "⚠️";
export const kAnimatedBinaryTypes = ["Fan", "Humidifier"];
export const kRelaysIndexed =  ["Heat Lamp", "Fan", "Humidifier"];
export const kBinaryOutputTypes = [...kRelaysIndexed, "Light Bulb"];
export const kRoundedOutputTypes = ["Grabber"];
