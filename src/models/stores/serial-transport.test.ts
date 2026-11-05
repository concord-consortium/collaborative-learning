import { autorun } from "mobx";
import { SerialDevice } from "./serial";
import { IDeviceTransport } from "./device-transport";
import { NodeChannelInfo } from "../../plugins/dataflow/model/utilities/channel";

function fakeTransport(sink: string[]): IDeviceTransport {
  return {
    write: (line: string) => { sink.push(line); },
    close: async () => undefined,
  };
}

describe("SerialDevice active-transport routing", () => {
  it("routes writeLine through the active transport", () => {
    const device = new SerialDevice();
    const written: string[] = [];
    device.setActiveDevice("arduino", fakeTransport(written));

    expect(device.isConnected()).toBe(true);
    expect(device.deviceFamily).toBe("arduino");

    device.writeLine("90");
    expect(written).toEqual(["90"]);
  });

  it("writeToOutForServo scales and writes through the active transport", () => {
    const device = new SerialDevice();
    const written: string[] = [];
    device.setActiveDevice("arduino", fakeTransport(written));

    // Servo config: angleScale 2/3, angleOffset 30 -> for n=0: 2/3*0+30 = 30
    device.writeToOutForServo(0, "Servo");
    expect(written).toEqual(["30"]);
  });

  it("clearActiveDevice disconnects", () => {
    const device = new SerialDevice();
    device.setActiveDevice("spikerbit", fakeTransport([]));
    device.clearActiveDevice();
    expect(device.isConnected()).toBe(false);
    expect(device.activeTransport).toBeUndefined();
    expect(device.deviceFamily).toBeUndefined();
  });

  it("clearActiveDevice resets raisesWebSerialConnect so it can't stick to a later device", () => {
    const device = new SerialDevice();
    device.setActiveDevice("arduino", fakeTransport([]));
    device.setRaisesWebSerialConnect(true);
    device.clearActiveDevice();
    expect(device.raisesWebSerialConnect).toBe(false);
  });

  it("ignores a stale transport's onDisconnect after a newer device has taken over", () => {
    const device = new SerialDevice();
    const transportA = fakeTransport([]);
    const transportB = fakeTransport([]);

    device.setActiveDevice("arduino", transportA);
    device.setActiveDevice("microbit", transportB);

    // Simulate transportA's read loop finally giving up long after transportB took over.
    transportA.onDisconnect?.("lost");

    expect(device.isConnected()).toBe(true);
    expect(device.activeTransport).toBe(transportB);
    expect(device.deviceFamily).toBe("microbit");
  });
});

describe("SerialDevice loss records", () => {
  it("onDisconnect('lost') clears the device and records it as lost", () => {
    const device = new SerialDevice();
    const transport = fakeTransport([]);
    device.setActiveDevice("arduino", transport);
    transport.onDisconnect?.("lost");
    expect(device.isConnected()).toBe(false);
    expect(device.lastLoss?.reason).toBe("lost");
    expect(device.lastLoss?.transport).toBe(transport);
  });

  it("onDisconnect('unplugged') clears the device and records it as unplugged", () => {
    const device = new SerialDevice();
    const transport = fakeTransport([]);
    device.setActiveDevice("arduino", transport);
    transport.onDisconnect?.("unplugged");
    expect(device.isConnected()).toBe(false);
    expect(device.lastLoss?.reason).toBe("unplugged");
  });

  it("an unplug after a loss from the same transport upgrades it, keeping its time", () => {
    const device = new SerialDevice();
    const transport = fakeTransport([]);
    device.setActiveDevice("arduino", transport);
    transport.onDisconnect?.("lost");
    const at = device.lastLoss?.at;
    transport.onDisconnect?.("unplugged");
    expect(device.lastLoss?.reason).toBe("unplugged");
    expect(device.lastLoss?.at).toBe(at);
  });

  it("an unplug from a transport that isn't the last one lost changes nothing", () => {
    const device = new SerialDevice();
    const transportA = fakeTransport([]);
    const transportB = fakeTransport([]);
    device.setActiveDevice("arduino", transportA);
    device.setActiveDevice("arduino", transportB);
    transportB.onDisconnect?.("lost");
    transportA.onDisconnect?.("unplugged");
    expect(device.lastLoss?.reason).toBe("lost");
    expect(device.lastLoss?.transport).toBe(transportB);
  });

  it("a later lost doesn't undo an unplug", () => {
    const device = new SerialDevice();
    const transport = fakeTransport([]);
    device.setActiveDevice("arduino", transport);
    transport.onDisconnect?.("unplugged");
    transport.onDisconnect?.("lost");
    expect(device.lastLoss?.reason).toBe("unplugged");
  });

  it("clearActiveDevice() with no reason records no loss", () => {
    const device = new SerialDevice();
    device.setActiveDevice("arduino", fakeTransport([]));
    device.clearActiveDevice();
    expect(device.lastLoss).toBeUndefined();
  });

  it("setActiveDevice and clearLastLoss clear the last loss", () => {
    const device = new SerialDevice();
    const transport = fakeTransport([]);
    device.setActiveDevice("arduino", transport);
    transport.onDisconnect?.("lost");
    device.clearLastLoss();
    expect(device.lastLoss).toBeUndefined();
    transport.onDisconnect?.("unplugged");
    expect(device.lastLoss).toBeUndefined();
    device.setActiveDevice("arduino", transport);
    transport.onDisconnect?.("lost");
    device.setActiveDevice("arduino", fakeTransport([]));
    expect(device.lastLoss).toBeUndefined();
  });

  it("lastLoss is observable", () => {
    const device = new SerialDevice();
    const transport = fakeTransport([]);
    const seen: Array<string | undefined> = [];
    const dispose = autorun(() => { seen.push(device.lastLoss?.reason); });
    device.setActiveDevice("arduino", transport);
    transport.onDisconnect?.("lost");
    transport.onDisconnect?.("unplugged");
    dispose();
    expect(seen).toEqual([undefined, "lost", "unplugged"]);
  });
});

describe("SerialDevice.receive protocol routing", () => {
  function arduinoChannel() {
    return { channelId: "emg", value: 0 } as any;
  }
  it("routes to the arduino parser when the device protocol is arduino", () => {
    const device = new SerialDevice();
    const ch = arduinoChannel();
    device.registerChannelSource(() => [ch]);
    device.deviceFamily = "arduino";
    device.receive("emg:42\r\n");
    expect(ch.value).toBe(42);
  });
  it("does not update arduino channels when the device protocol is microbit", () => {
    const device = new SerialDevice();
    const ch = arduinoChannel();
    device.registerChannelSource(() => [ch]);
    device.deviceFamily = "microbit";
    device.receive("emg:42\r\n");
    expect(ch.value).toBe(0);
  });

  it("receive updates the matching channel in every registered source", () => {
    const device = new SerialDevice();
    const a = arduinoChannel();
    const b = arduinoChannel();
    device.registerChannelSource(() => [a]);
    device.registerChannelSource(() => [b]);
    device.deviceFamily = "arduino";
    device.receive("emg:7\r\n");
    expect(a.value).toBe(7);
    expect(b.value).toBe(7);
  });

  it("receive updates the matching radio-hub channel in every registered source", () => {
    const device = new SerialDevice();
    const a = { channelId: "t-a", value: 0 } as NodeChannelInfo;
    const b = { channelId: "t-a", value: 0 } as NodeChannelInfo;
    device.registerChannelSource(() => [a]);
    device.registerChannelSource(() => [b]);
    device.deviceFamily = "microbit";
    device.receive("sat23.5\r\n");
    expect(a.value).toBe(23.5);
    expect(b.value).toBe(23.5);
  });

  it("a disposed source stops receiving", () => {
    const device = new SerialDevice();
    const a = arduinoChannel();
    const b = arduinoChannel();
    const disposeA = device.registerChannelSource(() => [a]);
    device.registerChannelSource(() => [b]);
    device.deviceFamily = "arduino";
    disposeA();
    device.receive("emg:7\r\n");
    expect(a.value).toBe(0);
    expect(b.value).toBe(7);
  });

  it("a source registered after connecting receives data", () => {
    const device = new SerialDevice();
    device.setActiveDevice("arduino", fakeTransport([]));
    const ch = arduinoChannel();
    device.registerChannelSource(() => [ch]);
    device.receive("emg:5\r\n");
    expect(ch.value).toBe(5);
  });
});

describe("SerialDevice.dataReceived", () => {
  it("dataReceived turns true on the first chunk from the active transport and resets on a new device", () => {
    const device = new SerialDevice();
    const transport = fakeTransport([]);
    const otherTransport = fakeTransport([]);
    device.setActiveDevice("arduino", transport);
    expect(device.dataReceived).toBe(false);
    transport.onData!("emg:5\r\n");
    expect(device.dataReceived).toBe(true);
    device.setActiveDevice("arduino", otherTransport);
    expect(device.dataReceived).toBe(false);
  });

  it("resets on clearActiveDevice", () => {
    const device = new SerialDevice();
    const transport = fakeTransport([]);
    device.setActiveDevice("arduino", transport);
    transport.onData!("emg:5\r\n");
    device.clearActiveDevice();
    expect(device.dataReceived).toBe(false);
  });

  it("ignores data from a transport that isn't active", () => {
    const device = new SerialDevice();
    const transportA = fakeTransport([]);
    const transportB = fakeTransport([]);
    device.setActiveDevice("arduino", transportA);
    device.setActiveDevice("arduino", transportB);
    transportA.onData!("emg:5\r\n");
    expect(device.dataReceived).toBe(false);
  });
});

describe("SerialDevice.isConnected observability", () => {
  it("isConnected is observable", () => {
    const device = new SerialDevice();
    const seen: boolean[] = [];
    const dispose = autorun(() => { seen.push(device.isConnected()); });
    device.setActiveDevice("arduino", fakeTransport([]));
    device.clearActiveDevice();
    dispose();
    expect(seen).toEqual([false, true, false]);
  });
});
