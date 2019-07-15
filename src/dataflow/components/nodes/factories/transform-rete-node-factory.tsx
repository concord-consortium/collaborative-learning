import Rete from "rete";
import { Node, Socket, NodeEditor } from "rete";
import { NodeData } from "rete/types/core/data";
import { NumControl } from "../controls/num-control";
import { DropdownListControl } from "../controls/dropdown-list-control";
import { NodeOperationTypes } from "../../../utilities/node";

export class TransformReteNodeFactory extends Rete.Component {
  private numSocket: Socket;
  constructor(numSocket: Socket) {
    super("Transform");
    this.numSocket = numSocket;
  }

  public builder(node: Node) {
    const inp1 = new Rete.Input("num1", "Number", this.numSocket);
    const out = new Rete.Output("num", "Number", this.numSocket);

    inp1.addControl(new NumControl(this.editor, "num1", node));

    const dropdownOptions = NodeOperationTypes
      .filter((nodeOp) => {
        return nodeOp.type === "transform";
      }).map((nodeOp) => {
        return nodeOp.name;
      });

    return node
      .addInput(inp1)
      .addControl(new DropdownListControl(this.editor, "transformOperator", node, dropdownOptions, true))
      .addControl(new NumControl(this.editor, "nodeValue", node, true))
      .addOutput(out) as any;
  }

  public worker(node: NodeData, inputs: any, outputs: any) {
    const transformOperator: any = node.data.transformOperator;
    let result = 0;
    const n1 = inputs.num1.length ? inputs.num1[0] : node.data.num1;

    const nodeOperationTypes = NodeOperationTypes.find(op => op.name === transformOperator);
    if (nodeOperationTypes) {
      result = nodeOperationTypes.method(n1, 0);
    }

    if (this.editor) {
      const _node = this.editor.nodes.find((n: { id: any; }) => n.id === node.id);
      if (_node) {
        const nodeValue = _node.controls.get("nodeValue") as NumControl;
        nodeValue && nodeValue.setValue(result);
      }
    }

    outputs.num = result;
  }
}
