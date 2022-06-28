import { types } from "mobx-state-tree";
import { SocketModel } from "./socket-model";

export const DataflowNodeDataModel = types.
  model("DataflowNodeData", {
    plot: types.boolean,
    // nodeValue: types.number,
    recentValues: types.array(types.maybeNull(types.number)),
    // Timer
    timeOnUnits: types.maybe(types.string),
    timeOn: types.maybe(types.number),
    timeOffUnits: types.maybe(types.string),
    timeOff: types.maybe(types.number),
    // Sensor
    type: types.maybe(types.string),
    sensor: types.maybe(types.string),
    virtual: types.maybe(types.boolean),
    // Generator
    generatorType: types.maybe(types.string),
    amplitudeUnits: types.maybe(types.string),
    amplitude: types.maybe(types.number),
    periodUnits: types.maybe(types.string),
    period: types.maybe(types.number),
  });

export const DataflowNodeModel = types.
  model("DataflowNode", {
    id: types.number,
    name: types.string,
    position: types.array(types.number),
    inputs: types.map(SocketModel),
    outputs: types.map(SocketModel),
    data: DataflowNodeDataModel,
  })
  .actions(self => ({
    setName(name: string) {
      self.name = name;
    },
    setPosition(position: [number, number]) {
      self.position.replace(position);
    },
    /*
    setInputs(inputs: {string: any}) {
      self.setSockets(inputs, 'inputs');
    },
    setOutputs(outputs: {string: any}) {
      self.setSockets(outputs, 'outputs');
    },
    setSockets(sockets: {string: any}, socketType: 'inputs' | 'outputs') {
      const selfSockets = socketType === 'inputs' ? self.inputs : self.outputs;

      // Update old sockets and add new sockets
      for (const name in sockets) {
        const socket = (sockets as any)[name];
        const socketModel = selfSockets.get(name);
        if (socketModel) {
          // Update socket
        } else {
          const newSocket = SocketModel.create({
            name,
          });
          newSocket.updateConnections(socket.connections);
          selfSockets.set(name, newSocket);
        }
      }

      // Remove deleted sockets
      const removedSockets: string[] = [];
      selfSockets.forEach((socket, name) => {
        if (!Object.keys(sockets).includes(name)) {
          removedSockets.push(name);
        }
      });
      removedSockets.forEach(name => selfSockets.delete(name));
    },
    setData(data: string) {
      self.data = data;
    }
    */
  }));

// const NodeSnapshotProcessor = types.snapshotProcessor(DataflowNodeModel, {
//   preProcessor(sn: {[key: string]: {id: number}}) {
//     const newSnapshot = {};
//     for (const [key, value] of Object.entries(sn)) {
//       newSnapshot[key] = { ...value, id: value.id.toString() };
//     }
//     return newSnapshot;
//   }
// });
