import Rete from "rete";
import { Node, Socket } from "rete";
import { NodeData } from "rete/types/core/data";
import { SensorSelectControl } from "../controls/sensor-select-control";
import { PlotControl } from "../controls/plot-control";

export class SensorReteNodeFactory extends Rete.Component {
  private numSocket: Socket;
  constructor(numSocket: Socket) {
    super("Sensor");
    this.numSocket = numSocket;
  }

  public builder(node: Node) {
    const out1 = new Rete.Output("num", "Number", this.numSocket);
    return node
      .addControl(new SensorSelectControl(this.editor, "sensorSelect", node, true))
      .addControl(new PlotControl(this.editor, "plot", node))
      .addOutput(out1) as any;
  }

  public worker(node: NodeData, inputs: any, outputs: any) {
    outputs.num = node.data.nodeValue;
  }
}
