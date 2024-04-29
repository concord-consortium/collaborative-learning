import { ClassicPreset } from "rete";
import { Instance } from "mobx-state-tree";
import { numSocket } from "./num-socket";
import { ValueControl } from "./controls/value-control";
import { HoldFunctionOptions } from "../model/utilities/node";
import { BaseNode, BaseNodeModel } from "./base-node";
import { DropdownListControl, IDropdownListControl } from "./controls/dropdown-list-control";
import { PlotButtonControl } from "./controls/plot-button-control";
import { typeField } from "../../../utilities/mst-utils";
import { INodeServices } from "./service-types";
import { INumberControl, NumberControl } from "./controls/num-control";
import { getNumDisplayStr } from "./utilities/view-utilities";

export const ControlNodeModel = BaseNodeModel.named("ControlNodeModel")
.props({
  type: typeField("Control"),
  controlOperator: "Hold Current",
  waitDuration: 0,
  // TODO: this should be moved to a tickEntry
  timerRunning: false,
})
.volatile(self => ({
  gateActive: false,
  heldValue: null as number | null
}))
.actions(self => ({
  setControlOperator(val: string) {
    self.controlOperator = val;
    // If we've switched to hold zero or hold current the downstream nodes
    // should update.
    self.process();
  },
  setWaitDuration(val: number) {
    self.waitDuration = val;
    // Currently this won't cause the timer to expire early so just changing
    // the waitDuration shouldn't have any immediate affect on the downstream nodes
  },
  setTimerRunning(val: boolean) {
    self.timerRunning = val;
    // TODO: we could trigger a reprocess here. This would cause the node to update
    // immediately when the timer expires. Currently the node waits for the next
    // tick before updating its display and output value.
  },
  setGateActive(val: boolean) {
    self.gateActive = val;
  },
  setHeldValue(val: number | null) {
    self.heldValue = val;
  }
}))
.actions(self => ({
  startTimer() {
    if (self.timerRunning) return;
    self.timerRunning = true;
    // FIXME: we should dispose this when the node is disposed
    // we should probably also clear it if the user changes the
    // control operator
    setTimeout(() => {
      self.setTimerRunning(false);
    }, self.waitDuration * 1000);
  }
}));
export interface IControlNodeModel extends Instance<typeof ControlNodeModel> {}

export class ControlNode extends BaseNode<
  {
    num1: ClassicPreset.Socket,
    num2: ClassicPreset.Socket
  },
  {
    value: ClassicPreset.Socket
  },
  {
    value: ValueControl,
    controlOperator: IDropdownListControl,
    waitDuration: INumberControl,
    plotButton: PlotButtonControl
  },
  IControlNodeModel
> {
  valueControl: ValueControl;

  constructor(
    id: string | undefined,
    model: IControlNodeModel,
    services: INodeServices
  ) {
    super(id, model, services);

    // The input names are the original names, hopefully by keeping them consistent
    // loading old data will be easier
    this.addInput("num2", new ClassicPreset.Input(numSocket, "Number2"));
    this.addInput("num1", new ClassicPreset.Input(numSocket, "Binary"));

    this.addOutput("value", new ClassicPreset.Output(numSocket, "Number"));

    const dropdownOptions = HoldFunctionOptions
    .map((nodeOp) => {
      const { name, displayName, icon } = nodeOp;
      return { name, displayName, icon };
    });
    const dropdownControl =
      new DropdownListControl(this, "controlOperator", model.setControlOperator, dropdownOptions);
    this.addControl("controlOperator", dropdownControl);

    const valueControl = new NumberControl(this, "waitDuration", "wait", null, "", "secs");
    this.addControl("waitDuration", valueControl);

    this.valueControl = new ValueControl("Control", this.getSentence);
    this.addControl("value", this.valueControl);

    this.addControl("plotButton", new PlotButtonControl(this));
  }

  hasFlowIn() {
    return this.services.isConnected(this.id, "num2");
  }

  getSentence = () => {
    const { nodeValue, timerRunning } = this.model;
    const resultString = getNumDisplayStr(nodeValue);

    if (this.model.waitDuration && this.services.playback) {
      // We can't tell if we are waiting from the dataset values
      // because we don't know if the timer was running.
      // We could guess the state by comparing the input value
      // with the output value, but they might be same even if
      // we aren't holding the value.
      // So instead we just leave off the hold information.
      return ` → ${resultString}`;
    }

    const { gateActive } = this.model;
    const waitString = `waiting → ${resultString}`;
    const onString = `on → ${resultString}`;
    const offString = `off → ${resultString}`;

    if (gateActive) return timerRunning ? waitString : onString;
    else return offString;
  };

  private startTimerIfNecessary(switchIn: number | undefined){
    if (!this.readOnly) {
      const timerRunning = this.model.timerRunning;
      const timerIsOption =  this.model.waitDuration > 0;
      if (timerIsOption && switchIn === 1 && !timerRunning) {
        this.model.startTimer();
      }
    }
  }

  private getValueToHold(signalValue: number, prevValue: number | null) {
    const funcName = this.model.controlOperator;

    if (funcName === "Hold 0" || funcName === "Output Zero"){
      return 0;
    }
    else if (funcName === "Hold Current"){
      return signalValue;
    }
    else if (funcName === "Hold Prior"){
      // Note: if the prevValue is null we be returning null here
      return prevValue;
    }
    console.warn("Unknown control operator", funcName);
    return 0;
  }

  data({num1, num2}: {num1?: number[], num2?: number[]}) {
    const { model } = this;

    // TODO: Should we use NaN, undefined or 0 if array is empty?
    // I don't know when the array is empty.
    const signalValue = num2 ? (num2.length ? num2[0] : NaN) : 0;
    const switchIn = num1?.[0];

    const recents = model.recentValues.get("nodeValue");
    const prevValue = recents && recents.length > 1 ? recents[recents.length - 1] : null;

    let result = 0;

    model.setGateActive(this.model.timerRunning || switchIn === 1);

    // If we just restarted the timer because switchIn is still 1
    // after the timer expired, we might want a different behavior.
    // Currently when the timer restarts in this case the previously
    // held value continues to be held. Instead we might want to
    // update the held value.
    this.startTimerIfNecessary(switchIn);

    // requires value in signalValue (except for case of Output Zero)
    if (isNaN(signalValue)) {
      model.setHeldValue(null);
      result = NaN;
    }

    if (!model.gateActive) {
      // Reset the heldValue so a new value can be held when the gate is active again
      model.setHeldValue(null);
      result = signalValue;
    } else {
      // Already a number here? Maintain. Otherwise set the new held value;
      model.heldValue == null && model.setHeldValue(this.getValueToHold(signalValue, prevValue));
      // If the previous value is null, and our operator is "hold previous", the heldValue will be null
      result = model.heldValue ?? 0;
    }

    this.saveNodeValue(result);

    return { value: result };
  }
}
