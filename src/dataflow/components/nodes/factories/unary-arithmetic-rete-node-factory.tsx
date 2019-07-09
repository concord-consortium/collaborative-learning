import Rete from "rete";
import { Node, Socket, NodeEditor } from "rete";
import { NodeData } from "rete/types/core/data";
import { NumControl } from "../controls/num-control";
import { DropdownListControl } from "../controls/dropdown-list-control";
import { NodeOperationInfo } from "../../../utilities/node";

export class UnaryArithmeticReteNodeFactory extends Rete.Component {
  private numSocket: Socket;
  constructor(numSocket: Socket) {
    super("Unary Arithmetic");
    this.numSocket = numSocket;
  }

  public builder(node: Node) {
    const inp1 = new Rete.Input("num1", "Number", this.numSocket);
    const out = new Rete.Output("num", "Number", this.numSocket);

    inp1.addControl(new NumControl(this.editor, "num1", node));

    const dropdownOptions = NodeOperationInfo
      .filter((nodeOp) => {
        return nodeOp.type === "unary arithmetic";
      }).map((nodeOp) => {
        return nodeOp.name;
      });

    return node
      .addInput(inp1)
      .addControl(new DropdownListControl(this.editor, "unaryArithmeticOperator", node, dropdownOptions, true))
      .addControl(new NumControl(this.editor, "preview", node, true))
      .addOutput(out) as any;
  }

  public worker(node: NodeData, inputs: any, outputs: any) {
    const unaryArithmeticOperator: any = node.data.unaryArithmeticOperator;
    let result = 0;
    const n1 = inputs.num1.length ? inputs.num1[0] : node.data.num1;

    const nodeOperationInfo = NodeOperationInfo.find(op => op.name === unaryArithmeticOperator);
    if (nodeOperationInfo) {
      result = nodeOperationInfo.method(n1, 0);
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
