import Rete from "@concord-consortium/rete";
import { Node, Socket } from "@concord-consortium/rete";
import { NodeData } from "@concord-consortium/rete/types/core/data";
import { DataflowReteNodeFactory, kEmptyValueString } from "./dataflow-rete-node-factory";
import { ValueControl } from "../controls/value-control";
import { DropdownListControl } from "../controls/dropdown-list-control";
import { NodeOperationTypes, roundNodeValue } from "../../../utilities/node";
import { PlotButtonControl } from "../controls/plot-button-control";

export class MathReteNodeFactory extends DataflowReteNodeFactory {
  constructor(numSocket: Socket) {
    super("Math", numSocket);
  }

  public builder(node: Node) {
    super.defaultBuilder(node);
    if (this.editor) {
      const inp1 = new Rete.Input("num1", "Number", this.numSocket);
      const inp2 = new Rete.Input("num2", "Number2", this.numSocket);
      const out = new Rete.Output("num", "Number", this.numSocket);

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
        .addControl(new PlotButtonControl(this.editor, "plot", node))
        .addControl(new ValueControl(this.editor, "nodeValue", node))
        .addOutput(out) as any;
    }
  }

  public worker(node: NodeData, inputs: any, outputs: any) {
    const mathOperator = node.data.mathOperator;
    let result = 0;
    let resultSentence = "";
    const n1 = inputs.num1.length ? inputs.num1[0] : node.data.num1;
    const n2 = inputs.num2 ? (inputs.num2.length ? inputs.num2[0] : node.data.num2) : 0;

    const nodeOperationTypes = NodeOperationTypes.find(op => op.name === mathOperator);
    if (nodeOperationTypes) {
      if (isNaN(n1) || isNaN(n2)) {
        result = NaN;
      } else {
        // NaNs are for propogating lack of values. Actual math erros like
        // divide-by-zero should output 0.
        result = nodeOperationTypes.method(n1, n2) || 0;
      }

      const n1Str = isNaN(n1) ? kEmptyValueString : "" + n1;
      const n2Str = isNaN(n2) ? kEmptyValueString : "" + n2;
      const resultStr = isNaN(result) ? kEmptyValueString : roundNodeValue(result);
      resultSentence = nodeOperationTypes.numberSentence(n1Str, n2Str) + resultStr;
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
