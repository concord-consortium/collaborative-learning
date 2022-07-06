import { types, Instance } from "mobx-state-tree";

const ConnectionModel = types
  .model("Connection", {
    node: types.number,
    output: types.maybe(types.string),
    input: types.maybe(types.string),
    data: types.map(types.string)
  });
  
export const SocketModel = types
  .model("Socket", {
    connections: types.map(ConnectionModel)
  })
  .preProcessSnapshot((snapshot: any) => {
    // Connections are stored in rete as an array, but MST works better with maps
    if (Array.isArray(snapshot.connections)) {
      const connections: any = {};
      snapshot.connections.forEach((connection: any) => {
        connections[`${connection.node}-${connection.output}-${connection.input}`] = connection;
      });
      return { connections };
    }
    return snapshot;
  });

export interface DataflowSocketModelType extends Instance<typeof SocketModel> {}

const DataflowNodeDataModel = types.
  model("DataflowNodeData", {
    plot: types.maybe(types.boolean),

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

export const DataflowNodeModel = types.
  model("DataflowNode", {
    id: types.number,
    name: types.string,
    x: types.number,
    y: types.number,
    inputs: types.map(SocketModel),
    outputs: types.map(SocketModel),
    data: DataflowNodeDataModel,
  })
  .preProcessSnapshot((snapshot: any) => {
    // Turn position into x and y because MST has weird issues with arrays
    if (Array.isArray(snapshot.position)) {
      const { position: [x, y], ...rest } = snapshot;
      return { x, y, ...rest };
    }
    return snapshot;
  });

export interface DataflowNodeModelType extends Instance<typeof DataflowNodeModel> {}

// A model for keeping the values separate from the structure of a node.
const DataflowValueModel = types.
  model("DataflowValue", {
    nodeValue: types.maybe(types.number),
    // JSON.stringified array of recent node values
    recentValues: types.optional(types.string, "[]")
  });

export const DataflowProgramModel = types.
  model("DataflowProgram", {
    id: types.maybe(types.string),
    nodes: types.map(DataflowNodeModel),
    // values has the same keys as nodes, where the values (current and recent) for the
    // node at nodes[key] is stored at values[key]
    values: types.map(DataflowValueModel)
  })
  .preProcessSnapshot((snapshot: any) => {
    const { nodes, ...rest } = snapshot;
    const values: { [key: string]: any } = {};
    if (nodes) {
      const keys = Object.keys(nodes);
      keys.forEach((key: string) => {
        const { nodeValue, recentValues, ...restData } = nodes[key].data;
        values[key] = {
          // Make null and NaN become undefined when going into MST
          nodeValue: ((nodeValue == null) || !isFinite(nodeValue)) ? undefined : nodeValue,
          // Store recentValues as a string instead of an array so there's only one patch per update
          recentValues: JSON.stringify(recentValues)
        };
        nodes[key].data = { ...restData };
      });
    }
    return { nodes, values, ...rest };
  });

export interface DataflowProgramModelType extends Instance<typeof DataflowProgramModel> {}
