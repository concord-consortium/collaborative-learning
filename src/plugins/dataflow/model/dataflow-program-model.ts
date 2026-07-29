import { types, Instance, SnapshotOut, SnapshotIn } from "mobx-state-tree";
import { NumberNodeModel } from "../nodes/number-node";
import { MathNodeModel } from "../nodes/math-node";
import { CounterNodeModel } from "../nodes/counter-node";
import { LogicNodeModel } from "../nodes/logic-node";
import { GeneratorNodeModel } from "../nodes/generator-node";
import { DemoOutputNodeModel } from "../nodes/demo-output-node";
import { LiveOutputNodeModel } from "../nodes/live-output-node";
import { SensorNodeModel } from "../nodes/sensor-node";
import { kMaxNodeValues } from "./utilities/node";
import { TransformNodeModel } from "../nodes/transform-node";
import { TimerNodeModel } from "../nodes/timer-node";
import { ControlNodeModel } from "../nodes/control-node";
import { uniqueId } from "../../../utilities/js-utils";
import { BaseNodeModel, IBaseNodeModel } from "../nodes/base-node";
import { IDataSet } from "../../../models/data/data-set";
import { getAttributeIdForNode } from "./utilities/recording-utilities";
import { getNewIndexedName } from "../nodes/utilities/indexed-name";
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

/**
 * A "super node" grouping: a labeled, collapsible container that references member node ids.
 * Members stay in the flat `nodes` map (so the rete engine still sees a flat graph); the group is
 * a parallel organizational layer. Adding this map is backward-compatible — old snapshots without
 * `groups` load with an empty map, so no version bump is needed.
 */
export const GroupModel = types
  .model("Group", {
    id: types.identifier,
    label: types.string,
    // Member node ids, stored as a map used as a set (key = value = node id). A map gives O(1)
    // add/remove/has and merges more cleanly than an array in collaborative (group) documents.
    // Membership is mirrored on each node via `groupId` so node→group lookup is also O(1).
    nodeIds: types.map(types.string),
    collapsed: types.optional(types.boolean, false),
  })
  .actions(self => ({
    setLabel(label: string) {
      self.label = label;
    },
    setCollapsed(collapsed: boolean) {
      self.collapsed = collapsed;
    },
    addNodeId(nodeId: string) {
      self.nodeIds.set(nodeId, nodeId);
    },
    removeNodeId(nodeId: string) {
      self.nodeIds.delete(nodeId);
    }
  }));
export interface IGroupModel extends Instance<typeof GroupModel> {}
export interface GroupModelSnapshotIn extends SnapshotIn<typeof GroupModel> {}

/**
 * The ConnectionModelWrapper is needed because Rete keeps references to the
 * connections. After a connection model is removed from the MST tree by an applied
 * snapshot, Rete still tries ot access its id. So we wrap the connection and keep
 * a copy of the id. This way the actual MST object is not referenced just to get
 * the id.
 */
export class ConnectionModelWrapper {
  public id;
  constructor(
    public model: IConnectionModel
  ) {
    this.id = model.id;
  }

  get source() { return this.model.source; }
  get sourceOutput() { return this.model.sourceOutput; }
  get target() { return this.model.target; }
  get targetInput() { return this.model.targetInput; }
}

export const DataflowNodeModel = types.
  model("DataflowNode", {
    id: types.identifier,
    name: types.string,
    x: types.number,
    y: types.number,
    // The group this node belongs to, if any. Mirrors GroupModel.nodeIds so node→group lookup is O(1);
    // maintained by createGroup / ungroupGroup / removeNodeAndConnections.
    groupId: types.maybe(types.string),
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
    ) as unknown as typeof BaseNodeModel
  })
  .volatile(self => ({
    // These are stored so annotations can update as the node moves around
    liveX: NaN,
    liveY: NaN,
  }))
  .views(self => ({
    // Current position: the live (mid-drag) value when set, else the committed x/y. Centralizes the
    // x-vs-liveX selection that bounds calculations need, so it lives in one place.
    get currentX() { return Number.isFinite(self.liveX) ? self.liveX : self.x; },
    get currentY() { return Number.isFinite(self.liveY) ? self.liveY : self.y; },
  }))
  .actions(self => ({
    setPosition(position: {x: number, y: number}) {
      self.x = self.liveX = position.x;
      self.y = self.liveY = position.y;
    },
    setLivePosition(position: {x: number, y: number}) {
      self.liveX = position.x;
      self.liveY = position.y;
    },
    setGroupId(groupId?: string) {
      self.groupId = groupId;
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
    groups: types.map(GroupModel),
    recentTicks: types.array(types.string),
  })
  .volatile(self => ({
    processor: undefined as DataflowProcessor | undefined,
    _connectionWrappers: {} as Record<string, ConnectionModelWrapper>
  }))
  .views(self => ({
    get currentTick() {
      const length = self.recentTicks.length;
      if (length === 0) return "";
      return self.recentTicks[length-1];
    },
    get recordedTicks() {
      return self.recentTicks.slice(0,-1);
    },
    getConnectionWrapper(id: string) {
      const connection = self.connections.get(id);
      if (!connection) return undefined;

      const existingWrapper = self._connectionWrappers[id];
      if (existingWrapper) return existingWrapper;

      const newWrapper = new ConnectionModelWrapper(connection);
      self._connectionWrappers[id] = newWrapper;
      return newWrapper;
    }
  }))
  .views(self => ({
    get connectionWrappers() {
      return [...self.connections.keys()].map(id => self.getConnectionWrapper(id)!);
    },
    getGroupForNode(nodeId: string) {
      const node = self.nodes.get(nodeId);
      return node?.groupId ? self.groups.get(node.groupId) : undefined;
    },
    // Next default group label ("Group 1", "Group 2", ...) based on existing labels. Uses the same
    // helper that names nodes, so groups and blocks index identically.
    getNextGroupLabel() {
      return getNewIndexedName([...self.groups.values()].map(g => g.label), "Group");
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

          // The user might have messed with the table, so the attribute might not exist
          if (attrId) {
            const nodeValue = dataSet.getValue(caseId, attrId) as number;
            node.setNodeValue(nodeValue);
          }

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
    },
    addNodeSnapshot(nodeSnapshot: DataflowNodeSnapshotIn) {
      const node = self.nodes.put(nodeSnapshot);
      node.data.createNextTickEntry(undefined, self.currentTick);
      return node;
    },
    addConnection(connection: IConnectionModel) {
      self.connections.put(connection);
    },
    removeConnection(id: IConnectionModel["id"]) {
      self.connections.delete(id);
      if (self._connectionWrappers[id]) {
        delete self._connectionWrappers[id];
      }
    }
  }))
  .actions(self => ({
    // Dissolve a single group: clear each member node's groupId, then remove the group. In its own
    // actions block so createGroup / ungroupGroups / removeNodeAndConnections can call it via `self`.
    ungroupGroup(id: string) {
      const group = self.groups.get(id);
      if (!group) return;
      [...group.nodeIds.keys()].forEach(nodeId => self.nodes.get(nodeId)?.setGroupId(undefined));
      self.groups.delete(id);
    }
  }))
  .actions(self => ({
    // Create a "super node" group from the given node ids. Requires ≥2 nodes that exist and are
    // not already in a group; returns the new group (or undefined if the request is invalid).
    createGroup(nodeIds: string[], label?: string) {
      // Dedupe before counting: nodeIds is a map, so a repeated id would pass the >=2 check but
      // yield a single member, leaving a group that breaks the >=2 invariant everything else assumes.
      const validIds = [...new Set(nodeIds)]
        .filter(nodeId => self.nodes.has(nodeId) && !self.getGroupForNode(nodeId));
      if (validIds.length < 2) return undefined;
      const id = uniqueId();
      const group = self.groups.put({ id, label: label ?? self.getNextGroupLabel(), collapsed: false });
      validIds.forEach(nodeId => {
        group.addNodeId(nodeId);
        self.nodes.get(nodeId)?.setGroupId(id);
      });
      return group;
    },
    ungroupGroups(ids: string[]) {
      ids.forEach(id => self.ungroupGroup(id));
    },
    // Remove a node, keeping group membership consistent: drop it from its group and dissolve the
    // group if that leaves it with fewer than 2 members. The bookkeeping lives here, rather than
    // only in removeNodeAndConnections, so that every removal path is consistent by construction —
    // NodeEditorMST.clear() calls this directly, and used to leave groups whose nodeIds referenced
    // deleted nodes behind in the saved document. Defined after ungroupGroup so it can use `self`.
    removeNode(id: IDataflowNodeModel["id"]) {
      // Capture the group first: getGroupForNode reads node.groupId, which goes away with the node.
      const group = self.getGroupForNode(id);
      self.nodes.delete(id);
      if (group) {
        group.removeNodeId(id);
        if (group.nodeIds.size < 2) self.ungroupGroup(group.id);
      }
    }
  }))
  .actions(self => ({
    removeNodeAndConnections(nodeId: string) {
      const connections = [...self.connections.values()].filter(c => {
        return c.source === nodeId || c.target === nodeId;
      });

      // We return the connection wrappers so they can be passed to
      // rete for cleanup
      const removedConnections = [];
      for (const connection of connections) {
        const wrapper = self.getConnectionWrapper(connection.id);
        wrapper && removedConnections.push(wrapper);
        self.removeConnection(connection.id);
      }

      // removeNode handles the group bookkeeping and auto-dissolve.
      self.removeNode(nodeId);
      return removedConnections;
    }
  }));
export interface DataflowProgramModelType extends Instance<typeof DataflowProgramModel> {}
export interface DataflowProgramSnapshotOut extends SnapshotOut<typeof DataflowProgramModel> {}
