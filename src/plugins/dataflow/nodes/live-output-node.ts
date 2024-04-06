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
import { IInputValueControl, InputValueControl } from "./controls/input-value-control";
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
  hubSelect: ""
})
.actions(self => ({
  setLiveOutputType(outputType: string) {
    self.liveOutputType = outputType;
  },
  setHubSelect(hub: string) {
    self.hubSelect = hub;
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
  inputValueControl: IInputValueControl;
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

    this.inputValueControl = new InputValueControl(this, "nodeValue", "", "Display for nodeValue");
    nodeValueInput.addControl(this.inputValueControl);
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
    const anyOuputFound = simOption || deviceFamily === "arduino" || deviceFamily === "microbit";
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

    if (!anyOuputFound && !options.includes(warningOption)) options.push(warningOption);

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

  tick() {
    const { stores, runnable } = this.services;
    const outputVariables = this.services.getOutputVariables();
    const outputVar = this.findOutputVariable();
    const foundDeviceFamily = stores.serialDevice.deviceFamily ?? "unknown device";
    if (runnable) {
      this.sendDataToSerialDevice(stores.serialDevice);
      this.sendDataToSimulatedOutput(outputVariables);
    }
    this.setLiveOutputOpts(foundDeviceFamily, outputVar);
    return true;
  }

  data({nodeValue}: {nodeValue?: number[]}) {
    // if there is not a valid input, use 0
    const value = nodeValue && nodeValue[0] != null && !isNaN(nodeValue[0]) ? nodeValue[0] : 0;

    if (kBinaryOutputTypes.includes(this.model.liveOutputType)) {
      // convert all non-zero to 1
      const newValue = +(value !== 0);
      this.model.setNodeValue(newValue);
      this.inputValueControl.setDisplayMessage(newValue === 0 ? "off" : "on");
    } else if (kGripperOutputTypes.includes(this.model.liveOutputType)){
      // NOTE: this looks similar to the Demo Output Node, but in this case we
      // are setting the nodeValue to 0-100. In the Demo Output Node it is set to
      // 0-1
      const newValue = getPercentageAsInt(value);
      this.model.setNodeValue(newValue);
      const roundedDisplayValue = Math.round((newValue / 10) * 10);
      this.inputValueControl.setDisplayMessage(`${roundedDisplayValue}% closed`);
    } else {
      // We shouldn't hit this case but if we do then just pass the value through
      this.model.setNodeValue(value);
      this.inputValueControl.setDisplayMessage(`${value}`);
    }

    return {};
  }
}

function getPercentageAsInt(num: number){
  if (num > 1)  return 100;
  if (num < 0)  return 0;
  return Math.round(num * 100);
}
