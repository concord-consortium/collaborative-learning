import { SerialDevice } from "./serial";

describe("SerialDevice transport routing", () => {
  it("routes writeLine through the spikerbit callback when active", () => {
    const device = new SerialDevice();
    const written: string[] = [];
    device.setSpikerbitActive((line) => written.push(line));

    expect(device.isConnected()).toBe(true);
    expect(device.deviceFamily).toBe("arduino");

    device.writeLine("90");
    expect(written).toEqual(["90"]);
  });

  it("writeToOutForServo scales and writes through the spikerbit callback", () => {
    const device = new SerialDevice();
    const written: string[] = [];
    device.setSpikerbitActive((line) => written.push(line));

    // Servo config: angleScale 2/3, angleOffset 30 -> for n=90: 2/3*90+30 = 90
    device.writeToOutForServo(90, "Servo");
    expect(written).toEqual(["90"]);
  });

  it("clearSpikerbit disconnects the transport", () => {
    const device = new SerialDevice();
    device.setSpikerbitActive(() => undefined);
    device.clearSpikerbit();
    expect(device.isConnected()).toBe(false);
    expect(device.spikerbitWrite).toBeUndefined();
  });
});
