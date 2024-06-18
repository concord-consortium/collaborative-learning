import { ClassicPreset } from "rete";
import { Instance } from "mobx-state-tree";
import { numSocket } from "./num-socket";
import { ValueControl } from "./controls/value-control";
import { BaseNode, BaseNodeModel, NoInputs } from "./base-node";
import { typeField } from "../../../utilities/mst-utils";
import { INodeServices } from "./service-types";

export const CounterNodeModel = BaseNodeModel.named("CounterNodeModel")
.props(({
  type: typeField("Counter")
}))
.volatile(self => ({
  count: 0
}))
.actions(self => ({
  incrementCount() {
    self.count++;
  }
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

  constructor(
    id: string | undefined,
    model: ICounterNodeModel,
    services: INodeServices
  ) {
    super(id, model, services);

    this.addOutput("value", new ClassicPreset.Output(numSocket, "Number"));

    this.valueControl = new ValueControl("Math", this.getSentence);
    this.addControl("value", this.valueControl);
  }

  getSentence = () => {
    return `${this.model.count}`;
  };

  data() {
    this.model.incrementCount();
    return { value: this.model.count};
  }
}
