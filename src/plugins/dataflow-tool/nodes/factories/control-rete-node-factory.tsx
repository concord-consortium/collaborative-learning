import Rete, { Node, Socket } from "rete";
import { NodeData } from "rete/types/core/data";
import { DataflowReteNodeFactory, kEmptyValueString } from "./dataflow-rete-node-factory";
import { ValueControl } from "../controls/value-control";
import { DropdownListControl } from "../controls/dropdown-list-control";
import { NodeControlTypes, roundNodeValue } from "../../model/utilities/node";
import { PlotButtonControl } from "../controls/plot-button-control";

export class ControlReteNodeFactory extends DataflowReteNodeFactory {
  constructor(numSocket: Socket) {
    super("Control", numSocket);
  }

  private heldValue: number | null = null;

  public builder(node: Node) {
    super.defaultBuilder(node);
    if (this.editor) {
      const inp1 = new Rete.Input("num1", "Binary", this.numSocket);
      const inp2 = new Rete.Input("num2", "Number2", this.numSocket);
      const out = new Rete.Output("num", "Number", this.numSocket);

      node.data.hasGate = true;
      node.data.gateActive = false;

      const dropdownOptions = NodeControlTypes
        .map((nodeOp) => {
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
    const funcName = node.data.controlOperator as string;
    const recents: number[] = (node.data.recentValues as any).nodeValue;
    const priorValue: number | undefined = recents[recents.length - 1];
    const n1 :number = inputs.num1.length ? inputs.num1[0] : node.data.num1;
    const n2 :number = inputs.num2 ? (inputs.num2.length ? inputs.num2[0] : node.data.num2) : 0;

    let result = 0;
    let cResult = 0;

    // for setting classes on node
    node.data.gateActive = n1 === 1;

    // needs a real number in n2 if it is to output anything
    if (isNaN(n2)) {
      this.heldValue = null;
      result = NaN;
      cResult = NaN;
    }

    // For each function, evaluate given inputs and node state
    if (funcName === "Output Zero"){
      this.heldValue = null;
      result = n1 === 1 ? 0 : n2;
      cResult = 0;
    }

    else if (funcName === "Hold Current"){
      if (n1 === 1){
        // Already a number here? Maintain. Otherwise set the new held value;
        this.heldValue = typeof this.heldValue === "number" ? this.heldValue : n2;
        result = this.heldValue;
        cResult = this.heldValue;
      }
      else {
        this.heldValue = null;
        result = n2;
        cResult = n2; // still n2, since the value to be held would be the current
      }
    }

    else if (funcName === "Hold Prior"){
      if (n1 === 1){
        // Already a number here? Maintain. Otherwise set the new held value;
        this.heldValue = typeof this.heldValue === "number" ? this.heldValue : priorValue;
        result = this.heldValue;
        cResult = this.heldValue;
      }
      else {
        this.heldValue = null;
        result = n2;
        cResult = priorValue;
      }
    }

    // prepare string to display on node
    const resultString = isNaN(result) ? kEmptyValueString : `${roundNodeValue(result)}`;
    const resultSentence = `1 ? ${roundNodeValue(cResult)} : ${n2} ⇒ ${resultString}`;

    // operate rete
    if (this.editor) {
      const _node = this.editor.nodes.find((n: { id: any; }) => n.id === node.id);
      if (_node) {
        const nodeValue = _node.controls.get("nodeValue") as ValueControl;
        nodeValue?.setValue(result);
        nodeValue?.setSentence(resultSentence);
        this.editor.view.updateConnections( {node: _node} );
      }
    }
    outputs.num = result;
  }
}
