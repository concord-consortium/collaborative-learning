import { Instance } from "mobx-state-tree";
import { typeField } from "../../../utilities/mst-utils";
import { BaseNode, BaseNodeModel, NoInputs } from "./base-node";
import { INodeServices } from "./service-types";
import { ClassicPreset } from "rete";
import { DropdownListControl, IDropdownListControl, ListOption } from "./controls/dropdown-list-control";
import { PlotButtonControl } from "./controls/plot-button-control";
import { numSocket } from "./num-socket";
import { NodeSensorTypes, kSensorMissingMessage, kSensorSelectMessage } from "../model/utilities/node";
import { NodeChannelInfo, kDeviceDisplayNames } from "../model/utilities/channel";
import { kSimulatedChannelPrefix } from "../model/utilities/simulated-channel";
import { ValueWithUnitsControl } from "./controls/value-with-units-control";
import { kEmptyValueString } from "./utilities/view-utilities";

export const SensorNodeModel = BaseNodeModel.named("SensorNodeModel")
.props({
  type: typeField("Sensor"),

  // FIXME: we'll have to migrate `type` to `sensorType`. In the old
  // saved data the sensorType will be called type.
  sensorType: "",

  sensor: "",
})
.actions(self => ({
  setSensor(sensor: string) {
    self.sensor = sensor;
    self.resetGraph();
    self.setNodeValue(NaN);
    // It isn't clear if we should reprocess, but since the graph and value
    // are getting reset it seems like a good idea to keep the downstream nodes
    // in sync with the graph.
    self.process();
  }
}))
.actions(self => ({
  setSensorType(type: string) {
    if (type === self.sensorType) return;

    self.sensorType = type;
    self.setSensor("");
  },
}));
export interface ISensorNodeModel extends Instance<typeof SensorNodeModel> {}

export class SensorNode extends BaseNode<
  NoInputs,
  { value: ClassicPreset.Socket },
  {
    sensorType: IDropdownListControl,
    sensor: IDropdownListControl,
    value: ValueWithUnitsControl,
    plotButton: PlotButtonControl
  },
  ISensorNodeModel
> {
  sensorControl: IDropdownListControl;

  constructor(
    id: string | undefined,
    model: ISensorNodeModel,
    services: INodeServices
  ) {
    super(id, model, services);

    this.addOutput("value", new ClassicPreset.Output(numSocket, "Number"));

    const sensorTypeOptions: ListOption[] = NodeSensorTypes.map(sensorType => ({
      name: sensorType.type,
      displayName: sensorType.name,
      icon: sensorType.icon
    }));
    const sensorTypeControl = new DropdownListControl(this, "sensorType", sensorTypeOptions,
      "Select Sensor Type",  "Select a sensor type");
    this.addControl("sensorType", sensorTypeControl);

    // A function is passed for the options, this way the dropdown component can
    // observe this function and re-render when its dependencies change
    this.sensorControl = new DropdownListControl(this, "sensor", [],
      "Select Sensor", kSensorSelectMessage, () => this.getSensorOptions());
    this.addControl("sensor", this.sensorControl);

    const valueControl = new ValueWithUnitsControl("Sensor", this.getDisplayValue,
      this.getUnits);
    this.addControl("value", valueControl);

    this.addControl("plotButton", new PlotButtonControl(this));
  }

  getNodeSensorType() {
    const { sensorType } = this.model;
    return NodeSensorTypes.find((s: any) => s.type === sensorType);
  }

  getDisplayValue = () => {
    const { nodeValue } = this.model;

    // If decimal places are specified for this sensor type, use them, otherwise default to 2
    const nodeSensorType = this.getNodeSensorType();
    const foundDecimalPlaces = nodeSensorType?.decimalPlaces;
    const decimalPlaces = foundDecimalPlaces !== undefined ? foundDecimalPlaces : 2;

    const displayValue = nodeValue == null || isNaN(nodeValue)
      ? kEmptyValueString
      : nodeValue.toFixed(decimalPlaces);

    return displayValue;
  };

  getUnits = () => {
    const nodeSensorType = this.getNodeSensorType();
    return nodeSensorType?.units || "";
  };

  public requiresSerial() {
    const isLiveSensor = /fsr|emg|tmp|[th]-[abcd]/; // match ids any live sensor channels
    const sensor = this.model.sensor;

    return isLiveSensor.test(sensor) && !sensor.startsWith(kSimulatedChannelPrefix);
  }

  getChannelString(ch: NodeChannelInfo) {
    if (ch.missing) {
      const deviceStr = kDeviceDisplayNames[`${ch.deviceFamily}`];
      return `${kSensorMissingMessage} Connect ${deviceStr} for live ${ch.displayName}`;
    }
    const chStr = ch.virtual
      ? `${ch.name} Demo Data`
      : ch.simulated
        ? `Simulated ${ch.name}`
        : `${ch.hubName}:${ch.type}`;
    return chStr;
  }

  convertChannelsToOptions(): ListOption[] {
    const channels = this.services.getChannels();
    if (!channels) return [];

    const channelsForType = channels.filter((ch: NodeChannelInfo) => {
      if (ch.type !== "relays"){
        return (ch.type === this.model.sensorType) || (this.model.sensorType === "");
      }
    });

    return channelsForType.map(channel => ({
      name: channel.channelId,
      displayName: this.getChannelString(channel),
      missing: channel.missing
    }));
  }

  getSensorOptions() {
    const options = this.convertChannelsToOptions();

    // If the current sensor no longer exists in the channels, then add a fake
    // sensor to the list. I'm not sure how this happens in real life. It
    // can be emulated by setting the sensor as a simulated sensor, and then
    // manually editing the document and removing the diagram view and variable
    // shared model.
    // Previously this was handled by showing the missing sensor as placeholder
    // text instead of a fake option.
    // a fake option. The fake option
    // TODO: this could be improved to have the correct displayName in most cases,
    // we'd have to search the possible channels which are not part of the listed
    // channels.
    const currentSensor = this.model.sensor;
    if (currentSensor && currentSensor !== "none" &&
        !options.find(option => option.name === currentSensor)) {
      options.unshift({
        name: currentSensor,
        displayName: currentSensor,
        missing: true
      });
    }

    if (options.length === 0) {
      options.push({
        name: "none", // TODO: might switch to "" here
        displayName: "None Available",
        active: false
      });
    }

    return options;
  }

  data(): { value: number} {
    if (this.services.inTick) {
      const chInfo =
      this.services.getChannels().find(ci => ci.channelId === this.model.sensor);

      // update virtual sensors
      if (chInfo?.virtualValueMethod && chInfo.timeFactor) {
        const time = Math.floor(Date.now() / chInfo.timeFactor);
        chInfo.value = chInfo.virtualValueMethod(time);
      }

      // update simulated sensors
      if (chInfo?.simulatedVariable) {
        chInfo.value = chInfo.simulatedVariable.currentValue || 0;
      }

      if (chInfo && isFinite(chInfo.value)) {
        this.saveNodeValue(chInfo.value);
      } else {
        // We can safely set NaN because the type of nodeValue is StringifiedNumber
        this.saveNodeValue(NaN);
      }
    }

    const value = this.model.nodeValue ?? NaN;
    return { value };
  }
}



