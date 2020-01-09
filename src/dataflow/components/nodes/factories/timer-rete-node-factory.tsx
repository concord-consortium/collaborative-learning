import Rete from "@concord-consortium/rete";
import { Node, Socket } from "@concord-consortium/rete";
import { NodeData } from "@concord-consortium/rete/types/core/data";
import { DataflowReteNodeFactory } from "./dataflow-rete-node-factory";
import { NumControl } from "../controls/num-control";
import { ValueControl } from "../controls/value-control";
import { PlotButtonControl } from "../controls/plot-button-control";
import { NodePeriodUnits } from "../../../utilities/node";

export class TimerReteNodeFactory extends DataflowReteNodeFactory {
  constructor(numSocket: Socket) {
    super("Timer", numSocket);
  }

  public builder(node: Node) {
    super.defaultBuilder(node);
    if (this.editor) {
      const out = new Rete.Output("num", "Number", this.numSocket);
      const units = NodePeriodUnits.map(u => u.unit);
      return node
        .addControl(new NumControl(this.editor, "timeOn", node, false, "time on", 5, 1, units, "Set Time On"))
        .addControl(new NumControl(this.editor, "timeOff", node, false, "time off", 5, 1, units, "Set Time Off"))
        .addControl(new PlotButtonControl(this.editor, "plot", node))
        .addControl(new ValueControl(this.editor, "nodeValue", node))
        .addOutput(out) as any;
    }
  }

  public worker(node: NodeData, inputs: any, outputs: any) {
    outputs.num = node.data.nodeValue;
    const result = node.data.nodeValue !== 0;
    if (this.editor) {
      const _node = this.editor.nodes.find((n: { id: any; }) => n.id === node.id);
      if (_node) {
        const nodeValue = _node.controls.get("nodeValue") as ValueControl;
        nodeValue && nodeValue.setSentence(+result === 0 ? "off" : "on");
        this.editor.view.updateConnections( {node: _node} );
      }
    }
  }
}
