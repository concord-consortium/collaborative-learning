import { types, Instance, SnapshotOut, detach, SnapshotIn } from "mobx-state-tree";
import { NumberNodeModel } from "../nodes/number-node";
import { MathNodeModel } from "../nodes/math-node";
import { CounterNodeModel } from "../nodes/counter-node";
import { LogicNodeModel } from "../nodes/logic-node";
import { GeneratorNodeModel } from "../nodes/generator-node";
import { DemoOutputNodeModel } from "../nodes/demo-output-node";
import { LiveOutputNodeModel } from "../nodes/live-output-node";
import { SensorNodeModel } from "../nodes/sensor-node";
import { NodeType, NodeTypes, kMaxNodeValues } from "./utilities/node";
import { TransformNodeModel } from "../nodes/transform-node";
import { TimerNodeModel } from "../nodes/timer-node";
import { ControlNodeModel } from "../nodes/control-node";
import { uniqueId } from "../../../utilities/js-utils";
import { BaseNodeModel, IBaseNodeModel } from "../nodes/base-node";
import { IDataSet } from "../../../models/data/data-set";
import { getAttributeIdForNode } from "./utilities/recording-utilities";
import { STATE_VERSION_CURRENT } from "./dataflow-state-versions";

export const ConnectionModel = types
  .model("Connection", {
    id: types.identifier,
    source: types.string,
    sourceOutput: types.string,
    target: types.string,
    targetInput: types.string
  });
export interface IConnectionModel extends Instance<typeof ConnectionModel> {}
export interface ConnectionModelSnapshotIn extends SnapshotIn<typeof ConnectionModel> {}

export const DataflowNodeModel = types.
  model("DataflowNode", {
    id: types.identifier,
    name: types.string,
    x: types.number,
    y: types.number,
    data: types.union(
      ControlNodeModel,
      CounterNodeModel,
      DemoOutputNodeModel,
      GeneratorNodeModel,
      LiveOutputNodeModel,
      LogicNodeModel,
      MathNodeModel,
      NumberNodeModel,
      SensorNodeModel,
      TimerNodeModel,
      TransformNodeModel,
    ) as typeof BaseNodeModel
  })
  .actions(self => ({
    setPosition(position: {x: number, y: number}) {
      self.x = position.x;
      self.y = position.y;
    }
  }))
  .preProcessSnapshot((snapshot: any) => {
    // TODO: is this needed anymore?
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

/**
 * Multiple ReteManagers might be running at the same time. We want to use a single
 * manager to process our nodes and update any volatile state. The ReteManagers
 * use DataflowProgramModel.processor volatile property to figure out which one
 * of them should actually do the processing.
 */
export interface DataflowProcessor {
  process(): void;
  /**
   * This is used so the system can prefer non readOnly processors
   */
  readOnly?: boolean;
  /**
   * This is used so the system can replace disposed processors
   */
  disposed: boolean;
}

export const DataflowProgramModel = types.
  model("DataflowProgram", {
    id: STATE_VERSION_CURRENT,
    nodes: types.map(DataflowNodeModel),
    connections: types.map(ConnectionModel),
    recentTicks: types.array(types.string),
  })
  .volatile(self => ({
    processor: undefined as DataflowProcessor | undefined
  }))
  .views(self => ({
    get currentTick() {
      const length = self.recentTicks.length;
      if (length === 0) return "";
      return self.recentTicks[length-1];
    },
    get recordedTicks() {
      return self.recentTicks.slice(0,-1);
    }
  }))
  .actions(self => ({
    clearRecentTicks() {
      self.recentTicks.clear();
    },
    addNewTick(newTick: string) {
      const { recentTicks, currentTick } = self;
      if (recentTicks.length > kMaxNodeValues) {
        recentTicks.shift();
      }
      recentTicks.push(newTick);
      self.nodes.forEach(node => {
        node.data.createNextTickEntry(currentTick, newTick, recentTicks);
      });
    }
  }))
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
    },
    // This action is used to wrap the changes in a single MST transaction
    // This could be generic, but a specific name is used so the recorded event has
    // a useful name.
    tickAndProcess(runner: () => void) {
      runner();
      // We add the new tick after the data and onTick methods have been called
      // this way any changes triggered by user actions will get stored in the
      // next tick instead of the one that was just added to the graph
      // This means that the graph should graph (recentTicks.length - 1) points.
      const newTick = uniqueId();
      self.addNewTick(newTick);
    },

    // This action is called after a change in the Rete diagram.
    // When a node is added, or removed, and a connection is added or removed.
    // FIXME: this will be recorded as a secondary history entry, so it will
    // break undo. We don't call the program's processor.process directly so
    // that the rete manager has a chance to update the main processor if
    // the previous main processor has gone away.
    processAfterProgramChange(runner: () => void) {
      runner();
    },
    setProcessor(processor: DataflowProcessor) {
      self.processor = processor;
    },
    playbackNodesWithCaseData(dataSet: IDataSet, playBackIndex: number) {
      self.clearRecentTicks();
      const startIndex = Math.max(playBackIndex - kMaxNodeValues, 0);

      for (let index = startIndex; index <= playBackIndex; index++) {
        self.addNewTick(index.toString());
        const caseId = dataSet.getCaseAtIndex(index)?.__id__;
        if (!caseId) break;
        let nodeIndex = 0;
        self.nodes.forEach((_node) => {
          const node = _node.data as IBaseNodeModel;
          const attrId = getAttributeIdForNode(dataSet, nodeIndex);
          const nodeValue = dataSet.getValue(caseId, attrId) as number;
          node.setNodeValue(nodeValue);
          nodeIndex++;
        });
      }

      // add one more tick so the last point is graphed
      self.addNewTick((playBackIndex+1).toString());
    }

  }))
  .actions(self => ({
    addNode(node: IDataflowNodeModel) {
      self.nodes.put(node);
      self.updateNodeNames();
    },
    addNodeSnapshot(nodeSnapshot: DataflowNodeSnapshotIn) {
      const node = self.nodes.put(nodeSnapshot);
      self.updateNodeNames();
      node.data.createNextTickEntry(undefined, self.currentTick);
      return node;
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
  }))
  .actions(self => ({
    removeNodeAndConnections(nodeId: string) {
      const connections = [...self.connections.values()].filter(c => {
        return c.source === nodeId || c.target === nodeId;
      });

      const removedConnections = [];
      for (const connection of connections) {
        removedConnections.push(connection);
        self.removeConnection(connection.id);
      }
      self.removeNode(nodeId);
      return removedConnections;
    }
  }));
export interface DataflowProgramModelType extends Instance<typeof DataflowProgramModel> {}
export interface DataflowProgramSnapshotOut extends SnapshotOut<typeof DataflowProgramModel> {}
