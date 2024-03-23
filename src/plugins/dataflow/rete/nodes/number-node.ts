import { ClassicPreset } from "rete";
import { Instance, types } from "mobx-state-tree";
import { numSocket } from "../num-socket";
import { NumberControl } from "../controls/num-control";

// There is some weirdness with the Number node and how its "value" is stored
// The value is an entered input like selecting the units or a math function
// But this value is not stored in the node state
// This particular node reads this value out of it is nodeValue which all nodes
// have. And is currently serialized in a separate "values" section.
export const NumberNodeModel = types.model("NumberNodeModel", {
  // Our v1 models support this nodeValueUnits, but it isn't actually supported
  // in the UI. The number control which displays the nodeValue is not configured
  // to edit the units.
  // nodeValueUnits: types.maybe(types.string)

  // The old Number node didn't store its number in its state. I think storing it
  // makes the most sense. It will make it easier to implement a first version
  // without having to figure out about mapping the old "values" and "nodeValue"
  // stuff into the new system.
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
export class NumberNode extends ClassicPreset.Node<
  Record<string, never>,
  { value: ClassicPreset.Socket },
  { value: NumberControl }
> {
  constructor(
    public model: INumberNodeModel,
    process: () => void
  ) {
    super("Number");

    this.addOutput("value", new ClassicPreset.Output(numSocket, "Number"));

    // TODO: The example of this includes a "change" listener added to the InputControl
    // https://retejs.org/examples/processing/dataflow

    const valueControl = new NumberControl(model, "value", process, "value", 2);
    this.addControl("value", valueControl);

    // TODO: need to add the plot control
  }

  data(): { value: number } {
    return { value: this.model.value };
  }
}
