import Rete from "rete";
import { Node, Socket } from "rete";
import { NodeData } from "rete/types/core/data";
import { DataflowReteNodeFactory } from "./dataflow-rete-node-factory";
import { NumControl } from "../controls/num-control";
import { ValueControl } from "../controls/value-control";
import { PlotControl } from "../controls/plot-control";
import { DropdownListControl } from "../controls/dropdown-list-control";
import { NodeGeneratorTypes } from "../../../utilities/node";

export class GeneratorReteNodeFactory extends DataflowReteNodeFactory {
  constructor(numSocket: Socket) {
    super("Generator", numSocket);
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
