import { types, Instance } from "mobx-state-tree";

const ConnectionModel = types
  .model("Connection", {
    node: types.number,
    output: types.maybe(types.string),
    input: types.maybe(types.string),
    data: types.map(types.string)
  });
  
const SocketModel = types
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
  })
  .postProcessSnapshot((snapshot: any) => {
    if (!Array.isArray(snapshot.connections)) {
      return { connections: Object.values(snapshot.connections) };
    }
    return snapshot;
  });

const DataflowNodeDataModel = types.
  model("DataflowNodeData", {
    plot: types.maybe(types.boolean),
    nodeValue: types.maybe(types.number),
    recentValues: types.maybe(types.string),

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
  })
  .preProcessSnapshot((snapshot: any) => {
    let { nodeValue, recentValues, ...rest} = snapshot;
    // Make null and NaN become undefined when going into MST
    if ((nodeValue == null) || !isFinite(nodeValue)) {
      nodeValue = undefined;
    }
    // Store recentValues as a string instead of an array so there's only one patch per update
    if (Array.isArray(recentValues)) {
      recentValues = JSON.stringify(recentValues);
    }
    // recentValues = recentValues?.map((v: number | undefined) => (v != null) && isFinite(v) ? v : undefined);
    return { nodeValue, recentValues, ...rest };
  })
  .postProcessSnapshot((snapshot: any) => {
    if (snapshot.recentValues && !Array.isArray(snapshot.recentValues)) {
      const { recentValues, ...rest } = snapshot;
      return { recentValues: JSON.parse(recentValues), ...rest };
    }
    return snapshot;
  });

const DataflowNodeModel = types.
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
  })
  .postProcessSnapshot((snapshot: any) => {
    if (snapshot.x != null && snapshot.y != null) {
      const { x, y, ...rest } = snapshot;
      return { position: [x, y], ...rest };
    }
    return snapshot;
  });

export const DataflowProgramModel = types.
  model("DataflowProgram", {
    id: types.maybe(types.string),
    nodes: types.map(DataflowNodeModel)
  });

export type DataflowProgramModelType = Instance<typeof DataflowProgramModel>;
