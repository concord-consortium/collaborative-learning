import { NodeEditor, NodeId, ClassicPreset as Classic, GetSchemes } from 'rete';

export type ClassicScheme = GetSchemes<Classic.Node, Classic.Connection<Classic.Node, Classic.Node>>

/**
 * DataflowNodeSetup is a set of functions that define how to process a node.
 */
export type DataflowNodeSetup<
  T extends ClassicScheme['Node'],
  I extends { [key in keyof T['inputs']]: any },
  O extends { [key in keyof T['outputs']]: any }
> = {
  inputs: () => (keyof I)[]
  outputs: () => (keyof O)[]
  // The typing here is weird. The data function of the setup returns a
  // map of outputs, but here it indicates it just returns 0
  data(fetchInputs: () => { [key in keyof I]: I[key][] }): O
}

/**
 * Dataflow is a class that allows to process nodes in a graph using Dataflow approach.
 * @priority 8
 */
export class Dataflow<Schemes extends ClassicScheme> {
  setups = new Map<NodeId, DataflowNodeSetup<any, any, any>>();

  /**
   * @param editor NodeEditor instance
   */
  constructor(private editor: NodeEditor<Schemes>) { }

  /**
   * Adds the node to the dataflow.
   * @param node Node instance
   * @param setup Set of functions that define how to process the node
   */
  public add<T extends Schemes['Node']>(node: T, setup: DataflowNodeSetup<T, any, any>) {
    const affected = this.setups.get(node.id);

    if (affected) {
      throw new Error('already processed');
    }
    this.setups.set(node.id, setup);
  }

  /**
   * Removes the node from the dataflow.
   * @param nodeId Node id
   */
  public remove(nodeId: NodeId) {
    this.setups.delete(nodeId);
  }

  /**
   * Fetches inputs of the node.
   * Unlike `fetch` method, this method doesn't call `data` function of the specified node
   * (but does call `data` for predecessor nodes recursively).
   * @param nodeId Node id
   * @returns Object with inputs
   */
  public fetchInputs(nodeId: NodeId) {
    const result = this.setups.get(nodeId);

    if (!result) throw new Error('node is not initialized');

    const inputKeys = result.inputs();

    const cons = this.editor.getConnections().filter(c => {
      return c.target === nodeId && inputKeys.includes(c.targetInput);
    });

    const inputs: Record<string, any> = {};
    const consWithSourceData = cons.map(c => {
      return {
        c,
        sourceData: this.fetch(c.source)
      };
    });

    for (const { c, sourceData } of consWithSourceData) {
      // TODO: this "previous" variable is why the inputs are passed as arrays
      // to the node data methods.
      // This is to support multiple connections to the same input socket.
      // We don't currently support this.
      const previous = inputs[c.targetInput] ? inputs[c.targetInput] : [];

      inputs[c.targetInput] = [...previous, sourceData[c.sourceOutput]];
    }

    return inputs;
  }

  /**
   * Fetches outputs of the node.
   * This method recursively calls `data` function of the predecessor nodes until receives
   * all of the required inputs and calls `data` function of the specified node.
   * @param nodeId Node id
   * @returns Object with outputs
   */
  public fetch(nodeId: NodeId): Record<string, any> {
    const result = this.setups.get(nodeId);

    if (!result) throw new Error('node is not initialized');

    const outputKeys = result.outputs();
    const data = result.data(() => this.fetchInputs(nodeId));

    const returningKeys = Object.keys(data) as (string | number | symbol)[];

    if (!outputKeys.every(key => returningKeys.includes(key))) {
      throw new Error(`dataflow node "${nodeId}" doesn't return all of required properties. ` +
        `Expected "${outputKeys.join('", "')}". Got "${returningKeys.join('", "')}"`);
    }

    return data;
  }
}
