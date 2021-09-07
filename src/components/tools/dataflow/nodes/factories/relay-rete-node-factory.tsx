import Rete, { Node, Socket } from "rete";
import { NodeData } from "rete/types/core/data";
import { DataflowReteNodeFactory } from "./dataflow-rete-node-factory";
import { ValueControl } from "../controls/value-control";
import { RelaySelectControl } from "../controls/relay-select-control";
import { PlotButtonControl } from "../controls/plot-button-control";

export class RelayReteNodeFactory extends DataflowReteNodeFactory {
  constructor(numSocket: Socket) {
    super("Relay", numSocket);
  }

  public builder(node: Node) {
    super.defaultBuilder(node);
    if (this.editor) {
      const inp1 = new Rete.Input("num1", "Number", this.numSocket);

      return node
        .addControl(new RelaySelectControl(this.editor, "relayList", node, true))
        .addControl(new PlotButtonControl(this.editor, "plot", node))
        .addControl(new ValueControl(this.editor, "nodeValue", node))
        .addInput(inp1) as any;
    }
  }

  public worker(node: NodeData, inputs: any, outputs: any) {
    const n1 = inputs.num1.length ? inputs.num1[0] : node.data.num1;
    const recentValues: any = node.data.recentValues;
    const mostRecentValue = recentValues?.[recentValues.length - 1];
    const lastValue = (mostRecentValue?.nodeValue) ? mostRecentValue.nodeValue.val : 1;
    // if there is not a valid input, use last value
    // otherwise convert all non-zero to 1
    const result = isNaN(n1) ? lastValue : +(n1 !== 0);
    if (this.editor) {
      const _node = this.editor.nodes.find((n: { id: any; }) => n.id === node.id);
      if (_node) {
        const nodeValue = _node.controls.get("nodeValue") as ValueControl;
        nodeValue && nodeValue.setValue(result);
        nodeValue?.setSentence(result === 0 ? "off" : "on");
        this.editor.view.updateConnections( {node: _node} );
      }
    }
  }
}
