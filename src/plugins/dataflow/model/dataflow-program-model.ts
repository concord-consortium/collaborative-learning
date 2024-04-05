import { cloneDeep } from "lodash";
import { types, Instance, getSnapshot, SnapshotOut } from "mobx-state-tree";

const ConnectionModel = types
  .model("Connection", {
    node: types.number,
    output: types.maybe(types.string),
    input: types.maybe(types.string),
    data: types.map(types.string)
  });

// The postProcessXSnapshotForRete functions are used to convert a program snapshot from
// MST/firebase to a format rete will accept. Comments in preProcessSnapshot() functions
// in corresponding models describe what these functions are undoing.

const postProcessSocketSnapshotForRete = (snapshot: DataflowSocketSnapshotOut) => {
  return { connections: Object.values(snapshot.connections) };
};

const postProcessSocketsSnapshotForRete = (snapshot: Record<string, DataflowSocketSnapshotOut>) => {
  const processedSockets: any = {};
  for (const key in snapshot) {
    processedSockets[key] = postProcessSocketSnapshotForRete(snapshot[key]);
  }
  return processedSockets;
};

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

export interface DataflowSocketSnapshotOut extends SnapshotOut<typeof SocketModel> {}

const DataflowNodeDataModel = types.
  model("DataflowNodeData", {
    plot: types.maybe(types.boolean),
    encodedDisplayName: types.maybe(types.string),

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

    // Control
    controlOperator: types.maybe(types.string),
    waitDuration: types.maybe(types.number),

    // Demo Output
    outputType: types.maybe(types.string),
    demoOutput: types.maybe(types.number),

    // Live Output
    hubSelect: types.maybe(types.string),
    liveOutputType: types.maybe(types.string),
    liveOutput: types.maybe(types.number),
  });

const postProcessNodeSnapshotForRete = (snapshot: DataflowNodeSnapshotOut) => {
  const { x, y, inputs, outputs, ...rest } = snapshot;
  return {
    position: [x, y],
    inputs: postProcessSocketsSnapshotForRete(inputs),
    outputs: postProcessSocketsSnapshotForRete(outputs),
    ...rest
  };
};

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

export interface DataflowNodeSnapshotOut extends SnapshotOut<typeof DataflowNodeModel> {}

// A model for keeping the values separate from the structure of a node.
const DataflowValueModel = types.
  model("DataflowValue", {
    // Stores values the node watches for minigraphs
    currentValues: types.map(types.maybe(types.number)),
    // Map of JSON.stringified arrays of recent node values
    recentValues: types.map(types.string)
  });

const postProcessProgramSnapshotForRete = (snapshot: DataflowProgramSnapshotOut) => {
  const { nodes, values, ...rest } = snapshot;
  const newNodes = cloneDeep(nodes) as any;
  const keys = Object.keys(newNodes);
  keys.forEach((key: string) => {
    newNodes[key] = postProcessNodeSnapshotForRete(newNodes[key]);
    const data = newNodes[key].data;
    data.recentValues = {};
    if ((values as any)?.[key]) {
      const { currentValues, recentValues } = (values as any)[key];
      Object.keys(currentValues).forEach((valueKey: string) => {
        data[valueKey] = currentValues[valueKey];
      });
      Object.keys(recentValues).forEach((recentValuesKey: string) => {
        data.recentValues[recentValuesKey] = JSON.parse(recentValues[recentValuesKey]);
      });
    }
  });
  return { nodes: newNodes, ...rest };
};

export const DataflowProgramModel = types.
  model("DataflowProgram", {
    id: types.maybe(types.string),
    nodes: types.map(DataflowNodeModel),
    // values has the same keys as nodes, where the values (current and recent) for the
    // node at nodes[key] is stored at values[key]
    values: types.map(DataflowValueModel)
  })
  .views(self => ({
    get snapshotForRete() {
      return postProcessProgramSnapshotForRete(getSnapshot(self));
    }
  }))
  .preProcessSnapshot((snapshot: any) => {
    const { nodes, ...rest } = cloneDeep(snapshot);
    const values: { [key: string]: any } = {};
    if (nodes) {
      const keys = Object.keys(nodes);
      keys.forEach((key: string) => {
        const { recentValues, watchedValues, ...restData } = nodes[key].data;
        const processedRecentValues: Record<string, string> = {};
        const currentValues: Record<string, number | undefined> = {};
        if (watchedValues && recentValues) {
          Object.keys(watchedValues).forEach((watchedKey: string) => {
            if (recentValues[watchedKey]) {
              processedRecentValues[watchedKey] = JSON.stringify(recentValues[watchedKey]);
            } else {
              processedRecentValues[watchedKey] = "[]";
            }
            const currentValue = restData[watchedKey];
            // Make null and NaN become undefined when going into MST
            currentValues[watchedKey] = currentValue === null || !isFinite(currentValue) ? undefined : currentValue;
          });
        }
        values[key] = {
          // Store all watched values in the currentValues map
          currentValues,
          // Store recentValues as a string instead of an array so there's only one patch per update
          recentValues: processedRecentValues
        };
        nodes[key].data = { ...restData };
      });
    }
    return { nodes, values, ...rest };
  });

export interface DataflowProgramModelType extends Instance<typeof DataflowProgramModel> {}
export interface DataflowProgramSnapshotOut extends SnapshotOut<typeof DataflowProgramModel> {}
