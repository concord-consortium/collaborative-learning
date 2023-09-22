import Rete, { Node, Socket } from "rete";
import { DataflowNode } from "../dataflow-node";
import { defaultMinigraphOptions } from "../dataflow-node-plot";
import { DeleteControl } from "../controls/delete-control";

export const kEmptyValueString = "__";

export abstract class DataflowReteNodeFactory extends Rete.Component {
  protected numSocket: Socket;

  constructor(name: string, numSocket: Socket) {
    super(name);
    this.numSocket = numSocket;
    const data: any = this.data;
    data.component = DataflowNode;
  }

  public defaultBuilder(node: Node) {
    if (this.editor) {
      node
        .addControl(new DeleteControl(this.editor, "delete", node));
    }

    // data.watchedValues determines which values the node cares about tracking
    // The key is the id of the control
    // The value is options related to the value, currently just for the minigraph
    node.data.watchedValues = { "nodeValue": defaultMinigraphOptions };

    return node;
  }
}
