import { types } from "mobx-state-tree";

const ConnectionModel = types
  .model("Connection", {
    node: types.number,
    output: types.maybe(types.string),
    input: types.maybe(types.string),
    data: types.map(types.string)
  });
  
const SocketModel = types
  .model("Socket", {
    connections: types.array(ConnectionModel)
  });

const DataflowNodeDataModel = types.
  model("DataflowNodeData", {
    plot: types.maybe(types.boolean),
    nodeValue: types.maybeNull(types.number),
    recentValues: types.array(types.maybeNull(types.number)),

    // Sensor
    type: types.maybe(types.string),
    sensor: types.maybe(types.string),
    virtual: types.maybe(types.boolean),

    // Number
    nodeValueUnits: types.maybe(types.string),

    // Generator
    generatorType: types.maybe(types.string),
    amplitudeUnits: types.maybe(types.string),
    amplitude: types.maybe(types.number),
    periodUnits: types.maybe(types.string),
    period: types.maybe(types.number),

    // Timer
    timeOnUnits: types.maybe(types.string),
    timeOn: types.maybe(types.number),
    timeOffUnits: types.maybe(types.string),
    timeOff: types.maybe(types.number),

    // Math
    mathOperator: types.maybe(types.string),

    // Logic
    logicOperator: types.maybe(types.string),

    // Transform
    transformOperator: types.maybe(types.string),

    // Relay
    relayList: types.maybe(types.string),

    // Light Bulb
    lightbulb: types.maybe(types.number),

    // Data Storage
    datasetName: types.maybe(types.string),
    interval: types.maybe(types.string),
    inputKeys: types.array(types.string),
    // sequence1, sequence2, ...
  });

const DataflowNodeModel = types.
  model("DataflowNode", {
    id: types.number,
    name: types.string,
    position: types.array(types.number),
    inputs: types.map(SocketModel),
    outputs: types.map(SocketModel),
    data: DataflowNodeDataModel,
  });

export const DataflowProgramModel = types.
  model("DataflowProgram", {
    id: types.maybe(types.string),
    nodes: types.map(DataflowNodeModel)
  });
