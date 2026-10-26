import { kMaxSeq } from "./cc-device-session";
import { withChecksum } from "./cc-device-protocol";
import { SerialDevice } from "./serial";
import { detectFirmwareReply, FirmwareReply, shouldFlash } from "./serial-protocol";
import { IDeviceTransport } from "./device-transport";

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

// The #n of the connect-time "!!". CcDeviceSession numbers its commands from 1 to kMaxSeq, so a
// connect-time number can never match one of the session's. That matters because a reply to a
// connect-time "!!" can reach the session: once one attempt has identified the firmware, the
// session starts while the replies to another attempt (a retry, or a first attempt the device
// answered late) may still be on their way.
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
}

// IDeviceTransport over a micro:bit WebUSB serial connection. Like WebSerialTransport,
// it owns the connection's inbound events: it forwards serial chunks to onData and fires
// onDisconnect on a lost/deauthorized connection, so SerialDevice can receive centrally.
export class MicrobitUsbTransport implements IDeviceTransport {
  onData?: (chunk: string) => void;
  onDisconnect?: () => void;

  constructor(private connection: IMicrobitUsbConnection) {
    connection.addEventListener("serialdata", ({ data }) => this.onData?.(data));
    connection.addEventListener("status", ({ status }) => {
      if (status === "Disconnected" || status === "NoAuthorizedDevice") this.onDisconnect?.();
    });
  }

  // Resolves when the write finishes, so a caller can wait for its last line to reach the board.
  // A failure is logged, not thrown.
  write(line: string) {
    return this.connection.serialWrite(`${line}\n`)
      .catch((e) => console.warn("Spiker:bit serialWrite failed", e));
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
    // During connect, inbound data feeds only firmware detection. EMG parsing begins once
    // setActiveDevice repoints the transport's onData at SerialDevice.receive (below).
    this.transport.onData = this.handleFirmwareData;

    try {
      await this.connectAndCheckFirmware(flashDataSource, progress);
    } catch (e) {
      // Close the link so a failed attempt doesn't leave the board open and still feeding
      // the firmware handler.
      await this.disconnect().catch((err) => console.warn("Spiker:bit disconnect failed", err));
      throw e;
    }

    // Route servo writes and inbound EMG through this WebUSB transport and mark the shared
    // store connected. setActiveDevice wires transport.onData -> receive (spikerbit maps to
    // the ccDevice protocol -> CcDeviceSession) and transport.onDisconnect, replacing
    // the connect-time firmware handler, and starts the session.
    this.serialDevice.setActiveDevice(kSpikerbitDeviceName, this.transport);
  }

  // Closes the WebUSB link. The library connection's status event then clears the store's
  // active device if this transport holds it.
  public disconnect() {
    this.transport.onData = undefined;
    this.buffer = "";
    return this.connection.disconnect();
  }

  private async connectAndCheckFirmware(
    flashDataSource: unknown,
    progress?: (stage: string, pct?: number) => void
  ) {
    await this.connection.connect();

    this.resetSeq = kFirstResetSeq;
    const running = await this.queryFirmware();
    if (shouldFlash(running, kSpikerbitDeviceName, kSpikerbitFirmwareVersion)) {
      // Flash when the board answers with no recognized reply, the legacy banner, a protocol
      // Dataflow doesn't speak, or older firmware. USB connection stays Connected through a
      // flash (DAPLink interface chip is untouched) and serial auto-reinitializes, so no explicit
      // reconnect here.
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

  // Identifies the firmware, right after connecting and again after a flash. A board that nobody
  // has been reading may have filled DAPLink's buffer with stale output, which arrives first and
  // usually ends in a cut-off line. So this writes "!! #n" and a bare "?" (firmware v1–v3 answers
  // only a bare "?") and reads lines until a hello line or a v1–v3 banner. Firmware that knows
  // "!!" resets to idle and sends an empty line and "ok #n" before its hello; the empty line ends
  // the cut-off line, so the hello isn't glued onto it. The "ok" needs no handling: the hello
  // identifies the firmware whether or not an "ok" came first, and shouldFlash decides. If
  // nothing is identified kRetryAfterDrainMs after the backlog has drained, the replies may have
  // been dropped while DAPLink's buffer was still full, so it writes "!!" and "?" once more.
  // Returns null when nothing is identified within firmwareQueryTimeoutMs.
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
  // carries a checksum, like every command Dataflow sends except the "?".
  private writeResetAndQuery() {
    this.lastDataAt = Date.now();
    this.shortReadAt = undefined;
    return this.connection.serialWrite(`${withChecksum(`!! #${this.resetSeq++}`)}\n?\n`);
  }
}
