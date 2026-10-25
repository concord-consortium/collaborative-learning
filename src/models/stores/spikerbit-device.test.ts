import { SerialDevice } from "./serial";
import { withChecksum } from "./cc-device-protocol";
import { kMaxSeq } from "./cc-device-session";
import { SpikerbitDevice, IMicrobitUsbConnection, kSpikerbitFirmwareVersion } from "./spikerbit-device";

const helloLine = (firmware: number, version = 1) =>
  `${withChecksum(`hello protocol:CCDeviceProtocol version:${version} device:spikerbit firmware:${firmware}`)}\r\n`;

// The size of one DAPLink serial read, as @microbit/microbit-connection delivers them.
const kReadBytes = 62;

// Splits `data` into reads of at most kReadBytes, as a backlog drains.
const asReads = (data: string) => {
  const reads: string[] = [];
  for (let i = 0; i < data.length; i += kReadBytes) reads.push(data.slice(i, i + kReadBytes));
  return reads;
};

// What the fake board sends for a connect-time write: "!! #n" gets an empty line and "ok #n" when
// the board knows "!!", and "?" gets `hello`. Each reply line is its own read.
const repliesTo = (data: string, knowsReset: boolean, hello: string | null) => {
  const reads: string[] = [];
  data.split("\n").forEach(line => {
    const reset = /^!! #(\d+)\*[0-9A-F]{2}$/.exec(line);
    if (reset && knowsReset) reads.push("\r\n", `${withChecksum(`ok #${reset[1]}`)}\r\n`);
    if (line === "?" && hello != null) reads.push(hello);
  });
  return reads;
};

class FakeConnection implements IMicrobitUsbConnection {
  serialListeners: Array<(d: { data: string }) => void> = [];
  statusListeners: Array<(d: { status: string }) => void> = [];
  flashed = false;
  written: string[] = [];
  // Complete line the fake board sends in answer to a "?" query; null means it never answers.
  respondHello: string | null = null;
  // What it answers "?" with once flashed; undefined means the same as before.
  respondHelloAfterFlash: string | null | undefined;
  // Whether the board knows "!!", so that it answers "!! #n" with an empty line and "ok #n".
  knowsReset = true;
  // Stale output waiting in DAPLink's buffer, read ahead of the board's first replies.
  backlog = "";
  // How many connect-time writes get no reply yet: their replies wait in `held`, as replies
  // that are lost (never released) or late (released by the test).
  holdReplies = 0;
  held: string[][] = [];
  // Whether the board acknowledges a session's open.
  acksOpen = true;

  addEventListener(type: string, listener: any) {
    if (type === "serialdata") this.serialListeners.push(listener);
    if (type === "status") this.statusListeners.push(listener);
  }
  emitSerial(data: string) { this.serialListeners.forEach(l => l({ data })); }
  emitReads(reads: string[]) { reads.forEach(read => this.emitSerial(read)); }
  releaseHeld() { this.held.splice(0).forEach(reads => this.emitReads(reads)); }
  async connect() { /* no-op */ }
  async flash() {
    this.flashed = true;
    if (this.respondHelloAfterFlash !== undefined) this.respondHello = this.respondHelloAfterFlash;
  }
  async serialWrite(data: string) {
    this.written.push(data);
    // Acknowledge an open so the session starts pinging; the seq is the "#n" before the checksum.
    const open = /^open session:\d+ #(\d+)/.exec(data);
    if (open && this.acksOpen) this.emitSerial(`${withChecksum(`ok #${open[1]}`)}\r\n`);
    if (!data.startsWith("!!")) return;
    const replies = repliesTo(data, this.knowsReset, this.respondHello);
    if (this.holdReplies > 0) {
      this.holdReplies--;
      this.held.push(replies);
    } else {
      this.emitReads([...asReads(this.backlog), ...replies]);
      this.backlog = "";
    }
  }
  async disconnect() { /* no-op */ }

  resetWrites() { return this.written.filter(w => w.startsWith("!!")); }
}

// A board left in free-run fills DAPLink's buffer with readings; the buffer keeps the oldest bytes
// and drops the rest, so the backlog ends in a cut-off line. On a V2 one such backlog was 578
// bytes: 48 readings and then "em".
const freeRunBacklog = () => {
  let backlog = "";
  for (let i = 0; i < 48; i++) backlog += `${withChecksum(`emg:${100 + i}`)}\r\n`;
  return `${backlog}em`;
};

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
    conn.knowsReset = false;
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
    // Firmware v1–v3 ignores "!!".
    conn.knowsReset = false;
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

  describe("connect-time reset and query", () => {
    const resetAndQuery = /^!! #(\d+)\*[0-9A-F]{2}\n\?\n$/;
    const resetSeqs = (conn: FakeConnection) => conn.resetWrites().map(w => Number(resetAndQuery.exec(w)![1]));

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      serialDevices.splice(0).forEach(d => d.clearActiveDevice());
      jest.useRealTimers();
    });

    async function connect(device: SpikerbitDevice) {
      const connecting = device.connectAndStream("HEX");
      await jest.advanceTimersByTimeAsync(5000);
      await connecting;
    }

    it("writes !! and a bare ? in one write, and connects to a current board without flashing", async () => {
      const conn = new FakeConnection();
      conn.respondHello = helloLine(kSpikerbitFirmwareVersion);
      await connect(new SpikerbitDevice(makeSerialDevice(), conn));

      expect(conn.flashed).toBe(false);
      expect(conn.resetWrites()).toHaveLength(1);
      expect(conn.resetWrites()[0]).toMatch(resetAndQuery);
    });

    it("finds the hello after a backlog that ends in a cut-off line", async () => {
      // As measured on a V2 after free-run: the backlog in 62-byte reads ending in "em", then the
      // empty line, the ok and the hello, each in its own read. Without the empty line the hello
      // would arrive as "emhello ..." and fail its checksum.
      const conn = new FakeConnection();
      conn.backlog = freeRunBacklog();
      conn.respondHello = helloLine(kSpikerbitFirmwareVersion);
      const reads: string[] = [];
      conn.serialListeners.push(({ data }) => reads.push(data));
      await connect(new SpikerbitDevice(makeSerialDevice(), conn));

      expect(conn.flashed).toBe(false);
      expect(conn.resetWrites()).toHaveLength(1);
      expect(reads.slice(0, 9).every(read => read.length === kReadBytes)).toBe(true);
      expect(reads[9]).toMatch(/em$/);
      expect(reads[10]).toBe("\r\n");
    });

    it("finds the hello when the backlog and the replies arrive packed into full 62-byte reads", async () => {
      const conn = new FakeConnection();
      conn.respondHello = helloLine(kSpikerbitFirmwareVersion);
      const backlog = freeRunBacklog();
      conn.backlog = backlog;
      // Deliver everything as one stream cut into reads, so the replies straddle read boundaries.
      conn.emitReads = (reads: string[]) => {
        const stream = reads.join("");
        expect(stream.startsWith(`${backlog}\r\nok #`)).toBe(true);
        asReads(stream).forEach(read => conn.emitSerial(read));
      };
      await connect(new SpikerbitDevice(makeSerialDevice(), conn));

      expect(conn.flashed).toBe(false);
      expect(conn.resetWrites()).toHaveLength(1);
    });

    it("writes !! and ? again 200 ms after a short read shows the backlog has drained", async () => {
      // The first replies are lost, as when DAPLink's buffer is still full as the board sends them.
      const conn = new FakeConnection();
      conn.respondHello = helloLine(kSpikerbitFirmwareVersion);
      conn.holdReplies = 1;
      const device = new SpikerbitDevice(makeSerialDevice(), conn);
      const connecting = device.connectAndStream("HEX");
      // The backlog arrives at once, as on the board, ending in a short read.
      await jest.advanceTimersByTimeAsync(0);
      conn.emitReads(asReads(freeRunBacklog()));

      await jest.advanceTimersByTimeAsync(180);
      expect(conn.resetWrites()).toHaveLength(1);
      await jest.advanceTimersByTimeAsync(40);
      expect(conn.resetWrites()).toHaveLength(2);
      await jest.advanceTimersByTimeAsync(5000);
      await connecting;

      expect(conn.flashed).toBe(false);
      expect(resetSeqs(conn)).toEqual([1000, 1001]);
    });

    it("writes !! and ? again 300 ms after the write when no data arrives at all", async () => {
      const conn = new FakeConnection();
      conn.respondHello = helloLine(kSpikerbitFirmwareVersion);
      conn.holdReplies = 1;
      const connecting = new SpikerbitDevice(makeSerialDevice(), conn).connectAndStream("HEX");

      await jest.advanceTimersByTimeAsync(280);
      expect(conn.resetWrites()).toHaveLength(1);
      await jest.advanceTimersByTimeAsync(40);
      expect(conn.resetWrites()).toHaveLength(2);
      await jest.advanceTimersByTimeAsync(5000);
      await connecting;

      expect(conn.flashed).toBe(false);
    });

    it("accepts a hello with no ok before it, from firmware that ignores !!", async () => {
      const conn = new FakeConnection();
      conn.knowsReset = false;
      conn.respondHello = helloLine(kSpikerbitFirmwareVersion);
      await connect(new SpikerbitDevice(makeSerialDevice(), conn));

      expect(conn.flashed).toBe(false);
      expect(conn.resetWrites()).toHaveLength(1);
    });

    it("flashes a board answering !! but no ?, after writing both once more, within 1.5 s", async () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
      const conn = new FakeConnection();
      conn.respondHello = null;
      let writesBeforeFlash = 0;
      const flash = jest.fn(async () => { writesBeforeFlash = conn.resetWrites().length; });
      conn.flash = flash;
      const connecting = new SpikerbitDevice(makeSerialDevice(), conn).connectAndStream("HEX");

      await jest.advanceTimersByTimeAsync(1490);
      expect(flash).not.toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(30);
      expect(flash).toHaveBeenCalledTimes(1);
      expect(writesBeforeFlash).toBe(2);
      await jest.advanceTimersByTimeAsync(5000);
      await connecting;
      // The re-query after the flash got no hello either, so it warned and connected anyway.
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/not confirmed after flash/));
      warn.mockRestore();
    });

    it("re-queries with the same sequence after a flash, with numbers of its own", async () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
      const conn = new FakeConnection();
      conn.backlog = freeRunBacklog();
      conn.respondHello = helloLine(kSpikerbitFirmwareVersion - 1);
      conn.respondHelloAfterFlash = helloLine(kSpikerbitFirmwareVersion);
      // The board's first replies after the flash are lost, so the re-query retries too.
      const flash = conn.flash.bind(conn);
      conn.flash = async () => {
        await flash();
        conn.holdReplies = 1;
      };
      await connect(new SpikerbitDevice(makeSerialDevice(), conn));

      expect(conn.flashed).toBe(true);
      expect(conn.resetWrites()).toHaveLength(3);
      conn.resetWrites().forEach(w => expect(w).toMatch(resetAndQuery));
      expect(resetSeqs(conn)).toEqual([1000, 1001, 1002]);
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it("keeps late replies to a connect-time !! from reaching the session", async () => {
      // The board answers the first write only after the retry has identified it, so the session
      // has started, with its open still unacknowledged, when the first ok arrives.
      const conn = new FakeConnection();
      conn.respondHello = helloLine(kSpikerbitFirmwareVersion);
      conn.holdReplies = 1;
      conn.acksOpen = false;
      await connect(new SpikerbitDevice(makeSerialDevice(), conn));
      expect(conn.written.filter(w => w.startsWith("open"))).not.toHaveLength(0);

      conn.releaseHeld();
      await jest.advanceTimersByTimeAsync(1500);

      // An ok taken for the open's would have started the session's pings.
      expect(conn.written.filter(w => w.startsWith("ping"))).toHaveLength(0);
      resetSeqs(conn).forEach(seq => expect(seq).toBeGreaterThan(kMaxSeq));
    });
  });
});
