import { DeviceLoss, IAbandonedOpenInfo, IDeviceTransport, tryAbandonedPart } from "./device-transport";
import { SerialDevice } from "./serial";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function log(message: string) {
  // eslint-disable-next-line no-console
  console.log(`[WebSerialTransport] ${message}`);
}

// Authentic Arduinos report this productId and are the only tested boards that raise the
// browser `connect` event, which the UI uses to track physical connection independently
// of port state.
const kArduinoUsbProductId = 67;

export type WebSerialOpenResult = "opened" | "canceled" | "failed" | "timeout" | "stillOpening";

export interface IWebSerialOpenOptions {
  // Give up on port.open after this long. No limit when omitted.
  timeoutMs?: number;
  // The chooser closed with a port, or a port was given.
  onChosen?(): void;
  // Called after an abandoned port is closed and forgotten, and again when its open settles late.
  onAbandoned?(info: IAbandonedOpenInfo): void;
}

type OpenOutcome = { status: "opened" } | { status: "failed"; error: unknown } | { status: "timeout" };

export class WebSerialTransport implements IDeviceTransport {
  onData?: (chunk: string) => void;
  onDisconnect?: (loss: DeviceLoss) => void;

  deviceFamily: string | undefined;
  private deviceInfo: SerialPortInfo | null = null;
  private port: SerialPort | null = null;
  // The port most recently given to or chosen in open(); unlike `port`, it is kept after close()
  // so it can be reopened.
  lastPort: SerialPort | null = null;
  // The error behind a "failed" or "stillOpening" result from open().
  lastOpenError: unknown;
  private writer: WritableStreamDefaultWriter | undefined;
  // The read loop's current reader. It holds a lock on `port.readable`, which must be
  // released before the port can be closed.
  private activeReader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  private reading = false;
  private readonly READ_TIMEOUT_MS = 2000;

  // Whether this board raises the browser `connect` event (see initWebSerialConnectionEvents). Only
  // authentic Arduinos were observed to raise it. Clone Arduinos raise `disconnect` too.
  get raisesWebSerialConnect(){
    return this.deviceInfo?.usbProductId === kArduinoUsbProductId;
  }

  private hasOpenPort(){
    return this.port != null && this.port.readable != null;
  }

  private determineDeviceFamily(info: SerialPortInfo){
    return info.usbProductId === 516 && info.usbVendorId === 3368 ? "microbit" : "arduino";
  }

  // Opens `port`, or asks the user to choose one when none is given, then resolves
  // deviceFamily/deviceInfo. Resolves "canceled" if the user dismisses the chooser, "timeout" if
  // port.open hasn't settled within options.timeoutMs, "stillOpening" if the browser says the port
  // is already opening, and "failed" for any other error or a port that cannot be opened for writing.
  public async open(port?: SerialPort, options: IWebSerialOpenOptions = {}): Promise<WebSerialOpenResult> {
    this.lastOpenError = undefined;
    try {
      this.port = port ?? await navigator.serial.requestPort();
      this.lastPort = this.port;
      options.onChosen?.();
      this.deviceInfo = await this.port.getInfo();
      this.deviceFamily = this.determineDeviceFamily(this.deviceInfo);
    } catch (error) {
      console.error("error requesting port: ", error);
      return (error as Error | undefined)?.name === "NotFoundError" ? "canceled" : "failed";
    }
    const openingPort = this.port;
    const outcome = await this.openWithLimit(openingPort, options);
    if (outcome.status === "timeout") {
      this.port = null;
      return "timeout";
    }
    if (outcome.status === "failed") {
      console.error("error opening port: ", outcome.error);
      this.lastOpenError = outcome.error;
      return (outcome.error as Error | undefined)?.name === "InvalidStateError" ? "stillOpening" : "failed";
    }
    if (!this.port.writable) {
      console.error("Port is not writable");
      await this.closePort();
      return "failed";
    }
    this.writer = this.port.writable.getWriter();
    return "opened";
  }

  // Races port.open against the time limit. When the limit wins, the port is given up on (see
  // abandonOpen) and this resolves at once.
  private async openWithLimit(port: SerialPort, options: IWebSerialOpenOptions): Promise<OpenOutcome> {
    const opening = port.open({ baudRate: 9600 });
    const settled: Promise<OpenOutcome> = opening.then(
      () => ({ status: "opened" as const }),
      (error: unknown) => ({ status: "failed" as const, error })
    );
    if (options.timeoutMs == null) return settled;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<OpenOutcome>((resolve) => {
      timeoutId = setTimeout(() => resolve({ status: "timeout" }), options.timeoutMs);
    });
    const outcome = await Promise.race([settled, timedOut]).finally(() => clearTimeout(timeoutId));
    if (outcome.status === "timeout") this.abandonOpen(port, settled, options);
    return outcome;
  }

  // Tries to close and forget a port whose open was given up on, and closes it if that open
  // succeeds later. Nothing here is awaited: a port stuck opening may not close either, and the
  // time limit mustn't wait for it. Close and forget start together, so one that hangs doesn't
  // keep the other from being tried, and each part reports through options.onAbandoned as it
  // finishes.
  private abandonOpen(port: SerialPort, settled: Promise<OpenOutcome>, options: IWebSerialOpenOptions) {
    const report = (info: IAbandonedOpenInfo) => {
      try {
        options.onAbandoned?.(info);
      } catch (e) {
        console.error("Abandoned open report failed", e);
      }
    };
    const forgettable = port as unknown as { forget?: () => Promise<void> };
    tryAbandonedPart("close", () => port.close(), report);
    tryAbandonedPart("forget", typeof forgettable.forget === "function" ? () => forgettable.forget!() : undefined,
      report);
    void settled.then(async (late) => {
      if (late.status === "opened") {
        try { await port.close(); } catch { /* the port is abandoned either way */ }
      }
      report({ late: late.status === "opened" ? "opened" : "failed" });
    });
  }

  public write(line: string){
    if (this.hasOpenPort()) {
      this.writer?.write(textEncoder.encode(`${line}\n`));
    } else {
      log("Port closed, skipping write");
    }
  }

  public async close(){
    this.reading = false;
    const reader = this.activeReader;
    this.activeReader = undefined;
    if (reader) {
      try { await reader.cancel(); } catch { /* reader may already be released */ }
      try { reader.releaseLock(); } catch { /* lock may already be released */ }
    }
    await this.closePort();
    this.port = null;
  }

  // Read loop. Delivers decoded chunks to onData; on give-up (reopen fails) closes the port,
  // then fires onDisconnect. Relies on the browser nulling `port.readable` on a real
  // disconnect to drive the reopen check below.
  public async startReading(){
    // Not proactively stopped by the navigator.serial "disconnect" event; it self-terminates
    // within one reopen cycle once the port stops being readable (see the timeout/reopen logic below).
    this.reading = true;
    while (this.reading && this.port) {
      if (!this.port.readable) {
        log("Port not readable, attempting to reopen...");
        const reopened = await this.reopenPort();
        if (!reopened || !this.port.readable) {
          console.error("Failed to reopen port, stopping stream handler");
          break;
        }
      }

      const streamReader = this.port.readable!.getReader();
      this.activeReader = streamReader;
      try {
        while (this.reading && this.port.readable) {
          const { value, done, timedOut } = await this.readWithTimeout(streamReader);
          if (timedOut) {
            log("Read timed out, closing and reopening port...");
            await this.closePort(streamReader);
            break;
          }
          if (done) break;
          this.onData?.(value!);
        }
      } catch (error) {
        console.error(error);
      } finally {
        // The streamReader might have already been released by closePort().
        // If it hasn't, we need to release it here so we can get a new reader later.
        // It is idempotent so it is safe to call a second time.
        streamReader.releaseLock();
        if (this.activeReader === streamReader) this.activeReader = undefined;
      }
    }
    // If we exited the loop without an explicit stop (close()), the connection failed.
    if (this.reading) {
      this.reading = false;
      // Release the port so a later connect to it doesn't find it still open.
      await this.closePort();
      this.port = null;
      this.onDisconnect?.("lost");
    }
  }

  private async readWithTimeout(
    streamReader: ReadableStreamDefaultReader<Uint8Array>
  ): Promise<{ value: string | undefined; done: boolean; timedOut: boolean }> {
    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<{ value: undefined; done: false; timedOut: true }>((resolve) => {
      timeoutId = setTimeout(() => resolve({ value: undefined, done: false, timedOut: true }), this.READ_TIMEOUT_MS);
    });
    const readPromise = streamReader.read().then(({ value, done }) => ({
      value: value ? textDecoder.decode(value) : undefined,
      done,
      timedOut: false
    }));
    // Clear the timer once the race settles so resolved reads don't leave pending timeouts firing.
    return Promise.race([readPromise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
  }

  private async closePort(streamReader?: ReadableStreamDefaultReader<Uint8Array>) {
    if (!this.port) return;
    try {
      if (streamReader) {
        try { await streamReader.cancel(); } catch { /* reader may already be released */ }
        try { streamReader.releaseLock(); } catch { /* lock may already be released */ }
      }
      if (this.writer) {
        try { await this.writer.close(); } catch { /* writer may already be closed */ }
      }
      await this.port.close();
    } catch (e) {
      console.error("Error closing port:", e);
    }
  }

  private async reopenPort() {
    if (!this.port) return false;
    try {
      await this.port.open({ baudRate: 9600 });
      this.writer = this.port.writable!.getWriter();
      return true;
    } catch (e) {
      console.error("Error reopening port:", e);
      return false;
    }
  }
}

/**
 * Some serial devices fire the `connect` event before we call requestPort (the browser raises
 * it for devices the origin already has permission for), so we register handlers at CLUE
 * startup to catch this event and improve the connect-button UI. Not every board does this —
 * see raisesWebSerialConnect in WebSerialTransport.
 *
 * The disconnect handler records an unplug of the Web Serial port it belongs to; see the comment
 * on it.
 */
export function initWebSerialConnectionEvents(serialDevice: SerialDevice){
  navigator.serial?.addEventListener("connect", (e) => {
    serialDevice.updateConnectionInfo(e.timeStamp, e.type);
  });
  // The browser fires disconnect at the removed SerialPort, and it bubbles here, so `e.target` says
  // which port was unplugged; any other port's unplug leaves the device alone.
  navigator.serial?.addEventListener("disconnect", (e) => {
    const isUnplugged = (transport: unknown): transport is WebSerialTransport =>
      transport instanceof WebSerialTransport && transport.lastPort === e.target;
    const active = serialDevice.activeTransport;
    if (isUnplugged(active)) {
      serialDevice.updateConnectionInfo(e.timeStamp, e.type);
      serialDevice.recordUnplug(active);
    } else {
      // The read loop may have given up on the port first and recorded it as lost.
      const lost = serialDevice.lastLoss?.transport;
      if (isUnplugged(lost)) serialDevice.recordUnplug(lost);
    }
  });
}
