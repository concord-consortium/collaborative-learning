// Functions for updating nodes on each tick.

import { Node } from "rete";
import { VariableType } from "@concord-consortium/diagram-view";
import { getHubSelect, getNodeValueWithType } from "./live-output-utilities";
import { NumControl } from "../controls/num-control";
import { SensorSelectControl } from "../controls/sensor-select-control";
import { NodeChannelInfo } from "../../model/utilities/channel";
import { kMaxNodeValues, NodeGeneratorTypes, NodeTimerInfo, NodeValue } from "../../model/utilities/node";
import { findOutputVariable, simulatedHubName } from "../../model/utilities/simulated-output";
import { SerialDevice } from "../../../../models/stores/serial";

function passSerialStateToChannel(sd: SerialDevice, channel: NodeChannelInfo) {
  if (sd.hasPort()){
    channel.serialConnected = true;
    const deviceMismatch = sd.deviceFamily !== channel.deviceFamily;
    const timeSinceActive = channel.usesSerial && channel.lastMessageRecievedAt
      ? Date.now() - channel.lastMessageRecievedAt: 0;
    channel.missing = deviceMismatch || timeSinceActive > 7000;
  } else {
    channel.serialConnected = false;
    channel.missing = true;
  }
}

export function sendDataToSerialDevice(n: Node, serialDevice: SerialDevice) {
  const { val, outType } = getNodeValueWithType(n);
  const isNumberOutput = isFinite(val);
  const { deviceFamily } = serialDevice;

  if (deviceFamily === "arduino" && isNumberOutput){
    serialDevice.writeToOutForBBGripper(val, outType);
  }
  if (deviceFamily === "microbit"){
    const hubSelect = getHubSelect(n);
    if (hubSelect.getChannels()){
      const hubId = hubSelect.getSelectionId();
      serialDevice.writeToOutForMicroBitRelayHub(val, hubId, outType);
    }
  }
}

export function sendDataToSimulatedOutput(n: Node, outputVariables?: VariableType[]) {
  const outputVariable = findOutputVariable(n, outputVariables);
  if (outputVariable && getHubSelect(n).getValue() === simulatedHubName(outputVariable)) {
    const { val } = getNodeValueWithType(n);

    // BROKEN, BUT TEST IF BEHAVIOR DIFFERENT WITH HARDWARE:
    // const outputValue = isFinite(val) ? val : 0;
    // outputVariable.setValue(outputValue);

    // FIX FOR NOW:
    if (isFinite(val)) outputVariable.setValue(val);

    // TODO: Should we also set the unit?
    // We'd use n.data.nodeValueUnits but it might be undefined
    // We could add a units field to getNodeValueWithType(n) ?
  }
}

export function updateNodeChannelInfo(n: Node, channels: NodeChannelInfo[], serialDevice: SerialDevice) {
  if (channels.length > 0 ){
    channels.filter(c => c.usesSerial).forEach((ch) => {
      passSerialStateToChannel(serialDevice, ch);
    });
  }

  const sensorSelect = n.controls.get("sensorSelect") as SensorSelectControl;
  if (sensorSelect) {
    sensorSelect.setChannels(channels);
    (sensorSelect as any).update();
  }
}

export function updateGeneratorNode(n: Node) {
  const generatorType = n.data.generatorType;
  const period = Number(n.data.period);
  const amplitude = Number(n.data.amplitude);
  const nodeGeneratorType = NodeGeneratorTypes.find(gt => gt.name === generatorType);
  if (nodeGeneratorType && period && amplitude) {
    const time = Date.now();
    // note: period is given in s, but we're passing in ms for time, need to adjust
    const val = nodeGeneratorType.method(time, period * 1000, amplitude);
    const nodeValue = n.controls.get("nodeValue") as NumControl;
    if (nodeValue) {
      nodeValue.setValue(val);
    }
  }
}

export function updateNodeRecentValues(n: Node) {
  const watchedValues = n.data.watchedValues as Record<string, any>;
  Object.keys(watchedValues).forEach((valueKey: string) => {
    const value: any = n.data[valueKey];
    let recentValue: NodeValue = {};

    // Store recentValue as object with unique keys for each value stored in node
    // Needed for node types that require more than a single value
    if (value === "number") {
      recentValue[valueKey] = { name: n.name, val: value };
    } else {
      recentValue = value;
    }

    const recentValues = n.data.recentValues as Record<string, any>;
    if (recentValues) {
      if (recentValues[valueKey]) {
        const newRecentValues: any = recentValues[valueKey];
        if (newRecentValues.length > kMaxNodeValues) {
          newRecentValues.shift();
        }
        newRecentValues.push(recentValue);
        recentValues[valueKey] = newRecentValues;
      } else {
        recentValues[valueKey] = [recentValue];
      }
    } else {
      n.data.recentValues = {[valueKey]: [recentValue]};
    }

    if (n.data.watchedValues) {
      n.update();
    }
  });
}

export function updateSensorNode(n: Node, channels: NodeChannelInfo[]) {
  const sensorSelect = n.controls.get("sensorSelect") as SensorSelectControl;

  if (sensorSelect) {
    const chInfo = channels.find(ci => ci.channelId === n.data.sensor);

    // update virtual sensors
    if (chInfo?.virtualValueMethod && chInfo.timeFactor) {
      const time = Math.floor(Date.now() / chInfo.timeFactor);
      chInfo.value = chInfo.virtualValueMethod(time);
    }

    // update simulated sensors
    if (chInfo?.simulatedVariable) {
      chInfo.value = chInfo.simulatedVariable.value || 0;
    }

    if (chInfo && isFinite(chInfo.value)) {
      sensorSelect.setSensorValue(chInfo.value);
    } else {
      // NaN-issue: is it that we are hitting this path when we should not?
      sensorSelect.setSensorValue(NaN);
    }
  }
}

export function updateTimerNode(n: Node) {
  const timeOn = Number(n.data.timeOn);
  const timeOff = Number(n.data.timeOff);
  if (timeOn && timeOff) {
    const time = Date.now();
    // note: time on/off is given in s, but we're passing in ms for time, need to adjust
    const val = NodeTimerInfo.method(time, timeOn * 1000, timeOff * 1000);
    const nodeValue = n.controls.get("nodeValue") as NumControl;
    if (nodeValue) {
      nodeValue.setValue(val);
    }
  }
}
