import Rete from "rete";
import { Node, Socket } from "rete";
import { NodeData } from "rete/types/core/data";
import { NumControl } from "../controls/num-control";
import { ValueControl } from "../controls/value-control";
import { DropdownListControl } from "../controls/dropdown-list-control";
import { NodeOperationTypes, roundNodeValue } from "../../../utilities/node";
import { PlotControl } from "../controls/plot-control";

export class MathReteNodeFactory extends Rete.Component {
  private numSocket: Socket;
  constructor(numSocket: Socket) {
    super("Math");
    this.numSocket = numSocket;
  }

  public builder(node: Node) {
    const inp1 = new Rete.Input("num1", "Number", this.numSocket);
    const inp2 = new Rete.Input("num2", "Number2", this.numSocket);
    const out = new Rete.Output("num", "Number", this.numSocket);

    inp1.addControl(new NumControl(this.editor, "num1", node));
    inp2.addControl(new NumControl(this.editor, "num2", node));

    const dropdownOptions = NodeOperationTypes
      .filter((nodeOp) => {
        return nodeOp.type === "math";
      }).map((nodeOp) => {
        return { name: nodeOp.name, icon: nodeOp.icon };
      });
    return node
      .addInput(inp1)
      .addInput(inp2)
      .addControl(new DropdownListControl(this.editor, "mathOperator", node, dropdownOptions, true))
      .addControl(new ValueControl(this.editor, "nodeValue", node))
      .addControl(new PlotControl(this.editor, "plot", node))
      .addOutput(out) as any;
  }

  public worker(node: NodeData, inputs: any, outputs: any) {
    const mathOperator = node.data.mathOperator;
    let result = 0;
    let resultSentence = "";
    const n1 = inputs.num1.length ? inputs.num1[0] : node.data.num1;
    const n2 = inputs.num2 ? (inputs.num2.length ? inputs.num2[0] : node.data.num2) : 0;

    const nodeOperationTypes = NodeOperationTypes.find(op => op.name === mathOperator);
    if (nodeOperationTypes) {
      result = nodeOperationTypes.method(n1, n2);
      resultSentence = nodeOperationTypes.numberSentence(n1, n2) + roundNodeValue(result);
    }

    if (this.editor) {
      const _node = this.editor.nodes.find((n: { id: any; }) => n.id === node.id);
      if (_node) {
        const nodeValue = _node.controls.get("nodeValue") as ValueControl;
        nodeValue && nodeValue.setValue(result);
        nodeValue && nodeValue.setSentence(resultSentence);
        this.editor.view.updateConnections( {node: _node} );
      }
    }

    outputs.num = result;
  }
}
