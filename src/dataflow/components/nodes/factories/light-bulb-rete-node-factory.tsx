import Rete from "rete";
import { Node, Socket } from "rete";
import { NodeData } from "rete/types/core/data";
import { DataflowReteNodeFactory } from "./dataflow-rete-node-factory";
import { ValueControl } from "../controls/value-control";
import { LightbulbControl } from "../controls/lightbulb-control";
import { PlotButtonControl } from "../controls/plot-button-control";

export class LightBulbReteNodeFactory extends DataflowReteNodeFactory {
  constructor(numSocket: Socket) {
    super("Light Bulb", numSocket);
  }

  public builder(node: Node) {
    super.defaultBuilder(node);
    if (this.editor) {
      const inp1 = new Rete.Input("num1", "Number", this.numSocket);

      return node
        .addControl(new PlotButtonControl(this.editor, "plot", node))
        .addControl(new ValueControl(this.editor, "nodeValue", node))
        .addControl(new LightbulbControl(this.editor, "lightbulb", node))
        .addInput(inp1) as any;
    }
  }

  public worker(node: NodeData, inputs: any, outputs: any) {
    const n1 = inputs.num1.length ? inputs.num1[0] : node.data.num1;
    // if there is not a valid input, use 0
    // otherwise convert all non-zero to 1
    const result = isNaN(n1) ? 0 : +(n1 !== 0);
    if (this.editor) {
      const _node = this.editor.nodes.find((n: { id: any; }) => n.id === node.id);
      if (_node) {
        const nodeValue = _node.controls.get("nodeValue") as ValueControl;
        nodeValue && nodeValue.setValue(result);
        nodeValue?.setSentence(result === 0 ? "off" : "on");

        const lightbulb = _node.controls.get("lightbulb") as LightbulbControl;
        lightbulb && lightbulb.setValue(result);

        this.editor.view.updateConnections( {node: _node} );
      }
    }
  }
}
