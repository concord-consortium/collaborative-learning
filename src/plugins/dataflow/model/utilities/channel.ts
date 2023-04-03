export interface NodeChannelInfo {
  hubId: string;
  hubName: string;
  channelId: string;
  missing: boolean;
  type: string;
  units: string;
  plug: number;  // TODO: make optional and preserve any usage, or remove
  value: number;
  name: string;
  virtual?: boolean;
  virtualValueMethod?: (t: number) => number;
  usesSerial?:boolean;
  serialConnected?:boolean | null;
  outputTargetDevice?: string;
  outputTargetActuator?: string;
  timeFactor?: number;
  deviceFamily?: string;
  lastMessageRecievedAt?: number | null;
  relaysState?: number[]
}

const emgSensorChannel: NodeChannelInfo = {
  hubId: "SERIAL-ARDUINO",
  hubName: "Arduino",
  name: "emg",
  channelId: "emg",
  missing: true,
  type: "emg-reading",
  units: "f(mv)",
  plug: 9,
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
  channelId: "fsr",
  missing: true,
  type: "fsr-reading",
  units: "n",
  plug: 10,
  value: 0,
  virtual: false,
  usesSerial: true,
  serialConnected: null,
  deviceFamily: "arduino"
};

interface MicroBitSensorChannelInfo {
  microBitId: string,
  type: string,
  units: string,
  plug: number
}

interface MicroBitHubInfo {
  microBitId: string,
  location?: string
  plug: number
}

const microBitHubs = [
  { microBitId: "a", plug: 19, relaysState: [0,0,0] },
  { microBitId: "b", plug: 20, relaysState: [0,0,0] },
  { microBitId: "c", plug: 21, relaysState: [0,0,0] },
  { microBitId: "d", plug: 22, relaysState: [0,0,0] },
];

// "plug" is not really used now, but considering keeping for now for ease of transition
// maybe it has a metaphor that will be useful soon
const microBitSensors: MicroBitSensorChannelInfo[] = [
 { microBitId: "a", plug: 11, type: "temperature", units: "°C" },
 { microBitId: "a", plug: 12, type: "humidity", units: "%" },
 { microBitId: "b", plug: 13, type: "temperature", units: "°C" },
 { microBitId: "b", plug: 14, type: "humidity", units: "%" },
 { microBitId: "c", plug: 15, type: "temperature", units: "°C" },
 { microBitId: "c", plug: 16, type: "humidity", units: "%" },
 { microBitId: "d", plug: 17, type: "temperature", units: "°C" },
 { microBitId: "d", plug: 18, type: "humidity", units: "%" }
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
    return {
      ...basis,
      hubId: `MICROBIT-RADIO-${s.microBitId}`,
      hubName: `microbit ${s.microBitId}`,
      name: `${s.type}-microbit-${s.microBitId}`,
      channelId: `${s.type.substring(0,1)}-${s.microBitId}`,
      type: `${s.type}`,
      units: `${s.units}`,
      plug: s.plug
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
      hubId: `MICROBIT-RADIO-${h.microBitId}`,
      hubName: `microbit ${h.microBitId}`,
      name: `relays-microbit-${h.microBitId}`,
      channelId: `r-${h.microBitId}`,
      units: `b`,
      plug: h.plug
    };
  });
  return channels;
}

const microBitSensorChannels = createMicroBitSensorChannels(microBitSensors);
const microBitRelayChannels = createMicroBitRelayInfoChannels(microBitHubs);

export const serialSensorChannels: NodeChannelInfo[] = [
  emgSensorChannel, fsrSensorChannel, ...microBitSensorChannels, ...microBitRelayChannels
];
