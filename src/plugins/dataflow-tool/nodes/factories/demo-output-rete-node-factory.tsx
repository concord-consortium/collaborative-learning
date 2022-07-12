import Rete, { Node, Socket } from "rete";
import { NodeData } from "rete/types/core/data";
import { DataflowReteNodeFactory } from "./dataflow-rete-node-factory";
import { DemoOutputControl } from "../controls/demo-output-control";
import { DemoOutputValueControl } from "../controls/demo-output-value-control";
import { DropdownListControl } from "../controls/dropdown-list-control";
import { MinigraphOptions } from "../dataflow-node-plot";
import { NodeDemoOutputTypes, NodePlotBlue, NodePlotRed } from "../../model/utilities/node";

const minigraphOptions: Record<string, MinigraphOptions> = {
  "speed": {
    backgroundColor: NodePlotBlue,
    borderColor: NodePlotBlue
  },
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
        const nodeValue = _node.inputs.get("nodeValue")?.control as DemoOutputValueControl;
        nodeValue?.setValue(result);
        if (outputType === "Light Bulb") {
          nodeValue?.setDisplayMessage(result === 0 ? "off" : "on");
        } else {
          nodeValue?.setDisplayMessage(result === 0 ? "closed" : "open");
        }
        nodeValue?.setConnected(inputs.nodeValue.length);

        const demoOutput = _node.controls.get("demoOutput") as DemoOutputControl;
        demoOutput?.setValue(result);

        // Update inputs based on output type
        if (outputType === "Grabber") {
          this.setupGrabberInputs(_node);

          // Update grabber speed
          const speedInput = inputs.speed.length ? inputs.speed[0] : node.data.speed;
          const speedValue = speedInput < 0 ? 0 : speedInput > 1 ? 1 : speedInput;
          const speedControl = _node.inputs.get("speed")?.control as DemoOutputValueControl;
          if (speedValue !== undefined) {
            speedControl?.setValue(speedValue);
          }
          speedControl?.setConnected(inputs.speed.length);

          // Update grabber tilt
          const tiltInput = inputs.tilt.length ? inputs.tilt[0] : node.data.tilt;
          const tiltValue = tiltInput;
          const tiltControl = _node.inputs.get("tilt")?.control as DemoOutputValueControl;
          if (tiltValue !== undefined) {
            tiltControl?.setValue(tiltValue);
          }
          tiltControl?.setConnected(inputs.tilt.length);
        } else {
          this.removeInput(_node, "speed");
          if ("speed" in (node as any).data.minigraphValues) {
            delete (node as any).data.minigraphValues.speed;
          }
          this.removeInput(_node, "tilt");
          if ("tilt" in (node as any).data.minigraphValues) {
            delete (node as any).data.minigraphValues.tilt;
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
    (node as any).data.minigraphValues.speed = minigraphOptions.speed;
    this.addInput(node, "speed", "speed: ");
    (node as any).data.minigraphValues.tilt = minigraphOptions.tilt;
    this.addInput(node, "tilt", "tilt: ");
  }

  private addInput(node: Node, inputKey: string, displayLabel = "") {
    if (this.editor) {
      const oldInput = node.inputs.get(inputKey);
      if (!oldInput) {
        const input = new Rete.Input(inputKey, "Number", this.numSocket);
        node.addInput(input);
        input.addControl(new DemoOutputValueControl(
          this.editor,
          inputKey,
          node,
          () => { node.data.plot = !node.data.plot; },
          displayLabel,
          0, // Initial value
          `Display for ${inputKey}`,
          '', // Initial display message
          (node as any).data.minigraphValues[inputKey].backgroundColor,
          (node as any).data.minigraphValues[inputKey].borderColor,
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
