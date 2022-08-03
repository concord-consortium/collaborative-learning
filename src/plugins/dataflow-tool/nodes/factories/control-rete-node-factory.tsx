import Rete, { Node, Socket } from "rete";
import { NodeData } from "rete/types/core/data";
import { DataflowReteNodeFactory, kEmptyValueString } from "./dataflow-rete-node-factory";
import { ValueControl } from "../controls/value-control";
import { DropdownListControl } from "../controls/dropdown-list-control";
import { NodeOperationTypes, roundNodeValue } from "../../model/utilities/node";
import { PlotButtonControl } from "../controls/plot-button-control";

export class ControlReteNodeFactory extends DataflowReteNodeFactory {
  constructor(numSocket: Socket) {
    super("Control", numSocket);
  }

  public heldValue: number | null;

  public builder(node: Node) {
    super.defaultBuilder(node);
    if (this.editor) {
      const inp1 = new Rete.Input("num1", "Number", this.numSocket);
      const inp2 = new Rete.Input("num2", "Number2", this.numSocket);
      const out = new Rete.Output("num", "Number", this.numSocket);

      const dropdownOptions = NodeOperationTypes
        .filter((nodeOp) => {
          return nodeOp.type === "control";
        }).map((nodeOp) => {
          return { name: nodeOp.name, icon: nodeOp.icon };
        });
      return node
        .addInput(inp1)
        .addInput(inp2)
        .addControl(new DropdownListControl(this.editor, "controlOperator", node, dropdownOptions, true))
        .addControl(new PlotButtonControl(this.editor, "plot", node))
        .addControl(new ValueControl(this.editor, "nodeValue", node))
        .addOutput(out) as any;
    }
  }

  public worker(node: NodeData, inputs: any, outputs: any) {
    const controlOperator = node.data.controlOperator; // "Output Zero" or "Hold Current" or "Hold Prior"
    let result = 0;
    let resultSentence = "";
    const recents: number[] = (node.data.recentValues as any).nodeValue;
    const priorValue: number | undefined = recents[recents.length - 1];
    const n1 = inputs.num1.length ? inputs.num1[0] : node.data.num1;
    const n2 = inputs.num2 ? (inputs.num2.length ? inputs.num2[0] : node.data.num2) : 0;

    if (controlOperator === "Output Zero"){
      this.heldValue = null;
    }

    if (controlOperator === "Hold Current"){
      this.heldValue = this.heldValue === null ? n2 : this.heldValue
    }

    if (controlOperator === "Hold Prior"){
      this.heldValue = this.heldValue === null ? priorValue : this.heldValue
    }

    console.log("heldValue: ", this.heldValue);
    const currentNodeOperationType = NodeOperationTypes.find(op => op.name === controlOperator);

    if (currentNodeOperationType) {

      if (isNaN(n1) || isNaN(n2)) {
        result = NaN;
      } else {
        result = currentNodeOperationType.method(n1, n2, this.heldValue);
      }

      // render the sentence version
      const n1Str = isNaN(n1) ? kEmptyValueString : "" + n1;
      const n2Str = isNaN(n2) ? kEmptyValueString : "" + n2;
      const resultStr = isNaN(result) ? kEmptyValueString : roundNodeValue(result);
      console.log("RESULT: ", result)
      resultSentence = currentNodeOperationType.numberSentence(n1Str, n2Str) + resultStr;
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
