import Rete from "rete";
import { Node, Socket } from "rete";
import { NodeData } from "rete/types/core/data";
import { DataflowReteNodeFactory } from "./dataflow-rete-node-factory";
import { NumControl } from "../controls/num-control";
import { TextControl } from "../controls/text-control";
import { PlotControl } from "../controls/plot-control";

export class DataStorageReteNodeFactory extends DataflowReteNodeFactory {
  private inputCount = 1;
  private inputPrefix = "num";
  private textPrefix = "sequence";

  constructor(numSocket: Socket) {
    super("Data Storage", numSocket);
  }

  public builder(node: Node) {
    super.defaultBuilder(node);
    if (this.editor) {
      this.inputCount = 1;
      node.addControl(new TextControl(this.editor, "datasetName", node, "name", "my-dataset"));
      node.addControl(new NumControl(this.editor, "interval", node, false, "interval", 1, 1));
      if (node.data.inputKeys) {
        const keys: any = node.data.inputKeys;
        keys.forEach((key: string) => {
          const inp = new Rete.Input(key, "sequence", this.numSocket);
          const keyNum = parseInt(key.substring(this.inputPrefix.length), 10);
          this.inputCount = Math.max(this.inputCount, keyNum);
          if (this.editor) {
            inp.addControl(new TextControl(this.editor, this.textPrefix + this.inputCount, node, "", "my-sequence"));
          }
          node.addInput(inp);
        });
      } else {
        const inp = new Rete.Input(this.inputPrefix + this.inputCount, "sequence", this.numSocket);
        inp.addControl(new TextControl(this.editor, this.textPrefix + this.inputCount, node, "", "my-sequence"));
        node.addInput(inp);
      }

      return node as any;
    }
  }

  public worker(node: NodeData, inputs: any, outputs: any) {
    const inputValues: any = {};
    const inputKeys: any = Object.keys(inputs);
    if (inputKeys) {
      inputKeys.forEach((key: string) => {
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
      const input = new Rete.Input(this.inputPrefix + this.inputCount, "sequence", this.numSocket);
      input.addControl(new TextControl(this.editor,
                                       this.textPrefix + this.inputCount,
                                       node,
                                       "",
                                       "my-sequence"));
      node.addInput(input);
      node.data.inputKeys = Array.from(node.inputs.keys());
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
    node.data.inputKeys = Array.from(node.inputs.keys());
    node.update();
  }

}
