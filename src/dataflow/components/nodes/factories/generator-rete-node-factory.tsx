import Rete from "rete";
import { Node, Socket } from "rete";
import { NodeData } from "rete/types/core/data";
import { NumControl } from "../controls/num-control";
import { ValueControl } from "../controls/value-control";
import { PlotControl } from "../controls/plot-control";
import { DropdownListControl } from "../controls/dropdown-list-control";
import { NodeGeneratorTypes } from "../../../utilities/node";
import { DataflowNode } from "../dataflow-node";

export class GeneratorReteNodeFactory extends Rete.Component {
  private numSocket: Socket;
  constructor(numSocket: Socket) {
    super("Generator");
    this.numSocket = numSocket;
    const data: any = this.data;
    data.component = DataflowNode;
  }

  public builder(node: Node) {
    const out = new Rete.Output("num", "Number", this.numSocket);
    const dropdownOptions = NodeGeneratorTypes
      .map((nodeOp) => {
        return { name: nodeOp.name, icon: nodeOp.icon };
      });

    return node
      .addControl(new DropdownListControl(this.editor, "generatorType", node, dropdownOptions, true))
      .addControl(new NumControl(this.editor, "amplitude", node, false, "amplitude", 1, .01))
      .addControl(new NumControl(this.editor, "period", node, false, "period", 10, 1))
      .addControl(new ValueControl(this.editor, "nodeValue", node))
      .addControl(new PlotControl(this.editor, "plot", node))
      .addOutput(out) as any;
  }

  public worker(node: NodeData, inputs: any, outputs: any) {
    outputs.num = node.data.nodeValue;
  }
}
