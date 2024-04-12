import { typeField } from "../../../utilities/mst-utils";
import { BaseNode, BaseNodeModel, NoOutputs } from "./base-node";
import { Instance } from "mobx-state-tree";
import { ClassicPreset } from "rete";
import { DropdownListControl, IDropdownListControl, ListOption } from "./controls/dropdown-list-control";
import { INodeServices } from "./service-types";
import { numSocket } from "./num-socket";
import { NodeLiveOutputTypes, NodeMicroBitHubs, baseLiveOutputOptions,
  kBinaryOutputTypes,
  kGripperOutputTypes, kMicroBitHubRelaysIndexed } from "../model/utilities/node";
import { InputValueControl } from "./controls/input-value-control";
import { SerialDevice } from "../../../models/stores/serial";
import { VariableType } from "@concord-consortium/diagram-view";
import { simulatedHub, simulatedHubName } from "../model/utilities/simulated-output";

// TODO: the list of sensors is populated on the tick, so if the tick is slow, the
// list of sensors will not update very well
export const LiveOutputNodeModel = BaseNodeModel.named("LiveOutputNodeModel")
.props({
  type: typeField("Live Output"),
  liveOutputType: "Gripper 2.0",
  // The default in the old DF was "connect device", choosing this does not bring up
  // the dialog, but it doesn't in the old one either. Hmm.
  hubSelect: "",
  // We record this in state so readOnly views of this node can mirror the status
  // without needing to track all of the channel state
  outputStatus: ""
})
.actions(self => ({
  setLiveOutputType(outputType: string) {
    self.liveOutputType = outputType;
  },
  setHubSelect(hub: string) {
    self.hubSelect = hub;
  },
  setOutputStatus(status: string) {
    self.outputStatus = status;
  }
}));
export interface ILiveOutputNodeModel extends Instance<typeof LiveOutputNodeModel> {}

export class LiveOutputNode extends BaseNode<
  {
    nodeValue: ClassicPreset.Socket
  },
  NoOutputs,
  {
    liveOutputType: IDropdownListControl,
    hubSelect: IDropdownListControl
  },
  ILiveOutputNodeModel
> {
  hubSelectControl: IDropdownListControl;

  constructor(
    id: string | undefined,
    model: ILiveOutputNodeModel,
    services: INodeServices
  ) {
    super(id, model, services);

    const nodeValueInput = new ClassicPreset.Input(numSocket, "NodeValue");
    this.addInput("nodeValue", nodeValueInput);

    const liveOutputControl = new DropdownListControl(this, "liveOutputType", NodeLiveOutputTypes);
    this.addControl("liveOutputType", liveOutputControl);

    this.hubSelectControl = new DropdownListControl(this, "hubSelect", NodeMicroBitHubs);
    this.addControl("hubSelect", this.hubSelectControl);

    const inputValueControl = new InputValueControl(this, "nodeValue", "", "Display for nodeValue",
      this.getDisplayMessageWithStatus);
    nodeValueInput.addControl(inputValueControl);
  }

  findOutputVariable() {
    const type = this.model.liveOutputType;
    return this.services.getOutputVariables().find(variable => variable.getAllOfType("live-output").includes(type));
  }

  public requiresSerial() {
    // live output block only indicates it requires serial
    // after a connection to another node is made.
    // This allows user to drag a block out and work on program before
    // the message prompting them to connect.
    return !this.findOutputVariable() && this.isConnected("nodeValue");
  }

  private sendDataToSerialDevice(serialDevice: SerialDevice) {
    // Default to 0 incase the nodeValue isn't set yet.
    // The nodeValue should be always be set to a valid number based on the
    // data method.
    const val = this.model.nodeValue ?? 0;
    const outType = this.model.liveOutputType;
    const isNumberOutput = val != null ? isFinite(val) : false;
    const { deviceFamily } = serialDevice;

    if (deviceFamily === "arduino" && isNumberOutput){
      serialDevice.writeToOutForBBGripper(val, outType);
    }
    if (deviceFamily === "microbit"){
      // It is not clear when the channels would be falsey but that is how this
      // code was written before.
      if (!this.services.getChannels()) return;
      const hubId = this.hubSelectControl.getSelectionId();
      if (hubId == null) return;
      serialDevice.writeToOutForMicroBitRelayHub(val, hubId, outType);
    }
  }

  private sendDataToSimulatedOutput(outputVariables?: VariableType[]) {
    const outputVariable = this.findOutputVariable();
    if (outputVariable && this.model.hubSelect === simulatedHubName(outputVariable)) {
      const val = this.model.nodeValue;
      // NOTE: this is where we historically saw NaN values with origins in the Sensor node
      if (val != null && isFinite(val)) outputVariable.setValue(val);
    }
  }

  outputsToAnyRelay() {
    return kMicroBitHubRelaysIndexed.includes(this.model.liveOutputType);
  }

  outputsToAnyGripper() {
    return kGripperOutputTypes.includes(this.model.liveOutputType);
  }

  getLiveOptions(deviceFamily: string, sharedVar?: VariableType ) {
    const options: ListOption[] = [];
    const simOption = sharedVar && simulatedHub(sharedVar);
    const anyOutputFound = simOption || deviceFamily === "arduino" || deviceFamily === "microbit";
    const { liveGripperOption, warningOption } = baseLiveOutputOptions;

    if (sharedVar && simOption) {
      options.push(simOption);
    }

    if (this.outputsToAnyRelay() && deviceFamily === "microbit") {
      options.push(...NodeMicroBitHubs);
    }

    if (this.outputsToAnyGripper() && deviceFamily === "arduino") {
      options.push(liveGripperOption);
    }

    if (this.outputsToAnyGripper() && deviceFamily !== "arduino") {
      if (!options.includes(warningOption)) {
        options.push(warningOption);
      }
    }

    if (!anyOutputFound && !options.includes(warningOption)) options.push(warningOption);

    return options;
  }

  setLiveOutputOpts(deviceFamily: string, sharedVar?: VariableType) {
    const options = this.getLiveOptions(deviceFamily, sharedVar);

    this.hubSelectControl.setOptions(options);

    const selectionId = this.hubSelectControl.getSelectionId();
    if (!selectionId) this.model.setHubSelect(options[0].name);

    // if user successfully connects arduino with warning selected, switch to physical gripper
    if (selectionId === "no-outputs-found" && deviceFamily === "arduino") {
      this.model.setHubSelect(baseLiveOutputOptions.liveGripperOption.name);
    }
  }

  private getSelectedRelayIndex(){
    return kMicroBitHubRelaysIndexed.indexOf(this.model.liveOutputType);
  }

  private updateHubsStatusReport(){
    const hubSelect = this.hubSelectControl;
    const hubsChannels = this.services.getChannels();
    if (!hubsChannels) return;
    const hubSelectOptions = hubSelect.options;
    hubsChannels
      .filter(c => c.deviceFamily === "microbit")
      .forEach(c => {
        // Incase there is a channel without a microbitId, skip it
        if (!c.microbitId) return;
        const targetHub = hubSelectOptions.find(option => option.id === c.microbitId);
        if (!targetHub) return;

        // The options are observable objects so changing the active status
        // should trigger the list to re-render. However this is being changed
        // outside of a transaction, so MobX might complain about it.
        targetHub.active = c.missing;
      });
  }

  private getHubRelaysChannel(){
    const selectedHubIdentifier = this.hubSelectControl.getSelectionId();
    const foundChannels = this.services.getChannels();
    if (!foundChannels) return null;
    const relayChannels = foundChannels.filter(c => c.type === "relays");
    return relayChannels.find(c => c.microbitId === selectedHubIdentifier);
  }

  private getRelayMessageReceived() {
    const hubRelaysChannel = this.getHubRelaysChannel();
    if (!hubRelaysChannel || !hubRelaysChannel.relaysState) return "no hub";
    const rIndex = this.getSelectedRelayIndex();
    const reportedValue = hubRelaysChannel.relaysState[rIndex];
    // TODO: this approach of knowing whether a message was received isn't
    // accurate. If we are sending the same value that was received before it will
    // immediately be labeled as "received". To really indicate if a message was
    // received we'd need an id system so the relay would return the id of message
    // that it received. However this might not be very useful if there are multiple
    // programs both trying to update the same relay. So instead showing a status
    // like: "Y secs ago, relay reported X" might be better. But even that isn't
    // great.
    return reportedValue === this.model.nodeValue ? "received" : "sent";
  }

  onTick() {
    const { stores, runnable } = this.services;
    const outputVariables = this.services.getOutputVariables();
    const outputVar = this.findOutputVariable();
    const foundDeviceFamily = stores.serialDevice.deviceFamily ?? "unknown device";
    if (runnable) {
      this.sendDataToSerialDevice(stores.serialDevice);
      this.sendDataToSimulatedOutput(outputVariables);
    }
    this.setLiveOutputOpts(foundDeviceFamily, outputVar);

    // This used to be in `data()` formerly known as `worker()`
    // it seems more appropriate to be in onTick, but that might
    // cause problems in the read only view if users are allowed to
    // look at the options
    this.updateHubsStatusReport();

    return true;
  }

  getDisplayMessage = () => {
    // TODO: if the nodeValue is not defined we might want display something
    // different than just showing it as 0
    const value = this.model.nodeValue ?? 0;
    const { liveOutputType } = this.model;
    if (kBinaryOutputTypes.includes(liveOutputType)) {
      return value === 0 ? "off" : "on";
    } else if (kGripperOutputTypes.includes(liveOutputType)){
      const roundedDisplayValue = Math.round((value / 10) * 10);
      return `${roundedDisplayValue}% closed`;
    }

    // We shouldn't hit this case but if we do then just pass the value through
    return `${value}`;
  };

  getDisplayMessageWithStatus = () => {
    const { outputStatus } = this.model;
    const displayMessage = this.getDisplayMessage();
    return displayMessage + (outputStatus ? ` (${outputStatus})` : "");
  };

  data({nodeValue}: {nodeValue?: number[]}) {
    // if there is not a valid input, use 0
    const value = nodeValue && nodeValue[0] != null && !isNaN(nodeValue[0]) ? nodeValue[0] : 0;

    const outputType = this.model.liveOutputType;

    if (kBinaryOutputTypes.includes(outputType)) {
      // convert all non-zero to 1
      const newValue = +(value !== 0);
      this.model.setNodeValue(newValue);
      if (kMicroBitHubRelaysIndexed.includes(outputType)) {
        this.model.setOutputStatus(this.getRelayMessageReceived());
      } else {
        this.model.setOutputStatus("");
      }
    } else if (kGripperOutputTypes.includes(outputType)){
      // NOTE: this looks similar to the Demo Output Node, but in this case we
      // are setting the nodeValue to 0-100. In the Demo Output Node it is set to
      // 0-1
      const newValue = getPercentageAsInt(value);
      this.model.setNodeValue(newValue);
      this.model.setOutputStatus("");
    } else {
      // We shouldn't hit this case but if we do then just pass the value through
      this.model.setNodeValue(value);
      this.model.setOutputStatus("");
    }

    return {};
  }
}

function getPercentageAsInt(num: number){
  if (num > 1)  return 100;
  if (num < 0)  return 0;
  return Math.round(num * 100);
}
