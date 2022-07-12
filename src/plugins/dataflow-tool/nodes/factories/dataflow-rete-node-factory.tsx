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
    node.data.minigraphValues = {"nodeValue": defaultMinigraphOptions};
    return node;
  }
}
