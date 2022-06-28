import { types } from 'mobx-state-tree';

export const ConnectionModel = types
  .model("Connection", {
    node: types.number,
    output: types.maybe(types.string),
    input: types.maybe(types.string),
    data: types.map(types.string)
  });

export const SocketModel = types
  .model("Socket", {
    // name: types.string,
    connections: types.array(ConnectionModel)
  });
  // })
  // .actions(self => ({
  //   updateConnections(connections: any[]) {
  //     self.connections = [];

  //     for (const connection of connections) {
  //       self.connections.push(ConnectionModel.create(connection));
  //     }
  //   }
  // }));
