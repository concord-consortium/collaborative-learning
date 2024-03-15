import Rete, { Node, Socket } from "rete";
import { NodeData } from "rete/types/core/data";
import { DataflowReteNodeFactory } from "./dataflow-rete-node-factory";
import { ValueControl } from "../controls/value-control";
import { DropdownListControl } from "../controls/dropdown-list-control";
import { NumControl } from "../controls/num-control";
import { HoldFunctionOptions } from "../../model/utilities/node";
import { PlotButtonControl } from "../controls/plot-button-control";
import { determineGateActive, getHoldNodeResultString } from "../utilities/view-utilities";

export class ControlReteNodeFactory extends DataflowReteNodeFactory {
  constructor(numSocket: Socket) {
    super("Control", numSocket);
  }

  private heldValue: number | null = null;
  private waitTimerOn: boolean = false;

  /**
   *  incoming ON  -> exsiting OFF : start timer  (this is a new on signal)
   *  incoming ON  -> existing ON  : do nothing   (gate already on)
   *  incoming OFF -> existing OFF : do nothing   (gate is already off)
   *  incoming OFF -> existing ON  : do nothing   (ignore gate open while timer is running)
   */
  private handleTimer(incomingSwitchVal: number, isCurrentOnSignal: boolean, duration: number){
    if (this.waitTimerOn) return null;
    if (isCurrentOnSignal) return null;
    if (incomingSwitchVal === 0) return null;

    this.waitTimerOn = true;
    setTimeout(() => {
      console.log("| timer done");
      this.waitTimerOn = false;
    }, duration);
  }

  public builder(node: Node) {
    super.defaultBuilder(node);
    if (this.editor) {
      const binaryInput = new Rete.Input("num1", "Binary", this.numSocket);
      const valueInput = new Rete.Input("num2", "Number2", this.numSocket);
      const out = new Rete.Output("num", "Number", this.numSocket);

      node.data.gateActive = false;

      const dropdownOptions = HoldFunctionOptions
        .map((nodeOp) => {
          return { name: nodeOp.name, displayName: nodeOp.displayName, icon: nodeOp.icon };
        });
      return node
        .addInput(valueInput)
        .addInput(binaryInput)
        .addControl(new DropdownListControl(this.editor, "controlOperator", node, dropdownOptions, true))
        .addControl(new NumControl(this.editor, "waitDuration", node, true, "wait", 2000, 1, ["ms"], "wait"))
        .addControl(new PlotButtonControl(this.editor, "plot", node))
        .addControl(new ValueControl(this.editor, "nodeValue", node))
        .addOutput(out) as any;
    }
  }

  public worker(node: NodeData, inputs: any, outputs: any) {
    const funcName = node.data.controlOperator as string;
    const recents: number[] | undefined = (node.data.recentValues as any)?.nodeValue;
    const lastRecentValue = recents?.[recents.length - 1];
    const priorValue = lastRecentValue == null ? null : lastRecentValue;
    const isWaitFunc = funcName.includes("Wait");
    const n1 :number = inputs.num1.length ? inputs.num1[0] : node.data.num1;
    const n2 :number = inputs.num2 ? (inputs.num2.length ? inputs.num2[0] : node.data.num2) : 0;

    let result = 0;
    let cResult = 0;

    isWaitFunc && this.handleTimer(inputs.num1[0], node.data.gateActive as boolean, node.data.waitDuration as number);

    // for setting classes on node
    node.data.hasWait = isWaitFunc;
    node.data.gateActive = determineGateActive(n1, isWaitFunc, this.waitTimerOn);

    // requires value in n2 (except for case of Output Zero)
    if (isNaN(n2)) {
      this.heldValue = null;
      result = NaN;
      cResult = NaN;
    }

    // For each function, evaluate given inputs and node state
    // TODO - check and see if this gets serialized, and if so, how to handle legacy funcNames on load
    if (funcName === "Hold 0" || funcName.includes("Output Zero")){
      this.heldValue = null;
      result = node.data.gateActive ? 0 : n2;
      cResult = 0;
    }

    else if (funcName.includes("Hold Current")){
      if (node.data.gateActive){
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

    else if (funcName.includes("Hold Prior")){
      if (node.data.gateActive){
        // Already a number here? Maintain. Otherwise set the new held value;
        this.heldValue = typeof this.heldValue === "number" ? this.heldValue : priorValue;
        result = this.heldValue || 0;
        cResult = this.heldValue || 0;
      }
      else {
        this.heldValue = null;
        result = n2;
        cResult = priorValue || 0;
      }
    }

    const resultSentence = getHoldNodeResultString(node.data, result, cResult) || "";

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
