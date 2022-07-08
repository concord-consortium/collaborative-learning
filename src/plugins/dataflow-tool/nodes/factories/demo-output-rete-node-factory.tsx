import Rete, { Node, Socket } from "rete";
import { NodeData } from "rete/types/core/data";
import { DataflowReteNodeFactory } from "./dataflow-rete-node-factory";
import { ValueControl } from "../controls/value-control";
import { TextControl } from "../controls/text-control";
import { DemoOutputControl } from "../controls/demo-output-control";
import { DemoOutputValueControl } from "../controls/demo-output-value-control";
import { DropdownListControl } from "../controls/dropdown-list-control";
import { PlotButtonControl } from "../controls/plot-button-control";
import { NodeDemoOutputTypes } from "../../model/utilities/node";

export class DemoOutputReteNodeFactory extends DataflowReteNodeFactory {
  constructor(numSocket: Socket) {
    super("Demo Output", numSocket);
  }

  public builder(node: Node) {
    super.defaultBuilder(node);
    if (this.editor) {
      // const inp1 = new Rete.Input("num1", "Number", this.numSocket);

      node
        .addControl(new DropdownListControl(this.editor, "outputType", node, NodeDemoOutputTypes, true))
        // .addControl(new PlotButtonControl(this.editor, "plot", node))
        // .addControl(new ValueControl(this.editor, "nodeValue", node))
        .addControl(new DemoOutputControl(this.editor, "demoOutput", node));

      this.addInput(node, "num1");
      // node.addInput(inp1);

      if (node.data.outputType === "Grabber") {
        this.addInput(node, "speed", "speed: ");
        this.addInput(node, "tilt", "tilt: ");
      }

      return node as any;
    }
  }

  public worker(node: NodeData, inputs: any, outputs: any) {
    const n1 = inputs.num1.length ? inputs.num1[0] : node.data.num1;
    // if there is not a valid input, use 0
    // otherwise convert all non-zero to 1
    const result = isNaN(n1) ? 0 : +(n1 !== 0);
    if (this.editor) {
      const _node = this.editor.nodes.find((n: { id: any; }) => n.id === node.id);
      if (_node) {
        const outputTypeControl = _node.controls.get("outputType") as DropdownListControl;
        const outputType = outputTypeControl.getValue();

        const nodeValue = _node.controls.get("nodeValue") as ValueControl;
        nodeValue && nodeValue.setValue(result);
        if (outputType === "Light Bulb") {
          nodeValue?.setSentence(result === 0 ? "off" : "on");
        } else {
          nodeValue?.setSentence(result === 0 ? "closed" : "open");
        }

        const demoOutput = _node.controls.get("demoOutput") as DemoOutputControl;
        demoOutput?.setValue(result);

        if (outputType === "Grabber") {
          this.addInput(_node, "speed", "speed: ");
          this.addInput(_node, "tilt", "tilt: ");
        } else {
          this.removeInput(_node, "speed");
          this.removeInput(_node, "tilt");
        }
        node.data.outputType = outputType;
        demoOutput?.setOutputType(outputType);

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
        // node.addControl(new PlotButtonControl(this.editor, inputKey + "Plot", node))
        //   .addControl(new ValueControl(this.editor, inputKey + "Value", node));
        node.addInput(input);
        // input.addControl(new PlotButtonControl(this.editor, inputKey + "Plot", node));
        // input.addControl(new ValueControl(
        //   this.editor,
        //   inputKey + "Value",
        //   node
        // ));
        input.addControl(new DemoOutputValueControl(
          this.editor,
          inputKey + "Text",
          node,
          () => { node.data.plot = !node.data.plot; },
          displayLabel,
          inputKey, // Display text
          `Display for ${inputKey}`
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
    // this.removeControl(node, inputKey + "Plot");
    // this.removeControl(node, inputKey + "Value");
    // const control = node.controls.get(inputKey);
    // if (control && this.editor) {
    //   node.removeControl(control);
    // }
  }

  // private removeControl(node: Node, controlKey: string) {
  //   const control = node.controls.get(controlKey);
  //   if (control && this.editor) {
  //     node.removeControl(control);
  //   }
  // }
}
