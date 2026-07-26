import { IDeviceTransport } from "./device-transport";
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

export class WebSerialTransport implements IDeviceTransport {
  onData?: (chunk: string) => void;
  onDisconnect?: () => void;

  deviceFamily: string | undefined;
  private deviceInfo: SerialPortInfo | null = null;
  private port: SerialPort | null = null;
  private writer: WritableStreamDefaultWriter | undefined;
  private reading = false;
  private readonly READ_TIMEOUT_MS = 2000;

  get knownBoard(){
    return this.deviceInfo?.usbProductId === kArduinoUsbProductId;
  }

  private hasOpenPort(){
    return this.port != null && this.port.readable != null;
  }

  private determineDeviceFamily(info: SerialPortInfo){
    return info.usbProductId === 516 && info.usbVendorId === 3368 ? "microbit" : "arduino";
  }

  // requestPort + open + resolve deviceFamily/deviceInfo. Returns false if the user
  // cancels the chooser or the port cannot be opened for writing.
  public async open(): Promise<boolean> {
    try {
      this.port = await navigator.serial.requestPort();
      this.deviceInfo = await this.port.getInfo();
      this.deviceFamily = this.determineDeviceFamily(this.deviceInfo);
    } catch (error) {
      console.error("error requesting port: ", error);
      return false;
    }
    await this.port.open({ baudRate: 9600 }).catch((e: any) => console.error(e));
    if (!this.port.writable) {
      console.error("Port is not writable");
      await this.closePort();
      return false;
    }
    this.writer = this.port.writable.getWriter();
    return true;
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
    await this.closePort();
    this.port = null;
  }

  // Read loop. Delivers decoded chunks to onData; on give-up (reopen fails) fires
  // onDisconnect. Preserves the prior reopen/timeout recovery behavior. Relies on the
  // browser nulling `port.readable` on a real disconnect to drive the reopen check below.
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
        streamReader.releaseLock();
      }
    }
    // If we exited the loop without an explicit stop (close()), the connection failed.
    if (this.reading) {
      this.reading = false;
      this.onDisconnect?.();
    }
  }

  private async readWithTimeout(
    streamReader: ReadableStreamDefaultReader<Uint8Array>
  ): Promise<{ value: string | undefined; done: boolean; timedOut: boolean }> {
    const timeoutPromise = new Promise<{ value: undefined; done: false; timedOut: true }>((resolve) => {
      setTimeout(() => resolve({ value: undefined, done: false, timedOut: true }), this.READ_TIMEOUT_MS);
    });
    const readPromise = streamReader.read().then(({ value, done }) => ({
      value: value ? textDecoder.decode(value) : undefined,
      done,
      timedOut: false
    }));
    return Promise.race([readPromise, timeoutPromise]);
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

// Registered once at store creation. Preserves the app-start `connect`/`disconnect`
// affordance (authentic Arduinos raise `connect` before the user clicks) while keeping
// navigator.serial out of SerialDevice. Only tears down when a Web Serial transport owns
// the current connection, so an unrelated Web Serial disconnect can't kill a WebUSB session.
export function initWebSerialConnectionEvents(serialDevice: SerialDevice){
  navigator.serial?.addEventListener("connect", (e) => {
    serialDevice.updateConnectionInfo(e.timeStamp, e.type);
  });
  navigator.serial?.addEventListener("disconnect", (e) => {
    if (serialDevice.activeTransport instanceof WebSerialTransport) {
      serialDevice.updateConnectionInfo(e.timeStamp, e.type);
      serialDevice.clearActiveDevice();
    }
  });
}
