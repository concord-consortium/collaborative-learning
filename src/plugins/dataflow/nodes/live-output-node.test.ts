import { LiveOutputNode, servoDisplayMessage } from "./live-output-node";

// Minimal fake SerialDevice that records which output writer the node invoked. The keyValue
// branch of sendDataToSerialDevice reads only this.model and the device's deviceFamily, so an
// Object.create stub of the node (as the rete-manager tests do) exercises the gate directly.
function fakeSerialDevice(deviceFamily: string) {
  return {
    deviceFamily,
    gripperWrites: [] as number[],
    servoWrites: [] as number[],
    writeToOutForBBGripper(val: number) { this.gripperWrites.push(val); },
    writeToOutForServo(val: number) { this.servoWrites.push(val); },
    writeToOutForMicroBitRelayHub() { /* unused on the keyValue path */ },
  };
}

function makeNode(nodeValue: number, liveOutputType: string): LiveOutputNode {
  const node = Object.create(LiveOutputNode.prototype);
  node.model = { nodeValue, liveOutputType };
  return node;
}

function send(node: LiveOutputNode, device: ReturnType<typeof fakeSerialDevice>) {
  (node as any).sendDataToSerialDevice(device);
}

describe("LiveOutputNode.sendDataToSerialDevice output gating (CLUE-567 #1)", () => {
  it("writes a gripper command to an Arduino, which declares gripper support", () => {
    const device = fakeSerialDevice("arduino");
    send(makeNode(130, "Gripper 2.0"), device);
    expect(device.gripperWrites).toEqual([130]);
    expect(device.servoWrites).toEqual([]);
  });

  it("does not write a gripper command to a Spiker:bit, whose only output is a servo", () => {
    // Regression for the protocol-only gate: arduino and spikerbit share the keyValue
    // protocol, so gating on protocol alone let gripper integers reach the Spiker:bit's servo.
    const device = fakeSerialDevice("spikerbit");
    send(makeNode(130, "Gripper 2.0"), device);
    expect(device.gripperWrites).toEqual([]);
    expect(device.servoWrites).toEqual([]);
  });

  it("writes a servo command to a Spiker:bit", () => {
    const device = fakeSerialDevice("spikerbit");
    send(makeNode(90, "Servo"), device);
    expect(device.servoWrites).toEqual([90]);
    expect(device.gripperWrites).toEqual([]);
  });
});

// Object.create bypasses the constructor (as above); stub the bits the config getters / data() read:
// services.stores.appConfig.getSetting, services.inTick (skip the serial side-effects), saveNodeValue.
function stubbedNode(model: any, settings: Record<string, any> = {}) {
  const node: any = Object.create(LiveOutputNode.prototype);
  node.model = model;
  node.services = {
    inTick: false,
    stores: { appConfig: { getSetting: (key: string) => settings[key] } },
  };
  node.saveNodeValue = (v: number) => { node.model.nodeValue = v; };
  node.saveOutputStatus = () => { /* noop */ };
  return node as LiveOutputNode;
}

describe("servoDisplayMessage (CLUE-581)", () => {
  it("shows degrees by default", () => {
    expect(servoDisplayMessage(90, false)).toBe("90°");
    expect(servoDisplayMessage(0, false)).toBe("0°");
  });
  it("shows % rotation in proportion mode", () => {
    expect(servoDisplayMessage(0, true)).toBe("0% rotation");
    expect(servoDisplayMessage(90, true)).toBe("50% rotation");
    expect(servoDisplayMessage(180, true)).toBe("100% rotation");
  });
});

describe("Servo input mode scaling in data() (settings.dataflow.servoInputMode)", () => {
  it("degrees mode (default): stores the input as-is, clamped to 0-180", () => {
    const node = stubbedNode({ liveOutputType: "Servo" });
    (node as any).data({ nodeValue: [90] });
    expect(node.model.nodeValue).toBe(90);
  });
  it("proportion mode: scales 0-1 across the full 0-180 sweep", () => {
    const half = stubbedNode({ liveOutputType: "Servo" }, { servoInputMode: "proportion" });
    (half as any).data({ nodeValue: [0.5] });
    expect(half.model.nodeValue).toBe(90);

    const full = stubbedNode({ liveOutputType: "Servo" }, { servoInputMode: "proportion" });
    (full as any).data({ nodeValue: [1] });
    expect(full.model.nodeValue).toBe(180);

    const none = stubbedNode({ liveOutputType: "Servo" }, { servoInputMode: "proportion" });
    (none as any).data({ nodeValue: [0] });
    expect(none.model.nodeValue).toBe(0);
  });
  it("proportion mode: out-of-range input clamps to 0-180", () => {
    const node = stubbedNode({ liveOutputType: "Servo" }, { servoInputMode: "proportion" });
    (node as any).data({ nodeValue: [1.5] });
    expect(node.model.nodeValue).toBe(180);
  });
});

describe("Live Output type restriction (settings.dataflow.liveOutputTypes)", () => {
  const names = (node: LiveOutputNode) => ((node as any).allowedLiveOutputTypes as any[]).map(o => o.name);
  it("returns the full list when unset", () => {
    const node = stubbedNode({});
    expect(names(node)).toContain("Servo");
    expect(names(node)).toContain("Gripper 2.0");
  });
  it("filters to the allowed subset", () => {
    const node = stubbedNode({}, { liveOutputTypes: ["Servo"] });
    expect(names(node)).toEqual(["Servo"]);
  });
  it("falls back to the full list for an empty, unknown-only, or malformed setting", () => {
    expect(names(stubbedNode({}, { liveOutputTypes: [] })).length).toBeGreaterThan(1);
    expect(names(stubbedNode({}, { liveOutputTypes: ["Nonexistent"] })).length).toBeGreaterThan(1);
    expect(names(stubbedNode({}, { liveOutputTypes: "Servo" })).length).toBeGreaterThan(1);
  });
});
