import { types, Instance, SnapshotOut, detach } from "mobx-state-tree";
import { NumberNodeModel } from "../rete/nodes/number-node";
import { MathNodeModel } from "../rete/nodes/math-node";
import { CounterNodeModel } from "../rete/nodes/counter-node";

export const ConnectionModel = types
  .model("Connection", {
    id: types.identifier,
    source: types.string,
    sourceOutput: types.string,
    target: types.string,
    targetInput: types.string
  });
export interface IConnectionModel extends Instance<typeof ConnectionModel> {}

export const DataflowNodeModel = types.
  model("DataflowNode", {
    id: types.identifier,
    name: types.string,
    x: types.number,
    y: types.number,
    data: types.union(NumberNodeModel, MathNodeModel, CounterNodeModel)
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
export interface IDataflowNodeModel extends Instance<typeof DataflowNodeModel> {}

export const DataflowProgramModel = types.
  model("DataflowProgram", {
    id: types.maybe(types.string),
    nodes: types.map(DataflowNodeModel),
    connections: types.map(ConnectionModel)
  })
  .actions(self => ({
    addNode(node: IDataflowNodeModel) {
      self.nodes.put(node);
    },
    removeNode(id: IDataflowNodeModel["id"]) {
      self.nodes.delete(id);
    },
    addConnection(connection: IConnectionModel) {
      self.connections.put(connection);
    },
    removeConnection(id: IConnectionModel["id"]) {
      // We use detach here so Rete code can continue referring to this object
      return detach(self.connections.get(id));
    }
  }));
export interface DataflowProgramModelType extends Instance<typeof DataflowProgramModel> {}
export interface DataflowProgramSnapshotOut extends SnapshotOut<typeof DataflowProgramModel> {}
