import { ClassicPreset } from "rete";
import { Instance } from "mobx-state-tree";
import { numSocket } from "../num-socket";
import { INumberControl, NumberControl } from "../controls/num-control";
import { BaseNode, BaseNodeModel, NoInputs, nodeType } from "./base-node";
import { PlotButtonControl } from "../controls/plot-button-control";

// There is some weirdness with the Number node and how its "value" is stored
// The value is an entered input like selecting the units or a math function
// But this value is not stored in the node state
// This particular node reads this value out of it is nodeValue which all nodes
// have. And is currently serialized in a separate "values" section.
export const NumberNodeModel = BaseNodeModel.named("NumberNodeModel")
.props({
  type: nodeType("Number"),
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

export class NumberNode extends BaseNode<
  NoInputs,
  { value: ClassicPreset.Socket },
  {
    value: INumberControl,
    plotButton: PlotButtonControl
  },
  INumberNodeModel
> {
  constructor(
    id: string | undefined,
    model: INumberNodeModel,
    process: () => void
  ) {
    super(id, model);

    this.addOutput("value", new ClassicPreset.Output(numSocket, "Number"));

    const valueControl = new NumberControl(model, "value", process, "value");
    this.addControl("value", valueControl);
    this.addControl("plotButton", new PlotButtonControl(model));

  }

  data(): { value: number } {
    // Save the updated value so it can be recorded in recent values on each tick
    this.model.setNodeValue(this.model.value);
    return { value: this.model.value };
  }
}
