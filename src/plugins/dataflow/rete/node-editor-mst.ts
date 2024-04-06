import { NodeEditor } from "rete";
import { DataflowEngine } from "rete-engine";
import { structures } from "rete-structures";
import { onPatch } from "mobx-state-tree";
import { AreaExtra, Schemes } from "./rete-scheme";
import {
  DataflowNodeModel, IDataflowNodeModel, DataflowProgramModelType, ConnectionModel
} from "../model/dataflow-program-model";
import { NumberNode } from "./nodes/number-node";
import { MathNode } from "./nodes/math-node";
import { CounterNode } from "./nodes/counter-node";
import { LogicNode } from "./nodes/logic-node";
import { GeneratorNode } from "./nodes/generator-node";
import { IBaseNodeModel, NodeClass } from "./nodes/base-node";
import { uniqueId } from "../../../utilities/js-utils";
import { INodeServices } from "./service-types";
import { LogEventName } from "../../../lib/logger-types";
import { logTileChangeEvent } from "../../../models/tiles/log/log-tile-change-event";
import { AreaExtensions, AreaPlugin } from "rete-area-plugin";
import { DemoOutputNode } from "./nodes/demo-output-node";
import { LiveOutputNode } from "./nodes/live-output-node";
import { DataflowContentModelType } from "../model/dataflow-content";
import { IStores } from "../../../models/stores/stores";
import { SensorNode } from "./nodes/sensor-node";

export class NodeEditorMST extends NodeEditor<Schemes> implements INodeServices {
  private reteNodesMap: Record<string, Schemes['Node']> = {};

  public engine = new DataflowEngine<Schemes>();
  public area: AreaPlugin<Schemes, AreaExtra>;

  constructor(
    private mstProgram: DataflowProgramModelType,
    private tileId: string,
    private div: HTMLElement,
    private mstContent: DataflowContentModelType,
    public stores: IStores,
    public runnable: boolean | undefined
  ) {
    super();

    this.use(this.engine);

    this.area = new AreaPlugin<Schemes, AreaExtra>(div);

    AreaExtensions.selectableNodes(this.area, AreaExtensions.selector(), {
      accumulating: AreaExtensions.accumulateOnCtrl()
    });

    // onPatch(mstProgram.nodes, (patch, reversePatch) => {
    //   console.log("nodes patch", patch);
    //   if (patch.op === "replace") {
    //     // don't do anything with this yet, but it might be needed
    //     // to support applySnapshot
    //     return;
    //   }
    //   // Using a method to parse the path would be better here
    //   const pattern = /^\/([^/[]*)$/;
    //   const result = patch.path.match(pattern);
    //   if (!result) {
    //     return;
    //   }
    //   const id = result[1];
    //   if (patch.op === "add") {
    //     const node = this.getNode(id);
    //     if (!node) return;
    //     this.emit({ type: 'nodecreated', data: node });
    //   }

    //   if (patch.op === "remove") {
    //     // I'm not sure what the value of patch will be here. And it is going to be tricky
    //     // to instantiate a real node back from the patch information. I'm hoping that
    //     // stuff that pays attention to this just looks at the id, but we'll see.
    //     this.emit({ type: 'noderemoved', data: { id } as any});
    //   }
    // });

    onPatch(mstProgram.connections, patch => {
      console.log("connections patch", patch);

      // If this is a connection being added:
      // we need to send the connection instance not data
      // this.emit({ type: 'connectioncreated', data })

      // If this ia connection being removed
      // we will no longer have the real connection instance to pass
      // but we can probably send previous snapshot somehow
      // this.emit({ type: 'connectionremoved', data: connection })
    });
  }

  public notifyAboutExistingObjects() {
    this.getNodes().forEach(node => this.emit({ type: 'nodecreated', data: node }));
    this.getConnections().forEach(connection => this.emit({ type: 'connectioncreated', data: connection}));
  }

  public process = () => {
    console.warn("NodeEditorMST.process");
    this.engine.reset();

    console.log("NodeEditorMST.process getNodes", this.getNodes());

    // It seems like structures should correctly handle our setup, but from what
    // I can tell it is reading the empty private nodes and connections from
    // from our parent. So we make this explicit
    const graph = structures({nodes: this.getNodes(), connections: this.getConnections()});

    // Because rete engine caches values even if the same node is the
    // parent of two leaves the data function of that common parent
    // will only be called once.
    // debugger;
    const leafNodes = graph.leaves().nodes();
    console.log("NodeEditorMST.process leafNodes", leafNodes);
    leafNodes.forEach(n => this.engine.fetch(n.id));
  };

  public logTileChangeEvent = (
    {operation, change}: Parameters<INodeServices['logTileChangeEvent']>[0]
  ) => {
    const logEventName = LogEventName.DATAFLOW_TOOL_CHANGE;
    logTileChangeEvent(logEventName, { operation, change, tileId: this.tileId });
  };

  public selectNode = (nodeId: string) => {
    this.area.emit({ type: "nodepicked", data: { id: nodeId } });
  };

  public update = (type: "node" | "connection" | "socket" | "control", id: string) => {
    this.area.update(type, id);
  };

  public isConnected = (nodeId: string, inputKey: string) => {
    const matchingConnection = [...this.mstProgram.connections.values()].find(connection =>
      connection.target === nodeId && connection.targetInput === inputKey);

    return !!matchingConnection;
  };

  public getOutputVariables = () => {
    return this.mstContent.outputVariables ?? [];
  };

  public removeInputConnection = (nodeId: string, inputKey: string) => {
    const matchingConnection = [...this.mstProgram.connections.values()].find(connection =>
      connection.target === nodeId && connection.targetInput === inputKey);

    if (!matchingConnection) return;
    this.removeConnection(matchingConnection.id);
  };

  public getChannels = () => {
    return this.mstContent.channels;
  };

  private createReteNodeFromNodeModel(id: string, model: IBaseNodeModel) {
    const nodeTypes: Record<string, NodeClass> =
    {
      "Counter": CounterNode,
      "Demo Output": DemoOutputNode,
      "Generator": GeneratorNode,
      "Live Output": LiveOutputNode,
      "Logic": LogicNode,
      "Math": MathNode,
      "Number": NumberNode,
      "Sensor": SensorNode
    };

    const constructor = nodeTypes[model.type];
    if (!constructor) {
      console.warn(`Can't find constructor for ${model.type}`);
      return;
    }

    return new constructor(id, model, this);
  }

  public createAndAddNode(nodeType: string, position?: [number, number]) {
    const id = uniqueId();
    this.mstProgram.addNodeSnapshot({
      id,
      name: nodeType,
      x: position?.[0] || 0,
      y: position?.[1] || 0,
      data: { type: nodeType }
    });

    const node = this.getNode(id);

    // Temporarily emit like normal. Ideally the onPatch above would be used
    // to emit instead, so this is consistent regardless of how the state
    // is changed.
    // This is not waiting for the emit before calling the process.
    // we might need to add it
    this.emit({ type: 'nodecreated', data: node });

    // run the process command so this newly added node can update any controls like the
    // value control.
    this.process();
  }

  //
  // Methods implementing the Rete `Editor` interface
  //

  /**
   * Get a node by id
   * @param id - The node id
   * @returns The node or undefined
   */
  public getNode(id: Schemes['Node']['id']) {
    const mstNode = this.mstProgram.nodes.get(id);
    if (!mstNode) {
      const _reteNode = this.reteNodesMap[id];
      if (_reteNode) {
        delete this.reteNodesMap[id];
      }
      // We have to hack this to make the types happy, this is a bug
      // in the Rete type system
      return undefined as unknown as Schemes['Node'];
    }

    const existingReteNode = this.reteNodesMap[id];
    if (existingReteNode) {
      return existingReteNode;
    } else {
      const reteNode = this.createReteNodeFromNodeModel(id, mstNode.data);
      if (reteNode) {
        this.reteNodesMap[id] = reteNode;
      }
      // We have to hack this to make the types happy, this is a bug
      // in the Rete type system
      return reteNode as unknown as Schemes['Node'];
    }
  }

  /**
   * Get all nodes
   * @returns Copy of array with nodes
   */
  public getNodes() {
    // We'll do this inefficiently for now:
    const reteNodeArray: Schemes['Node'][] = [];
    for(const mstNode of this.mstProgram.nodes.values()) {
      reteNodeArray.push(this.getNode(mstNode.id));
    }
    return reteNodeArray;

    // It is possible we are leaving some dead nodes in reteNodeMap
  }

  /**
   * Get all connections
   * @returns Copy of array with connections
   */
  public getConnections() {
    return [...this.mstProgram.connections.values()];
  }

  /**
   * Get a connection by id
   * @param id - The connection id
   * @returns The connection or undefined
   */
  public getConnection(id: Schemes['Connection']['id']) {
    // Again we have to hack the types due to an issue with the Rete types
    return this.mstProgram.connections.get(id) as unknown as Schemes['Connection'];
  }

  /**
   * Add a node
   * @param data - The node data
   * @returns Whether the node was added
   * @throws If the node has already been added
   * @emits nodecreate
   * @emits nodecreated
   */
  async addNode(data: Schemes['Node']) {
    if (this.getNode(data.id)) throw new Error('node has already been added');

    // We do not handle this 'nodecreate' event in all cases so be careful if
    // you are using it. If a node is created externally, this event will not
    // be sent.
    if (!await this.emit({ type: 'nodecreate', data })) return false;

    // Hack for now
    const node = data as any;

    // Add this new node to the map, some rete plugins hold onto
    // the node they receive. So we need to make sure to return the same node
    // instance when getNode is called
    this.reteNodesMap[node.id] = node;

    // Assume any code that adds a node will also create the MST model for the node
    const model = node.model as IDataflowNodeModel['data'];

    this.mstProgram.addNode(DataflowNodeModel.create({
      id: data.id,
      name: model.type,
      // FIXME: we have to figure out how to handle this positioning
      x: 0,
      y: 0,
      data: model
    }));

    // Note: we are changing the behavior of Rete here. In the default Rete editor
    // this function doesn't return until the 'nodecreated' event has been sent and
    // waited for. In our case the event should be sent when the 'put' happens above
    // but we are not waiting for this event. We could improve this code if waiting
    // for the event become important

    // Temporarily emit like normal so we can get things back to working.
    await this.emit({ type: 'nodecreated', data: node });

    // run the process command so this newly added node can update any controls like the
    // value control.
    this.process();

    return true;
  }

  /**
   * Add a connection
   * @param data - The connection data
   * @returns Whether the connection was added
   * @throws If the connection has already been added
   * @emits connectioncreate
   * @emits connectioncreated
   */
  async addConnection(data: Schemes['Connection']) {
    if (this.getConnection(data.id)) throw new Error('connection has already been added');

    // We do not handle this event in all cases so be careful if you use it
    if (!await this.emit({ type: 'connectioncreate', data })) return false;

    // From what I can tell code that creates the connections also creates
    // a unique id for the connection
    const connection = ConnectionModel.create(data);
    this.mstProgram.addConnection(connection);

    // Note: we are changing the behavior of Rete here. In the default Rete editor
    // this function doesn't return until the 'connectioncreated' event has been sent and
    // waited for. In our case the event should be sent when the 'put' happens above
    // but we are not waiting for this event. We could improve this code if waiting
    // for the event become important


    // Temporary use this approach to get things working
    await this.emit({ type: 'connectioncreated', data: connection });

    return true;
  }

  /**
   * Remove a node
   * @param id - The node id
   * @returns Whether the node was removed
   * @throws If the node cannot be found
   * @emits noderemove
   * @emits noderemoved
   */
  async removeNode(id: Schemes['Node']['id']) {
    if (!this.mstProgram.nodes.has(id)) throw new Error('cannot find node');

    const node = this.getNode(id);

    if (!await this.emit({ type: 'noderemove', data: node })) return false;

    this.mstProgram.removeNode(id);

    // Temporary use this approach to get things working
    await this.emit({ type: 'noderemoved', data: node });

    return true;
  }

  /**
   * Remove a connection
   * @param id - The connection id
   * @returns Whether the connection was removed
   * @throws If the connection cannot be found
   * @emits connectionremove
   * @emits connectionremoved
   */
  async removeConnection(id: Schemes['Connection']['id']) {
    if (!this.mstProgram.connections.has(id)) throw new Error('cannot find connection');

    const connection = this.getConnection(id);

    if (!await this.emit({ type: 'connectionremove', data: connection })) return false;

    this.mstProgram.removeConnection(id);

    // Temporary use this approach to get things working
    await this.emit({ type: 'connectionremoved', data: connection });

    return true;
  }

  /**
   * Clear all nodes and connections
   * @returns Whether the editor was cleared
   * @emits clear
   * @emits clearcancelled
   * @emits cleared
   */
  async clear() {
    if (!await this.emit({ type: 'clear' })) {
      await this.emit({ type: 'clearcancelled' });
      return false;
    }

    for (const connectionId of this.mstProgram.connections.keys()) await this.removeConnection(connectionId);
    for (const nodeId of this.mstProgram.nodes.keys()) await this.removeNode(nodeId);

    // In this case we sent the event here
    // We don't have an easy way to send this event in response to snapshot changes or patches
    // We wouldn't know if the cause of the change was an official clear or something else.
    await this.emit({ type: 'cleared' });
    return true;
  }
}
