import Rete from "@concord-consortium/rete";
import { Node, Socket } from "@concord-consortium/rete";
import { NodeData } from "@concord-consortium/rete/types/core/data";
import { DataflowReteNodeFactory } from "./dataflow-rete-node-factory";
import { TextControl } from "../controls/text-control";
import { DropdownListControl } from "../controls/dropdown-list-control";
import { IntervalTimes } from "../../../utilities/node";
import { NodeSensorTypes, ChartPlotColors } from "../../../utilities/node";

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
      node.addControl(new TextControl(this.editor, "datasetName", node, "Name", "my-dataset", "Set Dataset Name"));
      const intervalTimeOptions = IntervalTimes.map(option => ({
        name: option.text, val: option.val
      }));
      node.addControl(new DropdownListControl(this.editor,
                                              "interval",
                                              node,
                                              intervalTimeOptions,
                                              true,
                                              "Interval",
                                              "Select Interval"));
      if (node.data.inputKeys) {
        const keys: any = node.data.inputKeys;
        keys.forEach((key: string, index: number) => {
          const inp = new Rete.Input(key, "sequence", this.numSocket);
          const keyNum = parseInt(key.substring(this.inputPrefix.length), 10);
          this.inputCount = Math.max(this.inputCount, keyNum);
          if (this.editor && index !== keys.length - 1) {
            inp.addControl(new TextControl(this.editor,
                                           this.textPrefix + this.inputCount,
                                           node,
                                           "",
                                           "my-sequence",
                                           "Set Sequence Name"));
          }
          node.addInput(inp);
          const tc = inp.control as TextControl;
          if (tc) {
            tc.setColor(ChartPlotColors[node.inputs.size - 1 % ChartPlotColors.length]);
          }
        });
      } else {
        const inp = new Rete.Input(this.inputPrefix + this.inputCount, "sequence", this.numSocket);
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
    if (lastInput && lastInput.connections.length > 0 && this.editor) {
      // final input has a connection, add an additional input
      const name = lastInput.connections[0].output.node?.name;
      let sequenceName = "my-sequence";
      if (name === "Number" || name === "Timer") {
        sequenceName = name;
      } else if (name === "Sensor") {
        if (lastInput.connections[0].output.node) {
          const nodeType = String(lastInput.connections[0].output.node.data.type);
          const sensorType = NodeSensorTypes.find((s: any) => s.type === nodeType);
          sequenceName = nodeType === "none" ? name : (sensorType ? sensorType.name : sequenceName);
        }
      } else if (name === "Generator") {
        if (lastInput.connections[0].output.node) {
          sequenceName = String(lastInput.connections[0].output.node.data.generatorType);
        }
      } else if (name === "Math") {
        if (lastInput.connections[0].output.node) {
          sequenceName = String(lastInput.connections[0].output.node.data.mathOperator);
        }
      } else if (name === "Logic") {
        if (lastInput.connections[0].output.node) {
          sequenceName = String(lastInput.connections[0].output.node.data.logicOperator);
        }
      } else if (name === "Transform") {
        if (lastInput.connections[0].output.node) {
          sequenceName = String(lastInput.connections[0].output.node.data.transformOperator);
        }
      }

      lastInput.addControl(new TextControl(this.editor,
        this.textPrefix + this.inputCount,
        node,
        "",
        sequenceName,
        "Set Sequence Name"));
      const tc = lastInput.control as TextControl;
      if (tc) {
        tc.setColor(ChartPlotColors[node.inputs.size - 1 % ChartPlotColors.length]);
      }
      this.addInput(node);
    }
  }

  private addInput(node: Node) {
    if (this.editor) {
      this.inputCount++;
      const input = new Rete.Input(this.inputPrefix + this.inputCount, "sequence", this.numSocket);
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
