import Rete, { Node, Socket } from "rete";
import { NodeData } from "rete/types/core/data";
import { DataflowReteNodeFactory } from "./dataflow-rete-node-factory";
import { DemoOutputControl } from "../controls/demo-output-control";
import { InputValueControl } from "../controls/input-value-control";
import { DropdownListControl } from "../controls/dropdown-list-control";
import { MinigraphOptions } from "../dataflow-node-plot";
import { NodeDemoOutputTypes, NodePlotRed, kBinaryOutputTypes } from "../../model/utilities/node";
import { dataflowLogEvent } from "../../dataflow-logger";

const minigraphOptions: Record<string, MinigraphOptions> = {
  "tilt": {
    backgroundColor: "#fff",
    borderColor: NodePlotRed
  }
};

const grabberSpeed = .002;
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
    if (this.editor) {
      const _node = this.editor.nodes.find((n: { id: any; }) => n.id === node.id);
      if (_node) {
        const outputTypeControl = _node.controls.get("outputType") as DropdownListControl;
        const outputType = outputTypeControl.getValue();

        // Update the lightbulb or grabber
        const nodeValue = _node.inputs.get("nodeValue")?.control as InputValueControl;
        let newValue = isNaN(n1) ? 0 : n1;
        if (kBinaryOutputTypes.includes(outputType)) {
          // if there is not a valid input, use 0
          // otherwise convert all non-zero to 1
          newValue = isNaN(n1) ? 0 : +(n1 !== 0);
          nodeValue?.setDisplayMessage(newValue === 0 ? "off" : "on");
        } else {
          newValue = this.updateGrabber(_node, newValue, tickTime, nodeValue);
        }
        nodeValue?.setValue(newValue);
        nodeValue?.setConnected(inputs.nodeValue.length);

        // Set the demo output's main value (lightbulb on/off, grabber % closed)
        const demoOutput = _node.controls.get("demoOutput") as DemoOutputControl;
        demoOutput?.setValue(newValue);

        // Grabber specific updates
        if (outputType === "Advanced Grabber") {
          this.setupGrabberInputs(_node);
          this.updateTilt(_node, inputs, tickTime, demoOutput);
        } else {
          // Remove tilt when grabber isn't selected
          this.removeInput(_node, "tilt");
          delete (_node as any).data.watchedValues.tilt;
        }
        _node.data.outputType = outputType;
        demoOutput?.setOutputType(outputType);

        this.editor.view.updateConnections( { node: _node } );

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
            const toggleStr = node.data.plot ? "on" : "off";
            const tileId = node.meta.inTileWithId as string;
            dataflowLogEvent(`toggle minigraph ${toggleStr}`, node, tileId);
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

  private updateGrabber(node: Node, inputValue: number, tickTime: number, valueControl: InputValueControl) {
    // Update target percent closed, capped between 0 and 1.
    let percentClosed = Math.min(1, inputValue);
    percentClosed = Math.max(0, percentClosed);
    node.data.targetClosed = percentClosed;

    // Close or open the grabber towards the target
    let currentClosed = node.data.currentClosed as number;
    const closedDirection = percentClosed > currentClosed ? 1 : percentClosed < currentClosed ? -1 : 0;
    const nextClosed = currentClosed + grabberSpeed * tickTime * closedDirection;
    const targetClosed = node.data.targetClosed as number;
    currentClosed = closedDirection > 0 ? Math.min(nextClosed, targetClosed)
      : Math.max(nextClosed, targetClosed);
    node.data.currentClosed = currentClosed;

    // Update the display message
    const hundredPercentClosed = Math.round(currentClosed * 10) * 10;
    valueControl?.setDisplayMessage(`${hundredPercentClosed}% closed`);

    return currentClosed;
  }

  private updateTilt(node: Node, inputs: any, tickTime: number, demoOutput: DemoOutputControl) {
    // Update the target tilt
    const tiltValue = inputs.tilt?.length ? inputs.tilt[0] : node.data.tilt;
    const tiltControl = node.inputs.get("tilt")?.control as InputValueControl;
    if (tiltValue !== undefined && (tiltValue === 1 || tiltValue === 0 || tiltValue === -1)) {
      // Only update the target if the input is a legal value: 1, 0, -1
      node.data.targetTilt = tiltValue;
    }
    const targetTilt = node.data.targetTilt as number;
    tiltControl?.setValue(targetTilt);
    const tiltWord = targetTilt === 1 ? "up" : targetTilt === -1 ? "down" : "center";
    tiltControl?.setDisplayMessage(tiltWord);

    // Move grabber tilt towards the target
    let currentTilt = node.data.currentTilt as number;
    const tiltDirection = targetTilt > currentTilt ? 1 : targetTilt < currentTilt ? -1 : 0;
    const nextTilt = currentTilt + tiltSpeed * tickTime * tiltDirection;
    currentTilt = tiltDirection > 0 ? Math.min(nextTilt, targetTilt) : Math.max(nextTilt, targetTilt);
    node.data.currentTilt = currentTilt;
    demoOutput?.setTilt(currentTilt);

    tiltControl?.setConnected(inputs.tilt?.length);
  }
}
