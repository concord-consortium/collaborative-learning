import { ClassicPreset } from "rete";
import { Instance, types } from "mobx-state-tree";
import { numSocket } from "../num-socket";
import { INumberControl, NumberControl } from "../controls/num-control";
import { BaseNode, BaseNodeModel } from "./base-node";
import { NodeGeneratorTypes } from "../../model/utilities/node";
import { DropdownListControl, IDropdownListControl } from "../controls/dropdown-list-control";
import { ValueControl } from "../controls/value-control";

export const GeneratorNodeModel = BaseNodeModel.named("GeneratorNodeModel")
.props({
  type: types.optional(types.literal("Generator"), "Generator"),
  generatorType: "Sine",
  amplitude: 1,
  period: 10
  // FIXME: need periodUnits so the user can show the period in mins or hours
})
.actions(self => ({
  setGeneratorType(gType: string) {
    self.generatorType = gType;
  },
  setAmplitude(amp: number) {
    self.amplitude = amp;
  },
  setPeriod(period: number) {
    self.period = period;
  }
}));
export interface IGeneratorNodeModel extends Instance<typeof GeneratorNodeModel> {}

// TODO: The Record<string, never> type indicates that there are no
// inputs to this node. We should probably make a helper type for this
// if Rete doesn't have one
export class GeneratorNode extends BaseNode<
  Record<string, never>,
  { value: ClassicPreset.Socket },
  {
    generatorType: IDropdownListControl,
    amplitude: INumberControl,
    period: INumberControl,
    value: ValueControl,
  },
  IGeneratorNodeModel
> {
  valueControl: ValueControl;

  constructor(
    id: string | undefined,
    model: IGeneratorNodeModel,
    process: () => void
  ) {
    super("Generator", id, model);

    this.addOutput("value", new ClassicPreset.Output(numSocket, "Number"));

    const dropdownOptions = NodeGeneratorTypes.map((nodeOp) => {
      return { name: nodeOp.name, icon: nodeOp.icon };
    });
    const dropdownControl = new DropdownListControl(model,"generatorType", "Generator", process,
      dropdownOptions);
    this.addControl("generatorType", dropdownControl);

    const ampControl = new NumberControl(model, "amplitude", process, "amplitude");
    this.addControl("amplitude", ampControl);
    const periodControl = new NumberControl(model, "period", process, "period");
    this.addControl("period", periodControl);

    this.valueControl = new ValueControl("Generator");
    this.addControl("value", this.valueControl);
    // TODO: need to add the plot control
  }

  data(): { value: number } {
    // This follows the v1 generator block approach and shows and outputs 0 when
    // it hasn't been 'ticked' yet. This can happen if the sampling rate
    // is 1min and the block is just added to the diagram
    const value = this.model.nodeValue ?? 0;
    this.valueControl.setSentence(`${value}`);
    return { value };
  }

  tick() {
    const generatorType = this.model.generatorType;
    const period = Number(this.model.period);
    const amplitude = Number(this.model.amplitude);
    const nodeGeneratorType = NodeGeneratorTypes.find(gt => gt.name === generatorType);
    if (nodeGeneratorType && period && amplitude) {
      const time = Date.now();
      // note: period is given in s, but we're passing in ms for time, need to adjust
      const val = nodeGeneratorType.method(time, period * 1000, amplitude);
      this.model.setNodeValue(val);
      return true;
    }
    return false;
  }
}
