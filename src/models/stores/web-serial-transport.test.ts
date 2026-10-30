import { SerialDevice } from "./serial";
import { initWebSerialConnectionEvents, WebSerialOpenResult, WebSerialTransport } from "./web-serial-transport";

// Minimal fake SerialPort. `chunks` are delivered by the reader in order, then done.
function fakePort(info: Partial<SerialPortInfo>, chunks: Uint8Array[] = []) {
  let i = 0;
  const writer = { write: jest.fn(), close: jest.fn(async () => undefined) };
  const reader = {
    read: jest.fn(async () => (i < chunks.length ? { value: chunks[i++], done: false } : { done: true })),
    cancel: jest.fn(async () => undefined),
    releaseLock: jest.fn(),
  };
  return {
    getInfo: async () => info,
    open: jest.fn(async () => undefined),
    close: jest.fn(async () => undefined),
    writable: { getWriter: () => writer },
    readable: { getReader: () => reader },
    _writer: writer,
  } as any;
}

function stubSerial(port: any) {
  (navigator as any).serial = { requestPort: jest.fn(async () => port), addEventListener: jest.fn() };
}

describe("WebSerialTransport", () => {
  afterEach(() => { delete (navigator as any).serial; jest.clearAllTimers(); });

  it("resolves deviceFamily=microbit and raisesWebSerialConnect=false for a micro:bit", async () => {
    stubSerial(fakePort({ usbProductId: 516, usbVendorId: 3368 }));
    const t = new WebSerialTransport();
    expect(await t.open()).toBe("opened");
    expect(t.deviceFamily).toBe("microbit");
    expect(t.raisesWebSerialConnect).toBe(false);
  });

  it("resolves deviceFamily=arduino and raisesWebSerialConnect=true for an authentic Arduino", async () => {
    stubSerial(fakePort({ usbProductId: 67, usbVendorId: 9999 }));
    const t = new WebSerialTransport();
    expect(await t.open()).toBe("opened");
    expect(t.deviceFamily).toBe("arduino");
    expect(t.raisesWebSerialConnect).toBe(true);
  });

  it("open returns canceled when the chooser is dismissed", async () => {
    stubSerial(fakePort({}));
    (navigator as any).serial.requestPort = jest.fn(async () => { throw new DOMException("", "NotFoundError"); });
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const t = new WebSerialTransport();
    expect(await t.open()).toBe("canceled");
    expect(t.lastPort).toBeNull();
  });

  it("open returns failed when the chooser throws any other error", async () => {
    stubSerial(fakePort({}));
    (navigator as any).serial.requestPort = jest.fn(async () => { throw new DOMException("", "SecurityError"); });
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const t = new WebSerialTransport();
    expect(await t.open()).toBe("failed");
  });

  it("open returns failed when the port isn't writable", async () => {
    const port = fakePort({ usbProductId: 67 });
    port.writable = null;
    stubSerial(port);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const t = new WebSerialTransport();
    expect(await t.open()).toBe("failed");
  });

  it("open(port) opens the given port without the chooser", async () => {
    const port = fakePort({ usbProductId: 67 });
    stubSerial(fakePort({}));
    const t = new WebSerialTransport();
    expect(await t.open(port)).toBe("opened");
    expect((navigator as any).serial.requestPort).not.toHaveBeenCalled();
    expect(port.open).toHaveBeenCalled();
    expect(t.deviceFamily).toBe("arduino");
  });

  it("lastPort survives close", async () => {
    const port = fakePort({ usbProductId: 67 });
    stubSerial(port);
    const t = new WebSerialTransport();
    await t.open();
    expect(t.lastPort).toBe(port);
    await t.close();
    expect(t.lastPort).toBe(port);
  });

  it("frames and writes when open, and no-ops when the port is closed", async () => {
    const port = fakePort({ usbProductId: 67 });
    stubSerial(port);
    const t = new WebSerialTransport();
    await t.open();
    t.write("90");
    expect(port._writer.write).toHaveBeenCalledWith(new TextEncoder().encode("90\n"));

    port.readable = null; // simulate closed port
    port._writer.write.mockClear();
    t.write("91");
    expect(port._writer.write).not.toHaveBeenCalled();
  });

  it("close during an active read releases the reader and closes the port", async () => {
    let locked = false;
    let resolveRead: ((r: { done: boolean }) => void) | undefined;
    const reader = {
      read: jest.fn(() => new Promise<{ done: boolean }>(resolve => { resolveRead = resolve; })),
      cancel: jest.fn(async () => { resolveRead?.({ done: true }); }),
      releaseLock: jest.fn(() => { locked = false; }),
    };
    const port = {
      getInfo: async () => ({ usbProductId: 67 }),
      open: jest.fn(async () => undefined),
      // Like a real stream, closing a port whose readable is locked rejects.
      close: jest.fn(async () => { if (locked) throw new TypeError("locked"); }),
      writable: { getWriter: () => ({ write: jest.fn(), close: jest.fn(async () => undefined) }) },
      readable: { getReader: () => { locked = true; return reader; } },
    } as any;
    stubSerial(port);
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

    const t = new WebSerialTransport();
    await t.open();
    const onDisconnect = jest.fn();
    t.onDisconnect = onDisconnect;
    errorSpy.mockClear();
    const readingDone = t.startReading();
    await Promise.resolve();

    await t.close();
    await readingDone;

    expect(reader.cancel).toHaveBeenCalled();
    expect(locked).toBe(false);
    expect(port.close).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
    expect(onDisconnect).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  // NOTE: unlike the other cases, this test doesn't reuse the shared `fakePort`/its
  // "done" reader response. A reader that reports `done` (without a timeout) leaves
  // `port.readable` untouched, so the transport's outer loop just re-acquires a reader
  // and immediately gets `done` again forever - an infinite, ever-faster loop that
  // piles up uncleared `readWithTimeout` timers and OOMs the test process (confirmed
  // by running it). Real hardware doesn't hit this: a genuine disconnect mid-read makes
  // the browser null out `port.readable`/`writable`, which is what drives the reopen
  // check. This test reproduces that real shape instead: the read after the first chunk
  // hangs (as a real dropped connection would), so the 2000ms read timeout fires,
  // `closePort` runs (closing nulls `readable`, matching the real API), and the
  // subsequent reopen attempt finds no readable port and gives up.
  it("delivers decoded chunks to onData, then disconnects when the port is lost", async () => {
    jest.useFakeTimers();
    try {
      const chunk = new TextEncoder().encode("emg:7\r\n");
      let call = 0;
      const reader = {
        read: jest.fn(() => call++ === 0
          ? Promise.resolve({ value: chunk, done: false })
          : new Promise(() => { /* never resolves, forcing the read timeout */ })),
        cancel: jest.fn(async () => undefined),
        releaseLock: jest.fn(),
      };
      const port = {
        getInfo: async () => ({ usbProductId: 67 }),
        open: jest.fn(async () => undefined),
        close: jest.fn(async () => { port.readable = null; }), // closing invalidates readable, as in the real API
        writable: { getWriter: () => ({ write: jest.fn(), close: jest.fn(async () => undefined) }) },
        readable: { getReader: () => reader },
      } as any;
      stubSerial(port);

      const t = new WebSerialTransport();
      await t.open();
      const received: string[] = [];
      t.onData = (c) => received.push(c);
      const disconnected: string[] = [];
      t.onDisconnect = (loss) => disconnected.push(loss);

      const readingDone = t.startReading();
      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(2000);
      await readingDone;

      expect(received).toContain("emg:7\r\n");
      expect(disconnected).toEqual(["lost"]);
    } finally {
      jest.useRealTimers();
    }
  });

  it("closes the port before firing onDisconnect when it gives up", async () => {
    const order: string[] = [];
    const reader = {
      read: jest.fn(async () => ({ done: true })),
      cancel: jest.fn(async () => undefined),
      releaseLock: jest.fn(),
    };
    const port = {
      getInfo: async () => ({ usbProductId: 67 }),
      open: jest.fn(),
      close: jest.fn(async () => { order.push("close"); }),
      writable: { getWriter: () => ({ write: jest.fn(), close: jest.fn(async () => undefined) }) },
      readable: { getReader: () => reader },
    } as any;
    // The first open succeeds; the stream then ends, the readable goes away and the reopen fails.
    port.open.mockImplementationOnce(async () => undefined).mockImplementation(async () => {
      throw new DOMException("already open", "InvalidStateError");
    });
    reader.read.mockImplementation(async () => { port.readable = null; return { done: true }; });
    stubSerial(port);
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    const t = new WebSerialTransport();
    await t.open();
    t.onDisconnect = () => { order.push("onDisconnect"); };
    await t.startReading();

    expect(order).toEqual(["close", "onDisconnect"]);
  });
});

describe("WebSerialTransport open steps", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    delete (navigator as any).serial;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("open reports the chooser closing before the port opens", async () => {
    const port = fakePort({ usbProductId: 67 });
    const order: string[] = [];
    port.open = jest.fn(async () => { order.push("open"); });
    stubSerial(port);
    const t = new WebSerialTransport();
    expect(await t.open(undefined, { onChosen: () => order.push("chosen") })).toBe("opened");
    expect(order).toEqual(["chosen", "open"]);
  });

  it("open reports a given port as chosen", async () => {
    const onChosen = jest.fn();
    const t = new WebSerialTransport();
    expect(await t.open(fakePort({ usbProductId: 67 }), { onChosen })).toBe("opened");
    expect(onChosen).toHaveBeenCalledTimes(1);
  });

  it("open resolves timeout when port.open hasn't settled within timeoutMs, and tries close and forget", async () => {
    jest.useFakeTimers();
    const port = fakePort({ usbProductId: 67 });
    port.open = jest.fn(() => new Promise(() => { /* never settles */ }));
    port.close = jest.fn(async () => { throw new DOMException("", "InvalidStateError"); });
    port.forget = jest.fn(async () => undefined);
    const onAbandoned = jest.fn();
    const t = new WebSerialTransport();
    const result = t.open(port, { timeoutMs: 20000, onAbandoned });
    await jest.advanceTimersByTimeAsync(20000);
    expect(await result).toBe("timeout");
    expect(onAbandoned).toHaveBeenCalledWith({ close: "failed" });
    expect(onAbandoned).toHaveBeenCalledWith({ forget: "ok" });
  });

  it("open resolves timeout at the limit when closing the stuck port hangs too, and still tries forget", async () => {
    jest.useFakeTimers();
    const port = fakePort({ usbProductId: 67 });
    port.open = jest.fn(() => new Promise(() => { /* never settles */ }));
    port.close = jest.fn(() => new Promise<void>(() => { /* never settles */ }));
    port.forget = jest.fn(async () => undefined);
    const onAbandoned = jest.fn();
    const t = new WebSerialTransport();
    let result: WebSerialOpenResult | undefined;
    void t.open(port, { timeoutMs: 20000, onAbandoned }).then(r => { result = r; });
    await jest.advanceTimersByTimeAsync(20000);
    expect(result).toBe("timeout");
    expect(port.close).toHaveBeenCalled();
    expect(port.forget).toHaveBeenCalled();
    expect(onAbandoned.mock.calls).toEqual([[{ forget: "ok" }]]);
  });

  it("an onAbandoned that throws doesn't become an unhandled rejection", async () => {
    jest.useFakeTimers();
    const port = fakePort({ usbProductId: 67 });
    let resolveOpen: () => void = () => undefined;
    port.open = jest.fn(() => new Promise<void>(resolve => { resolveOpen = resolve; }));
    const onAbandoned = jest.fn(() => { throw new Error("listener failed"); });
    const t = new WebSerialTransport();
    const result = t.open(port, { timeoutMs: 20000, onAbandoned });
    await jest.advanceTimersByTimeAsync(20000);
    expect(await result).toBe("timeout");
    resolveOpen();
    await jest.advanceTimersByTimeAsync(0);
    // close, forget and the late open each report, and each throws.
    expect(onAbandoned).toHaveBeenCalledTimes(3);
    expect(console.error).toHaveBeenCalledWith("Abandoned open report failed", expect.any(Error));
  });

  it("an open that finishes after the timeout is closed at once and reported", async () => {
    jest.useFakeTimers();
    const port = fakePort({ usbProductId: 67 });
    let resolveOpen: () => void = () => undefined;
    port.open = jest.fn(() => new Promise<void>(resolve => { resolveOpen = resolve; }));
    port.forget = jest.fn(async () => undefined);
    const onAbandoned = jest.fn();
    const t = new WebSerialTransport();
    const result = t.open(port, { timeoutMs: 20000, onAbandoned });
    await jest.advanceTimersByTimeAsync(20000);
    expect(await result).toBe("timeout");
    port.close.mockClear();
    resolveOpen();
    await jest.advanceTimersByTimeAsync(0);
    expect(port.close).toHaveBeenCalled();
    expect(onAbandoned).toHaveBeenLastCalledWith({ late: "opened" });
  });

  it("a late open failure is reported", async () => {
    jest.useFakeTimers();
    const port = fakePort({ usbProductId: 67 });
    let rejectOpen: (e: unknown) => void = () => undefined;
    port.open = jest.fn(() => new Promise<void>((_, reject) => { rejectOpen = reject; }));
    const onAbandoned = jest.fn();
    const t = new WebSerialTransport();
    const result = t.open(port, { timeoutMs: 20000, onAbandoned });
    await jest.advanceTimersByTimeAsync(20000);
    await result;
    rejectOpen(new DOMException("", "NetworkError"));
    await jest.advanceTimersByTimeAsync(0);
    expect(onAbandoned).toHaveBeenLastCalledWith({ late: "failed" });
  });

  it("open doesn't time out when the port opens in time", async () => {
    jest.useFakeTimers();
    const onAbandoned = jest.fn();
    const t = new WebSerialTransport();
    expect(await t.open(fakePort({ usbProductId: 67 }), { timeoutMs: 20000, onAbandoned })).toBe("opened");
    await jest.advanceTimersByTimeAsync(20000);
    expect(onAbandoned).not.toHaveBeenCalled();
  });

  it("open resolves stillOpening when the browser says the port is still opening", async () => {
    const port = fakePort({ usbProductId: 67 });
    port.open = jest.fn(async () => { throw new DOMException("", "InvalidStateError"); });
    const t = new WebSerialTransport();
    expect(await t.open(port)).toBe("stillOpening");
    expect((t.lastOpenError as Error).name).toBe("InvalidStateError");
  });

  it("open resolves failed and keeps the error when port.open rejects otherwise", async () => {
    const port = fakePort({ usbProductId: 67 });
    port.open = jest.fn(async () => { throw new DOMException("", "NetworkError"); });
    const t = new WebSerialTransport();
    expect(await t.open(port)).toBe("failed");
    expect((t.lastOpenError as Error).name).toBe("NetworkError");
  });

  it("forget is reported unsupported when the port has none", async () => {
    jest.useFakeTimers();
    const port = fakePort({ usbProductId: 67 });
    port.open = jest.fn(() => new Promise(() => { /* never settles */ }));
    const onAbandoned = jest.fn();
    const t = new WebSerialTransport();
    const result = t.open(port, { timeoutMs: 20000, onAbandoned });
    await jest.advanceTimersByTimeAsync(20000);
    await result;
    expect(onAbandoned).toHaveBeenCalledWith({ close: "ok" });
    expect(onAbandoned).toHaveBeenCalledWith({ forget: "unsupported" });
  });
});

describe("initWebSerialConnectionEvents", () => {
  let listeners: Record<string, (e: Event) => void>;

  beforeEach(() => {
    listeners = {};
    (navigator as any).serial = {
      addEventListener: jest.fn((type: string, l: (e: Event) => void) => { listeners[type] = l; })
    };
  });
  afterEach(() => { delete (navigator as any).serial; });

  // The browser fires disconnect at the removed SerialPort, and it bubbles to navigator.serial.
  const unplug = (port: unknown) =>
    listeners.disconnect({ timeStamp: 1, type: "disconnect", target: port } as unknown as Event);
  const transportOn = (port: unknown) => {
    const transport = new WebSerialTransport();
    transport.lastPort = port as SerialPort;
    return transport;
  };

  it("the browser's disconnect event records an unplug of the active Web Serial device", () => {
    const serialDevice = new SerialDevice();
    initWebSerialConnectionEvents(serialDevice);
    const port = {};
    const transport = transportOn(port);
    serialDevice.setActiveDevice("arduino", transport);
    unplug(port);
    expect(serialDevice.isConnected()).toBe(false);
    expect(serialDevice.lastLoss?.reason).toBe("unplugged");
    expect(serialDevice.lastLoss?.transport).toBe(transport);
  });

  it("upgrades a loss the read loop recorded first", () => {
    const serialDevice = new SerialDevice();
    initWebSerialConnectionEvents(serialDevice);
    const port = {};
    const transport = transportOn(port);
    serialDevice.setActiveDevice("arduino", transport);
    transport.onDisconnect?.("lost");
    unplug(port);
    expect(serialDevice.lastLoss?.reason).toBe("unplugged");
  });

  it("an unplug of another port leaves the active device connected", () => {
    const serialDevice = new SerialDevice();
    initWebSerialConnectionEvents(serialDevice);
    serialDevice.setActiveDevice("arduino", transportOn({}));
    unplug({});
    expect(serialDevice.isConnected()).toBe(true);
    expect(serialDevice.lastLoss).toBeUndefined();
  });

  it("an unplug of another port doesn't upgrade a loss", () => {
    const serialDevice = new SerialDevice();
    initWebSerialConnectionEvents(serialDevice);
    const transport = transportOn({});
    serialDevice.setActiveDevice("arduino", transport);
    transport.onDisconnect?.("lost");
    unplug({});
    expect(serialDevice.lastLoss?.reason).toBe("lost");
  });

  it("ignores the event when no Web Serial device is or was connected", () => {
    const serialDevice = new SerialDevice();
    initWebSerialConnectionEvents(serialDevice);
    const transport = { write: jest.fn(), close: jest.fn() };
    serialDevice.setActiveDevice("spikerbit", transport);
    unplug({});
    expect(serialDevice.isConnected()).toBe(true);
    serialDevice.clearActiveDevice();
  });
});
