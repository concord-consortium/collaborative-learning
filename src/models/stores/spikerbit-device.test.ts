import { SerialDevice } from "./serial";
import { withChecksum } from "./cc-device-protocol";
import { kMaxSeq } from "./cc-device-session";
import {
  IMicrobitUsbConnection, ISpikerbitConnectObserver, IUsbDisconnectSource, kSpikerbitFirmwareVersion,
  MicrobitUsbTransport, SpikerbitDevice
} from "./spikerbit-device";

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
  // The USBDevice the library holds; the transport compares unplug events against it.
  device: unknown = { name: "this board" };

  addEventListener(type: string, listener: any) {
    if (type === "serialdata") this.serialListeners.push(listener);
    if (type === "status") this.statusListeners.push(listener);
  }
  emitSerial(data: string) { this.serialListeners.forEach(l => l({ data })); }
  emitReads(reads: string[]) { reads.forEach(read => this.emitSerial(read)); }
  releaseHeld() { this.held.splice(0).forEach(reads => this.emitReads(reads)); }
  // A known device: the library goes straight to "Connecting".
  async connect(options?: { progress?: (stage: string) => void }) { options?.progress?.("Connecting"); }
  // The pct values the library's flash progress callback gets; undefined ends the flashing.
  flashProgress: Array<number | undefined> = [];
  async flash(_source?: unknown, options?: { progress?: (stage: string, pct?: number) => void }) {
    this.flashed = true;
    this.flashProgress.forEach(pct => options?.progress?.("PartialFlashing", pct));
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
  getDevice() { return this.device; }
  emitStatus(status: string) { this.statusListeners.forEach(l => l({ status })); }

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
    jest.useRealTimers();
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

  it("flashes when no firmware reply arrives", async () => {
    const serialDevice = makeSerialDevice();
    const conn = new FakeConnection();
    conn.knowsReset = false;
    conn.respondHello = null; // never answers "?"
    const device = new SpikerbitDevice(serialDevice, conn, { firmwareQueryTimeoutMs: 50 });

    await device.connectAndStream("HEX");

    expect(conn.flashed).toBe(true);
  });

  it("flashes (auto-updates) when the board reports out-of-date firmware", async () => {
    const serialDevice = makeSerialDevice();
    const conn = new FakeConnection();
    conn.respondHello = helloLine(kSpikerbitFirmwareVersion - 1); // older firmware still running
    const device = new SpikerbitDevice(serialDevice, conn);

    await device.connectAndStream("HEX");

    expect(conn.flashed).toBe(true);
  });

  it("flashes a board answering with the legacy banner as soon as the banner arrives", async () => {
    jest.useFakeTimers();
    const serialDevice = makeSerialDevice();
    const conn = new FakeConnection();
    // Firmware v1–v3 ignores "!!".
    conn.knowsReset = false;
    conn.respondHello = "CLUE-SPIKERBIT v3\r\n";
    const device = new SpikerbitDevice(serialDevice, conn);

    const connecting = device.connectAndStream("HEX");
    // Well before kFirmwareQueryTimeoutMs, after which a board that doesn't answer is flashed too.
    await jest.advanceTimersByTimeAsync(100);
    expect(conn.flashed).toBe(true);
    await jest.advanceTimersByTimeAsync(5000);
    await connecting;
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
    conn.emitSerial(`${withChecksum("emg:57")}\r\n`);

    expect(channel.value).toBe(57);
  });

  it("disconnects the connection when connecting fails after the link opens", async () => {
    const serialDevice = makeSerialDevice();
    const conn = new FakeConnection();
    conn.respondHello = null;
    conn.flash = jest.fn().mockRejectedValue(new Error("flash failed"));
    const disconnect = jest.spyOn(conn, "disconnect");
    const device = new SpikerbitDevice(serialDevice, conn, { firmwareQueryTimeoutMs: 50 });

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

  it("ends the session only once the close write has finished", async () => {
    const serialDevice = makeSerialDevice();
    const conn = new FakeConnection();
    conn.respondHello = helloLine(kSpikerbitFirmwareVersion);
    let finishClose: () => void = () => undefined;
    const write = conn.serialWrite.bind(conn);
    conn.serialWrite = async (data: string) => {
      await write(data);
      if (data.startsWith("close")) await new Promise<void>(resolve => { finishClose = resolve; });
    };
    await new SpikerbitDevice(serialDevice, conn).connectAndStream("HEX");

    let ended = false;
    const ending = serialDevice.endSession().then(() => { ended = true; });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(ended).toBe(false);
    finishClose();
    await ending;
    expect(ended).toBe(true);
  });

  it("logs a write that throws before returning a promise, as the library does once the board is gone", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const conn = new FakeConnection();
    conn.serialWrite = () => { throw new Error("not connected"); };
    const transport = new MicrobitUsbTransport(conn);

    await expect(transport.write("servo:90")).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith("Spiker:bit serialWrite failed", expect.any(Error));
    warn.mockRestore();
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

  describe("reporting connection steps", () => {
    it("reports opened, firmware checked and no update for current firmware", async () => {
      const conn = new FakeConnection();
      conn.respondHello = helloLine(kSpikerbitFirmwareVersion);
      const calls: string[] = [];
      const observer: ISpikerbitConnectObserver = {
        onOpened: () => calls.push("opened"),
        onFirmwareChecked: (reply, willUpdate) => calls.push(`firmwareChecked:${willUpdate}:${reply?.kind}`),
        onUpdateProgress: () => calls.push("progress"),
        onUpdateFinished: () => calls.push("finished")
      };

      await new SpikerbitDevice(makeSerialDevice(), conn).connectAndStream("HEX", observer);

      expect(calls).toEqual(["opened", "firmwareChecked:false:ccDevice"]);
    });

    it("reports update progress as percents and the update finishing", async () => {
      const conn = new FakeConnection();
      conn.respondHello = helloLine(kSpikerbitFirmwareVersion - 1);
      conn.flashProgress = [0.5, undefined];
      const observer = {
        onFirmwareChecked: jest.fn(),
        onUpdateProgress: jest.fn(),
        onUpdateFinished: jest.fn()
      };
      const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);

      await new SpikerbitDevice(makeSerialDevice(), conn, { firmwareQueryTimeoutMs: 50 })
        .connectAndStream("HEX", observer);

      expect(observer.onFirmwareChecked).toHaveBeenCalledWith(expect.objectContaining({ kind: "ccDevice" }), true);
      expect(observer.onUpdateProgress).toHaveBeenCalledTimes(1);
      expect(observer.onUpdateProgress).toHaveBeenCalledWith(50);
      expect(observer.onUpdateFinished).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });

    it("reports a known device's open as opening without the chooser", async () => {
      const conn = new FakeConnection();
      conn.respondHello = helloLine(kSpikerbitFirmwareVersion);
      const observer = { onOpening: jest.fn() };
      await new SpikerbitDevice(makeSerialDevice(), conn).connectAndStream("HEX", observer);
      expect(observer.onOpening).toHaveBeenCalledWith(false);
    });

    it("reports the board going away during its update, but not a disconnect it was asked for", async () => {
      const conn = new FakeConnection();
      conn.respondHello = helloLine(kSpikerbitFirmwareVersion - 1);
      let finishFlash: () => void = () => undefined;
      conn.flash = jest.fn(() => new Promise<void>(resolve => { finishFlash = resolve; }));
      const observer = { onLost: jest.fn(), onFirmwareChecked: jest.fn() };
      const device = new SpikerbitDevice(makeSerialDevice(), conn, { firmwareQueryTimeoutMs: 50 });
      const connecting = device.connectAndStream("HEX", observer);
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(observer.onFirmwareChecked).toHaveBeenCalled();
      conn.emitStatus("Disconnected");
      expect(observer.onLost).toHaveBeenCalledWith("lost");

      observer.onLost.mockClear();
      void device.disconnect();
      conn.emitStatus("Disconnected");
      expect(observer.onLost).not.toHaveBeenCalled();
      finishFlash();
      await expect(connecting).rejects.toMatchObject({ code: "closed" });
    });

    it("a disconnected connect that fails later leaves a newer connect on the same device alone", async () => {
      const serialDevice = makeSerialDevice();
      const conn = new FakeConnection();
      conn.respondHello = helloLine(kSpikerbitFirmwareVersion - 1);
      let failFlash: (e: Error) => void = () => undefined;
      conn.flash = jest.fn(() => new Promise<void>((_, reject) => { failFlash = reject; }));
      const disconnect = jest.spyOn(conn, "disconnect");
      const device = new SpikerbitDevice(serialDevice, conn, { firmwareQueryTimeoutMs: 50 });
      const first = device.connectAndStream("HEX");
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(conn.flash).toHaveBeenCalled();

      await device.disconnect();
      conn.respondHello = helloLine(kSpikerbitFirmwareVersion);
      await device.connectAndStream("HEX");
      expect(serialDevice.isConnected()).toBe(true);
      disconnect.mockClear();

      failFlash(new Error("flash stopped"));
      await expect(first).rejects.toThrow("flash stopped");
      expect(disconnect).not.toHaveBeenCalled();
      expect(serialDevice.activeTransport).toBeDefined();
    });

    describe("a disconnect while it starts stops it at its next step", () => {
      it("is never queried when disconnected while it opens", async () => {
        const serialDevice = makeSerialDevice();
        const conn = new FakeConnection();
        conn.respondHello = helloLine(kSpikerbitFirmwareVersion);
        let finishOpen: () => void = () => undefined;
        conn.connect = () => new Promise<void>(resolve => { finishOpen = resolve; });
        const device = new SpikerbitDevice(serialDevice, conn, { firmwareQueryTimeoutMs: 50 });
        const connecting = device.connectAndStream("HEX");

        void device.disconnect();
        finishOpen();
        await expect(connecting).rejects.toMatchObject({ code: "closed" });
        expect(conn.written).toEqual([]);
        expect(serialDevice.isConnected()).toBe(false);
      });

      it("is never flashed when disconnected during its firmware query", async () => {
        const serialDevice = makeSerialDevice();
        const conn = new FakeConnection();
        conn.respondHello = helloLine(kSpikerbitFirmwareVersion - 1);
        conn.holdReplies = 1;
        const device = new SpikerbitDevice(serialDevice, conn, { firmwareQueryTimeoutMs: 50 });
        const connecting = device.connectAndStream("HEX");
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(conn.resetWrites()).toHaveLength(1);

        void device.disconnect();
        await expect(connecting).rejects.toMatchObject({ code: "closed" });
        expect(conn.flashed).toBe(false);
        expect(serialDevice.isConnected()).toBe(false);
      });

      it("doesn't finish its update when disconnected while flashing", async () => {
        const serialDevice = makeSerialDevice();
        const conn = new FakeConnection();
        conn.respondHello = helloLine(kSpikerbitFirmwareVersion - 1);
        let finishFlash: () => void = () => undefined;
        conn.flash = jest.fn(() => new Promise<void>(resolve => { finishFlash = resolve; }));
        const observer = { onUpdateFinished: jest.fn() };
        const device = new SpikerbitDevice(serialDevice, conn, { firmwareQueryTimeoutMs: 50 });
        const connecting = device.connectAndStream("HEX", observer);
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(conn.flash).toHaveBeenCalled();

        void device.disconnect();
        finishFlash();
        await expect(connecting).rejects.toMatchObject({ code: "closed" });
        expect(observer.onUpdateFinished).not.toHaveBeenCalled();
        expect(serialDevice.isConnected()).toBe(false);
      });

      it("never becomes the active device when disconnected after its update", async () => {
        const serialDevice = makeSerialDevice();
        const conn = new FakeConnection();
        conn.respondHello = helloLine(kSpikerbitFirmwareVersion - 1);
        conn.respondHelloAfterFlash = helloLine(kSpikerbitFirmwareVersion);
        const device = new SpikerbitDevice(serialDevice, conn, { firmwareQueryTimeoutMs: 50 });
        const connecting = device.connectAndStream("HEX", { onUpdateFinished: () => { void device.disconnect(); } });

        await expect(connecting).rejects.toMatchObject({ code: "closed" });
        expect(conn.flashed).toBe(true);
        expect(serialDevice.isConnected()).toBe(false);
      });
    });

    describe("a USB open that doesn't finish", () => {
      beforeEach(() => {
        jest.useFakeTimers();
      });

      function makeHangingConn() {
        const conn = new FakeConnection();
        let settle: (error?: Error) => void = () => undefined;
        conn.connect = options => new Promise<void>((resolve, reject) => {
          options?.progress?.("Connecting");
          settle = error => error ? reject(error) : resolve();
        });
        const disconnect = jest.spyOn(conn, "disconnect");
        return { conn, disconnect, settle: (error?: Error) => settle(error) };
      }

      it("throws open-timeout, and disconnects a late open", async () => {
        const { conn, disconnect, settle } = makeHangingConn();
        const observer = { onAbandoned: jest.fn() };
        const promise = new SpikerbitDevice(makeSerialDevice(), conn, { openTimeoutMs: 20000 })
          .connectAndStream("HEX", observer);
        const assertion = expect(promise).rejects.toMatchObject({ code: "open-timeout" });

        await jest.advanceTimersByTimeAsync(20000);
        await assertion;
        expect(disconnect).toHaveBeenCalled();
        disconnect.mockClear();

        settle();
        await jest.advanceTimersByTimeAsync(0);
        expect(disconnect).toHaveBeenCalled();
        expect(observer.onAbandoned).toHaveBeenLastCalledWith({ late: "opened" });
      });

      it("counts the limit from the library's Connecting stage, after its chooser", async () => {
        const conn = new FakeConnection();
        let progress: (stage: string) => void = () => undefined;
        conn.connect = options => new Promise<void>(() => {
          progress = options!.progress!;
          progress("Initializing");
          progress("FindingDevice");
        });
        const observer = { onOpening: jest.fn() };
        let error: unknown;
        void new SpikerbitDevice(makeSerialDevice(), conn, { openTimeoutMs: 20000 })
          .connectAndStream("HEX", observer)
          .catch(e => { error = e; });
        // The student takes a minute in the chooser.
        await jest.advanceTimersByTimeAsync(60000);
        expect(error).toBeUndefined();
        expect(observer.onOpening).not.toHaveBeenCalled();
        progress("Connecting");
        expect(observer.onOpening).toHaveBeenCalledWith(true);
        await jest.advanceTimersByTimeAsync(19999);
        expect(error).toBeUndefined();
        await jest.advanceTimersByTimeAsync(1);
        expect(error).toMatchObject({ code: "open-timeout" });
      });

      it("throws open-timeout at the limit when closing the stuck link hangs too, and still tries forget", async () => {
        const { conn, disconnect } = makeHangingConn();
        disconnect.mockImplementation(() => new Promise<void>(() => { /* never settles */ }));
        const forget = jest.fn().mockResolvedValue(undefined);
        conn.device = { forget };
        const observer = { onAbandoned: jest.fn() };
        let error: unknown;
        void new SpikerbitDevice(makeSerialDevice(), conn, { openTimeoutMs: 20000 })
          .connectAndStream("HEX", observer)
          .catch(e => { error = e; });
        await jest.advanceTimersByTimeAsync(20000);
        expect(error).toMatchObject({ code: "open-timeout" });
        expect(disconnect).toHaveBeenCalledTimes(1);
        expect(forget).toHaveBeenCalled();
        expect(observer.onAbandoned.mock.calls).toEqual([[{ forget: "ok" }]]);
      });

      it("reports a late failure of the open", async () => {
        const { conn, settle } = makeHangingConn();
        const observer = { onAbandoned: jest.fn() };
        const promise = new SpikerbitDevice(makeSerialDevice(), conn, { openTimeoutMs: 1000 })
          .connectAndStream("HEX", observer);
        const assertion = expect(promise).rejects.toMatchObject({ code: "open-timeout" });
        await jest.advanceTimersByTimeAsync(1000);
        await assertion;

        settle(new Error("late failure"));
        await jest.advanceTimersByTimeAsync(0);
        expect(observer.onAbandoned).toHaveBeenLastCalledWith({ late: "failed" });
      });

      it("tries forget on the USB device when the open is abandoned", async () => {
        const { conn } = makeHangingConn();
        const forget = jest.fn().mockResolvedValue(undefined);
        conn.device = { forget };
        const observer = { onAbandoned: jest.fn() };
        const promise = new SpikerbitDevice(makeSerialDevice(), conn, { openTimeoutMs: 1000 })
          .connectAndStream("HEX", observer);
        const assertion = expect(promise).rejects.toMatchObject({ code: "open-timeout" });
        await jest.advanceTimersByTimeAsync(1000);
        await assertion;

        expect(forget).toHaveBeenCalled();
        expect(observer.onAbandoned).toHaveBeenCalledWith({ close: "ok" });
        expect(observer.onAbandoned).toHaveBeenCalledWith({ forget: "ok" });
      });

      it("reports forget as unsupported when the device has none", async () => {
        const { conn } = makeHangingConn();
        const observer = { onAbandoned: jest.fn() };
        const promise = new SpikerbitDevice(makeSerialDevice(), conn, { openTimeoutMs: 1000 })
          .connectAndStream("HEX", observer);
        const assertion = expect(promise).rejects.toMatchObject({ code: "open-timeout" });
        await jest.advanceTimersByTimeAsync(1000);
        await assertion;

        expect(observer.onAbandoned).toHaveBeenCalledWith({ forget: "unsupported" });
      });
    });
  });

  describe("noticing a lost board", () => {
    // A stand-in for navigator.usb that lets a test raise its disconnect event.
    function makeUsbSource() {
      const listeners = new Set<(e: { device: unknown }) => void>();
      const source: IUsbDisconnectSource & { unplug: (device: unknown) => void, count: () => number } = {
        addEventListener: (_type, l) => { listeners.add(l); },
        removeEventListener: (_type, l) => { listeners.delete(l); },
        unplug: device => listeners.forEach(l => l({ device })),
        count: () => listeners.size
      };
      return source;
    }

    it("an unplug of its own device fires onDisconnect('unplugged')", () => {
      const conn = new FakeConnection();
      const usb = makeUsbSource();
      const transport = new MicrobitUsbTransport(conn, usb);
      const losses: string[] = [];
      transport.onDisconnect = loss => losses.push(loss);
      usb.unplug(conn.device);
      expect(losses).toEqual(["unplugged"]);
    });

    it("an unplug of its own device also closes the library connection", () => {
      const conn = new FakeConnection();
      const disconnect = jest.spyOn(conn, "disconnect");
      const usb = makeUsbSource();
      new MicrobitUsbTransport(conn, usb);
      usb.unplug(conn.device);
      expect(disconnect).toHaveBeenCalledTimes(1);
    });

    it("the Disconnected status from closing after an unplug leaves it unplugged", () => {
      const serialDevice = makeSerialDevice();
      const conn = new FakeConnection();
      jest.spyOn(conn, "disconnect").mockImplementation(async () => conn.emitStatus("Disconnected"));
      const usb = makeUsbSource();
      serialDevice.setActiveDevice("spikerbit", new MicrobitUsbTransport(conn, usb));
      usb.unplug(conn.device);
      expect(serialDevice.isConnected()).toBe(false);
      expect(serialDevice.lastLoss?.reason).toBe("unplugged");
    });

    it("an unplug of another device is ignored", () => {
      const conn = new FakeConnection();
      const usb = makeUsbSource();
      const transport = new MicrobitUsbTransport(conn, usb);
      const losses: string[] = [];
      transport.onDisconnect = loss => losses.push(loss);
      usb.unplug({ name: "another board" });
      conn.device = undefined;
      usb.unplug(undefined);
      expect(losses).toEqual([]);
    });

    it("the library's Disconnected status fires onDisconnect('lost')", () => {
      const conn = new FakeConnection();
      const transport = new MicrobitUsbTransport(conn, makeUsbSource());
      const losses: string[] = [];
      transport.onDisconnect = loss => losses.push(loss);
      conn.emitStatus("Disconnected");
      expect(losses).toEqual(["lost"]);
    });

    it("dispose removes the unplug listener", () => {
      const usb = makeUsbSource();
      const transport = new MicrobitUsbTransport(new FakeConnection(), usb);
      expect(usb.count()).toBe(1);
      transport.dispose();
      expect(usb.count()).toBe(0);
    });

    it("disposing the device removes its transport's unplug listener", () => {
      const usb = makeUsbSource();
      const device = new SpikerbitDevice(makeSerialDevice(), new FakeConnection(), { usb });
      expect(usb.count()).toBe(1);
      device.dispose();
      expect(usb.count()).toBe(0);
    });

    it("a failed write and then the unplug end as unplugged", () => {
      const serialDevice = makeSerialDevice();
      const conn = new FakeConnection();
      const usb = makeUsbSource();
      const transport = new MicrobitUsbTransport(conn, usb);
      serialDevice.setActiveDevice("spikerbit", transport);
      conn.emitStatus("Disconnected");
      expect(serialDevice.lastLoss?.reason).toBe("lost");
      usb.unplug(conn.device);
      expect(serialDevice.lastLoss?.reason).toBe("unplugged");
    });

    it("the unplug and then a failed write end as unplugged", () => {
      const serialDevice = makeSerialDevice();
      const conn = new FakeConnection();
      const usb = makeUsbSource();
      const transport = new MicrobitUsbTransport(conn, usb);
      serialDevice.setActiveDevice("spikerbit", transport);
      usb.unplug(conn.device);
      conn.emitStatus("Disconnected");
      expect(serialDevice.lastLoss?.reason).toBe("unplugged");
    });
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

    it("counts the backlog as drained at a read shorter than 62 bytes, not at a full one", async () => {
      const conn = new FakeConnection();
      conn.respondHello = helloLine(kSpikerbitFirmwareVersion);
      conn.holdReplies = 1;
      const connecting = new SpikerbitDevice(makeSerialDevice(), conn).connectAndStream("HEX");
      await jest.advanceTimersByTimeAsync(0);
      // Full reads 50 ms apart, too close together for the 100 ms quiet rule to end the backlog.
      for (let i = 0; i < 8; i++) {
        conn.emitSerial("x".repeat(kReadBytes));
        await jest.advanceTimersByTimeAsync(50);
      }
      expect(conn.resetWrites()).toHaveLength(1);
      conn.emitSerial("x".repeat(kReadBytes - 1));
      await jest.advanceTimersByTimeAsync(190);
      expect(conn.resetWrites()).toHaveLength(1);
      await jest.advanceTimersByTimeAsync(30);
      expect(conn.resetWrites()).toHaveLength(2);
      await jest.advanceTimersByTimeAsync(5000);
      await connecting;
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

    it("still flashes when writing !! and ? again throws before returning a promise", async () => {
      const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
      const conn = new FakeConnection();
      conn.respondHello = null;
      const write = conn.serialWrite.bind(conn);
      conn.serialWrite = (data: string) => {
        if (data.startsWith("!!") && conn.resetWrites().length === 1) {
          conn.written.push(data);
          throw new Error("not connected");
        }
        return write(data);
      };
      const connecting = new SpikerbitDevice(makeSerialDevice(), conn).connectAndStream("HEX");

      await jest.advanceTimersByTimeAsync(5000);
      await connecting;

      expect(conn.flashed).toBe(true);
      expect(warn).toHaveBeenCalledWith("Spiker:bit serialWrite failed", expect.any(Error));
      warn.mockRestore();
    });

    it("re-queries with the same steps after a flash, with numbers of its own", async () => {
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
