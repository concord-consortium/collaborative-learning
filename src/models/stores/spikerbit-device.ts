import { kMaxSeq } from "./cc-device-session";
import { withChecksum } from "./cc-device-protocol";
import { SerialDevice } from "./serial";
import { detectFirmwareReply, FirmwareReply, shouldFlash } from "./serial-protocol";
import { DeviceLoss, IDeviceTransport } from "./device-transport";

// The version of the firmware bundled at src/plugins/dataflow/firmware/spikerbit-clue.hex.
// Keep equal to the `firmware:` number in the HELLO line of spikerbit-clue.ts.
export const kSpikerbitFirmwareVersion = 4;

// The `device` field of the hello a Spiker:bit sends, and also its deviceFamily key in
// kDeviceCapabilities.
const kSpikerbitDeviceName = "spikerbit";

// How long queryFirmware waits in all, both attempts included, for a firmware reply before
// deciding to flash.
const kFirmwareQueryTimeoutMs = 1500;

// The most one "serialdata" event can carry. @microbit/microbit-connection reads the board's
// output with DAPLink's vendor serial read, whose 64-byte reply spends 2 bytes on its header
// (`read` in its usb/daplink.js). While a backlog drains, every read comes back full, so the
// first shorter one means DAPLink's buffer has been emptied. This is only a hint; kDrainQuietMs
// and the overall timeout are the backstops.
const kDaplinkReadBytes = 62;

// With no data for this long, the backlog counts as drained even without a short read.
const kDrainQuietMs = 100;

// How long after the drain queryFirmware waits for a reply before it writes "!!" and "?" again.
const kRetryAfterDrainMs = 200;

// How often queryFirmware checks for a reply and for the drain.
const kQueryPollMs = 10;

// Above CcDeviceSession's 1..kMaxSeq, so a late reply to a connect-time "!!" can't match a session
// command.
const kFirstResetSeq = kMaxSeq + 1;

// Minimal subset of @microbit/microbit-connection's MicrobitUSBConnection that
// this module depends on. Kept as an interface so tests can supply a fake and so
// the device logic stays decoupled from the library (only spikerbit-connection.ts
// imports it).
export interface IMicrobitUsbConnection {
  addEventListener(type: "serialdata", listener: (data: { data: string }) => void): void;
  addEventListener(type: "status", listener: (data: { status: string }) => void): void;
  connect(): Promise<void>;
  flash(
    dataSource: unknown,
    options: { partial?: boolean; progress?: (stage: string, pct?: number) => void }
  ): Promise<void>;
  serialWrite(data: string): Promise<void>;
  disconnect(): Promise<void>;
  // The library's USBDevice. Typed unknown: it's only compared with the device in an unplug event.
  getDevice(): unknown;
}

// The part of navigator.usb that reports a device being unplugged.
export interface IUsbDisconnectSource {
  addEventListener(type: "disconnect", listener: (e: { device: unknown }) => void): void;
  removeEventListener(type: "disconnect", listener: (e: { device: unknown }) => void): void;
}

// IDeviceTransport over a micro:bit WebUSB serial connection. Like WebSerialTransport,
// it owns the connection's inbound events: it forwards serial chunks to onData and fires
// onDisconnect on a lost/deauthorized connection, so SerialDevice can receive centrally.
// The library disconnects itself after any failed WebUSB call, which reports the loss as "lost".
// It listens for navigator.usb's disconnect event only in its initialize(), which CLUE doesn't call
// because it also pauses the connection in a hidden tab, so this listens for unplugs itself.
export class MicrobitUsbTransport implements IDeviceTransport {
  onData?: (chunk: string) => void;
  onDisconnect?: (loss: DeviceLoss) => void;

  constructor(
    private connection: IMicrobitUsbConnection,
    private usb: IUsbDisconnectSource | undefined = (navigator as { usb?: IUsbDisconnectSource }).usb
  ) {
    connection.addEventListener("serialdata", ({ data }) => this.onData?.(data));
    connection.addEventListener("status", ({ status }) => {
      if (status === "Disconnected" || status === "NoAuthorizedDevice") this.onDisconnect?.("lost");
    });
    usb?.addEventListener("disconnect", this.handleUnplug);
  }

  dispose() {
    this.usb?.removeEventListener("disconnect", this.handleUnplug);
  }

  private handleUnplug = (e: { device: unknown }) => {
    const device = this.connection.getDevice();
    if (device === undefined || e.device !== device) return;
    this.onDisconnect?.("unplugged");
    // The library doesn't see the unplug, so its status would stay Connected. The Disconnected
    // status this raises reports "lost", which doesn't undo the unplug already recorded.
    this.connection.disconnect().catch((err) => console.warn("Spiker:bit disconnect failed", err));
  };

  // Resolves when the write finishes, so a caller can wait for its last line to reach the board.
  // A failure is logged, not thrown. It's async because serialWrite throws before returning a
  // promise when the board is gone.
  async write(line: string) {
    try {
      await this.connection.serialWrite(`${line}\n`);
    } catch (e) {
      console.warn("Spiker:bit serialWrite failed", e);
    }
  }

  close() {
    return this.connection.disconnect();
  }
}

export interface SpikerbitDeviceOptions {
  firmwareQueryTimeoutMs?: number;
}

export class SpikerbitDevice {
  private serialDevice: SerialDevice;
  private connection: IMicrobitUsbConnection;
  private transport: MicrobitUsbTransport;
  private buffer = "";
  private detectedReply: FirmwareReply | null = null;
  private firmwareQueryTimeoutMs: number;
  private resetSeq = kFirstResetSeq;
  // When the latest connect-time chunk arrived, and when the backlog was first seen to have
  // drained (a read shorter than kDaplinkReadBytes) since the latest "!!" and "?".
  private lastDataAt = 0;
  private shortReadAt: number | undefined;

  constructor(serialDevice: SerialDevice, connection: IMicrobitUsbConnection, options?: SpikerbitDeviceOptions) {
    this.serialDevice = serialDevice;
    this.connection = connection;
    this.transport = new MicrobitUsbTransport(connection);
    this.firmwareQueryTimeoutMs = options?.firmwareQueryTimeoutMs ?? kFirmwareQueryTimeoutMs;
  }

  public async connectAndStream(
    flashDataSource: unknown,
    progress?: (stage: string, pct?: number) => void
  ){
    this.transport.onData = this.handleFirmwareData;

    try {
      await this.connectAndCheckFirmware(flashDataSource, progress);
    } catch (e) {
      // Close the link so a failed attempt doesn't leave the board open and still feeding
      // the firmware handler.
      await this.disconnect().catch((err) => console.warn("Spiker:bit disconnect failed", err));
      throw e;
    }

    this.serialDevice.setActiveDevice(kSpikerbitDeviceName, this.transport);
  }

  // Closes the WebUSB link. The library connection's status event then clears the store's
  // active device if this transport holds it.
  public disconnect() {
    this.transport.onData = undefined;
    this.buffer = "";
    return this.connection.disconnect();
  }

  // Stops listening for this board being unplugged. Call when the device is no longer kept.
  public dispose() {
    this.transport.dispose();
  }

  private async connectAndCheckFirmware(
    flashDataSource: unknown,
    progress?: (stage: string, pct?: number) => void
  ) {
    await this.connection.connect();

    this.resetSeq = kFirstResetSeq;
    const running = await this.queryFirmware();
    if (shouldFlash(running, kSpikerbitDeviceName, kSpikerbitFirmwareVersion)) {
      // USB connection stays Connected through a flash (DAPLink interface chip is untouched) and
      // serial auto-reinitializes, so no explicit reconnect here.
      await this.connection.flash(flashDataSource, { partial: true, progress });
      // Re-query to confirm the flash took, but proceed regardless: the board was just written
      // with the known-good bundled hex, so a null/stale reply here is far more likely a serial
      // re-init timing artifact than bad firmware, and aborting would discard a good flash while
      // showing the user nothing. We warn rather than fail so a genuinely halted board (e.g. a
      // partial flash whose reset was swallowed) still leaves a trace.
      const confirmed = await this.queryFirmware();
      if (shouldFlash(confirmed, kSpikerbitDeviceName, kSpikerbitFirmwareVersion)) {
        console.warn(
          `Spiker:bit firmware not confirmed after flash (got ${JSON.stringify(confirmed)}, ` +
          `expected firmware ${kSpikerbitFirmwareVersion}); connecting anyway.`
        );
      }
    }
  }

  // Connect-time only: scan inbound data for the firmware reply, surfaced via detectedReply
  // for queryFirmware. EMG parsing does not happen here; it runs through SerialDevice.receive
  // once the transport becomes the active device.
  private handleFirmwareData = (data: string) => {
    this.lastDataAt = Date.now();
    if (data.length < kDaplinkReadBytes && this.shortReadAt === undefined) {
      this.shortReadAt = this.lastDataAt;
    }
    this.buffer += data;
    const detected = detectFirmwareReply(this.buffer);
    if (detected.reply) {
      this.detectedReply = detected.reply;
      this.buffer = detected.remaining;
    }
  };

  // Identifies the firmware, right after connecting and again after a flash: writes "!! #n" and a
  // bare "?", reads lines until a hello or a v1–v3 banner, and writes both once more
  // kRetryAfterDrainMs after the backlog drains, in case DAPLink's full buffer dropped the
  // replies. Returns null when nothing is identified within firmwareQueryTimeoutMs. Why "!!" comes
  // first: cc-device-protocol.md, "Connecting".
  private async queryFirmware(): Promise<FirmwareReply | null> {
    this.detectedReply = null;
    const started = Date.now();
    await this.writeResetAndQuery();
    let retried = false;
    return new Promise<FirmwareReply | null>((resolve) => {
      const poll = () => {
        if (this.detectedReply) return resolve(this.detectedReply);
        const now = Date.now();
        if (now - started >= this.firmwareQueryTimeoutMs) return resolve(null);
        if (!retried) {
          const drainedAt = this.shortReadAt
            ?? (now - this.lastDataAt >= kDrainQuietMs ? this.lastDataAt + kDrainQuietMs : undefined);
          if (drainedAt !== undefined && now - drainedAt >= kRetryAfterDrainMs) {
            retried = true;
            this.writeResetAndQuery().catch((e) => console.warn("Spiker:bit serialWrite failed", e));
          }
        }
        setTimeout(poll, kQueryPollMs);
      };
      poll();
    });
  }

  // Both lines go in one write, so the "?" reaches the board right behind the "!!". The "!!"
  // carries a checksum, like every command Dataflow sends except the "?". Async so that a
  // serialWrite that throws before returning a promise rejects instead.
  private async writeResetAndQuery() {
    this.lastDataAt = Date.now();
    this.shortReadAt = undefined;
    await this.connection.serialWrite(`${withChecksum(`!! #${this.resetSeq++}`)}\n?\n`);
  }
}
