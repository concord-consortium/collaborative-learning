import { SerialDevice } from "./serial";
import { withChecksum } from "./cc-device-protocol";
import { SpikerbitDevice, IMicrobitUsbConnection, kSpikerbitFirmwareVersion } from "./spikerbit-device";

const helloLine = (firmware: number, version = 1) =>
  `${withChecksum(`hello protocol:CCDeviceProtocol version:${version} device:spikerbit firmware:${firmware}`)}\r\n`;

class FakeConnection implements IMicrobitUsbConnection {
  serialListeners: Array<(d: { data: string }) => void> = [];
  statusListeners: Array<(d: { status: string }) => void> = [];
  flashed = false;
  written: string[] = [];
  // Complete line the fake board sends in answer to a "?" query; null means it never answers.
  respondHello: string | null = null;

  addEventListener(type: string, listener: any) {
    if (type === "serialdata") this.serialListeners.push(listener);
    if (type === "status") this.statusListeners.push(listener);
  }
  emitSerial(data: string) { this.serialListeners.forEach(l => l({ data })); }
  async connect() { /* no-op */ }
  async flash() { this.flashed = true; }
  async serialWrite(data: string) {
    this.written.push(data);
    // Acknowledge an open so the session starts pinging; the seq is the "#n" before the checksum.
    const open = /^open session:\d+ #(\d+)/.exec(data);
    if (open) this.emitSerial(`${withChecksum(`ok #${open[1]}`)}\r\n`);
    if (data.trim() === "?" && this.respondHello != null) {
      this.emitSerial(this.respondHello);
    }
  }
  async disconnect() { /* no-op */ }
}

// Sessions ping on a timer, so each test's device is cleared afterward.
const serialDevices: SerialDevice[] = [];
function makeSerialDevice() {
  const device = new SerialDevice();
  serialDevices.push(device);
  return device;
}

describe("SpikerbitDevice", () => {
  afterEach(() => {
    serialDevices.splice(0).forEach(d => d.clearActiveDevice());
  });

  it("does NOT flash when the board reports the current firmware version", async () => {
    const serialDevice = makeSerialDevice();
    const conn = new FakeConnection();
    conn.respondHello = helloLine(kSpikerbitFirmwareVersion);
    const device = new SpikerbitDevice(serialDevice, conn);

    await device.connectAndStream("HEX");

    expect(conn.flashed).toBe(false);
    expect(serialDevice.isConnected()).toBe(true);
  });

  it("flashes when no version reply arrives", async () => {
    const serialDevice = makeSerialDevice();
    const conn = new FakeConnection();
    conn.respondHello = null; // never answers "?"
    const device = new SpikerbitDevice(serialDevice, conn, { versionQueryTimeoutMs: 50 });

    await device.connectAndStream("HEX");

    expect(conn.flashed).toBe(true);
  });

  it("flashes (auto-updates) when the board reports an out-of-date version", async () => {
    const serialDevice = makeSerialDevice();
    const conn = new FakeConnection();
    conn.respondHello = helloLine(kSpikerbitFirmwareVersion - 1); // older firmware still running
    const device = new SpikerbitDevice(serialDevice, conn);

    await device.connectAndStream("HEX");

    expect(conn.flashed).toBe(true);
  });

  it("flashes a board answering with the legacy banner", async () => {
    const serialDevice = makeSerialDevice();
    const conn = new FakeConnection();
    conn.respondHello = "CLUE-SPIKERBIT v3\r\n";
    const device = new SpikerbitDevice(serialDevice, conn);

    await device.connectAndStream("HEX");

    expect(conn.flashed).toBe(true);
  });

  it("flashes a board speaking a newer protocol version, even with newer firmware", async () => {
    const serialDevice = makeSerialDevice();
    const conn = new FakeConnection();
    conn.respondHello = helloLine(kSpikerbitFirmwareVersion + 5, 2);
    const device = new SpikerbitDevice(serialDevice, conn);

    await device.connectAndStream("HEX");

    expect(conn.flashed).toBe(true);
  });

  it("routes servo writes through the connection once streaming", async () => {
    const serialDevice = makeSerialDevice();
    const conn = new FakeConnection();
    conn.respondHello = helloLine(kSpikerbitFirmwareVersion);
    const device = new SpikerbitDevice(serialDevice, conn);

    await device.connectAndStream("HEX");
    serialDevice.writeToOutForServo(0, "Servo");

    expect(conn.written.some(w => /^servo:30\*[0-9A-F]{2}\n$/.test(w))).toBe(true);
  });

  it("sends open once streaming", async () => {
    const serialDevice = makeSerialDevice();
    const conn = new FakeConnection();
    conn.respondHello = helloLine(kSpikerbitFirmwareVersion);
    const device = new SpikerbitDevice(serialDevice, conn);

    await device.connectAndStream("HEX");

    const opens = conn.written.filter(w => w.startsWith("open"));
    expect(opens).toHaveLength(1);
    expect(opens[0]).toMatch(/^open session:\d+ #\d+\*[0-9A-F]{2}\n$/);
  });

  it("routes inbound EMG through SerialDevice.receive to the matching channel", async () => {
    const serialDevice = makeSerialDevice();
    const conn = new FakeConnection();
    conn.respondHello = helloLine(kSpikerbitFirmwareVersion);
    const channel = { channelId: "emg", value: 0 } as any;
    const device = new SpikerbitDevice(serialDevice, conn);

    serialDevice.registerChannelSource(() => [channel]);
    await device.connectAndStream("HEX");
    // Data arriving after setActiveDevice flows transport.onData -> receive -> the session.
    // The fake board acknowledged the open when it was written.
    conn.emitSerial("emg:57\r\n");

    expect(channel.value).toBe(57);
  });

  it("disconnects the connection when connecting fails after the link opens", async () => {
    const serialDevice = makeSerialDevice();
    const conn = new FakeConnection();
    conn.respondHello = null;
    conn.flash = jest.fn().mockRejectedValue(new Error("flash failed"));
    const disconnect = jest.spyOn(conn, "disconnect");
    const device = new SpikerbitDevice(serialDevice, conn, { versionQueryTimeoutMs: 50 });

    await expect(device.connectAndStream("HEX")).rejects.toThrow("flash failed");

    expect(disconnect).toHaveBeenCalled();
    expect(serialDevice.isConnected()).toBe(false);
  });

  it("disconnect closes the connection", async () => {
    const serialDevice = makeSerialDevice();
    const conn = new FakeConnection();
    conn.respondHello = helloLine(kSpikerbitFirmwareVersion);
    const disconnect = jest.spyOn(conn, "disconnect");
    const device = new SpikerbitDevice(serialDevice, conn);

    await device.connectAndStream("HEX");
    await device.disconnect();

    expect(disconnect).toHaveBeenCalled();
  });

  it("clears the store's transport on disconnect", async () => {
    const serialDevice = makeSerialDevice();
    const conn = new FakeConnection();
    conn.respondHello = helloLine(kSpikerbitFirmwareVersion);
    const device = new SpikerbitDevice(serialDevice, conn);

    await device.connectAndStream("HEX");
    conn.statusListeners.forEach(l => l({ status: "Disconnected" }));

    expect(serialDevice.isConnected()).toBe(false);
  });
});
