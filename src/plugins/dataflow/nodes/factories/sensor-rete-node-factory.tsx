import Rete, { Node, Socket } from "rete";
import { NodeData } from "rete/types/core/data";
import { DataflowReteNodeFactory } from "./dataflow-rete-node-factory";
import { SensorSelectControl } from "../controls/sensor-select-control";
import { PlotButtonControl } from "../controls/plot-button-control";
import { SensorValueControl } from "../controls/sensor-value-control";
import { DataflowContentModelType } from "../../model/dataflow-content";

export class SensorReteNodeFactory extends DataflowReteNodeFactory {
  private content?: DataflowContentModelType;

  constructor(numSocket: Socket, content?: DataflowContentModelType) {
    super("Sensor", numSocket);

    this.content = content;
  }

  public builder(node: Node) {
    super.defaultBuilder(node);
    if (this.editor) {
      const out1 = new Rete.Output("num", "Number", this.numSocket);
      return node
        .addControl(new SensorSelectControl(this.editor, "sensorSelect", node, true, this.content))
        .addControl(new PlotButtonControl(this.editor, "plot", node))
        .addControl(new SensorValueControl(this.editor, "nodeValue", node, true))
        .addOutput(out1) as any;
    }
  }

  public worker(node: NodeData, inputs: any, outputs: any) {

    const makeZero = node.data.type === "fsr-reading" && isNaN(node.data.nodeValue as number);
    outputs.num = makeZero ? 0 : node.data.nodeValue;

    if (this.editor) {
      const _node = this.editor.nodes.find((n: { id: any; }) => n.id === node.id);
      if (_node) {
        const nodeValue = _node.controls.get("nodeValue") as SensorValueControl;
        nodeValue && nodeValue.setValue(outputs.num);
      }
    }
  }
}
