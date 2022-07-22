import Rete, { Node, Socket } from "rete";
import { NodeData } from "rete/types/core/data";
import { DataflowReteNodeFactory } from "./dataflow-rete-node-factory";
// import { LiveOutputControl } from "../controls/live-output-control";
import { InputValueControl } from "../controls/input-value-control";
import { DropdownListControl } from "../controls/dropdown-list-control";
import { NodeLiveOutputTypes, NodePlotRed } from "../../model/utilities/node";
import { inject } from "mobx-react";

export class LiveOutputReteNodeFactory extends DataflowReteNodeFactory {
  constructor(numSocket: Socket) {
    super("Live Output", numSocket);
  }

  public builder(node: Node) {
    super.defaultBuilder(node);
    if (this.editor) {
      this.addInput(node, "nodeValue")
      node
        .addControl(new DropdownListControl(this.editor, "liveOutputType", node, NodeLiveOutputTypes, true))

      node.data.lastTick = Date.now();
      return node as any;
    }
  }

  public worker(node: NodeData, inputs: any, outputs: any) {
    const n1 = inputs.nodeValue.length ? inputs.nodeValue[0] : node.data.nodeValue;
    if (this.editor) {
      const _node = this.editor.nodes.find((n: { id: any; }) => n.id === node.id);
      if (_node) {
        const outputTypeControl = _node.controls.get("liveOutputType") as DropdownListControl;
        const outputType = outputTypeControl.getValue();
        const nodeValue = _node.inputs.get("nodeValue")?.control as InputValueControl;
        const quasiPercent = n1 * 100;
        nodeValue?.setValue(parseInt(quasiPercent.toFixed(2)));
        nodeValue?.setConnected(inputs.nodeValue.length);
        _node.data.outputType = outputType;
        this.editor.view.updateConnections( {node: _node} );
        _node.update();
      }
    }
  }

  private addInput(node: Node, inputKey: string, displayLabel = "") {
    if (this.editor) {
      const oldInput = node.inputs.get(inputKey);
      if (!oldInput) {
        const input = new Rete.Input(inputKey, "Number", this.numSocket);
        node.addInput(input);
        input.addControl(new InputValueControl(
          this.editor,
          inputKey,
          node,
          () => {
            node.data.plot = !node.data.plot;
            this.editor?.trigger("process");
          },
          displayLabel,
          0, // Initial value
          `Display for ${inputKey}`,
          '', // Initial display message
          (node as any).data.watchedValues[inputKey].backgroundColor,
          (node as any).data.watchedValues[inputKey].borderColor,
          (val: any) => {
            //return typeof val === "number" ? val.toFixed(1) : val;
            return typeof val === "number" ? val : 1;
          }
        ));
      }
    }
  }

  private removeInput(node: Node, inputKey: string) {
    const input = node.inputs.get(inputKey);
    if (input && this.editor) {
      input.connections.slice().map(this.editor.removeConnection.bind(this.editor));
      node.removeInput(input);
    }
  }

}

