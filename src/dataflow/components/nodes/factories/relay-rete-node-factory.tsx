import Rete from "rete";
import { Node, Socket } from "rete";
import { NodeData } from "rete/types/core/data";
import { NumControl } from "../controls/num-control";
import { RelaySelectControl } from "../controls/relay-select-control";
import { PlotControl } from "../controls/plot-control";

export class RelayReteNodeFactory extends Rete.Component {
  private numSocket: Socket;
  constructor(numSocket: Socket) {
    super("Relay");
    this.numSocket = numSocket;
  }

  public builder(node: Node) {
    const inp1 = new Rete.Input("num1", "Number", this.numSocket);
    inp1.addControl(new NumControl(this.editor, "num1", node));
    return node
      .addControl(new RelaySelectControl(this.editor, "relayList", node, true))
      .addControl(new NumControl(this.editor, "nodeValue", node, true))
      .addControl(new PlotControl(this.editor, "plot", node))
      .addInput(inp1) as any;
  }

  public worker(node: NodeData, inputs: any, outputs: any) {
    const n1 = inputs.num1.length ? inputs.num1[0] : node.data.num1;
    const result = n1 !== 0;

    if (this.editor) {
      const _node = this.editor.nodes.find((n: { id: any; }) => n.id === node.id);
      if (_node) {
        const nodeValue = _node.controls.get("nodeValue") as NumControl;
        nodeValue && nodeValue.setValue(+result);
        this.editor.view.updateConnections( {node: _node} );
      }
    }
  }
}
