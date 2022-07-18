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

const clawSpeed = .002;
const tiltSpeed = .002;

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

      node.data.targetClosed = 0;
      node.data.currentClosed = node.data.targetClosed;
      node.data.clawSpeed = .005;
      node.data.targetTilt = 0;
      node.data.currentTilt = node.data.targetTilt;
      node.data.lastTick = Date.now();

      return node as any;
    }
  }

  public worker(node: NodeData, inputs: any, outputs: any) {
    const now = Date.now();
    const tickTime = now - (node.data.lastTick as number);
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
        let newValue = isNaN(n1) ? 0 : n1;
        if (outputType === "Light Bulb") {
          nodeValue?.setDisplayMessage(result === 0 ? "off" : "on");
        } else {
          // Update target percent closed
          let percentClosed = Math.min(1, newValue);
          percentClosed = Math.max(0, percentClosed);
          node.data.targetClosed = percentClosed;

          // Close or open the claw towards the target
          const closedDirection = percentClosed > (node.data.currentClosed as number) ? 1
            : percentClosed < (node.data.currentClosed as number) ? -1 : 0;
          const nextClosed = (node.data.currentClosed as number) + clawSpeed * tickTime * closedDirection;
          node.data.currentClosed = closedDirection > 0 ? Math.min(nextClosed, (node.data.targetClosed as number))
            : Math.max(nextClosed, (node.data.targetClosed as number));
          newValue = node.data.currentClosed;

          // Update the display message
          const hundredPercentClosed = Math.round(newValue * 10) * 10;
          nodeValue?.setDisplayMessage(`${hundredPercentClosed}% closed`);
        }
        nodeValue?.setConnected(inputs.nodeValue.length);

        // Set the demo output's main value (lightbulb on/off, claw % closed)
        const demoOutput = _node.controls.get("demoOutput") as DemoOutputControl;
        demoOutput?.setValue(newValue);
        // demoOutput?.setValue(result);

        // Grabber specific updates
        if (outputType === "Grabber") {
          this.setupGrabberInputs(_node);

          // Update grabber target tilt
          const tiltValue = inputs.tilt?.length ? inputs.tilt[0] : node.data.tilt;
          const tiltControl = _node.inputs.get("tilt")?.control as InputValueControl;
          if (tiltValue !== undefined && (tiltValue === 1 || tiltValue === 0 || tiltValue === -1)) {
            node.data.targetTilt = tiltValue;
          }
          tiltControl?.setValue(node.data.targetTilt as number);
          const tiltWord = node.data.targetTilt === 1 ? "up"
            : node.data.targetTilt === -1 ? "down" : "center";
          tiltControl?.setDisplayMessage(tiltWord);

          // Move grabber tilt towards the target
          const tiltDirection = (node.data.targetTilt as number) > (node.data.currentTilt as number) ? 1
            : (node.data.targetTilt as number) < (node.data.currentTilt as number) ? -1 : 0;
          const nextTilt = (node.data.currentTilt as number) + tiltSpeed * tickTime * tiltDirection;
          node.data.currentTilt = tiltDirection > 0 ? Math.min(nextTilt, (node.data.targetTilt as number))
            : Math.max(nextTilt, (node.data.targetTilt as number));
          demoOutput?.setTilt(node.data.currentTilt as number);

          tiltControl?.setConnected(inputs.tilt?.length);
        } else {
          // Remove tilt when grabber isn't selected
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
    node.data.lastTick = now;
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
