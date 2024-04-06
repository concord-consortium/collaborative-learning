import { types, Instance, SnapshotOut, detach, SnapshotIn } from "mobx-state-tree";
import { NumberNodeModel } from "../rete/nodes/number-node";
import { MathNodeModel } from "../rete/nodes/math-node";
import { CounterNodeModel } from "../rete/nodes/counter-node";
import { LogicNodeModel } from "../rete/nodes/logic-node";
import { GeneratorNodeModel } from "../rete/nodes/generator-node";
import { DemoOutputNodeModel } from "../rete/nodes/demo-output-node";
import { LiveOutputNodeModel } from "../rete/nodes/live-output-node";
import { SensorNodeModel } from "../rete/nodes/sensor-node";
import { NodeType, NodeTypes } from "./utilities/node";

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
    data: types.union(
      CounterNodeModel,
      DemoOutputNodeModel,
      GeneratorNodeModel,
      LiveOutputNodeModel,
      LogicNodeModel,
      MathNodeModel,
      NumberNodeModel,
      SensorNodeModel)
  })
  .preProcessSnapshot((snapshot: any) => {
    // Turn position into x and y because MST has weird issues with arrays
    if (Array.isArray(snapshot.position)) {
      const { position: [x, y], ...rest } = snapshot;
      return { x, y, ...rest };
    }
    return snapshot;
  });
export interface DataflowNodeSnapshotIn extends SnapshotIn<typeof DataflowNodeModel> {}
export interface DataflowNodeSnapshotOut extends SnapshotOut<typeof DataflowNodeModel> {}
export interface IDataflowNodeModel extends Instance<typeof DataflowNodeModel> {}

export const DataflowProgramModel = types.
  model("DataflowProgram", {
    id: types.maybe(types.string),
    nodes: types.map(DataflowNodeModel),
    connections: types.map(ConnectionModel)
  })
  .actions(self => ({
    // This isn't great but it is how the unique node names have been working
    updateNodeNames(){
      let idx = 1;
      self.nodes.forEach((node) => {
        const nodeType = NodeTypes.find( (n: NodeType) => n.name === node.name);
        const displayNameBase = nodeType ? nodeType.displayName : node.name;
        node.data.orderedDisplayName = displayNameBase + " " + idx;
        idx++;
      });
    }
  }))
  .actions(self => ({
    addNode(node: IDataflowNodeModel) {
      self.nodes.put(node);
      self.updateNodeNames();
    },
    addNodeSnapshot(node: DataflowNodeSnapshotIn) {
      self.nodes.put(node);
      self.updateNodeNames();
    },
    removeNode(id: IDataflowNodeModel["id"]) {
      self.nodes.delete(id);
      self.updateNodeNames();
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
