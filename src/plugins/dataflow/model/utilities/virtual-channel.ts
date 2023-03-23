import { NodeChannelInfo } from "./channel";
import { demoStreams } from "./demo-data";

const virtualTempChannel: NodeChannelInfo = {
  hubId: "00000-VIRTUAL-HUB", hubName: "Virtual Sensor", name: "Temperature", channelId: "00001-VIR",
  missing: false, type: "temperature", units: "°C", plug: 1, value: 0, virtual: true, timeFactor: 1000,
  virtualValueMethod: (t: number) => {
    const vals = [20, 20, 20, 21, 21, 21, 20, 20, 21, 21, 21, 21, 21, 21, 21];
    return vals[t % vals.length];
  } };
const virtualHumidChannel: NodeChannelInfo = {
  hubId: "00000-VIRTUAL-HUB", hubName: "Virtual Sensor", name: "Humidity", channelId: "00002-VIR",
  missing: false, type: "humidity", units: "%", plug: 2, value: 0, virtual: true, timeFactor: 1000,
  virtualValueMethod: (t: number) => {
    const vals = [60, 60, 60, 61, 61, 61, 62, 62, 62, 61, 61, 61, 61, 61, 61, 61];
    return vals[t % vals.length];
  } };
const virtualCO2Channel: NodeChannelInfo = {
  hubId: "00000-VIRTUAL-HUB", hubName: "Virtual Sensor", name: "CO2", channelId: "00003-VIR",
  missing: false, type: "CO2", units: "PPM", plug: 3, value: 0, virtual: true, timeFactor: 1000,
  virtualValueMethod: (t: number) => {
    const vals = [409, 409, 410, 410, 410, 410, 411, 411, 410, 410, 410, 409, 409, 411, 411];
    return vals[t % vals.length];
  } };
const virtualO2Channel: NodeChannelInfo = {
  hubId: "00000-VIRTUAL-HUB", hubName: "Virtual Sensor", name: "O2", channelId: "00004-VIR",
  missing: false, type: "O2", units: "PPM", plug: 4, value: 0, virtual: true, timeFactor: 1000,
  virtualValueMethod: (t: number) => {
    const vals = [21, 21, 21, 22, 22, 22, 21, 21, 21, 21, 22, 22, 22, 22, 22];
    return vals[t % vals.length];
  } };
const virtualLightChannel: NodeChannelInfo = {
  hubId: "00000-VIRTUAL-HUB", hubName: "Virtual Sensor", name: "Light", channelId: "00005-VIR",
  missing: false, type: "light", units: "lux", plug: 5, value: 0, virtual: true, timeFactor: 1000,
  virtualValueMethod: (t: number) => {
    const vals = [9000, 9000, 9001, 9001, 9002, 9002, 9002, 9001, 9001, 9001, 9000, 9001, 9001, 9002, 9002];
    return vals[t % vals.length];
  } };
const virtualPartChannel: NodeChannelInfo = {
  hubId: "00000-VIRTUAL-HUB", hubName: "Virtual Sensor", name: "Particulates", channelId: "00006VIR",
  missing: false, type: "particulates", units: "PM2.5", plug: 7, value: 0, virtual: true, timeFactor: 1000,
  virtualValueMethod: (t: number) => {
    const vals = [10, 10, 10, 10, 10, 10, 11, 11, 11, 11, 11, 11, 11, 11, 11];
    return vals[t % vals.length];
  } };
const virtualEmgChannelVaried: NodeChannelInfo = {
  hubId: "00000-VIRTUAL-HUB", hubName: "Virtual Sensor", name: "EMG - Varied Clenches", channelId: "00007VIR",
  missing: false, type: "emg-reading", units: "f(mv)", plug: 8, value: 0, virtual: true, timeFactor: 100,
  virtualValueMethod: (t: number) => {
    const vals = demoStreams.emgVariedPulses;
    return vals[t % vals.length];
} };
const virtualEmgChannelLongHold: NodeChannelInfo = {
  hubId: "00000-VIRTUAL-HUB", hubName: "Virtual Sensor", name: "EMG - Long Clench and Hold", channelId: "00008VIR",
  missing: false, type: "emg-reading", units: "f(mv)", plug: 9, value: 0, virtual: true, timeFactor: 100,
  virtualValueMethod: (t: number) => {
    const vals = demoStreams.emgLongHold;
    return vals[t % vals.length];
} };
const virtualEmgChannelShortHold: NodeChannelInfo = {
  hubId: "00000-VIRTUAL-HUB", hubName: "Virtual Sensor", name: "EMG - Short Clench and Hold", channelId: "00009VIR",
  missing: false, type: "emg-reading", units: "f(mv)", plug: 10, value: 0, virtual: true, timeFactor: 100,
  virtualValueMethod: (t: number) => {
    const vals = demoStreams.emgShortHold;
    return vals[t % vals.length];
} };
const virtualFsrChannel: NodeChannelInfo = {
  hubId: "00000-VIRTUAL-HUB", hubName: "Virtual Sensor", name: "FSR", channelId: "00010VIR",
  missing: false, type: "fsr-reading", units: "f(n)", plug: 11, value: 0, virtual: true, timeFactor: 100,
  virtualValueMethod: (t: number) => {
    const vals = demoStreams.fsrSqueeze;
    return vals[t % vals.length];
} };

export const virtualSensorChannels: NodeChannelInfo[] = [
  virtualTempChannel, virtualHumidChannel, virtualCO2Channel, virtualO2Channel,
  virtualLightChannel, virtualPartChannel,
  virtualEmgChannelVaried, virtualEmgChannelLongHold, virtualEmgChannelShortHold,
  virtualFsrChannel
];
