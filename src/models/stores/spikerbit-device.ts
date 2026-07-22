import { NodeChannelInfo } from "../../plugins/dataflow/model/utilities/channel";
import { SerialDevice } from "./serial";
import { parseArduinoSerialData, detectSpikerbitVersion } from "./serial-protocol";

// The version of the firmware bundled at src/plugins/dataflow/firmware/spikerbit-clue.hex.
// Bump together with the VERSION constant in the MakeCode source.
export const kSpikerbitFirmwareVersion = 2;

// How long to wait for a "?" version reply before deciding to flash.
const kVersionQueryTimeoutMs = 1500;

// Minimal subset of @microbit/microbit-connection's MicrobitUSBConnection that
// this module depends on. Kept as an interface so tests can supply a fake, and
// so this file never has to statically import the (ESM-only) library.
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

export interface SpikerbitDeviceOptions {
  versionQueryTimeoutMs?: number;
}

export class SpikerbitDevice {
  private serialDevice: SerialDevice;
  private connection: IMicrobitUsbConnection;
  private channels: NodeChannelInfo[] = [];
  private buffer = "";
  private detectedVersion: number | null = null;
  private versionQueryTimeoutMs: number;

  constructor(serialDevice: SerialDevice, connection: IMicrobitUsbConnection, options?: SpikerbitDeviceOptions) {
    this.serialDevice = serialDevice;
    this.connection = connection;
    this.versionQueryTimeoutMs = options?.versionQueryTimeoutMs ?? kVersionQueryTimeoutMs;
  }

  public async connectAndStream(
    channels: NodeChannelInfo[],
    flashDataSource: unknown,
    progress?: (stage: string, pct?: number) => void
  ){
    this.channels = channels;
    this.connection.addEventListener("serialdata", this.handleSerialData);
    this.connection.addEventListener("status", this.handleStatus);

    await this.connection.connect();

    const running = await this.queryVersion();
    if (running == null) {
      // USB connection stays Connected through a flash (DAPLink interface chip is
      // untouched) and serial auto-reinitialises, so no explicit reconnect here.
      await this.connection.flash(flashDataSource, { partial: true, progress });
      await this.queryVersion();
    }

    // Route servo writes through this WebUSB connection and mark the shared store connected.
    this.serialDevice.setSpikerbitActive((line: string) => {
      this.connection.serialWrite(`${line}\n`).catch((e) => console.warn("Spiker:bit serialWrite failed", e));
    });
  }

  private handleSerialData = ({ data }: { data: string }) => {
    this.buffer += data;
    const detected = detectSpikerbitVersion(this.buffer);
    if (detected.version != null) {
      this.detectedVersion = detected.version;
      this.buffer = detected.remaining;
    }
    this.buffer = parseArduinoSerialData(this.buffer, this.channels);
  };

  private handleStatus = ({ status }: { status: string }) => {
    if (status === "Disconnected" || status === "NoAuthorizedDevice") {
      this.serialDevice.clearSpikerbit();
    }
  };

  // Sends "?" and waits up to the timeout for a version reply (surfaced via
  // handleSerialData setting detectedVersion). Returns the version or null.
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
