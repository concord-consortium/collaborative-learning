import Rete from "rete";
import { Socket } from "rete";
import { DataflowNode } from "../dataflow-node";

export abstract class DataflowReteNodeFactory extends Rete.Component {
  protected numSocket: Socket;
  constructor(name: string, numSocket: Socket) {
    super(name);
    this.numSocket = numSocket;
    const data: any = this.data;
    data.component = DataflowNode;
  }
}
