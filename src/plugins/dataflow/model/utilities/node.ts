import SineIcon from "../../../shared-assets/icons/dataflow/generator/sine.svg";
import SquareIcon from "../../../shared-assets/icons/dataflow/generator/square.svg";
import TriangleIcon from "../../../shared-assets/icons/dataflow/generator/triangle.svg";

import AndIcon from "../../../shared-assets/icons/dataflow/logic/and.svg";
import EqualIcon from "../../../shared-assets/icons/dataflow/logic/equal.svg";
import GreaterThanOrEqualToIcon from "../../../shared-assets/icons/dataflow/logic/greater-than-or-equal-to.svg";
import GreaterThanIcon from "../../../shared-assets/icons/dataflow/logic/greater-than.svg";
import LessThanOrEqualToIcon from "../../../shared-assets/icons/dataflow/logic/less-than-or-equal-to.svg";
import LessThanIcon from "../../../shared-assets/icons/dataflow/logic/less-than.svg";
import NandIcon from "../../../shared-assets/icons/dataflow/logic/nand.svg";
import NotEqualIcon from "../../../shared-assets/icons/dataflow/logic/not-equal.svg";
import OrIcon from "../../../shared-assets/icons/dataflow/logic/or.svg";
import XorIcon from "../../../shared-assets/icons/dataflow/logic/xor.svg";

import AddIcon from "../../../shared-assets/icons/dataflow/math/add.svg";
import SubtractIcon from "../../../shared-assets/icons/dataflow/math/subtract.svg";
import MultiplyIcon from "../../../shared-assets/icons/dataflow/math/multiply.svg";
import DivideIcon from "../../../shared-assets/icons/dataflow/math/divide.svg";

import LightBulbIcon from "../../../shared-assets/icons/dataflow/output/light-bulb.svg";
import GrabberIcon from "../../../shared-assets/icons/dataflow/output/grabber.svg";
import AdvancedGrabberIcon from "../../assets/icons/output/advanced-grabber.svg";
import HumidIcon from "../../../shared-assets/icons/dataflow/output/humid.svg";
import FanIcon from "../../../shared-assets/icons/dataflow/output/fan.svg";

import TemperatureIcon from "../../../shared-assets/icons/dataflow/sensor/temperature.svg";
import CO2Icon from "../../../shared-assets/icons/dataflow/sensor/co2.svg";
import HumidityIcon from "../../../shared-assets/icons/dataflow/sensor/humidity.svg";
import LightIcon from "../../../shared-assets/icons/dataflow/sensor/light.svg";
import SignalIcon from "../../../shared-assets/icons/dataflow/control/signal.svg";
import EMGIcon from "../../../shared-assets/icons/dataflow/sensor/sensor-emg-icon.svg";
import PressureIcon from "../../../shared-assets/icons/dataflow/sensor/pressure.svg";
import ServoIcon from "../../../shared-assets/icons/dataflow/output/servo.svg";

import AbsoluteValueIcon from "../../../shared-assets/icons/dataflow/transform/absolute-value.svg";
import NegationIcon from "../../../shared-assets/icons/dataflow/transform/negation.svg";
import NotIcon from "../../../shared-assets/icons/dataflow/transform/not.svg";

import HoldPreviousArrowIcon from "../../assets/icons/control/hold-previous.svg";
import HoldCurrentArrowIcon from "../../assets/icons/control/hold-this.svg";
import HoldZeroArrowIcon from "../../assets/icons/control/hold-zero.svg";

import { isFiniteNumber } from "../../../../utilities/math-utils";

export const kMaxNodeValues = 16;

interface NodeNameValuePair {
  name: string;
  val: number;
}
interface NodeValueMap {
  [key: string]: NodeNameValuePair;
}
export type NodeValue = number | NodeValueMap;

export interface NodeType {
  name: string;
  displayName: string;
}

export const NodeTypes: NodeType[] = [
  {
    name: "Sensor",
    displayName: "Input",
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
    displayName: "Hold",
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
    name: "Round",
    type: "transform",
    method: (n1: number, n2: number) => Math.round(n1),
    numberSentence: (n1: string, n2: string) => `round(${n1}) = `,
    icon: SignalIcon
  },
  {
    name: "Floor",
    type: "transform",
    method: (n1: number, n2: number) => Math.floor(n1),
    numberSentence: (n1: string, n2: string) => `floor(${n1}) = `,
    icon: SignalIcon
  },
  {
    name: "Ceil",
    type: "transform",
    method: (n1: number, n2: number) => Math.ceil(n1),
    numberSentence: (n1: string, n2: string) => `ceil(${n1}) = `,
    icon: SignalIcon
  },
  {
    name: "Ramp",
    type: "transform",
    method: (n1: number, n2: number, prevValue?: number) => {
      if (!isFiniteNumber(prevValue)) return n1;

      const delta = n1 - prevValue;
      const isSteep = Math.abs(delta) > 0.1 * prevValue;

      if (delta > 0) {
        const increaseBy = n1 * 0.1;
        return isSteep ? prevValue + increaseBy : n1;
      }

      if (delta < 0) {
        const decreaseBy = prevValue * 0.1;
        return isSteep ? prevValue - decreaseBy : n1;
      }

      return n1;
    },
    numberSentence: (n1: string, n2: string) => `${n1} → `,
    icon: SignalIcon
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

export const HoldFunctionOptions = [
  {
    name: "Hold Current",
    displayName: "Hold this",
    type: "control",
    icon: HoldCurrentArrowIcon
  },
  {
    name: "Hold Prior",
    displayName: "Hold previous",
    type: "control",
    icon: HoldPreviousArrowIcon
  },
  {
    name: "Output Zero",
    displayName: "Hold 0",
    type: "control",
    icon: HoldZeroArrowIcon
  },
  // {
  //   name: "Hold Current Wait",
  //   displayName: "Hold this, wait",
  //   type: "control",
  //   icon: HoldCurrentArrowIcon
  // },
  // {
  //   name: "Hold Prior Wait",
  //   displayName: "Hold previous, wait",
  //   type: "control",
  //   icon: HoldPreviousArrowIcon
  // },
  // {
  //   name: "Output Zero Wait",
  //   displayName: "Hold 0, wait",
  //   type: "control",
  //   icon: HoldZeroArrowIcon
  // }
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
    name: "Light",
    type: "light",
    units: "lux",
    icon: LightIcon
  },
  // {
  //   name: "O₂",
  //   type: "O2",
  //   units: "%",
  //   icon: O2Icon
  // },
  // {
  //   name: "Soil Moisture",
  //   type: "soil-moisture",
  //   units: "",
  //   icon: MoistureIcon
  // },
  // {
  //   name: "Particulates",
  //   type: "particulates",
  //   units: "PM2.5",
  //   icon: ParticulatesIcon
  // },
  {
    name: "EMG",
    type: "emg-reading",
    units: "mV",
    icon: EMGIcon,
    decimalPlaces: 0
  },
  {
    name: "Surface Pressure",
    type: "fsr-reading",
    units: "psi",
    icon: PressureIcon,
    decimalPlaces: 0
  },
  {
    name: "Pin Reading",
    type: "pin-reading",
    units: "mV",
    icon: SignalIcon,
    decimalPlaces: 0
  }
];

export const NodeDemoOutputTypes = [
  {
    name: "Light Bulb",
    icon: LightBulbIcon
  },
  {
    name: "Grabber",
    icon: GrabberIcon,
    displayName: "Gripper"
  },
  {
    name: "Advanced Grabber",
    icon: AdvancedGrabberIcon,
    displayName: "Advanced Gripper"
  },
  {
    name: "Fan",
    icon: FanIcon
  },
  {
    name: "Humidifier",
    icon: HumidIcon
  }
] as const;
export type NodeDemoOutputTypeNames = (typeof NodeDemoOutputTypes)[number]['name'];

export const NodeLiveOutputTypes = [
  {
    name: "Gripper 2.0",
    icon: GrabberIcon,
    angleBase: 130,
    sweep: 95
  },
  {
    name: "Grabber",
    icon: GrabberIcon,
    angleBase: 180,
    sweep: 60,
    displayName: "Gripper"
  },
  {
    name: "Humidifier",
    icon: HumidIcon,
    relayIndex: 2
  },
  {
    name: "Fan",
    icon: FanIcon,
    relayIndex: 1
  },
  {
    name: "Heat Lamp",
    icon: LightBulbIcon,
    relayIndex: 0
  },
  {
    name: "Servo",
    icon: ServoIcon,
    angleBase: 0,
    angleOffset: 30,
    angleScale: 2 / 3,
    sweep: 180
  }
];

function createNodeMicroBitHubs(arr: string[]) {
  return arr.map((id) => {
    return {
      id,
      name: `micro:bit hub ${id}`,
      active: false
    };
  });
}
const hubIdentifiers = ["a", "b", "c", "d", "e", "f", "g", "h"];
export const NodeMicroBitHubs = createNodeMicroBitHubs(hubIdentifiers);

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

export const baseLiveOutputOptions = {
  liveGripperOption: {
    active: true,
    icon: GrabberIcon,
    id: "bb-gripper",
    name: "Physical Gripper"
  },
  noDeviceLiveGripperOption: {
    active: true,
    id: "no-device-bb-gripper",
    name: "Physical Gripper",
    displayName: "⚠️ connect device",
  },
  liveServoOption: {
    active: true,
    icon: ServoIcon,
    id: "bb-servo",
    name: "Physical Servo"
  },
  noDeviceliveServoOption: {
    active: true,
    id: "no-devie-bb-servo",
    name: "Physical Servo",
    displayName: "⚠️ connect device",
  },
  genericWarningOption: {
    active: true,
    id: "no-outputs-found",
    name: "⚠️ connect device",
  }
};

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

export const ChartPlotColors = ["#d51eff", "#17ddd7", "#d3d114", "#3974ff", "#ff3d3d",
                               "#49d381", "#b05ecb", "#ffd56d", "#ffa56d", "#f57676",
                               "#fa73b0", "#eb80dc", "#cd88e4", "#d49600", "#d45200",
                               "#c60e0e", "#cc0860", "#b81da1", "#8d27ad", "#8b989f",
                               "#5dd581", "#3cc8f5", "#aeb9bf", "#92e3aa", "#7ad9f8",
                               "#5d6e77", "#31bc5a", "#0caadd"];
export const NodePlotColor = "#3f3f3f";
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

export const kSensorSelectMessage = "Select an input";
export const kSensorMissingMessage = "⚠️";
export const kAnimatedBinaryTypes = ["Fan", "Humidifier"];
export const kMicroBitHubRelaysIndexed =  ["Heat Lamp", "Fan", "Humidifier"];
export const kBinaryOutputTypes = [...kMicroBitHubRelaysIndexed, "Light Bulb"];
export const kGripperOutputTypes = ["Grabber", "Gripper", "Gripper 2.0"];
export const kServoOutputTypes = ["Servo"];
