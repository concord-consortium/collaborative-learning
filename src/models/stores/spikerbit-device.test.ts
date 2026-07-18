import { SerialDevice } from "./serial";
import { SpikerbitDevice, IMicrobitUsbConnection } from "./spikerbit-device";

class FakeConnection implements IMicrobitUsbConnection {
  serialListeners: Array<(d: { data: string }) => void> = [];
  statusListeners: Array<(d: { status: string }) => void> = [];
  flashed = false;
  written: string[] = [];
  // When set, the next serialWrite("?") triggers a version reply.
  respondWithVersion = false;

  addEventListener(type: string, listener: any) {
    if (type === "serialdata") this.serialListeners.push(listener);
    if (type === "status") this.statusListeners.push(listener);
  }
  emitSerial(data: string) { this.serialListeners.forEach(l => l({ data })); }
  async connect() { /* no-op */ }
  async flash() { this.flashed = true; }
  async serialWrite(data: string) {
    this.written.push(data);
    if (data.trim() === "?" && this.respondWithVersion) {
      this.emitSerial("CLUE-SPIKERBIT v1\r\n");
    }
  }
  async disconnect() { /* no-op */ }
}

describe("SpikerbitDevice", () => {
  it("does NOT flash when the version query is answered", async () => {
    const serialDevice = new SerialDevice();
    const conn = new FakeConnection();
    conn.respondWithVersion = true;
    const device = new SpikerbitDevice(serialDevice, conn);

    await device.connectAndStream([], "HEX");

    expect(conn.flashed).toBe(false);
    expect(serialDevice.isConnected()).toBe(true);
  });

  it("flashes when no version reply arrives", async () => {
    const serialDevice = new SerialDevice();
    const conn = new FakeConnection();
    conn.respondWithVersion = false; // never answers "?"
    const device = new SpikerbitDevice(serialDevice, conn, { versionQueryTimeoutMs: 50 });

    await device.connectAndStream([], "HEX");

    expect(conn.flashed).toBe(true);
  });

  it("routes servo writes through the connection once streaming", async () => {
    const serialDevice = new SerialDevice();
    const conn = new FakeConnection();
    conn.respondWithVersion = true;
    const device = new SpikerbitDevice(serialDevice, conn);

    await device.connectAndStream([], "HEX");
    serialDevice.writeLine("90");

    expect(conn.written).toContain("90\n");
  });

  it("clears the store's transport on disconnect", async () => {
    const serialDevice = new SerialDevice();
    const conn = new FakeConnection();
    conn.respondWithVersion = true;
    const device = new SpikerbitDevice(serialDevice, conn);

    await device.connectAndStream([], "HEX");
    conn.statusListeners.forEach(l => l({ status: "Disconnected" }));

    expect(serialDevice.isConnected()).toBe(false);
  });
});
