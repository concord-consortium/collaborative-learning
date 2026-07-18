import { NodeChannelInfo } from "../../plugins/dataflow/model/utilities/channel";
import { parseArduinoSerialData } from "./serial-protocol";

function emgChannel(): NodeChannelInfo {
  return {
    hubId: "SERIAL-ARDUINO", hubName: "Arduino", name: "emg", displayName: "EMG",
    channelId: "emg", missing: true, type: "emg-reading", units: "mV", value: 0,
    virtual: false, usesSerial: true, serialConnected: null, deviceFamily: "arduino"
  };
}

describe("parseArduinoSerialData", () => {
  it("updates the matching channel value from a complete line", () => {
    const channels = [emgChannel()];
    const remaining = parseArduinoSerialData("emg:512\r\n", channels);
    expect(channels[0].value).toBe(512);
    expect(remaining).toBe("");
  });

  it("keeps an incomplete trailing line in the returned buffer", () => {
    const channels = [emgChannel()];
    const remaining = parseArduinoSerialData("emg:512\r\nemg:2", channels);
    expect(channels[0].value).toBe(512);
    expect(remaining).toBe("emg:2");
  });

  it("discards a corrupted complete line and recovers on the next", () => {
    const channels = [emgChannel()];
    const remaining = parseArduinoSerialData("emgNaN\r\nemg:7\r\n", channels);
    expect(channels[0].value).toBe(7);
    expect(remaining).toBe("");
  });

  it("consumes unknown channels without throwing", () => {
    const channels = [emgChannel()];
    const remaining = parseArduinoSerialData("fsr:3\r\nemg:9\r\n", channels);
    expect(channels[0].value).toBe(9);
    expect(remaining).toBe("");
  });
});

import { detectSpikerbitVersion } from "./serial-protocol";

describe("detectSpikerbitVersion", () => {
  it("returns the version and strips through the match when present", () => {
    const { version, remaining } = detectSpikerbitVersion("noise CLUE-SPIKERBIT v1\r\nemg:5\r\n");
    expect(version).toBe(1);
    expect(remaining).toBe("emg:5\r\n");
  });

  it("returns null and the untouched buffer when absent", () => {
    const { version, remaining } = detectSpikerbitVersion("emg:5\r\n");
    expect(version).toBeNull();
    expect(remaining).toBe("emg:5\r\n");
  });

  it("parses multi-digit versions", () => {
    const { version } = detectSpikerbitVersion("CLUE-SPIKERBIT v12\r\n");
    expect(version).toBe(12);
  });
});
