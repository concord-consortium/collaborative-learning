import { NodeChannelInfo } from "../../plugins/dataflow/model/utilities/channel";
import { SerialDevice } from "./serial";
import { detectSpikerbitVersion } from "./serial-protocol";
import { IDeviceTransport } from "./device-transport";

// The version of the firmware bundled at src/plugins/dataflow/firmware/spikerbit-clue.hex.
// Bump together with the VERSION constant in the MakeCode source.
export const kSpikerbitFirmwareVersion = 3;

// How long to wait for a "?" version reply before deciding to flash.
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
// onDisconnect on a lost/deauthorised connection, so SerialDevice can receive centrally.
export class MicrobitUsbTransport implements IDeviceTransport {
  onData?: (chunk: string) => void;
  onDisconnect?: () => void;

  constructor(private connection: IMicrobitUsbConnection) {
    connection.addEventListener("serialdata", ({ data }) => this.onData?.(data));
    connection.addEventListener("status", ({ status }) => {
      if (status === "Disconnected" || status === "NoAuthorizedDevice") this.onDisconnect?.();
    });
  }

  write(line: string) {
    this.connection.serialWrite(`${line}\n`)
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
  private channels: NodeChannelInfo[] = [];
  private buffer = "";
  private detectedVersion: number | null = null;
  private versionQueryTimeoutMs: number;

  constructor(serialDevice: SerialDevice, connection: IMicrobitUsbConnection, options?: SpikerbitDeviceOptions) {
    this.serialDevice = serialDevice;
    this.connection = connection;
    this.transport = new MicrobitUsbTransport(connection);
    this.versionQueryTimeoutMs = options?.versionQueryTimeoutMs ?? kVersionQueryTimeoutMs;
  }

  public async connectAndStream(
    channels: NodeChannelInfo[],
    flashDataSource: unknown,
    progress?: (stage: string, pct?: number) => void
  ){
    this.channels = channels;
    // During connect, inbound data feeds only version detection. EMG parsing begins once
    // setActiveDevice repoints the transport's onData at SerialDevice.receive (below).
    this.transport.onData = this.handleVersionData;

    await this.connection.connect();

    const running = await this.queryVersion();
    if (running == null || running < kSpikerbitFirmwareVersion) {
      // Flash when the board is running no known firmware (no reply) or an out-of-date
      // version. USB connection stays Connected through a flash (DAPLink interface chip is
      // untouched) and serial auto-reinitialises, so no explicit reconnect here.
      await this.connection.flash(flashDataSource, { partial: true, progress });
      await this.queryVersion();
    }

    // Route servo writes and inbound EMG through this WebUSB transport and mark the shared
    // store connected. setActiveDevice wires transport.onData -> receive (spikerbit maps to
    // the arduino protocol -> parseArduinoSerialData) and transport.onDisconnect, replacing
    // the connect-time version handler.
    this.serialDevice.setActiveDevice("spikerbit", this.transport, this.channels);
  }

  // Connect-time only: scan inbound data for the firmware version reply, surfaced via
  // detectedVersion for queryVersion. EMG parsing does not happen here — it runs through
  // SerialDevice.receive once the transport becomes the active device.
  private handleVersionData = (data: string) => {
    this.buffer += data;
    const detected = detectSpikerbitVersion(this.buffer);
    if (detected.version != null) {
      this.detectedVersion = detected.version;
      this.buffer = detected.remaining;
    }
  };

  // Sends "?" and waits up to the timeout for a version reply (surfaced via
  // handleVersionData setting detectedVersion). Returns the version or null.
  private async queryVersion(): Promise<number | null> {
    this.detectedVersion = null;
    await this.connection.serialWrite("?\n");
    return new Promise<number | null>((resolve) => {
      const started = Date.now();
      const poll = () => {
        if (this.detectedVersion != null) return resolve(this.detectedVersion);
        if (Date.now() - started >= this.versionQueryTimeoutMs) return resolve(null);
        setTimeout(poll, 50);
      };
      poll();
    });
  }
}
