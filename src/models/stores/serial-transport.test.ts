import { SerialDevice } from "./serial";
import { IDeviceTransport } from "./device-transport";

function fakeTransport(sink: string[]): IDeviceTransport {
  return {
    write: (line: string) => sink.push(line),
    close: async () => undefined,
  };
}

describe("SerialDevice active-transport routing", () => {
  it("routes writeLine through the active transport", () => {
    const device = new SerialDevice();
    const written: string[] = [];
    device.setActiveDevice("spikerbit", fakeTransport(written), []);

    expect(device.isConnected()).toBe(true);
    expect(device.deviceFamily).toBe("spikerbit");

    device.writeLine("90");
    expect(written).toEqual(["90"]);
  });

  it("writeToOutForServo scales and writes through the active transport", () => {
    const device = new SerialDevice();
    const written: string[] = [];
    device.setActiveDevice("spikerbit", fakeTransport(written), []);

    // Servo config: angleScale 2/3, angleOffset 30 -> for n=90: 2/3*90+30 = 90
    device.writeToOutForServo(90, "Servo");
    expect(written).toEqual(["90"]);
  });

  it("clearActiveDevice disconnects", () => {
    const device = new SerialDevice();
    device.setActiveDevice("spikerbit", fakeTransport([]), []);
    device.clearActiveDevice();
    expect(device.isConnected()).toBe(false);
    expect(device.activeTransport).toBeUndefined();
    expect(device.deviceFamily).toBeUndefined();
  });

  it("ignores a stale transport's onDisconnect after a newer device has taken over", () => {
    const device = new SerialDevice();
    const transportA = fakeTransport([]);
    const transportB = fakeTransport([]);

    device.setActiveDevice("arduino", transportA, []);
    device.setActiveDevice("spikerbit", transportB, []);

    // Simulate transportA's read loop finally giving up long after transportB took over.
    transportA.onDisconnect?.();

    expect(device.isConnected()).toBe(true);
    expect(device.activeTransport).toBe(transportB);
    expect(device.deviceFamily).toBe("spikerbit");
  });
});

describe("SerialDevice.receive protocol routing", () => {
  function arduinoChannel() {
    return { channelId: "emg", value: 0 } as any;
  }
  it("routes to the arduino parser when the device protocol is arduino", () => {
    const device = new SerialDevice();
    const ch = arduinoChannel();
    device.channels = [ch];
    device.deviceFamily = "arduino";
    device.receive("emg:42\r\n");
    expect(ch.value).toBe(42);
  });
  it("does not update arduino channels when the device protocol is microbit", () => {
    const device = new SerialDevice();
    const ch = arduinoChannel();
    device.channels = [ch];
    device.deviceFamily = "microbit";
    device.receive("emg:42\r\n");
    expect(ch.value).toBe(0);
  });
});
