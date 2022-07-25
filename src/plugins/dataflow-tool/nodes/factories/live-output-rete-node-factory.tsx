import Rete, { Node, Socket } from "rete";
import { NodeData } from "rete/types/core/data";
import { DataflowReteNodeFactory } from "./dataflow-rete-node-factory";
import { InputValueControl } from "../controls/input-value-control";
import { DropdownListControl } from "../controls/dropdown-list-control";
import { NodeLiveOutputTypes, NodePlotRed } from "../../model/utilities/node";

export class LiveOutputReteNodeFactory extends DataflowReteNodeFactory {
  constructor(numSocket: Socket) {
    super("Live Output", numSocket);
  }

  public builder(node: Node) {
    super.defaultBuilder(node);
    if (this.editor) {
      this.addInput(node, "nodeValue");
      // TODO (CLAW)- add "hold" input
      node
        .addControl(new DropdownListControl(this.editor, "liveOutputType", node, NodeLiveOutputTypes, true));

      node.data.lastTick = Date.now();
      return node as any;
    }
  }

  public worker(node: NodeData, inputs: any, outputs: any) {
    // TODO & NOTE (CLAW) At the moment we take the input as soon as we can and send it to serial
    // this updates the value of the node and then the default NodeProcess takes the data
    // and sends it out via Serial.  It does not pass through any rete "output"
    const n1 = inputs.nodeValue.length ? inputs.nodeValue[0] : node.data.nodeValue;
    if (this.editor) {
      const _node = this.editor.nodes.find((n: { id: any; }) => n.id === node.id);
      if (_node) {
        const outputTypeControl = _node.controls.get("liveOutputType") as DropdownListControl;
        const outputType = outputTypeControl.getValue();

        const nodeValue = _node.inputs.get("nodeValue")?.control as InputValueControl;

        let newValue = isNaN(n1) ? 0 : n1;

        if (outputType === "Light Bulb"){
          newValue = isNaN(n1) ? 0 : +(n1 !== 0);
          nodeValue?.setDisplayMessage(newValue === 0 ? "off" : "on");
        }

        if (outputType === "Backyard Claw"){
          if (n1 > 1){
            newValue = 1;
          } else if (n1 < 0) {
            newValue = 0;
          } else {
            newValue = parseInt((n1 * 100).toFixed(2), 10);
          }
          const roundedDisplayValue = Math.round((newValue / 10) * 10);
          // at the moment, physical claw is driven by a nearest 1%, not nearest 10%
          // however, displaying the rounded to nearest 10% for consistency
          // swap commented/uncommented below to change to display of nearest 1%
          // nodeValue?.setDisplayMessage(`${newValue}% closed`);
          nodeValue?.setDisplayMessage(`${roundedDisplayValue}% closed`);

        }

        nodeValue?.setValue(newValue);
        nodeValue?.setConnected(inputs.nodeValue.length);

        _node.data.outputType = outputType;
        this.editor.view.updateConnections( {node: _node} );
        _node.update();
      }
    }
  }

  // IMPROVEMENT - this is a duplicate method - abstract for all factories?
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

