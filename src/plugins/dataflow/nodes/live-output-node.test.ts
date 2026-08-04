import { LiveOutputNode } from "./live-output-node";

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
