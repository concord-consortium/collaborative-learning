import Rete from "rete";
import { Node, Socket } from "rete";
import { NodeData } from "rete/types/core/data";
import { DataflowReteNodeFactory } from "./dataflow-rete-node-factory";
import { NumControl } from "../controls/num-control";
import { PlotControl } from "../controls/plot-control";

export class NumberReteNodeFactory extends DataflowReteNodeFactory {
  constructor(numSocket: Socket) {
    super("Number", numSocket);
  }

  public builder(node: Node) {
    const out1 = new Rete.Output("num", "Number", this.numSocket);
    const ctrl = new NumControl(this.editor, "nodeValue", node);
    const plot = new PlotControl(this.editor, "plot", node);
    return node.addControl(ctrl).addControl(plot).addOutput(out1) as any;
  }

  public worker(node: NodeData, inputs: any, outputs: any) {
    outputs.num = node.data.nodeValue;
  }
}
