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

  public heldValue: number | null = null;
  public alternativeValue: number | null = null;

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

  private deriveValue(n1:number, n2: number, prior: number, funcName: string, held: number | null) {
    return 42
  }

  public worker(node: NodeData, inputs: any, outputs: any) {
    console.log('TICK!')
    let result = 0;
    let resultSentence = "";
    const recents: number[] = (node.data.recentValues as any).nodeValue;
    console.log("RECENTS: ", recents)
    const priorValue: number | undefined = recents[recents.length - 1];
    const n1 = inputs.num1.length ? inputs.num1[0] : node.data.num1;
    const n2 = inputs.num2 ? (inputs.num2.length ? inputs.num2[0] : node.data.num2) : 0;

    console.log("n1: ", n1, "n2: ", n2)
    console.log("priorValue: ", priorValue)
    console.log("controlOperator: ", node.data.controlOperator)
    console.log("this.heldValue: ", this.heldValue)
    console.log("this.alternativeValue: ", this.alternativeValue)
    console.log('----')

    switch (node.data.controlOperator) {
      case "Output Zero":
        this.heldValue = null;
        this.alternativeValue = 0;
        break;

      case "Hold Current":
        if (this.heldValue === null){
          this.heldValue = n2;
        }
        this.alternativeValue = this.heldValue;
        break;

      case "Hold Prior":
        if (this.heldValue === null){
          this.heldValue = priorValue;
        }
        this.alternativeValue = this.heldValue;
        break;

      default:
        this.heldValue = null;
        this.alternativeValue = 0;
        break;
    }

    // set result and create sentence version
    if (isNaN(n2)) {
      result = NaN;
    } else {
      result = n1 === 0 ? n2 : this.alternativeValue;
    }
    const resultStr = isNaN(result) ? kEmptyValueString : roundNodeValue(result);
    resultSentence = `${n1} ≡ ${(n1 === 1 ? "on" : "off")} ⇒ ${resultStr}`;

    // operate rete
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
