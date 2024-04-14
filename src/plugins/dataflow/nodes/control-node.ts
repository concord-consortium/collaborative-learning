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
  waitDuration: 0
})
.volatile(self => ({
  // TODO: is this the right default?
  timerRunning: false,
  // TODO: is this the right default?
  gateActive: false,
  heldValue: null as number | null
}))
.actions(self => ({
  setControlOperator(val: string) {
    self.controlOperator = val;
  },
  setWaitDuration(val: number) {
    self.waitDuration = val;
  },
  setTimerRunning(val: boolean) {
    self.timerRunning = val;
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
    const dropdownControl = new DropdownListControl(this, "controlOperator", dropdownOptions);
    this.addControl("controlOperator", dropdownControl);

    // TODO need to add the readonly "secs" label
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
    const result = this.model.nodeValue;

    const { gateActive, timerRunning } = this.model;
    const resultString = getNumDisplayStr(result);
    const waitString = `waiting → ${resultString}`;
    const onString = `on → ${resultString}`;
    const offString = `off → ${resultString}`;

    if (gateActive) return timerRunning ? waitString : onString;
    else return offString;
  };

  private startTimerIfNecessary(switchIn: number | undefined){
    const timerRunning = this.model.timerRunning;
    const timerIsOption =  this.model.waitDuration > 0;
    if (timerIsOption && switchIn === 1 && !timerRunning) {
      this.model.startTimer();
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

    // This nodeValue is used to record the recent values of the node
    model.setNodeValue(result);

    return { value: result };
  }

  onTick() {
    if ( this.model.waitDuration > 0 ) {
      // We might be waiting for a timer to expire so we need to reprocess after tick
      return true;
    }
    return false;
  }
}
