import { SerialDevice, WebSerialTransport } from "./serial";
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
    device.setActiveDevice("spikerbit", fakeTransport(written));

    expect(device.isConnected()).toBe(true);
    expect(device.deviceFamily).toBe("spikerbit");

    device.writeLine("90");
    expect(written).toEqual(["90"]);
  });

  it("writeToOutForServo scales and writes through the active transport", () => {
    const device = new SerialDevice();
    const written: string[] = [];
    device.setActiveDevice("spikerbit", fakeTransport(written));

    // Servo config: angleScale 2/3, angleOffset 30 -> for n=90: 2/3*90+30 = 90
    device.writeToOutForServo(90, "Servo");
    expect(written).toEqual(["90"]);
  });

  it("clearActiveDevice disconnects", () => {
    const device = new SerialDevice();
    device.setActiveDevice("spikerbit", fakeTransport([]));
    device.clearActiveDevice();
    expect(device.isConnected()).toBe(false);
    expect(device.activeTransport).toBeUndefined();
    expect(device.deviceFamily).toBeUndefined();
  });
});

describe("WebSerialTransport", () => {
  it("writes the line framed with a trailing newline, encoded, when the port is open", () => {
    const fakeWriter = { write: jest.fn() };
    const transport = new WebSerialTransport(
      () => fakeWriter as unknown as WritableStreamDefaultWriter,
      () => true,
      async () => undefined
    );

    transport.write("90");

    expect(fakeWriter.write).toHaveBeenCalledTimes(1);
    const sentBytes = fakeWriter.write.mock.calls[0][0];
    expect(new TextDecoder().decode(sentBytes)).toBe("90\n");
    expect(sentBytes).toEqual(new TextEncoder().encode("90\n"));
  });

  it("does not write when the port is closed", () => {
    const fakeWriter = { write: jest.fn() };
    const transport = new WebSerialTransport(
      () => fakeWriter as unknown as WritableStreamDefaultWriter,
      () => false,
      async () => undefined
    );

    transport.write("90");

    expect(fakeWriter.write).not.toHaveBeenCalled();
  });

  it("picks up a replaced writer through the getter indirection, with no stale capture", () => {
    const firstWriter = { write: jest.fn() };
    const secondWriter = { write: jest.fn() };
    let currentWriter: { write: jest.Mock } = firstWriter;

    const transport = new WebSerialTransport(
      () => currentWriter as unknown as WritableStreamDefaultWriter,
      () => true,
      async () => undefined
    );

    transport.write("first");
    expect(firstWriter.write).toHaveBeenCalledTimes(1);
    expect(new TextDecoder().decode(firstWriter.write.mock.calls[0][0])).toBe("first\n");

    currentWriter = secondWriter;
    transport.write("second");

    expect(secondWriter.write).toHaveBeenCalledTimes(1);
    expect(new TextDecoder().decode(secondWriter.write.mock.calls[0][0])).toBe("second\n");
    expect(firstWriter.write).toHaveBeenCalledTimes(1);
  });
});
