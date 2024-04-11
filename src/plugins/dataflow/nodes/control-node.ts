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
    const valueControl = new NumberControl(this, "waitDuration", "wait");
    this.addControl("waitDuration", valueControl);

    this.valueControl = new ValueControl("Control");
    this.addControl("value", this.valueControl);

    this.addControl("plotButton", new PlotButtonControl(this));
  }

  hasFlowIn() {
    return this.services.isConnected(this.id, "num2");
  }

  private getSentence(result: number, calcResult: number) {
    const { gateActive, timerRunning } = this.model;
    const resultString = getNumDisplayStr(result);
    const cResultString = getNumDisplayStr(calcResult);
    const waitString = `waiting → ${cResultString}`;
    const onString = `on → ${cResultString}`;
    const offString = `off → ${resultString}`;

    if (gateActive) return timerRunning ? waitString : onString;
    else return offString;
  }

  private determineGateAndTimerStates(switchIn: number | undefined){
    const timerRunning = this.model.timerRunning;
    const timerIsOption =  this.model.waitDuration > 0;
    const startTimer = timerIsOption && switchIn === 1 && !timerRunning;
    const activateGate = timerRunning ? true : switchIn === 1;
    return { activateGate, startTimer };
  }


  data({num1, num2}: {num1?: number[], num2?: number[]}) {
    const { model } = this;

    // TODO: Should we use NaN, undefined or 0 if array is empty?
    // I don't know when the array is empty.
    const signalValue = num2 ? (num2.length ? num2[0] : NaN) : 0;
    const funcName = model.controlOperator;
    const recents = model.recentValues.get("nodeValue");
    const prevValue = recents && recents.length > 1 ? recents[recents.length - 1] : null;

    let result = 0;
    let cResult = 0;

    const { activateGate, startTimer } = this.determineGateAndTimerStates(num1?.[0]);

    // TODO: this should probably only happen if we are in a writable tile?
    startTimer && model.startTimer();
    model.setGateActive(activateGate);

    // requires value in signalValue (except for case of Output Zero)
    if (isNaN(signalValue)) {
      model.setHeldValue(null);
      result = NaN;
      cResult = NaN;
    }

    // For each function, evaluate given inputs and node state
    // TODO - check and see if this gets serialized, and if so, how to handle legacy funcNames on load
    if (funcName === "Hold 0" || funcName === "Output Zero"){
      model.setHeldValue(null);
      result = model.gateActive ? 0 : signalValue;
      cResult = 0;
    }

    else if (funcName === "Hold Current"){
      if (model.gateActive){
        // Already a number here? Maintain. Otherwise set the new held value;
        model.heldValue == null && model.setHeldValue(signalValue);
        result = model.heldValue!;
        cResult = model.heldValue!;
      }
      else {
        model.setHeldValue(null);
        result = signalValue;
        cResult = signalValue; // still signalValue, since the value to be held would be the current
      }
    }

    else if (funcName === "Hold Prior"){
      if (model.gateActive){
        // Already a number here? Maintain. Otherwise set the new held value;
        model.heldValue == null && model.setHeldValue(prevValue);
        result = model.heldValue ?? 0;
        cResult = model.heldValue ?? 0;
      }
      else {
        model.setHeldValue(null);
        result = signalValue;
        cResult = prevValue ?? 0;
      }
    }

    const resultSentence = this.getSentence(result, cResult);

    // This nodeValue is used to record the recent values of the node
    model.setNodeValue(result);
    this.valueControl.setSentence(resultSentence);

    return { value: result };
  }
}
