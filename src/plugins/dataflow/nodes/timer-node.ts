import { ClassicPreset } from "rete";
import { Instance } from "mobx-state-tree";
import { numSocket } from "./num-socket";
import { INumberUnitsControl, NumberUnitsControl } from "./controls/num-units-control";
import { BaseNode, BaseNodeModel, NoInputs } from "./base-node";
import { NodePeriodUnits } from "../model/utilities/node";
import { ValueControl } from "./controls/value-control";
import { PlotButtonControl } from "./controls/plot-button-control";
import { typeField } from "../../../utilities/mst-utils";
import { INodeServices } from "./service-types";

export const TimerNodeModel = BaseNodeModel.named("TimerNodeModel")
.props({
  type: typeField("Timer"),
  timeOn: 5,
  timeOnUnits: "sec",
  timeOff: 5,
  timeOffUnits: "sec"
})
.actions(self => ({
  setTimeOn(timeOn: number) {
    self.timeOn = timeOn;
  },
  setTimeOnUnits(units: string) {
    self.timeOnUnits = units;
  },
  setTimeOff(timeOff: number) {
    self.timeOff = timeOff;
  },
  setTimeOffUnits(units: string) {
    self.timeOffUnits = units;
  }
}));
export interface ITimerNodeModel extends Instance<typeof TimerNodeModel> {}

export class TimerNode extends BaseNode<
  NoInputs,
  { value: ClassicPreset.Socket },
  {
    timeOn: INumberUnitsControl,
    timeOff: INumberUnitsControl,
    value: ValueControl,
    plotButton: PlotButtonControl
  },
  ITimerNodeModel
> {
  valueControl: ValueControl;

  constructor(
    id: string | undefined,
    model: ITimerNodeModel,
    services: INodeServices
  ) {
    super(id, model, services);

    this.addOutput("value", new ClassicPreset.Output(numSocket, "Number"));

    const units = NodePeriodUnits.map(u => u.unit);
    const timeOnControl = new NumberUnitsControl(this, "timeOn", "time on",
      0, units, "Set Time On");
    this.addControl("timeOn", timeOnControl);

    const timeOffControl = new NumberUnitsControl(this, "timeOff", "time off", 0, units,
      "Set Time Off");
    this.addControl("timeOff", timeOffControl);

    this.valueControl = new ValueControl("Timer", this.getSentence);
    this.addControl("value", this.valueControl);

    this.addControl("plotButton", new PlotButtonControl(this));
  }

  get currentValue() {
    // This follows the v1 generator block approach and shows and outputs 0 when
    // it hasn't been 'ticked' yet. This can happen if the sampling rate
    // is 1min and the block is just added to the diagram
    return this.model.nodeValue ?? 0;
  }

  getSentence = () => {
    return +this.currentValue === 0 ? "off" : "on";
  };

  getSharedProgramNodeValue() {
    return this.getSentence();
  }

  data(): { value: number } {
    if (this.services.inTick) {
      const modelTimeOn = Number(this.model.timeOn);
      const timeOn = isFinite(modelTimeOn) ? modelTimeOn : 0;
      const modelTimeOff = Number(this.model.timeOff);
      const timeOff = isFinite(modelTimeOff) ? modelTimeOff : 0;

      const time = Date.now();

      // time on/off is given in s, but we convert to ms so we can use a simple mod function
      const timeOnMS = timeOn * 1000;
      const timeOffMS = timeOff * 1000;
      const value = time % (timeOnMS + timeOffMS) < timeOnMS ? 1 : 0;
      this.saveNodeValue(value);
    }
    return { value: this.currentValue };
  }
}
