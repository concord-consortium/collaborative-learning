import { SerialDevice } from "./serial";
import { SpikerbitDevice, IMicrobitUsbConnection, kSpikerbitFirmwareVersion } from "./spikerbit-device";

class FakeConnection implements IMicrobitUsbConnection {
  serialListeners: Array<(d: { data: string }) => void> = [];
  statusListeners: Array<(d: { status: string }) => void> = [];
  flashed = false;
  written: string[] = [];
  // Version the fake board reports to a "?" query; null means it never answers.
  respondVersion: number | null = null;

  addEventListener(type: string, listener: any) {
    if (type === "serialdata") this.serialListeners.push(listener);
    if (type === "status") this.statusListeners.push(listener);
  }
  emitSerial(data: string) { this.serialListeners.forEach(l => l({ data })); }
  async connect() { /* no-op */ }
  async flash() { this.flashed = true; }
  async serialWrite(data: string) {
    this.written.push(data);
    if (data.trim() === "?" && this.respondVersion != null) {
      this.emitSerial(`CLUE-SPIKERBIT v${this.respondVersion}\r\n`);
    }
  }
  async disconnect() { /* no-op */ }
}

describe("SpikerbitDevice", () => {
  it("does NOT flash when the board reports the current firmware version", async () => {
    const serialDevice = new SerialDevice();
    const conn = new FakeConnection();
    conn.respondVersion = kSpikerbitFirmwareVersion;
    const device = new SpikerbitDevice(serialDevice, conn);

    await device.connectAndStream([], "HEX");

    expect(conn.flashed).toBe(false);
    expect(serialDevice.isConnected()).toBe(true);
  });

  it("flashes when no version reply arrives", async () => {
    const serialDevice = new SerialDevice();
    const conn = new FakeConnection();
    conn.respondVersion = null; // never answers "?"
    const device = new SpikerbitDevice(serialDevice, conn, { versionQueryTimeoutMs: 50 });

    await device.connectAndStream([], "HEX");

    expect(conn.flashed).toBe(true);
  });

  it("flashes (auto-updates) when the board reports an out-of-date version", async () => {
    const serialDevice = new SerialDevice();
    const conn = new FakeConnection();
    conn.respondVersion = kSpikerbitFirmwareVersion - 1; // older firmware still running
    const device = new SpikerbitDevice(serialDevice, conn);

    await device.connectAndStream([], "HEX");

    expect(conn.flashed).toBe(true);
  });

  it("routes servo writes through the connection once streaming", async () => {
    const serialDevice = new SerialDevice();
    const conn = new FakeConnection();
    conn.respondVersion = kSpikerbitFirmwareVersion;
    const device = new SpikerbitDevice(serialDevice, conn);

    await device.connectAndStream([], "HEX");
    serialDevice.writeLine("90");

    expect(conn.written).toContain("90\n");
  });

  it("clears the store's transport on disconnect", async () => {
    const serialDevice = new SerialDevice();
    const conn = new FakeConnection();
    conn.respondVersion = kSpikerbitFirmwareVersion;
    const device = new SpikerbitDevice(serialDevice, conn);

    await device.connectAndStream([], "HEX");
    conn.statusListeners.forEach(l => l({ status: "Disconnected" }));

    expect(serialDevice.isConnected()).toBe(false);
  });
});
