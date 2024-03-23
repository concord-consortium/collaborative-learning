import { ClassicPreset } from "rete";
import { Instance, types } from "mobx-state-tree";
import { numSocket } from "../num-socket";
import { ValueControl } from "../controls/value-control";

export const CounterNodeModel = types.model("CounterNodeModel");
export interface ICounterNodeModel extends Instance<typeof CounterNodeModel> {}

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
    this.valueControl.setValue(result);

    return { value: result};
  }
}
