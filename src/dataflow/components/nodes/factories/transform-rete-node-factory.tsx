import Rete from "rete";
import { Node, Socket } from "rete";
import { NodeData } from "rete/types/core/data";
import { DataflowReteNodeFactory, kEmptyValueString } from "./dataflow-rete-node-factory";
import { NumControl } from "../controls/num-control";
import { ValueControl } from "../controls/value-control";
import { DropdownListControl } from "../controls/dropdown-list-control";
import { NodeOperationTypes } from "../../../utilities/node";
import { PlotButtonControl } from "../controls/plot-button-control";

export class TransformReteNodeFactory extends DataflowReteNodeFactory {
  constructor(numSocket: Socket) {
    super("Transform", numSocket);
  }

  public builder(node: Node) {
    super.defaultBuilder(node);
    if (this.editor) {
      const inp1 = new Rete.Input("num1", "Number", this.numSocket);
      const out = new Rete.Output("num", "Number", this.numSocket);

      const dropdownOptions = NodeOperationTypes
        .filter((nodeOp) => {
          return nodeOp.type === "transform";
        }).map((nodeOp) => {
          return { name: nodeOp.name, icon: nodeOp.icon };
        });

      return node
        .addInput(inp1)
        .addControl(new DropdownListControl(this.editor, "transformOperator", node, dropdownOptions, true))
        .addControl(new PlotButtonControl(this.editor, "plot", node))
        .addControl(new ValueControl(this.editor, "nodeValue", node))
        .addOutput(out) as any;
      }
  }

  public worker(node: NodeData, inputs: any, outputs: any) {
    const transformOperator: any = node.data.transformOperator;
    let result = 0;
    let resultSentence = "";
    const n1 = inputs.num1.length ? inputs.num1[0] : node.data.num1;

    const nodeOperationTypes = NodeOperationTypes.find(op => op.name === transformOperator);
    if (nodeOperationTypes) {
      if (isNaN(n1)) {
        result = NaN;
      } else {
        result = nodeOperationTypes.method(n1, 0);
      }

      const n1Str = isNaN(n1)  ? kEmptyValueString : "" + n1;
      const resultStr = isNaN(result) ? kEmptyValueString : result;
      resultSentence = nodeOperationTypes.numberSentence(n1Str, "") + resultStr;
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
