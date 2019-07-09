import Rete from "rete";
import { Node, Socket } from "rete";
import { NodeData } from "rete/types/core/data";
import { NumControl } from "../controls/num-control";
import { DropdownListControl } from "../controls/dropdown-list-control";
import { NodeOperationInfo } from "../../../utilities/node";

export class ArithmeticReteNodeFactory extends Rete.Component {
  private numSocket: Socket;
  constructor(numSocket: Socket) {
    super("Arithmetic");
    this.numSocket = numSocket;
  }

  public builder(node: Node) {
    const inp1 = new Rete.Input("num1", "Number", this.numSocket);
    const inp2 = new Rete.Input("num2", "Number2", this.numSocket);
    const out = new Rete.Output("num", "Number", this.numSocket);

    inp1.addControl(new NumControl(this.editor, "num1", node));
    inp2.addControl(new NumControl(this.editor, "num2", node));

    const dropdownOptions = NodeOperationInfo
      .filter((nodeOp) => {
        return nodeOp.type === "arithmetic";
      }).map((nodeOp) => {
        return nodeOp.name;
      });

    return node
      .addInput(inp1)
      .addInput(inp2)
      .addControl(new DropdownListControl(this.editor, "arithmeticOperator", node, dropdownOptions, true))
      .addControl(new NumControl(this.editor, "preview", node, true))
      .addOutput(out) as any;
  }

  public worker(node: NodeData, inputs: any, outputs: any) {
    const arithmeticOperator = node.data.arithmeticOperator;
    let result = 0;
    const n1 = inputs.num1.length ? inputs.num1[0] : node.data.num1;
    const n2 = inputs.num2 ? (inputs.num2.length ? inputs.num2[0] : node.data.num2) : 0;

    const nodeOperationInfo = NodeOperationInfo.find(op => op.name === arithmeticOperator);
    if (nodeOperationInfo) {
      result = nodeOperationInfo.method(n1, n2);
    }

    if (this.editor) {
      const _node = this.editor.nodes.find((n: { id: any; }) => n.id === node.id);
      if (_node) {
        const preview = _node.controls.get("preview") as NumControl;
        preview && preview.setValue(result);
      }
    }

    outputs.num = result;
  }
}
