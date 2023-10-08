import { VariableType } from "@concord-consortium/diagram-view";

export interface NodeChannelInfo {
  hubId: string;
  hubName: string;
  channelId: string;
  missing: boolean;
  type: string;
  units: string;
  value: number;
  name: string;
  displayName?: string;
  simulated?: boolean;
  simulatedVariable?: VariableType;
  virtual?: boolean;
  virtualValueMethod?: (t: number) => number;
  usesSerial?:boolean;
  serialConnected?:boolean | null;
  outputTargetDevice?: string;
  outputTargetActuator?: string;
  timeFactor?: number;
  deviceFamily?: string | undefined;
  lastMessageRecievedAt?: number | null;
  relaysState?: number[];
  microbitId?: string;
}

const emgSensorChannel: NodeChannelInfo = {
  hubId: "SERIAL-ARDUINO",
  hubName: "Arduino",
  name: "emg",
  displayName: "EMG",
  channelId: "emg",
  missing: true,
  type: "emg-reading",
  units: "f(mv)",
  value: 0,
  virtual: false,
  usesSerial: true,
  serialConnected: null,
  deviceFamily: "arduino"
};

export const fsrSensorChannel: NodeChannelInfo = {
  hubId: "SERIAL-ARDUINO",
  hubName: "Arduino",
  name: "fsr",
  displayName: "Pressure",
  channelId: "fsr",
  missing: true,
  type: "fsr-reading",
  units: "n",
  value: 0,
  virtual: false,
  usesSerial: true,
  serialConnected: null,
  deviceFamily: "arduino"
};

export const tmpSensorChannel: NodeChannelInfo = {
  hubId: "SERIAL-ARDUINO",
  hubName: "Arduino",
  name: "tmp",
  displayName: "Temperature",
  channelId: "tmp",
  missing: true,
  type: "temperature",
  units: "n",
  value: 0,
  virtual: false,
  usesSerial: true,
  serialConnected: null,
  deviceFamily: "arduino"
};

interface MicroBitSensorChannelInfo {
  microBitId: string,
  type: string,
  units: string
}

interface MicroBitHubInfo {
  microBitId: string,
  location?: string
}

const microBitHubs = [
  { microBitId: "a", relaysState: [0,0,0] },
  { microBitId: "b", relaysState: [0,0,0] },
  { microBitId: "c", relaysState: [0,0,0] },
  { microBitId: "d", relaysState: [0,0,0] },
];

const microBitSensors: MicroBitSensorChannelInfo[] = [
 { microBitId: "a", type: "temperature", units: "°C" },
 { microBitId: "a", type: "humidity", units: "%" },
 { microBitId: "b", type: "temperature", units: "°C" },
 { microBitId: "b", type: "humidity", units: "%" },
 { microBitId: "c", type: "temperature", units: "°C" },
 { microBitId: "c", type: "humidity", units: "%" },
 { microBitId: "d", type: "temperature", units: "°C" },
 { microBitId: "d", type: "humidity", units: "%" }
];

function createMicroBitSensorChannels(sensors: MicroBitSensorChannelInfo[] ){
  const basis = {
    missing: true,
    value: 0,
    virtual: false,
    usesSerial: true,
    serialConnected: null,
    deviceFamily: "microbit",
    lastMessageRecievedAt: Date.now()
  };

  const channels = sensors.map((s) => {
    const hubDisplayName = s.microBitId.toUpperCase();
    const sensorTypeDisplayName = `${s.type.charAt(0).toUpperCase()}${s.type.slice(1)}`;
    return {
      ...basis,
      microbitId: s.microBitId,
      hubId: `MICROBIT-RADIO-${s.microBitId}`,
      hubName: `microbit ${s.microBitId}`,
      name: `${s.type}-microbit-${s.microBitId}`,
      displayName: `${sensorTypeDisplayName} ${hubDisplayName}`,
      channelId: `${s.type.substring(0,1)}-${s.microBitId}`,
      type: `${s.type}`,
      units: `${s.units}`
    };
  });
  return channels;
}

function createMicroBitRelayInfoChannels(hubs: MicroBitHubInfo[] ){
  const basis = {
    missing: true,
    value: 0,
    virtual: false,
    type: "relays",
    usesSerial: true,
    serialConnected: null,
    deviceFamily: "microbit",
    lastMessageRecievedAt: Date.now()
  };

  const channels = hubs.map((h) => {
    return {
      ...basis,
      microbitId: h.microBitId,
      hubId: `MICROBIT-RADIO-${h.microBitId}`,
      hubName: `microbit ${h.microBitId}`,
      name: `relays-microbit-${h.microBitId}`,
      channelId: `r-${h.microBitId}`,
      units: `b`
    };
  });
  return channels;
}

const microBitSensorChannels = createMicroBitSensorChannels(microBitSensors);
const microBitRelayChannels = createMicroBitRelayInfoChannels(microBitHubs);

export const serialSensorChannels: NodeChannelInfo[] = [
  emgSensorChannel, fsrSensorChannel, tmpSensorChannel,
  ...microBitSensorChannels, ...microBitRelayChannels
];

export const kDeviceDisplayNames: Record<string, string> = {
  "arduino": "Arduino",
  "microbit": "micro:bit"
};
