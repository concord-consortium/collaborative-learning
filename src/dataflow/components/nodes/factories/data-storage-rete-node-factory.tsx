import Rete from "rete";
import { Node, Socket } from "rete";
import { NodeData } from "rete/types/core/data";
import { DataflowReteNodeFactory } from "./dataflow-rete-node-factory";
import { NumControl } from "../controls/num-control";
import { TextControl } from "../controls/text-control";
import { PlotControl } from "../controls/plot-control";

export class DataStorageReteNodeFactory extends DataflowReteNodeFactory {
  private inputCount = 1;

  constructor(numSocket: Socket) {
    super("Data Storage", numSocket);
  }

  public builder(node: Node) {
    if (this.editor) {
      const inp = new Rete.Input("num" + this.inputCount, "sequence", this.numSocket);
      inp.addControl(new TextControl(this.editor, "text" + this.inputCount, node, "", "my-sequence"));

      return node
        .addControl(new TextControl(this.editor, "dataset", node, "name", "my-dataset"))
        .addControl(new NumControl(this.editor, "interval", node, false, "interval", 1, 1))
        .addControl(new PlotControl(this.editor, "plot", node))
        .addInput(inp) as any;
    }
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
    const lastKey = Array.from(node.inputs.keys())[node.inputs.size - 1];
    const lastInput = node.inputs.get(lastKey);
    if (lastInput && lastInput.connections.length > 0) {
      // final input has a connection, add an additional input
        this.addInput(node);
    }
  }

  private addInput(node: Node) {
    if (this.editor) {
      this.inputCount++;
      const input = new Rete.Input("num" + this.inputCount, "sequence", this.numSocket);
      input.addControl(new TextControl(this.editor,
                                       "text" + this.inputCount,
                                       node,
                                       "",
                                       "my-sequence"));
      node.addInput(input);
      node.update();
    }
  }

  private removeInputs(node: Node) {
    const lastKey = Array.from(node.inputs.keys())[node.inputs.size - 1];
    node.inputs.forEach((input, key) => {
      if (input.connections.length === 0 && key !== lastKey) {
        this.removeInput(node, key);
      }
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
