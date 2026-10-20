import { IDeviceTransport } from "./device-transport";
import { SerialDevice } from "./serial";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function log(message: string) {
  // eslint-disable-next-line no-console
  console.log(`[WebSerialTransport] ${message}`);
}

export type WebSerialOpenResult = "opened" | "canceled" | "failed";

export class WebSerialTransport implements IDeviceTransport {
  onData?: (chunk: string) => void;
  onDisconnect?: () => void;

  deviceFamily: string | undefined;
  private deviceInfo: SerialPortInfo | null = null;
  private port: SerialPort | null = null;
  // The port most recently given to or chosen in open(); unlike `port`, it is kept after close()
  // so it can be reopened.
  lastPort: SerialPort | null = null;
  private writer: WritableStreamDefaultWriter | undefined;
  // The read loop's current reader. It holds a lock on `port.readable`, which must be
  // released before the port can be closed.
  private activeReader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  private reading = false;
  private readonly READ_TIMEOUT_MS = 2000;

  private hasOpenPort(){
    return this.port != null && this.port.readable != null;
  }

  private determineDeviceFamily(info: SerialPortInfo){
    return info.usbProductId === 516 && info.usbVendorId === 3368 ? "microbit" : "arduino";
  }

  // Opens `port`, or asks the user to choose one when none is given, then resolves
  // deviceFamily/deviceInfo. Resolves "canceled" if the user dismisses the chooser, and
  // "failed" for any other error or a port that cannot be opened for writing.
  public async open(port?: SerialPort): Promise<WebSerialOpenResult> {
    try {
      this.port = port ?? await navigator.serial.requestPort();
      this.lastPort = this.port;
      this.deviceInfo = await this.port.getInfo();
      this.deviceFamily = this.determineDeviceFamily(this.deviceInfo);
    } catch (error) {
      console.error("error requesting port: ", error);
      return (error as Error | undefined)?.name === "NotFoundError" ? "canceled" : "failed";
    }
    await this.port.open({ baudRate: 9600 }).catch((e: any) => console.error(e));
    if (!this.port.writable) {
      console.error("Port is not writable");
      await this.closePort();
      return "failed";
    }
    this.writer = this.port.writable.getWriter();
    return "opened";
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
      try { await reader.cancel(); } catch (e) { /* reader may already be released */ }
      try { reader.releaseLock(); } catch (e) { /* lock may already be released */ }
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
      this.onDisconnect?.();
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
        try { await streamReader.cancel(); } catch (e) { /* reader may already be released */ }
        try { streamReader.releaseLock(); } catch (e) { /* lock may already be released */ }
      }
      if (this.writer) {
        try { await this.writer.close(); } catch (e) { /* writer may already be closed */ }
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
 * Registers, at CLUE startup, a handler that tears down the active connection when the browser
 * raises `disconnect` (the board was unplugged). It is guarded so it only fires while a
 * WebSerialTransport is active and can't kill a live WebUSB (Spiker:bit) session.
 */
export function initWebSerialConnectionEvents(serialDevice: SerialDevice){
  navigator.serial?.addEventListener("disconnect", () => {
    if (serialDevice.activeTransport instanceof WebSerialTransport) {
      serialDevice.clearActiveDevice();
    }
  });
}
