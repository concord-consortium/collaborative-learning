import { ClassicPreset } from "rete";
import { Instance } from "mobx-state-tree";
import { numSocket } from "../num-socket";
import { ValueControl } from "../controls/value-control";
import { BaseNodeModel } from "./base-node";

export const CounterNodeModel = BaseNodeModel.named("CounterNodeModel");
export interface ICounterNodeModel extends Instance<typeof CounterNodeModel> {}

// This node was added to verify how many times the data function of nodes is
// being called.
export class CounterNode extends ClassicPreset.Node<
  Record<string, never>,
  {
    value: ClassicPreset.Socket
  },
  {
    value: ValueControl
  }
> {
  valueControl: ValueControl;
  counter = 0;

  constructor(
    public model: ICounterNodeModel
  ) {
    super("Counter");

    this.addOutput("value", new ClassicPreset.Output(numSocket, "Number"));

    this.valueControl = new ValueControl("Math");
    this.addControl("value", this.valueControl);
  }

  data() {
    const result = this.counter++;
    this.valueControl.setSentence(`${result}`);


    return { value: result};
  }
}
