import { Instance, types } from "mobx-state-tree";
import { typeField } from "../../../utilities/mst-utils";
import { BaseNode, BaseNodeModel, NoInputs } from "./base-node";
import { INodeServices } from "./service-types";
import { ClassicPreset } from "rete";
import { DropdownListControl, IDropdownListControl, ListOption } from "./controls/dropdown-list-control";
import { PlotButtonControl } from "./controls/plot-button-control";
import { numSocket } from "./num-socket";
import { NodeSensorTypes, kSensorMissingMessage, kSensorSelectMessage } from "../model/utilities/node";
import { NodeChannelInfo, kDeviceDisplayNames, serialSensorChannels } from "../model/utilities/channel";
import { kSimulatedChannelPrefix, niceNameFromSimulationChannelId } from "../model/utilities/simulated-channel";
import { ValueWithUnitsControl } from "./controls/value-with-units-control";
import { kEmptyValueString } from "./utilities/view-utilities";
import { virtualSensorChannels } from "../model/utilities/virtual-channel";

const staticChannels = [...virtualSensorChannels, ...serialSensorChannels];

export const SensorNodeModel = BaseNodeModel.named("SensorNodeModel")
.props({
  type: typeField("Sensor"),
  sensorType: "",
  sensor: "",
  sensorDisplayName: types.maybe(types.string)
})
.actions(self => ({
  setSensor(sensor: string, sensorDisplayName?: string) {
    self.sensor = sensor;
    self.sensorDisplayName = sensorDisplayName;
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
    const sensorTypeControl = new DropdownListControl(this, "sensorType", model.setSensorType,
       sensorTypeOptions, "Select Input Type",  "Select an input type");
    this.addControl("sensorType", sensorTypeControl);

    // A function is passed for the options, this way the dropdown component can
    // observe this function and re-render when its dependencies change
    this.sensorControl = new DropdownListControl(this, "sensor", this.setSensorWrapper, [],
      "Select Sensor", kSensorSelectMessage, this.getSensorOptions);
    this.addControl("sensor", this.sensorControl);

    const valueControl = new ValueWithUnitsControl("Sensor", this.getDisplayValue,
      this.getUnits);
    this.addControl("value", valueControl);

    this.addControl("plotButton", new PlotButtonControl(this));
  }

  setSensorWrapper = (sensor: string) => {
    const options = this.getSensorOptions();
    const option = options.find(opt => opt.name === sensor);
    this.model.setSensor(sensor, option?.displayName);
  };

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

  getSharedProgramNodeValue() {
    return this.getDisplayValue();
  }

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

  /**
   * Do our best to return a nice name given a sensor name. This should
   * only be used for legacy sensor nodes which don't explicitly store
   * the display name of the sensor.
   *
   * @param name
   * @returns
   */
  convertSensorNameToDisplayName(name: string) {
    const staticChannel = staticChannels.find(channel => channel.channelId === name);
    if (staticChannel) {
      return this.getChannelString(staticChannel);
    }

    return niceNameFromSimulationChannelId(name);
  }


  /**
   * If the current sensor doesn't existing in the options, then add a fake sensor
   * to the list. This will happen in a few cases:
   * - when a live (not readOnly) tile is loaded and the tick hasn't happened yet
   * - when a program recording is finished and a copy of the program is displayed
   * - when a readOnly view of the tile is shown
   *
   * We store the displayName of the choice, so we can display something user
   * friendly in these cases. For the virtual channels and serial sensor channels
   * we can lookup the display name because the list of these channels is static.
   * However for the simulated sensors this display name is taken from the
   * shared variable. And we can't always look up these shared variables. In
   * particular in a recorded view of the program the shared variables are not
   * also recorded.
   *
   * For backwards compatibility we do the best we can with converting the name
   * to a displayName.
   *
   * @param options
   */
  addFakeOptionIfNecessary(options: ListOption[]) {
    const currentSensor = this.model.sensor;
    if (currentSensor && currentSensor !== "none" &&
        !options.find(option => option.name === currentSensor)) {
      options.unshift({
        name: currentSensor,
        displayName: this.model.sensorDisplayName ??
          this.convertSensorNameToDisplayName(currentSensor),
        // We don't know if this is a missing sensor or not.
        // In a readOnly view we do not have enough info to know.
        // In a live view, or a readOnly view running in the
        // same app as the live view that hasn't ticked yet, we don't know the channels
        // at that point.
        // If there was a channel that was deleted then in a live view it might be
        // correct to show this fake option as missing. The only way that can currently
        // happen is if the selected simulated variable is removed from the document.
        // Given all this, it seems the best we can do is to show this option as missing
        // when we are not readOnly. In that case there is a chance it was caused by a
        // deletion. And it will also make it clear that the channels aren't known until
        // the first tick happens.
        missing: !this.readOnly
      });
    }
  }

  getSensorOptions = () => {
    const options = this.convertChannelsToOptions();
    this.addFakeOptionIfNecessary(options);

    if (options.length === 0) {
      options.push({
        name: "none", // TODO: might switch to "" here
        displayName: "None Available",
        active: false
      });
    }

    return options;
  };

  data(): { value: number} {
    if (this.services.inTick) {
      const { sensorType } = this.model;
      const chInfo = this.services.getChannels().find(ci => ci.channelId === this.model.sensor);

      // update virtual sensors
      if (chInfo?.virtualValueMethod && chInfo.timeFactor) {
        const time = Math.floor(Date.now() / chInfo.timeFactor);
        chInfo.value = chInfo.virtualValueMethod(time);
      }

      // update simulated sensors
      if (chInfo?.simulatedVariable) {
        chInfo.value = chInfo.simulatedVariable.currentValue || 0;
      }

      if (chInfo){
        let newValue = chInfo.value;
        const isDigitalReading = sensorType === "fsr-reading" || sensorType === "pin-reading";
        if (isDigitalReading) {
          // For digital readings, if they don't exist make them zero
          if(newValue == null || isNaN(newValue)) {
            newValue = 0;
          }
        } else {
          // For other readings pass "doesn't exist" through
          if (newValue == null) {
            // This will convert null and undefined to NaN
            newValue = NaN;
          }
        }

        this.saveNodeValue(newValue);
      } else {
        // We can safely set NaN because the type of nodeValue is StringifiedNumber
        this.saveNodeValue(NaN);
      }
    }

    const value = this.model.nodeValue ?? NaN;
    return { value };
  }
}



