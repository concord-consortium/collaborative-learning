export const NodeTypes = [
  {
    name: "Sensor",
  },
  {
    name: "Number",
  },
  {
    name: "Generator",
  },
  {
    name: "Math",
  },
  {
    name: "Logic",
  },
  {
    name: "Transform",
  },
  {
    name: "Relay",
  },
  {
    name: "Data Storage",
  },
];

export const NodeOperationTypes = [
  {
    name: "Add",
    type: "math",
    method: (n1: number, n2: number) => n1 + n2,
    numberSentence: (n1: string, n2: string) => `${n1} + ${n2} = `,
    icon: "icon-add"
  },
  {
    name: "Subtract",
    type: "math",
    method: (n1: number, n2: number) => n1 - n2,
    numberSentence: (n1: string, n2: string) => `${n1} - ${n2} = `,
    icon: "icon-subtract"
  },
  {
    name: "Multiply",
    type: "math",
    method: (n1: number, n2: number) => n1 * n2,
    numberSentence: (n1: string, n2: string) => `${n1} * ${n2} = `,
    icon: "icon-multiply"
  },
  {
    name: "Divide",
    type: "math",
    method: (n1: number, n2: number) => n1 / n2,
    numberSentence: (n1: string, n2: string) => `${n1} / ${n2} = `,
    icon: "icon-divide"
  },
  {
    name: "Absolute Value",
    type: "transform",
    method: (n1: number, n2: number) => Math.abs(n1),
    numberSentence: (n1: string, n2: string) => `|${n1}| = `,
    icon: "icon-absolute-value"
  },
  {
    name: "Negation",
    type: "transform",
    method: (n1: number, n2: number) => 0 - n1,
    numberSentence: (n1: string, n2: string) => `-(${n1}) = `,
    icon: "icon-negation"
  },
  {
    name: "Not",
    type: "transform",
    method: (n1: number, n2: number) => n1 ? 0 : 1,
    numberSentence: (n1: string, n2: string) => `!${n1} ⇒ `,
    icon: "icon-not"
  },
  {
    name: "Greater Than",
    type: "logic",
    method: (n1: number, n2: number) => +(n1 > n2),
    numberSentence: (n1: string, n2: string) => `${n1} > ${n2} ⇒ `,
    icon: "icon-greater-than"
  },
  {
    name: "Less Than",
    type: "logic",
    method: (n1: number, n2: number) => +(n1 < n2),
    numberSentence: (n1: string, n2: string) => `${n1} < ${n2} ⇒ `,
    icon: "icon-less-than"
  },
  {
    name: "Greater Than Or Equal To",
    type: "logic",
    method: (n1: number, n2: number) => +(n1 >= n2),
    numberSentence: (n1: string, n2: string) => `${n1} >= ${n2} ⇒ `,
    icon: "icon-greater-than-or-equal-to"
  },
  {
    name: "Less Than Or Equal To",
    type: "logic",
    method: (n1: number, n2: number) => +(n1 <= n2),
    numberSentence: (n1: string, n2: string) => `${n1} <= ${n2} ⇒ `,
    icon: "icon-less-than-or-equal-to"
  },
  {
    name: "Equal",
    type: "logic",
    method: (n1: number, n2: number) => +(n1 === n2),
    numberSentence: (n1: string, n2: string) => `${n1} == ${n2} ⇒ `,
    icon: "icon-equal"
  },
  {
    name: "Not Equal",
    type: "logic",
    method: (n1: number, n2: number) => +(n1 !== n2),
    numberSentence: (n1: string, n2: string) => `${n1} != ${n2} ⇒ `,
    icon: "icon-not-equal"
  },
  {
    name: "And",
    type: "logic",
    method: (n1: number, n2: number) => n1 && n2 ? 1 : 0,
    numberSentence: (n1: string, n2: string) => `${n1} && ${n2} ⇒ `,
    icon: "icon-and"
  },
  {
    name: "Or",
    type: "logic",
    method: (n1: number, n2: number) => n1 || n2 ? 1 : 0,
    numberSentence: (n1: string, n2: string) => `${n1} || ${n2} ⇒ `,
    icon: "icon-or"
  },
  {
    name: "Nand",
    type: "logic",
    method: (n1: number, n2: number) => +(!(n1 && n2 ? 1 : 0)),
    numberSentence: (n1: string, n2: string) => `${n1} nand ${n2} ⇒ `,
    icon: "icon-nand"
  },
  {
    name: "Xor",
    type: "logic",
    method: (n1: number, n2: number) => +((n1 ? 1 : 0) !== (n2 ? 1 : 0)),
    numberSentence: (n1: string, n2: string) => `${n1} xor ${n2} ⇒ `,
    icon: "icon-xor"
  }
];

export const NodeSensorTypes = [
  {
    name: "Temperature",
    type: "temperature",
    units: "°C",
    icon: "icon-temperature"
  },
  {
    name: "Humidity",
    type: "humidity",
    units: "%",
    icon: "icon-humidity"
  },
  {
    name: "CO₂",
    type: "CO2",
    units: "PPM",
    icon: "icon-co2"
  },
  {
    name: "O₂",
    type: "O2",
    units: "%",
    icon: "icon-o2"
  },
  {
    name: "Light",
    type: "light",
    units: "lux",
    icon: "icon-light"
  },
  {
    name: "Soil Moisture",
    type: "soil-moisture",
    units: "",
    icon: "icon-soil-moisture"
  },
  {
    name: "Particulates",
    type: "particulates",
    units: "PM2.5",
    icon: "icon-particulates"
  },
];

export const NodeGeneratorTypes = [
  {
    name: "Sine",
    method: (t: number, p: number, a: number, v: number) => Math.round(Math.sin(t * Math.PI / (p / 2)) * a * 100) / 100,
    icon: "icon-sine-generator"
  },
  {
    name: "Square",
    method: (t: number, p: number, a: number, v: number) => t % p < p / 2 ? 1 * a : 0,
    icon: "icon-square-generator"
  },
  {
    name: "Triangle",
    method: (t: number, p: number, a: number, v: number) => (2 * a / p) * Math.abs(t % p - p / 2),
    icon: "icon-triangle-generator"
  },
  {
    name: "Noise",
    method: (t: number, p: number, a: number, v: number) => Math.random() * a,
    icon: "icon-noise-generator"
  },
];

export interface NodeChannelInfo {
  hubId: string;
  hubName: string;
  channelId: string;
  type: string;
  units: string;
  plug: number;
  value: number;
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

export interface ProgramRunTime {
  text: string;
  val: number;
}
export interface IntervalTime extends ProgramRunTime {
  maxProgramRunTime: number;
}
export const DEFAULT_PROGRAM_TIME = 600;
export const ProgramRunTimes: ProgramRunTime[] = [
  {
    text: "1 min",
    val: 60
  },
  {
    text: "5 mins",
    val: 300
  },
  {
    text: "10 mins",
    val: 600
  },
  {
    text: "30 mins",
    val: 1800
  },
  {
    text: "1 hour",
    val: 3600
  },
  {
    text: "6 hours",
    val: 21600
  },
  {
    text: "1 day",
    val: 86400
  },
  {
    text: "5 days",
    val: 432000
  },
  {
    text: "30 days",
    val: 2592000
  }
];

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
