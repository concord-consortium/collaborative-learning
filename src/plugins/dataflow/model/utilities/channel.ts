export interface NodeChannelInfo {
  hubId: string; // would use this but "hub" is local microbit
  hubName: string;
  channelId: string;
  missing: boolean;
  type: string;
  units: string;
  plug: number;
  value: number;
  name: string;
  virtual?: boolean;
  virtualValueMethod?: (t: number) => number;
  usesSerial?:boolean;
  serialConnected?:boolean | null;
  outputTargetDevice?: string;
  outputTargetActuator?: string;
  timeFactor?: number;
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
  serialConnected: null
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
  serialConnected: null
};

interface MicroBitSensorChannelInfo {
  microBitId: string,
  type: string,
  units: string,
  plug: number
}

// "plug" is not really used now, but considering keeping for now for ease of transition
// maybe it has a metaphor that will be useful soon
const microBitSensors: MicroBitSensorChannelInfo[] = [
 { microBitId: "a", plug: 11, type: "temperature", units: "°C" },
 { microBitId: "a", plug: 12, type: "humidity", units: "%"},
 { microBitId: "b", plug: 13, type: "temperature", units: "°C"  },
 { microBitId: "b", plug: 14, type: "humidity", units: "%"  },
 { microBitId: "c", plug: 15, type: "temperature", units: "°C"  },
 { microBitId: "c", plug: 16, type: "humidity", units: "%"  },
 { microBitId: "d", plug: 17, type: "temperature", units: "°C"  },
 { microBitId: "d", plug: 18, type: "humidity", units: "%"  }
];

function createMicroBitChannels(sensors: MicroBitSensorChannelInfo[] ){
  const basis = {
    missing: true,
    value: 0,
    virtual: false,
    usesSerial: true,
    serialConnected: null
  };

  const channels = sensors.map((s) => {
    return {
      ...basis,
      hubId: `MICROBIT-RADIO-${s.microBitId}`,
      hubName: `micro:bit ${s.microBitId}`,
      name: `${s.type}-micro:bit-${s.microBitId}`,
      channelId: `${s.type.substring(0,1)}-${s.microBitId}`,
      type: `${s.type}`,
      units: `${s.units}`,
      plug: s.plug
    };
  });
  return channels;
}

const microBitSensorChannels = createMicroBitChannels(microBitSensors);

console.log("SERIAL created microbit channels: ", microBitSensorChannels)
export const serialSensorChannels: NodeChannelInfo[] = [
  emgSensorChannel, fsrSensorChannel, ...microBitSensorChannels
];
