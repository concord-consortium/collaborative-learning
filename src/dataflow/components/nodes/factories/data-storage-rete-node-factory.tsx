import Rete from "rete";
import { Node, Socket } from "rete";
import { NodeData } from "rete/types/core/data";
import { DataflowReteNodeFactory } from "./dataflow-rete-node-factory";
import { NumControl } from "../controls/num-control";
import { TextControl } from "../controls/text-control";
import { PlotControl } from "../controls/plot-control";
import * as uuid from "uuid/v4";

export class DataStorageReteNodeFactory extends DataflowReteNodeFactory {
  constructor(numSocket: Socket) {
    super("Data Storage", numSocket);
  }

  public builder(node: Node) {
    const inputUuid = uuid();
    const inp = new Rete.Input("i-" + inputUuid, "sequence", this.numSocket);
    inp.addControl(new TextControl(this.editor, "it-" + inputUuid, node, "", "my-sequence"));

    return node
      .addControl(new TextControl(this.editor, "dataset", node, "name", "my-dataset"))
      .addControl(new NumControl(this.editor, "interval", node, false, "interval", 1, 1))
      .addControl(new PlotControl(this.editor, "plot", node))
      .addInput(inp) as any;
  }

  public worker(node: NodeData, inputs: any, outputs: any) {
    const inputValues: any = {};
    const inputKeys: any = Object.keys(inputs);
    if (inputKeys) {
      inputKeys.forEach((key: any) => {
        if (inputs[key].length) {
          const inputValue = { name: "sequence", val: inputs[key][0] };
          inputValues[key] = inputValue;
        }
      });
    }

    if (this.editor) {
      const _node = this.editor.nodes.find((n: { id: any; }) => n.id === node.id);
      if (_node) {
        this.updateInputs(_node);
        _node.data.nodeValue = inputValues;
        this.editor.view.updateConnections( {node: _node} );
      }
    }
  }

  private updateInputs(node: Node) {
    this.addInputs(node);
    this.removeInputs(node);
  }

  private addInputs(node: Node) {
    const iterator = node.inputs.values();
    let result = iterator.next();
    let lastInput = result.value;
    while (!result.done) {
      lastInput = result.value;
      result = iterator.next();
    }
    if (lastInput && lastInput.connections.length > 0) {
      // final input has a connection, add an additional input
        this.addInput(node);
    }
  }

  private addInput(node: Node) {
    const inputUuid = uuid();
    const input = new Rete.Input("i-" + inputUuid, "sequence", this.numSocket);
    input.addControl(new TextControl(this.editor,
                                     "it-" + inputUuid,
                                     node,
                                     "",
                                     "my-sequence"));
    node.addInput(input);
    node.update();
  }

  private removeInputs(node: Node) {
    const invalidInputs = [];
    const iterator = node.inputs.values();
    let result = iterator.next();
    let invalidInput = "";
    while (!result.done) {
      if (invalidInput) {
        invalidInputs.push(invalidInput);
        invalidInput = "";
      }
      if (result.value && result.value.connections.length === 0) {
        // we found an input with no connections
        // if it isn't the last input, then remove it
        invalidInput = result.value.key;
      }
      result = iterator.next();
    }
    invalidInputs.forEach((input) => {
      this.removeInput(node, input);
    });
  }

  private removeInput(node: Node, inputKey: string) {
    const input = node.inputs.get(inputKey);
    if (input && this.editor) {
      input.connections.slice().map(this.editor.removeConnection.bind(this.editor));
      node.removeInput(input);
    }
    node.update();
  }

}
