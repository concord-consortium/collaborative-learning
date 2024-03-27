import { ClassicPreset } from "rete";
import { Instance, types } from "mobx-state-tree";
import { numSocket } from "../num-socket";
import { ValueControl } from "../controls/value-control";
import { BaseNode, BaseNodeModel } from "./base-node";

export const CounterNodeModel = BaseNodeModel.named("CounterNodeModel")
.props(({
  type: types.optional(types.literal("Counter"), "Counter")
}));
export interface ICounterNodeModel extends Instance<typeof CounterNodeModel> {}

// This node was added to verify how many times the data function of nodes is
// being called.
export class CounterNode extends BaseNode<
  Record<string, never>,
  {
    value: ClassicPreset.Socket
  },
  {
    value: ValueControl
  },
  ICounterNodeModel
> {
  valueControl: ValueControl;
  counter = 0;

  constructor(
    id: string | undefined,
    model: ICounterNodeModel
  ) {
    super("Counter", id, model);

    this.addOutput("value", new ClassicPreset.Output(numSocket, "Number"));

    this.valueControl = new ValueControl("Math");
    this.addControl("value", this.valueControl);
  }

  data() {
    console.log("Counter node data called");
    const result = this.counter++;
    this.valueControl.setSentence(`${result}`);


    return { value: result};
  }
}
