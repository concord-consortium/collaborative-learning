import Rete from "rete";
import { Node, Socket } from "rete";
import { NodeData } from "rete/types/core/data";
import { NumControl } from "../controls/num-control";

export class NumReteNodeFactory extends Rete.Component {
  private numSocket: Socket;
  constructor(numSocket: Socket) {
    super("Number");
    this.numSocket = numSocket;
  }

  public builder(node: Node) {
    const out1 = new Rete.Output("num", "Number", this.numSocket);
    const ctrl = new NumControl(this.editor, "nodeValue", node);
    return node.addControl(ctrl).addOutput(out1) as any;
  }

  public worker(node: NodeData, inputs: any, outputs: any) {
    outputs.num = node.data.nodeValue;
  }
}
