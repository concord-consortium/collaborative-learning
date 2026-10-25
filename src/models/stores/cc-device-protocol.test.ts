import {
  ccChecksum, withChecksum, parseCcDeviceLine, splitLines, parseHello
} from "./cc-device-protocol";

describe("ccChecksum", () => {
  it("XORs every character and formats two uppercase hex digits", () => {
    expect(ccChecksum("emg:512")).toBe("63");
    expect(ccChecksum("emg:8")).toBe("6D");
    expect(withChecksum("ok #7")).toBe("ok #7*30");
  });
});

describe("parseCcDeviceLine", () => {
  it("parses a reading with and without a checksum", () => {
    expect(parseCcDeviceLine("emg:512")).toEqual({ kind: "reading", name: "emg", value: 512 });
    expect(parseCcDeviceLine(withChecksum("emg:512"))).toEqual({ kind: "reading", name: "emg", value: 512 });
  });
  it("keeps signs and fractions", () => {
    expect(parseCcDeviceLine("tmp:-1.25")).toEqual({ kind: "reading", name: "tmp", value: -1.25 });
  });
  it("accepts / and _ in names", () => {
    expect(parseCcDeviceLine("a/relay_1:1")).toEqual({ kind: "reading", name: "a/relay_1", value: 1 });
  });
  it("returns null for a wrong checksum, accepting either hex case", () => {
    expect(parseCcDeviceLine("emg:512*00")).toBeNull();
    expect(parseCcDeviceLine("emg:8*6d")).toEqual({ kind: "reading", name: "emg", value: 8 });
  });
  it("parses ok #n, and err with and without #n", () => {
    expect(parseCcDeviceLine("ok #12")).toEqual({ kind: "ok", seq: 12 });
    expect(parseCcDeviceLine("err #3 nosession")).toEqual({ kind: "err", seq: 3, reason: "nosession" });
    expect(parseCcDeviceLine("err checksum")).toEqual({ kind: "err", reason: "checksum" });
    // An err without a reason still answers its command.
    expect(parseCcDeviceLine("err #3")).toEqual({ kind: "err", seq: 3, reason: "" });
  });
  it("parses hello fields", () => {
    expect(parseCcDeviceLine("hello protocol:CCDeviceProtocol version:1 device:spikerbit firmware:4"))
      .toEqual({
        kind: "hello",
        fields: { protocol: "CCDeviceProtocol", version: "1", device: "spikerbit", firmware: "4" }
      });
  });
  it("treats anything else as unknown", () => {
    expect(parseCcDeviceLine("cap sensor:emg")).toEqual({ kind: "unknown" });
    expect(parseCcDeviceLine("emg:abc")).toEqual({ kind: "unknown" });
    expect(parseCcDeviceLine("CLUE-SPIKERBIT v3")).toEqual({ kind: "unknown" });
    // Reading names are lowercase.
    expect(parseCcDeviceLine("EMG:1")).toEqual({ kind: "unknown" });
    // An ok always carries the #n it answers, and nothing after it.
    expect(parseCcDeviceLine("ok")).toEqual({ kind: "unknown" });
    expect(parseCcDeviceLine("ok #3 junk")).toEqual({ kind: "unknown" });
  });
});

describe("splitLines", () => {
  it("keeps a partial line, including one split inside *hh or between \\r and \\n", () => {
    expect(splitLines("emg:1*3")).toEqual({ lines: [], remaining: "emg:1*3" });
    expect(splitLines("emg:1\r")).toEqual({ lines: [], remaining: "emg:1\r" });
    expect(splitLines("emg:1\r\nok #2\r\nemg")).toEqual({ lines: ["emg:1", "ok #2"], remaining: "emg" });
  });
  it("removes only the \\r that ends a line, so a corrupted line still fails its checksum", () => {
    const { lines } = splitLines("emg:1\r2*56\r\n");
    expect(lines).toEqual(["emg:1\r2*56"]);
    expect(parseCcDeviceLine(lines[0])).toBeNull();
  });
});

describe("parseHello", () => {
  it("reads the four fields", () => {
    expect(parseHello({ protocol: "CCDeviceProtocol", version: "1", device: "spikerbit", firmware: "4" }))
      .toEqual({ protocol: "CCDeviceProtocol", version: 1, device: "spikerbit", firmware: 4 });
  });
  it("rejects missing or non-numeric fields", () => {
    expect(parseHello({ protocol: "CCDeviceProtocol", version: "1", device: "spikerbit" })).toBeNull();
    expect(parseHello({ protocol: "CCDeviceProtocol", version: "x", device: "spikerbit", firmware: "4" })).toBeNull();
    expect(parseHello({ protocol: "CCDeviceProtocol", version: "", device: "spikerbit", firmware: "4" })).toBeNull();
  });
  it("rejects a number too large to hold", () => {
    const firmware = "9".repeat(400);
    expect(parseHello({ protocol: "CCDeviceProtocol", version: "1", device: "spikerbit", firmware })).toBeNull();
  });
});
