import { VariableType } from "@concord-consortium/diagram-view";

export interface NodeChannelInfo {
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
  // The wire protocol this channel's data uses (see DeviceProtocol): "keyValue" or
  // "radioHub". A connected device satisfies this channel when its protocol matches.
  protocol?: string | undefined;
  lastMessageReceivedAt?: number | null;
  relaysState?: number[];
  microbitId?: string;
}

const emgSensorChannel: NodeChannelInfo = {
  name: "emg",
  displayName: "EMG",
  channelId: "emg",
  missing: true,
  type: "emg-reading",
  units: "mV",
  value: 0,
  virtual: false,
  usesSerial: true,
  serialConnected: null,
  protocol: "keyValue"
};

export const fsrSensorChannel: NodeChannelInfo = {
  name: "fsr",
  displayName: "Pressure",
  channelId: "fsr",
  missing: true,
  type: "fsr-reading",
  units: "psi",
  value: 0,
  virtual: false,
  usesSerial: true,
  serialConnected: null,
  protocol: "keyValue"
};

export const tmpSensorChannel: NodeChannelInfo = {
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
  protocol: "keyValue"
};

export const a1PinChannel: NodeChannelInfo = {
  name: "a1",
  displayName: "A1",
  channelId: "a1",
  missing: true,
  type: "pin-reading",
  units: "n",
  value: 0,
  virtual: false,
  usesSerial: true,
  serialConnected: null,
  protocol: "keyValue"
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
    protocol: "radioHub",
    lastMessageReceivedAt: Date.now()
  };

  const channels = sensors.map((s) => {
    const hubDisplayName = s.microBitId.toUpperCase();
    const sensorTypeDisplayName = `${s.type.charAt(0).toUpperCase()}${s.type.slice(1)}`;
    return {
      ...basis,
      microbitId: s.microBitId,
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
    protocol: "radioHub",
    lastMessageReceivedAt: Date.now()
  };

  const channels = hubs.map((h) => {
    return {
      ...basis,
      microbitId: h.microBitId,
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
  emgSensorChannel, fsrSensorChannel, tmpSensorChannel, a1PinChannel,
  ...microBitSensorChannels, ...microBitRelayChannels
];

