import { ClassicPreset } from "rete";
import { Instance, types } from "mobx-state-tree";
import { numSocket } from "../num-socket";
import { INumberControl, NumberControl } from "../controls/num-control";
import { BaseNode, BaseNodeModel } from "./base-node";

// There is some weirdness with the Number node and how its "value" is stored
// The value is an entered input like selecting the units or a math function
// But this value is not stored in the node state
// This particular node reads this value out of it is nodeValue which all nodes
// have. And is currently serialized in a separate "values" section.
export const NumberNodeModel = BaseNodeModel.named("NumberNodeModel")
.props({
  type: types.optional(types.literal("Number"), "Number"),
  // Our v1 models support this nodeValueUnits, but it isn't actually supported
  // in the UI. The number control which displays the nodeValue is not configured
  // to edit the units.
  // nodeValueUnits: types.maybe(types.string)

  // The old Number node didn't store its number in its state. It really should
  // since this number is not computed it is something the user must enter in.
  value: 0
})
.actions(self => ({
  setValue(val: number) {
    self.value = val;
  }
}));
export interface INumberNodeModel extends Instance<typeof NumberNodeModel> {}

// TODO: The Record<string, never> type indicates that there are no
// inputs to this node. We should probably make a helper type for this
// if Rete doesn't have one
export class NumberNode extends BaseNode<
  Record<string, never>,
  { value: ClassicPreset.Socket },
  { value: INumberControl },
  INumberNodeModel
> {
  constructor(
    id: string | undefined,
    model: INumberNodeModel,
    process: () => void
  ) {
    super("Number", id, model);

    this.addOutput("value", new ClassicPreset.Output(numSocket, "Number"));

    const valueControl = new NumberControl(model, "value", process, "value");
    this.addControl("value", valueControl);

    // TODO: need to add the plot control
  }

  data(): { value: number } {
    // Save the updated value so it can be recorded in recent values on each tick
    this.model.setNodeValue(this.model.value);
    return { value: this.model.value };
  }
}
