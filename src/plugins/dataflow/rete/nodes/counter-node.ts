import { ClassicPreset } from "rete";
import { Instance } from "mobx-state-tree";
import { numSocket } from "../num-socket";
import { ValueControl } from "../controls/value-control";
import { BaseNode, BaseNodeModel, NoInputs, nodeType } from "./base-node";

export const CounterNodeModel = BaseNodeModel.named("CounterNodeModel")
.props(({
  type: nodeType("Counter")
}));
export interface ICounterNodeModel extends Instance<typeof CounterNodeModel> {}

// This node was added to verify how many times the data function of nodes is
// being called.
export class CounterNode extends BaseNode<
  NoInputs,
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
    super(id, model);

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
