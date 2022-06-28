
// TODO: Combine this with dataflow-node-model.ts

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
    connections: types.array(ConnectionModel)
  });
