import { typeField } from "../../../utilities/mst-utils";
import { BaseNode, BaseNodeModel, BaseTickEntry, NoOutputs } from "./base-node";
import { Instance, types } from "mobx-state-tree";
import { ClassicPreset } from "rete";
import { DropdownListControl, IDropdownListControl, ListOption } from "./controls/dropdown-list-control";
import { INodeServices } from "./service-types";
import { numSocket } from "./num-socket";
import { NodeLiveOutputTypes, NodeMicroBitHubs, baseLiveOutputOptions,
  kBinaryOutputTypes,
  kGripperOutputTypes, kMicroBitHubRelaysIndexed } from "../model/utilities/node";
import { InputValueControl } from "./controls/input-value-control";
import { SerialDevice } from "../../../models/stores/serial";
import { simulatedHub, simulatedHubName } from "../model/utilities/simulated-output";
import { VariableType } from "@concord-consortium/diagram-view";
import { runInAction } from "mobx";

export const LiveOutputTickEntry = BaseTickEntry.named("LiveOutputTickEntry")
.props({
  outputStatus: types.maybe(types.string),
});
interface ILiveOutputTickEntry extends Instance<typeof LiveOutputTickEntry> {}

// TODO: the list of sensors is populated on the tick, so if the tick is slow, the
// list of sensors will not update very well
export const LiveOutputNodeModel = BaseNodeModel.named("LiveOutputNodeModel")
.props({
  type: typeField("Live Output"),
  liveOutputType: "",
  hubSelect: "",

  tickEntries: types.map(LiveOutputTickEntry),
})
.views(self => ({
  get isGripperType() {
    return kGripperOutputTypes.includes(self.liveOutputType);
  },
  get isRelayType() {
    return kMicroBitHubRelaysIndexed.includes(self.liveOutputType);
  },
  get outputStatus() {
    const currentEntry = self.tickEntries.get(self.currentTick) as ILiveOutputTickEntry | undefined;
    return currentEntry?.outputStatus;
  }
}))
.actions(self => ({
  setHubSelect(hub: string) {
    self.hubSelect = hub;
    // There is nothing downstream from us so we don't need to reprocess
  },
}))
.actions(self => ({
  setLiveOutputType(outputType: string, deviceFamily: string | undefined,
      getSharedVar: () => VariableType | undefined )
  {
    if (outputType === self.liveOutputType) return;

    self.liveOutputType = outputType;

    // Get the shared variable after setting our new outputType since
    // the variable depends on the outputType
    const sharedVar = getSharedVar();
    console.log("setLiveOutputType.sharedVariable", sharedVar?.getAllOfType("live-output"));
    if (self.isGripperType) {
      if (deviceFamily === "arduino") {
        // If we have a connected arduino we should have a gripper, prefer that
        self.setHubSelect(baseLiveOutputOptions.liveGripperOption.name);
      } else if (sharedVar) {
        self.setHubSelect(simulatedHubName(sharedVar));
      } else {
        // Without a valid device, or variable, default to the device
        // The options list will be updated so this device option will prompt the user to
        // connect a device
        self.setHubSelect(baseLiveOutputOptions.liveGripperOption.name);
      }
    }

    // When a relay type is selected this is used with the microbit where hubs need to be
    // selected. We can't just automatically choose a particular hub.
    if (self.isRelayType) {
      if (deviceFamily === "microbit") {
        // Prompt the user to select an option if there is a microbit connected
        self.setHubSelect("");
      } else if (sharedVar) {
        self.setHubSelect(simulatedHubName(sharedVar));
      } else {
        // Without a valid device, or variable, default to a warning suggesting they
        // connect a device
        self.setHubSelect(baseLiveOutputOptions.genericWarningOption.name);
      }
    }

    // TODO: what do we do with the new servo type?

    // There is nothing downstream from us so we don't need to reprocess
  },
  setOutputStatus(status: string) {
    const currentEntry = self.tickEntries.get(self.currentTick)  as ILiveOutputTickEntry | undefined;
    if (currentEntry) {
      currentEntry.outputStatus = status;
    } else {
      console.warn("No current tick entry");
    }
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

    const liveOutputControl =
      new DropdownListControl(this, "liveOutputType", this.setLiveOutputTypeWrapper, NodeLiveOutputTypes);
    this.addControl("liveOutputType", liveOutputControl);

    if (this.readOnly) {
      // In readOnly mode we will not be updating the list of options, so if the value of hubSelect
      // is one of these dynamically added options, it will not be found in the readOnly view.
      // This will result in the readOnly view just showing "Select an option".
      // To work around this we use a special set of readOnly options which always contains the name
      // of the current option.
      // TODO: this could be improved by serializing more info about the current hubSelect option
      // like the displayName, active, and missing properties. This way the readOnly view could
      // display these as well.
      this.hubSelectControl = new DropdownListControl(this, "hubSelect", model.setHubSelect, [], undefined, undefined,
        this.getReadOnlyHubSelectOptions
      );
    } else {
      this.hubSelectControl = new DropdownListControl(this, "hubSelect", model.setHubSelect, []);

      if (!model.hubSelect) {
        // Set the default value. This also updates the hubSelect depending on the connected device and
        // and simulation.
        // FIXME: this might cause problems with undo support since it is changing the state on node
        // initialization, we'll have to make sure this happens within the node creation action
        this.setLiveOutputTypeWrapper("Gripper 2.0");
      }
      // Update the options now that we have a type
      this.setHubSelectOptions();
    }
    this.addControl("hubSelect", this.hubSelectControl);

    const inputValueControl = new InputValueControl(this, "nodeValue", "", "Display for nodeValue",
      this.getDisplayMessageWithStatus);
    nodeValueInput.addControl(inputValueControl);
  }

  setLiveOutputTypeWrapper = (val: string) => {
    this.model.setLiveOutputType(val, this.deviceFamily, this.getPotentialOutputVariable);
    // Update the options now that our type might have changed
    this.setHubSelectOptions();
  };

  getReadOnlyHubSelectOptions = () => {
    if (this.model.hubSelect) {
      return [ { name: this.model.hubSelect }];
    } else {
      return NodeMicroBitHubs;
    }
  };

  getPotentialOutputVariable = () => {
    const type = this.model.liveOutputType;
    return this.services.getOutputVariables().find(variable => variable.getAllOfType("live-output").includes(type));
  };

  private getSelectedOutputVariable() {
    const outputVariable = this.getPotentialOutputVariable();
    if (outputVariable && this.model.hubSelect === simulatedHubName(outputVariable)) {
      return outputVariable;
    } else {
      return undefined;
    }
  }

  public requiresSerial() {
    // live output block only indicates it requires serial
    // after a connection to another node is made.
    // This allows user to drag a block out and work on program before
    // the message prompting them to connect.
    return !this.getSelectedOutputVariable() && this.isConnected("nodeValue");
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

  private sendDataToSimulatedOutput() {
    const outputVariable = this.getSelectedOutputVariable();
    if (outputVariable) {
      const val = this.model.nodeValue;
      // NOTE: this is where we historically saw NaN values with origins in the Sensor node
      if (val != null && isFinite(val)) outputVariable.setValue(val);
    }
  }

  setHubSelectOptions() {
    const options: ListOption[] = [];
    const deviceFamily = this.deviceFamily;
    const sharedVar = this.getPotentialOutputVariable();
    const simOption = sharedVar && simulatedHub(sharedVar);
    const { liveGripperOption, noDeviceLiveGripperOption, genericWarningOption } = baseLiveOutputOptions;
    const { isGripperType, isRelayType, hubSelect } = this.model;

    if (simOption) {
      options.push(simOption);
    }

    if (isRelayType) {
      if (deviceFamily === "microbit") {
        options.push(...NodeMicroBitHubs);
      } else {
        options.push(genericWarningOption);
      }
    }

    if (isGripperType) {
      if (deviceFamily === "arduino") {
        options.push(liveGripperOption);
      } else {
        options.push(noDeviceLiveGripperOption);
      }
    }

    if (!options.find(option => option.name === hubSelect)) {
      // In certain cases, if we don't have an option for the current selection
      // we might need to add one.
    }

    this.hubSelectControl.setOptions(options);
  }

  private getSelectedRelayIndex(){
    return kMicroBitHubRelaysIndexed.indexOf(this.model.liveOutputType);
  }

  private updateHubsStatusReport(){
    const hubSelect = this.hubSelectControl;
    const hubsChannels = this.services.getChannels();
    if (!hubsChannels) return;
    const hubSelectOptions = hubSelect.options;

    // Run this in an action so the UI only updates once when the status
    // of the options is changed
    runInAction(() => {
      hubsChannels
      .filter(c => c.deviceFamily === "microbit")
      .forEach(c => {
        // Incase there is a channel without a microbitId, skip it
        if (!c.microbitId) return;
        const targetHub = hubSelectOptions.find(option => option.id === c.microbitId);
        if (!targetHub) return;

        // The options are observable objects so changing the active status
        // should trigger the list to re-render.
        hubSelect.setActiveOption(c.microbitId, c.missing);
        targetHub.active = c.missing;
      });
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

  saveOutputStatus(status: string) {
    if (!this.readOnly) {
      this.model.setOutputStatus(status);
    }
  }

  get deviceFamily() {
    return this.services.stores.serialDevice.deviceFamily;
  }

  data({nodeValue}: {nodeValue?: number[]}) {
    // if there is not a valid input, use 0
    const value = nodeValue && nodeValue[0] != null && !isNaN(nodeValue[0]) ? nodeValue[0] : 0;

    const outputType = this.model.liveOutputType;

    if (kBinaryOutputTypes.includes(outputType)) {
      // convert all non-zero to 1
      const newValue = +(value !== 0);
      this.saveNodeValue(newValue);
      if (kMicroBitHubRelaysIndexed.includes(outputType)) {
        this.saveOutputStatus(this.getRelayMessageReceived());
      } else {
        this.saveOutputStatus("");
      }
    } else if (kGripperOutputTypes.includes(outputType)){
      // NOTE: this looks similar to the Demo Output Node, but in this case we
      // are setting the nodeValue to 0-100. In the Demo Output Node it is set to
      // 0-1
      const newValue = getPercentageAsInt(value);
      this.saveNodeValue(newValue);
      this.saveOutputStatus("");
    } else {
      // We shouldn't hit this case but if we do then just pass the value through
      this.saveNodeValue(value);
      this.saveOutputStatus("");
    }

    if (this.services.inTick) {
      const { stores, runnable } = this.services;
      if (runnable) {
        this.sendDataToSerialDevice(stores.serialDevice);
        this.sendDataToSimulatedOutput();
      }
      this.setHubSelectOptions();

      // We won't be in a tick in a read only view. However users aren't allowed
      // to look at the options so there isn't a reason to update the status
      // report outside of the tick.
      this.updateHubsStatusReport();
    }

    return {};
  }
}

function getPercentageAsInt(num: number){
  if (num > 1)  return 100;
  if (num < 0)  return 0;
  return Math.round(num * 100);
}
