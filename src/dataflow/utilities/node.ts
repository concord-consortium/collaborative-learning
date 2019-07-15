export const NodeOperationTypes = [
  {
    name: "add",
    type: "math",
    method: (n1: number, n2: number) => n1 + n2
  },
  {
    name: "subtract",
    type: "math",
    method: (n1: number, n2: number) => n1 - n2
  },
  {
    name: "multiply",
    type: "math",
    method: (n1: number, n2: number) => n1 * n2
  },
  {
    name: "divide",
    type: "math",
    method: (n1: number, n2: number) => n1 / n2
  },
  {
    name: "absolute value",
    type: "transform",
    method: (n1: number, n2: number) => Math.abs(n1)
  },
  {
    name: "negation",
    type: "transform",
    method: (n1: number, n2: number) => 0 - n1
  },
  {
    name: "not",
    type: "transform",
    method: (n1: number, n2: number) => n1 ? 0 : 1
  },
  {
    name: "greater than",
    type: "logic",
    method: (n1: number, n2: number) => +(n1 > n2)
  },
  {
    name: "less than",
    type: "logic",
    method: (n1: number, n2: number) => +(n1 < n2)
  },
  {
    name: "greater than or equal to",
    type: "logic",
    method: (n1: number, n2: number) => +(n1 >= n2)
  },
  {
    name: "less than or equal to",
    type: "logic",
    method: (n1: number, n2: number) => +(n1 <= n2)
  },
  {
    name: "equal",
    type: "logic",
    method: (n1: number, n2: number) => +(n1 === n2)
  },
  {
    name: "not equal",
    type: "logic",
    method: (n1: number, n2: number) => +(n1 !== n2)
  },
  {
    name: "and",
    type: "logic",
    method: (n1: number, n2: number) => n1 && n2 ? 1 : 0
  },
  {
    name: "or",
    type: "logic",
    method: (n1: number, n2: number) => n1 || n2 ? 1 : 0
  },
  {
    name: "nand",
    type: "logic",
    method: (n1: number, n2: number) => +(!(n1 && n2 ? 1 : 0))
  },
  {
    name: "xor",
    type: "logic",
    method: (n1: number, n2: number) => +((n1 ? 1 : 0) !== (n2 ? 1 : 0))
  }
];

export const NodeSensorTypes = [
  {
    name: "temperature",
    units: "°C",
  },
  {
    name: "humidity",
    units: "%",
  },
  {
    name: "CO₂",
    units: "PPM",
  },
  {
    name: "O₂",
    units: "%",
  },
  {
    name: "light",
    units: "lux",
  },
  {
    name: "soil moisture",
    units: "",
  },
  {
    name: "particulates",
    units: "PM2.5",
  },
];

export interface NodeChannelInfo {
  hubId: string;
  hubName: string;
  channelId: string;
  type: string;
  units: string;
}
