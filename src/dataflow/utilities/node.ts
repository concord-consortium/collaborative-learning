export const NodeOperationTypes = [
  {
    name: "add",
    type: "math",
    method: (n1: number, n2: number) => n1 + n2,
    numberSentence: (n1: number, n2: number) => `${n1} + ${n2} = `,
    icon: "icon-add"
  },
  {
    name: "subtract",
    type: "math",
    method: (n1: number, n2: number) => n1 - n2,
    numberSentence: (n1: number, n2: number) => `${n1} - ${n2} = `,
    icon: "icon-subtract"
  },
  {
    name: "multiply",
    type: "math",
    method: (n1: number, n2: number) => n1 * n2,
    numberSentence: (n1: number, n2: number) => `${n1} * ${n2} = `,
    icon: "icon-multiply"
  },
  {
    name: "divide",
    type: "math",
    method: (n1: number, n2: number) => n1 / n2,
    numberSentence: (n1: number, n2: number) => `${n1} / ${n2} = `,
    icon: "icon-divide"
  },
  {
    name: "absolute value",
    type: "transform",
    method: (n1: number, n2: number) => Math.abs(n1),
    numberSentence: (n1: number, n2: number) => `|${n1}| = `,
    icon: "icon-absolute-value"
  },
  {
    name: "negation",
    type: "transform",
    method: (n1: number, n2: number) => 0 - n1,
    numberSentence: (n1: number, n2: number) => `-(${n1}) = `,
    icon: "icon-negation"
  },
  {
    name: "not",
    type: "transform",
    method: (n1: number, n2: number) => n1 ? 0 : 1,
    numberSentence: (n1: number, n2: number) => `!${n1} ⇒ `,
    icon: "icon-not"
  },
  {
    name: "greater than",
    type: "logic",
    method: (n1: number, n2: number) => +(n1 > n2),
    numberSentence: (n1: number, n2: number) => `${n1} > ${n2} ⇒ `,
    icon: "icon-greater-than"
  },
  {
    name: "less than",
    type: "logic",
    method: (n1: number, n2: number) => +(n1 < n2),
    numberSentence: (n1: number, n2: number) => `${n1} < ${n2} ⇒ `,
    icon: "icon-less-than"
  },
  {
    name: "greater than or equal to",
    type: "logic",
    method: (n1: number, n2: number) => +(n1 >= n2),
    numberSentence: (n1: number, n2: number) => `${n1} >= ${n2} ⇒ `,
    icon: "icon-greater-than-or-equal-to"
  },
  {
    name: "less than or equal to",
    type: "logic",
    method: (n1: number, n2: number) => +(n1 <= n2),
    numberSentence: (n1: number, n2: number) => `${n1} <= ${n2} ⇒ `,
    icon: "icon-less-than-or-equal-to"
  },
  {
    name: "equal",
    type: "logic",
    method: (n1: number, n2: number) => +(n1 === n2),
    numberSentence: (n1: number, n2: number) => `${n1} == ${n2} ⇒ `,
    icon: "icon-equal"
  },
  {
    name: "not equal",
    type: "logic",
    method: (n1: number, n2: number) => +(n1 !== n2),
    numberSentence: (n1: number, n2: number) => `${n1} != ${n2} ⇒ `,
    icon: "icon-not-equal"
  },
  {
    name: "and",
    type: "logic",
    method: (n1: number, n2: number) => n1 && n2 ? 1 : 0,
    numberSentence: (n1: number, n2: number) => `${n1} && ${n2} ⇒ `,
    icon: "icon-and"
  },
  {
    name: "or",
    type: "logic",
    method: (n1: number, n2: number) => n1 || n2 ? 1 : 0,
    numberSentence: (n1: number, n2: number) => `${n1} || ${n2} ⇒ `,
    icon: "icon-or"
  },
  {
    name: "nand",
    type: "logic",
    method: (n1: number, n2: number) => +(!(n1 && n2 ? 1 : 0)),
    numberSentence: (n1: number, n2: number) => `${n1} nand ${n2} ⇒ `,
    icon: "icon-nand"
  },
  {
    name: "xor",
    type: "logic",
    method: (n1: number, n2: number) => +((n1 ? 1 : 0) !== (n2 ? 1 : 0)),
    numberSentence: (n1: number, n2: number) => `${n1} xor ${n2} ⇒ `,
    icon: "icon-xor"
  }
];

export const NodeSensorTypes = [
  {
    name: "temperature",
    type: "temperature",
    units: "°C",
    icon: "icon-temperature"
  },
  {
    name: "humidity",
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
    name: "light",
    type: "light",
    units: "lux",
    icon: "icon-light"
  },
  {
    name: "soil moisture",
    type: "soil-moisture",
    units: "",
    icon: "icon-soil-moisture"
  },
  {
    name: "particulates",
    type: "particulates",
    units: "PM2.5",
    icon: "icon-particulates"
  },
];

export const NodeGeneratorTypes = [
  {
    name: "sine",
    method: (t: number, p: number, a: number, v: number) => Math.round(Math.sin(t * Math.PI / p) * a * 100) / 100,
    icon: "icon-sine-generator"
  },
  {
    name: "square",
    method: (t: number, p: number, a: number, v: number) => t % p < p / 2 ? 1 * a : 0,
    icon: "icon-square-generator"
  },
  {
    name: "triangle",
    method: (t: number, p: number, a: number, v: number) => (2 * a / p) * Math.abs(t % p - p / 2),
    icon: "icon-triangle-generator"
  },
  {
    name: "random walk",
    method: (t: number, p: number, a: number, v: number) => Math.random() > .5 ? v + 1 * a : v - 1 * a,
    icon: "icon-random-walk-generator"
  },
  {
    name: "noise",
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
  value: number;
}
