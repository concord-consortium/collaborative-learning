import { NodeChannelInfo } from "../../plugins/dataflow/model/utilities/channel";
import { withChecksum } from "./cc-device-protocol";
import { IDeviceTransport } from "./device-transport";
import { SerialDevice } from "./serial";

class FakeTransport implements IDeviceTransport {
  written: string[] = [];
  onData?: (chunk: string) => void;
  onDisconnect?: () => void;
  write(line: string) { this.written.push(line); }
  async close() { /* no-op */ }
}

// The body of a written line, without its checksum.
const lastBody = (transport: FakeTransport) => transport.written[transport.written.length - 1].split("*")[0];

const ack = (transport: FakeTransport, seq: number) => transport.onData?.(`${withChecksum(`ok #${seq}`)}\r\n`);

describe("SerialDevice with a ccDevice device", () => {
  let serialDevice: SerialDevice;
  let transport: FakeTransport;

  beforeEach(() => {
    jest.useFakeTimers();
    serialDevice = new SerialDevice();
    transport = new FakeTransport();
  });

  afterEach(() => {
    serialDevice.clearActiveDevice();
    jest.useRealTimers();
  });

  it("starts a session when a ccDevice device becomes active", () => {
    serialDevice.setActiveDevice("spikerbit", transport);
    expect(transport.written[0]).toMatch(/^open session:\d+ #1\*[0-9A-F]{2}$/);
    expect(serialDevice.ccDeviceSession).toBeDefined();
  });

  it("does not start a session for other protocols", () => {
    serialDevice.setActiveDevice("arduino", transport);
    expect(transport.written).toEqual([]);
    expect(serialDevice.ccDeviceSession).toBeUndefined();
  });

  it("routes inbound data to the session's parser", () => {
    const emgChannel = { channelId: "emg", value: 0 } as NodeChannelInfo;
    serialDevice.registerChannelSource(() => [emgChannel]);
    serialDevice.setActiveDevice("spikerbit", transport);
    ack(transport, 1);
    transport.onData?.("emg:33\r\n");
    expect(emgChannel.value).toBe(33);
  });

  function expectNoMoreWrites(old: FakeTransport) {
    const count = old.written.length;
    jest.advanceTimersByTime(5000);
    expect(old.written.length).toBe(count);
  }

  it("stops the session on clearActiveDevice", () => {
    serialDevice.setActiveDevice("spikerbit", transport);
    ack(transport, 1);
    serialDevice.clearActiveDevice();
    expect(serialDevice.ccDeviceSession).toBeUndefined();
    expectNoMoreWrites(transport);
  });

  it("stops the session on a transport disconnect", () => {
    serialDevice.setActiveDevice("spikerbit", transport);
    ack(transport, 1);
    transport.onDisconnect?.();
    expectNoMoreWrites(transport);
  });

  it("stops the old session on a second setActiveDevice", () => {
    serialDevice.setActiveDevice("spikerbit", transport);
    ack(transport, 1);
    const second = new FakeTransport();
    serialDevice.setActiveDevice("spikerbit", second);
    expectNoMoreWrites(transport);
    expect(second.written[0]).toMatch(/^open session:/);
  });

  it("writes servo as servo:<angle> to a ccDevice device", () => {
    serialDevice.setActiveDevice("spikerbit", transport);
    serialDevice.writeToOutForServo(0, "Servo");
    expect(lastBody(transport)).toBe("servo:30");
  });

  it("still writes a bare angle to an Arduino", () => {
    serialDevice.setActiveDevice("arduino", transport);
    serialDevice.writeToOutForServo(90, "Servo");
    expect(transport.written).toEqual(["90"]);
  });

  it("endSession sends close and stops the session", async () => {
    serialDevice.setActiveDevice("spikerbit", transport);
    ack(transport, 1);
    await serialDevice.endSession();
    expect(lastBody(transport)).toMatch(/^close session:\d+$/);
    expectNoMoreWrites(transport);
  });

  it("endSession resolves at once without a session", async () => {
    await expect(serialDevice.endSession()).resolves.toBeUndefined();
  });
});
