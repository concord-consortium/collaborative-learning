import { ClassicPreset } from "rete";
import { Instance } from "mobx-state-tree";
import { numSocket } from "./num-socket";
import { INumberUnitsControl, NumberUnitsControl } from "./controls/num-units-control";
import { BaseNode, BaseNodeModel, NoInputs } from "./base-node";
import { NodeGeneratorTypes, NodePeriodUnits } from "../model/utilities/node";
import { DropdownListControl, IDropdownListControl } from "./controls/dropdown-list-control";
import { ValueControl } from "./controls/value-control";
import { PlotButtonControl } from "./controls/plot-button-control";
import { typeField } from "../../../utilities/mst-utils";
import { INodeServices } from "./service-types";
import { INumberControl, NumberControl } from "./controls/num-control";

export const GeneratorNodeModel = BaseNodeModel.named("GeneratorNodeModel")
.props({
  type: typeField("Generator"),
  generatorType: "Sine",
  amplitude: 1,
  period: 10,
  periodUnits: "sec"
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
  },
  setPeriodUnits(units: string) {
    self.periodUnits = units;
  }
}));
export interface IGeneratorNodeModel extends Instance<typeof GeneratorNodeModel> {}

export class GeneratorNode extends BaseNode<
  NoInputs,
  { value: ClassicPreset.Socket },
  {
    generatorType: IDropdownListControl,
    amplitude: INumberControl,
    period: INumberUnitsControl,
    value: ValueControl,
    plotButton: PlotButtonControl
  },
  IGeneratorNodeModel
> {
  constructor(
    id: string | undefined,
    model: IGeneratorNodeModel,
    services: INodeServices
  ) {
    super(id, model, services);

    this.addOutput("value", new ClassicPreset.Output(numSocket, "Number"));

    const dropdownOptions = NodeGeneratorTypes.map((nodeOp) => {
      return { name: nodeOp.name, icon: nodeOp.icon };
    });
    const dropdownControl = new DropdownListControl(this, "generatorType", dropdownOptions);
    this.addControl("generatorType", dropdownControl);

    const ampControl = new NumberControl(this, "amplitude", "amplitude",
      null, "Set Amplitude");
    this.addControl("amplitude", ampControl);

    const units = NodePeriodUnits.map(u => u.unit);
    const periodControl = new NumberUnitsControl(this, "period", "period", null, units,
      "Set Period");
    this.addControl("period", periodControl);

    const valueControl = new ValueControl("Generator", this.getSentence);
    this.addControl("value", valueControl);

    this.addControl("plotButton", new PlotButtonControl(this));
  }

  get currentValue() {
    // This follows the v1 generator block approach and shows and outputs 0 when
    // it hasn't been 'ticked' yet. This can happen if the sampling rate
    // is 1min and the block is just added to the diagram
    return this.model.nodeValue ?? 0;
  }

  getSentence = () => {
    return `${this.currentValue}`;
  };

  data(): { value: number } {
    return { value: this.currentValue };
  }

  onTick() {
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
