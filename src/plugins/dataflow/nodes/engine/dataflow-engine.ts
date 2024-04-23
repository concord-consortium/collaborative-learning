import { GetSchemes, NodeEditor, NodeId, Root, Scope } from 'rete';

import { Dataflow, ClassicScheme } from './dataflow';
import { Cache } from './utils/cache';

export type DataflowNode = { data(inputs: Record<string, any>): Promise<Record<string, any>> | Record<string, any> }
export type DataflowEngineScheme = GetSchemes<
  ClassicScheme['Node'] & DataflowNode,
  ClassicScheme['Connection']
>

type Configure<Schemes extends DataflowEngineScheme> = (node: Schemes['Node']) => ({
  inputs: () => string[]
  outputs: () => string[]
})

/**
 * DataflowEngine is a plugin that integrates Dataflow with NodeEditor making it easy to use.
 * Additionally, it provides a cache for the data of each node in order to avoid recurring calculations.
 * @priority 10
 * @listens nodecreated
 * @listens noderemoved
 */
export class DataflowEngine<Schemes extends DataflowEngineScheme> extends Scope<never, [Root<Schemes>]> {
  editor!: NodeEditor<Schemes>;
  dataflow?: Dataflow<Schemes>;
  cache = new Cache<NodeId, Record<string, any>>();

  constructor(private configure?: Configure<Schemes>) {
    super('dataflow-engine');

    this.addPipe(context => {
      if (context.type === 'nodecreated') {
        this.add(context.data);
      }
      if (context.type === 'noderemoved') {
        this.remove(context.data);
      }
      return context;
    });
  }

  setParent(scope: Scope<Root<Schemes>>): void {
    super.setParent(scope);

    this.editor = this.parentScope<NodeEditor<Schemes>>(NodeEditor);
    this.dataflow = new Dataflow(this.editor);
  }

  private getDataflow() {
    if (!this.dataflow) throw new Error(`DataflowEngine isn't attached to NodeEditor`);
    return this.dataflow;
  }

  private add(node: Schemes['Node']) {
    const options = this.configure
      ? this.configure(node)
      : { inputs: () => Object.keys(node.inputs), outputs: () => Object.keys(node.outputs) };

    this.getDataflow().add(node, {
      inputs: options.inputs,
      outputs: options.outputs,
      data: (fetchInputs) => {
        const cache = this.cache.get(node.id);

        if (cache) return cache;

        const inputs = fetchInputs();
        const result = node.data(inputs);

        this.cache.add(node.id, result);

        return result;
      }
    });
  }

  private remove(node: Schemes['Node']) {
    this.getDataflow().remove(node.id);
  }

  /**
   * Resets the cache of the node and all its predecessors.
   * @param nodeId Node id to reset. If not specified, all nodes will be reset.
   */
  public reset(nodeId?: NodeId) {
    if (nodeId) {
      const setup = this.getDataflow().setups.get(nodeId);

      if (!setup) throw 'setup';

      const outputKeys = setup.outputs();

      this.cache.delete(nodeId);
      this.editor.getConnections()
        .filter(c => c.source === nodeId && outputKeys.includes(c.sourceOutput))
        .forEach(c => this.reset(c.target));
    } else {
      this.cache.clear();
    }
  }

  /**
   * Fetches input data for the node by fetching data for all its predecessors recursively.
   * @param nodeId Node id to fetch input data for
   */
  public fetchInputs(nodeId: NodeId) {
    return this.getDataflow().fetchInputs(nodeId);
  }

  /**
   * Fetches output data of the node
   * @param nodeId Node id to fetch data from
   */
  public fetch(nodeId: NodeId) {
    return this.getDataflow().fetch(nodeId);
  }
}
