import Rete, { Node, Socket } from "rete";
import { NodeData } from "rete/types/core/data";
import { DataflowReteNodeFactory } from "./dataflow-rete-node-factory";
import { DemoOutputControl } from "../controls/demo-output-control";
import { InputValueControl } from "../controls/input-value-control";
import { DropdownListControl } from "../controls/dropdown-list-control";
import { MinigraphOptions } from "../dataflow-node-plot";
import { NodeDemoOutputTypes, NodePlotBlue, NodePlotRed } from "../../model/utilities/node";

const minigraphOptions: Record<string, MinigraphOptions> = {
  "tilt": {
    backgroundColor: "#fff",
    borderColor: NodePlotRed
  }
};

export class DemoOutputReteNodeFactory extends DataflowReteNodeFactory {
  constructor(numSocket: Socket) {
    super("Demo Output", numSocket);
  }

  public builder(node: Node) {
    super.defaultBuilder(node);
    if (this.editor) {
      node
        .addControl(new DropdownListControl(this.editor, "outputType", node, NodeDemoOutputTypes, true))
        .addControl(new DemoOutputControl(this.editor, "demoOutput", node));

      this.addInput(node, "nodeValue");

      if (node.data.outputType === "Grabber") {
        this.setupGrabberInputs(node);
      }

      return node as any;
    }
  }

  public worker(node: NodeData, inputs: any, outputs: any) {
    const n1 = inputs.nodeValue.length ? inputs.nodeValue[0] : node.data.nodeValue;
    // if there is not a valid input, use 0
    // otherwise convert all non-zero to 1
    const result = isNaN(n1) ? 0 : +(n1 !== 0);
    if (this.editor) {
      const _node = this.editor.nodes.find((n: { id: any; }) => n.id === node.id);
      if (_node) {
        const outputTypeControl = _node.controls.get("outputType") as DropdownListControl;
        const outputType = outputTypeControl.getValue();

        // Update main display
        const nodeValue = _node.inputs.get("nodeValue")?.control as InputValueControl;
        nodeValue?.setValue(result);
        if (outputType === "Light Bulb") {
          nodeValue?.setDisplayMessage(result === 0 ? "off" : "on");
        } else {
          let percentClosed = Math.min(1, n1);
          percentClosed = Math.max(0, percentClosed);
          // percentClosed = Math.round(percentClosed * 100);
          percentClosed = Math.round(percentClosed * 10) * 10;
          nodeValue?.setDisplayMessage(`${percentClosed}% Closed`);
        }
        nodeValue?.setConnected(inputs.nodeValue.length);

        const demoOutput = _node.controls.get("demoOutput") as DemoOutputControl;
        demoOutput?.setValue(isNaN(n1) ? 0 : n1);
        // demoOutput?.setValue(result);

        // Update inputs based on output type
        if (outputType === "Grabber") {
          this.setupGrabberInputs(_node);

          // Update grabber tilt
          const tiltInput = inputs.tilt?.length ? inputs.tilt[0] : node.data.tilt;
          const tiltValue = tiltInput;
          const tiltControl = _node.inputs.get("tilt")?.control as InputValueControl;
          if (tiltValue !== undefined) {
            tiltControl?.setValue(tiltValue);
            demoOutput?.setTilt(tiltValue);
          }
          tiltControl?.setConnected(inputs.tilt?.length);
        } else {
          this.removeInput(_node, "tilt");
          if ("tilt" in (node as any).data.watchedValues) {
            delete (node as any).data.watchedValues.tilt;
          }
        }
        node.data.outputType = outputType;
        demoOutput?.setOutputType(outputType);

        this.editor.view.updateConnections( {node: _node} );

        _node.update();
      }
    }
  }

  private setupGrabberInputs(node: Node) {
    (node as any).data.watchedValues.tilt = minigraphOptions.tilt;
    this.addInput(node, "tilt", "tilt: ");
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
            return typeof val === "number" ? val.toFixed(1) : val;
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
