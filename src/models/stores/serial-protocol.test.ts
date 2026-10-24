import { NodeChannelInfo } from "../../plugins/dataflow/model/utilities/channel";
import {
  parseKeyValueData, detectSpikerbitVersion, detectFirmwareReply, shouldFlash, FirmwareReply
} from "./serial-protocol";
import { withChecksum } from "./cc-device-protocol";

function emgChannel(): NodeChannelInfo {
  return {
    name: "emg", displayName: "EMG",
    channelId: "emg", missing: true, type: "emg-reading", units: "mV", value: 0,
    virtual: false, usesSerial: true, serialConnected: null, protocol: "keyValue"
  };
}

describe("parseKeyValueData", () => {
  it("updates the matching channel value from a complete line", () => {
    const channels = [emgChannel()];
    const remaining = parseKeyValueData("emg:512\r\n", channels);
    expect(channels[0].value).toBe(512);
    expect(remaining).toBe("");
  });

  it("updates every channel with the matching id", () => {
    const a = emgChannel();
    const b = emgChannel();
    const before = Date.now();
    parseKeyValueData("emg:42\r\n", [a, b]);
    expect(a.value).toBe(42);
    expect(b.value).toBe(42);
    expect(a.lastMessageReceivedAt).toBeGreaterThanOrEqual(before);
    expect(b.lastMessageReceivedAt).toBeGreaterThanOrEqual(before);
  });

  it("keeps an incomplete trailing line in the returned buffer", () => {
    const channels = [emgChannel()];
    const remaining = parseKeyValueData("emg:512\r\nemg:2", channels);
    expect(channels[0].value).toBe(512);
    expect(remaining).toBe("emg:2");
  });

  it("discards a corrupted complete line and recovers on the next", () => {
    const channels = [emgChannel()];
    const remaining = parseKeyValueData("emgNaN\r\nemg:7\r\n", channels);
    expect(channels[0].value).toBe(7);
    expect(remaining).toBe("");
  });

  it("consumes unknown channels without throwing", () => {
    const channels = [emgChannel()];
    const remaining = parseKeyValueData("fsr:3\r\nemg:9\r\n", channels);
    expect(channels[0].value).toBe(9);
    expect(remaining).toBe("");
  });

  it("tolerates trailing whitespace between the value and the line ending", () => {
    // A board running older firmware pads each serial line with spaces before \r\n,
    // e.g. "emg:57                    \r\n". The value must still be parsed.
    const channels = [emgChannel()];
    const remaining = parseKeyValueData("emg:57                    \r\nemg:42                    \r\n", channels);
    expect(channels[0].value).toBe(42);
    expect(remaining).toBe("");
  });

  it("stamps lastMessageReceivedAt on a channel it updates so staleness can be detected", () => {
    const channels = [emgChannel()];
    const before = Date.now();
    parseKeyValueData("emg:512\r\n", channels);
    expect(channels[0].lastMessageReceivedAt).toBeGreaterThanOrEqual(before);
  });

  it("leaves lastMessageReceivedAt stale on a channel the stream never sends", () => {
    // A Spiker:bit satisfies fsr by protocol but never emits it; the seeded-stale timestamp
    // must not be refreshed, so the freshness check flips fsr to `missing`.
    const emg = emgChannel();
    const fsr: NodeChannelInfo = { ...emgChannel(), name: "fsr", channelId: "fsr", lastMessageReceivedAt: 1000 };
    parseKeyValueData("emg:512\r\n", [emg, fsr]);
    expect(fsr.lastMessageReceivedAt).toBe(1000);
  });
});

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

  it("tolerates trailing whitespace after the version (micro:bit pads its lines)", () => {
    const { version, remaining } = detectSpikerbitVersion("CLUE-SPIKERBIT v1              \r\nemg:5\r\n");
    expect(version).toBe(1);
    expect(remaining).toBe("emg:5\r\n");
  });
});

describe("detectFirmwareReply", () => {
  const hello = "hello protocol:CCDeviceProtocol version:1 device:spikerbit firmware:4";
  it("finds a hello line after stale readings", () => {
    const { reply, remaining } = detectFirmwareReply(`emg:5\r\n${withChecksum(hello)}\r\nemg:6`);
    expect(reply).toEqual({
      kind: "ccDevice",
      hello: { protocol: "CCDeviceProtocol", version: 1, device: "spikerbit", firmware: 4 }
    });
    expect(remaining).toBe("emg:6");
  });
  it("waits for a hello split across chunks", () => {
    expect(detectFirmwareReply("hello protocol:CCDevice").reply).toBeNull();
  });
  it("still recognizes the padded legacy banner", () => {
    expect(detectFirmwareReply("CLUE-SPIKERBIT v2      \r\n").reply).toEqual({ kind: "legacy", firmware: 2 });
  });
  it("ignores a hello with a bad checksum", () => {
    expect(detectFirmwareReply(`${hello}*00\r\n`).reply).toBeNull();
  });
});

describe("shouldFlash", () => {
  const cc = (version: number, firmware: number, protocol = "CCDeviceProtocol", device = "spikerbit"): FirmwareReply =>
    ({ kind: "ccDevice", hello: { protocol, version, device, firmware } });
  it.each([
    ["no reply", null, true],
    ["a legacy banner", { kind: "legacy", firmware: 3 } as FirmwareReply, true],
    ["another protocol", cc(1, 4, "Other"), true],
    ["a newer protocol version, even with newer firmware", cc(2, 9), true],
    ["another device on the same protocol, even with newer firmware", cc(1, 9, "CCDeviceProtocol", "other"), true],
    ["older firmware", cc(1, 3), true],
    ["the same firmware", cc(1, 4), false],
    ["newer firmware", cc(1, 5), false],
  ])("%s", (_label, reply, expected) => {
    expect(shouldFlash(reply, "spikerbit", 4)).toBe(expected);
  });
});
