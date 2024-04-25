import { NodeEditor } from "rete";
import { Schemes } from "./rete-scheme";
import {
  DataflowNodeModel, IDataflowNodeModel, DataflowProgramModelType, ConnectionModel
} from "../model/dataflow-program-model";
import { IBaseNode, IBaseNodeModel } from "./base-node";

export class NodeEditorMST extends NodeEditor<Schemes> {
  public reteNodesMap: Record<string, Schemes['Node']> = {};

  constructor(
    private mstProgram: DataflowProgramModelType,
    private createReteNodeFromNodeModel: (id: string, model: IBaseNodeModel) => IBaseNode | undefined
  ) {
    super();
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
        (_reteNode as IBaseNode).dispose();
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

    (node as IBaseNode).dispose();
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
