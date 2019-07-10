export const NodeOperationInfo = [
  {
    name: "add",
    type: "arithmetic",
    method: (n1: number, n2: number) => n1 + n2
  },
  {
    name: "subtract",
    type: "arithmetic",
    method: (n1: number, n2: number) => n1 - n2
  },
  {
    name: "multiply",
    type: "arithmetic",
    method: (n1: number, n2: number) => n1 * n2
  },
  {
    name: "divide",
    type: "arithmetic",
    method: (n1: number, n2: number) => n1 / n2
  },
  {
    name: "absolute value",
    type: "unary arithmetic",
    method: (n1: number, n2: number) => Math.abs(n1)
  },
  {
    name: "not",
    type: "unary arithmetic",
    // this is the dataflow 2.0 implementation of "NOT" implemented in 2017
    // ref: https://github.com/concord-consortium/flow-server/blob/master/static/flow/filters.js#L40
    method: (n1: number, n2: number) => 1 - n1
  },
  {
    name: "greater than",
    type: "comparison",
    method: (n1: number, n2: number) => +(n1 > n2)
  },
  {
    name: "less than",
    type: "comparison",
    method: (n1: number, n2: number) => +(n1 < n2)
  },
  {
    name: "equal",
    type: "comparison",
    method: (n1: number, n2: number) => +(n1 === n2)
  },
  {
    name: "not equal",
    type: "comparison",
    method: (n1: number, n2: number) => +(n1 !== n2)
  },
  {
    name: "and",
    type: "logic",
    // this is the dataflow 2.0 implementation of "AND" implemented in 2017
    // ref: https://github.com/concord-consortium/flow-server/blob/master/static/flow/filters.js#L28
    // tslint:disable-next-line:no-bitwise
    method: (n1: number, n2: number) => n1 & n2
  },
  {
    name: "or",
    type: "logic",
    // this is the dataflow 2.0 implementation of "OR" implemented in 2017
    // ref: https://github.com/concord-consortium/flow-server/blob/master/static/flow/filters.js#L32
    // tslint:disable-next-line:no-bitwise
    method: (n1: number, n2: number) => n1 | n2
  },
  {
    name: "nand",
    type: "logic",
    // this is the dataflow 2.0 implementation of "NAND" implemented in 2017
    // ref: https://github.com/concord-consortium/flow-server/blob/master/static/flow/filters.js#L44
    // tslint:disable-next-line:no-bitwise
    method: (n1: number, n2: number) => 1 - (n1 & n2)
  },
  {
    name: "xor",
    type: "logic",
    // this is the dataflow 2.0 implementation of "XOR" implemented in 2017
    // ref: https://github.com/concord-consortium/flow-server/blob/master/static/flow/filters.js#L36
    // tslint:disable-next-line:no-bitwise
    method: (n1: number, n2: number) => n1 ^ n2
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
    name: "CO2",
    units: "PPM",
  },
  {
    name: "O2",
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
