import { WebSerialTransport } from "./web-serial-transport";

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
  (navigator as any).serial = { requestPort: async () => port, addEventListener: jest.fn() };
}

describe("WebSerialTransport", () => {
  afterEach(() => { delete (navigator as any).serial; jest.clearAllTimers(); });

  it("resolves deviceFamily=microbit and raisesWebSerialConnect=false for a micro:bit", async () => {
    stubSerial(fakePort({ usbProductId: 516, usbVendorId: 3368 }));
    const t = new WebSerialTransport();
    expect(await t.open()).toBe(true);
    expect(t.deviceFamily).toBe("microbit");
    expect(t.raisesWebSerialConnect).toBe(false);
  });

  it("resolves deviceFamily=arduino and raisesWebSerialConnect=true for an authentic Arduino", async () => {
    stubSerial(fakePort({ usbProductId: 67, usbVendorId: 9999 }));
    const t = new WebSerialTransport();
    expect(await t.open()).toBe(true);
    expect(t.deviceFamily).toBe("arduino");
    expect(t.raisesWebSerialConnect).toBe(true);
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
      const disconnected: boolean[] = [];
      t.onDisconnect = () => disconnected.push(true);

      const readingDone = t.startReading();
      await Promise.resolve();
      await jest.advanceTimersByTimeAsync(2000);
      await readingDone;

      expect(received).toContain("emg:7\r\n");
      expect(disconnected).toEqual([true]);
    } finally {
      jest.useRealTimers();
    }
  });
});
