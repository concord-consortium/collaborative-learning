import { SerialDevice } from "./serial";
import { detectFirmwareReply, FirmwareReply, shouldFlash } from "./serial-protocol";
import { IDeviceTransport } from "./device-transport";

// The version of the firmware bundled at src/plugins/dataflow/firmware/spikerbit-clue.hex.
// Bump together with the VERSION constant in the MakeCode source.
export const kSpikerbitFirmwareVersion = 3;

// How long to wait for a "?" firmware reply before deciding to flash.
const kVersionQueryTimeoutMs = 1500;

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
  versionQueryTimeoutMs?: number;
}

export class SpikerbitDevice {
  private serialDevice: SerialDevice;
  private connection: IMicrobitUsbConnection;
  private transport: MicrobitUsbTransport;
  private buffer = "";
  private detectedReply: FirmwareReply | null = null;
  private versionQueryTimeoutMs: number;

  constructor(serialDevice: SerialDevice, connection: IMicrobitUsbConnection, options?: SpikerbitDeviceOptions) {
    this.serialDevice = serialDevice;
    this.connection = connection;
    this.transport = new MicrobitUsbTransport(connection);
    this.versionQueryTimeoutMs = options?.versionQueryTimeoutMs ?? kVersionQueryTimeoutMs;
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
    this.serialDevice.setActiveDevice("spikerbit", this.transport);
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

    const running = await this.queryFirmware();
    if (shouldFlash(running, kSpikerbitFirmwareVersion)) {
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
      if (shouldFlash(confirmed, kSpikerbitFirmwareVersion)) {
        console.warn(
          `Spiker:bit firmware not confirmed after flash (got ${JSON.stringify(confirmed)}, ` +
          `expected version ${kSpikerbitFirmwareVersion}); connecting anyway.`
        );
      }
    }
  }

  // Connect-time only: scan inbound data for the firmware reply, surfaced via detectedReply
  // for queryFirmware. EMG parsing does not happen here; it runs through SerialDevice.receive
  // once the transport becomes the active device.
  private handleFirmwareData = (data: string) => {
    this.buffer += data;
    const detected = detectFirmwareReply(this.buffer);
    if (detected.reply) {
      this.detectedReply = detected.reply;
      this.buffer = detected.remaining;
    }
  };

  // Sends "?" and waits up to the timeout for a firmware reply (surfaced via handleFirmwareData
  // setting detectedReply). Returns the reply or null.
  private async queryFirmware(): Promise<FirmwareReply | null> {
    this.detectedReply = null;
    await this.connection.serialWrite("?\n");
    return new Promise<FirmwareReply | null>((resolve) => {
      const started = Date.now();
      const poll = () => {
        if (this.detectedReply) return resolve(this.detectedReply);
        if (Date.now() - started >= this.versionQueryTimeoutMs) return resolve(null);
        setTimeout(poll, 50);
      };
      poll();
    });
  }
}
