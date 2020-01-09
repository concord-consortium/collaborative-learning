import Rete from "@concord-consortium/rete";
import { Node, Socket } from "@concord-consortium/rete";
import { NodeData } from "@concord-consortium/rete/types/core/data";
import { DataflowReteNodeFactory } from "./dataflow-rete-node-factory";
import { NumControl } from "../controls/num-control";
import { ValueControl } from "../controls/value-control";
import { PlotButtonControl } from "../controls/plot-button-control";
import { DropdownListControl } from "../controls/dropdown-list-control";
import { NodeGeneratorTypes, NodePeriodUnits } from "../../../utilities/node";

export class GeneratorReteNodeFactory extends DataflowReteNodeFactory {
  constructor(numSocket: Socket) {
    super("Generator", numSocket);
  }

  public builder(node: Node) {
    super.defaultBuilder(node);
    if (this.editor) {
      const out = new Rete.Output("num", "Number", this.numSocket);
      const units = NodePeriodUnits.map(u => u.unit);
      const dropdownOptions = NodeGeneratorTypes
        .map((nodeOp) => {
          return { name: nodeOp.name, icon: nodeOp.icon };
        });

      return node
        .addControl(new DropdownListControl(this.editor, "generatorType", node, dropdownOptions, true))
        .addControl(new NumControl(this.editor, "amplitude", node, false, "Amplitude", 1, .01, null, "Set Amplitude"))
        .addControl(new NumControl(this.editor, "period", node, false, "Period", 10, 1, units, "Set Period"))
        .addControl(new PlotButtonControl(this.editor, "plot", node))
        .addControl(new ValueControl(this.editor, "nodeValue", node))
        .addOutput(out) as any;
    }
  }

  public worker(node: NodeData, inputs: any, outputs: any) {
    outputs.num = node.data.nodeValue;
  }
}
