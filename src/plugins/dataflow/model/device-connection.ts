import { makeAutoObservable, runInAction } from "mobx";
import { SerialDevice } from "../../../models/stores/serial";
import { SpikerbitDevice } from "../../../models/stores/spikerbit-device";
import {
  createSpikerbitConnection, makeSpikerbitFlashDataSource
} from "../../../models/stores/spikerbit-connection";
import { getGrantedSerialPorts, WebSerialTransport } from "../../../models/stores/web-serial-transport";
import spikerbitHex from "../firmware/spikerbit-clue.hex";

export type DeviceChoice = "arduino" | "microbitHub" | "spikerbit";

export const kDeviceChoiceOrder: DeviceChoice[] = ["arduino", "microbitHub", "spikerbit"];

export const kDeviceChoiceLabels: Record<DeviceChoice, string> = {
  arduino: "Arduino",
  microbitHub: "micro:bit (radio hub)",
  spikerbit: "Spiker:bit"
};

export type ConnectResult = "connected" | "canceled" | "failed";

export interface IDeviceConnectionDeps {
  createWebSerialTransport(): WebSerialTransport;
  getGrantedSerialPorts(): Promise<SerialPort[]>;
  createSpikerbitDevice(serialDevice: SerialDevice): SpikerbitDevice;
  getSpikerbitFlashDataSource(): unknown;
}

const kNoDeviceSelected = "no-device-selected";

function isNoDeviceSelected(error: unknown) {
  return (error as { code?: string } | null)?.code === kNoDeviceSelected;
}

/**
 * The one device connection shared by every DataFlow tile. It owns connect, reconnect and
 * disconnect; the tiles only read its state.
 */
export class DeviceConnection {
  // The menu choice the user last connected with; it names the device in the UI.
  lastChoice: DeviceChoice | undefined = undefined;
  // Set while a connect or reconnect attempt is in progress.
  busyChoice: DeviceChoice | undefined = undefined;

  private serialDevice: SerialDevice;
  private deps: IDeviceConnectionDeps;
  private lastWebSerialTransport: WebSerialTransport | undefined;
  // Kept for the life of this object so Reconnect reuses the library's known device.
  private spikerbitDevice: SpikerbitDevice | undefined;

  constructor(serialDevice: SerialDevice, deps?: Partial<IDeviceConnectionDeps>) {
    this.serialDevice = serialDevice;
    this.deps = {
      createWebSerialTransport: () => new WebSerialTransport(),
      getGrantedSerialPorts,
      createSpikerbitDevice: (device) => new SpikerbitDevice(device, createSpikerbitConnection()),
      getSpikerbitFlashDataSource: () => makeSpikerbitFlashDataSource(spikerbitHex),
      ...deps
    };
    makeAutoObservable<DeviceConnection, "serialDevice" | "deps" | "lastWebSerialTransport" | "spikerbitDevice">(
      this,
      {
        serialDevice: false,
        deps: false,
        lastWebSerialTransport: false,
        spikerbitDevice: false,
        connect: false,
        reconnect: false,
        disconnect: false
      }
    );
  }

  get isConnected() {
    return this.serialDevice.isConnected();
  }

  get connectedLabel(): string | undefined {
    return this.isConnected && this.lastChoice ? kDeviceChoiceLabels[this.lastChoice] : undefined;
  }

  async connect(choice: DeviceChoice): Promise<ConnectResult> {
    return this.attempt(choice, async () => {
      if (this.isConnected) await this.disconnect();
      return choice === "spikerbit" ? this.connectSpikerbit() : this.connectWebSerial();
    });
  }

  async reconnect(): Promise<ConnectResult> {
    const choice = this.lastChoice;
    if (!choice) return "canceled";
    return this.attempt(choice, async () => {
      if (this.isConnected) await this.disconnect();
      return choice === "spikerbit" ? this.connectSpikerbit() : this.reconnectWebSerial();
    });
  }

  async disconnect(): Promise<void> {
    try {
      await this.serialDevice.activeTransport?.close();
    } catch (e) {
      console.error("Device disconnect failed", e);
    }
    this.serialDevice.clearActiveDevice();
  }

  private async attempt(choice: DeviceChoice, run: () => Promise<ConnectResult>): Promise<ConnectResult> {
    if (this.busyChoice) return "canceled";
    runInAction(() => { this.busyChoice = choice; });
    try {
      const result = await run();
      if (result === "connected") runInAction(() => { this.lastChoice = choice; });
      return result;
    } catch (e) {
      console.error("Device connection failed", e);
      return "failed";
    } finally {
      runInAction(() => { this.busyChoice = undefined; });
    }
  }

  private async connectWebSerial(): Promise<ConnectResult> {
    return this.openWebSerial(this.deps.createWebSerialTransport());
  }

  private async openWebSerial(transport: WebSerialTransport, port?: SerialPort): Promise<ConnectResult> {
    const opened = await transport.open(port);
    if (opened !== "opened") return opened;
    this.lastWebSerialTransport = transport;
    return this.activateWebSerial(transport);
  }

  private async activateWebSerial(transport: WebSerialTransport): Promise<ConnectResult> {
    const deviceFamily = transport.deviceFamily;
    if (!deviceFamily) {
      await transport.close();
      return "failed";
    }
    this.serialDevice.setActiveDevice(deviceFamily, transport);
    this.serialDevice.setRaisesWebSerialConnect(transport.raisesWebSerialConnect);
    transport.startReading();
    return "connected";
  }

  private async reconnectWebSerial(): Promise<ConnectResult> {
    const lastPort = this.lastWebSerialTransport?.lastPort ?? null;

    if (lastPort) {
      const transport = this.deps.createWebSerialTransport();
      if (await transport.open(lastPort) === "opened") return this.finishWebSerial(transport);
      const matching = await this.findGrantedPortMatching(lastPort);
      if (matching && matching !== lastPort) {
        const matchTransport = this.deps.createWebSerialTransport();
        if (await matchTransport.open(matching) === "opened") return this.finishWebSerial(matchTransport);
      }
    }

    const chooserTransport = this.deps.createWebSerialTransport();
    const result = await chooserTransport.open();
    return result === "opened" ? this.finishWebSerial(chooserTransport) : result;
  }

  private finishWebSerial(transport: WebSerialTransport) {
    this.lastWebSerialTransport = transport;
    return this.activateWebSerial(transport);
  }

  private async findGrantedPortMatching(lastPort: SerialPort): Promise<SerialPort | undefined> {
    const { usbVendorId, usbProductId } = lastPort.getInfo();
    const granted = await this.deps.getGrantedSerialPorts();
    return granted.find(port => {
      const info = port.getInfo();
      return info.usbVendorId === usbVendorId && info.usbProductId === usbProductId;
    });
  }

  private async connectSpikerbit(): Promise<ConnectResult> {
    try {
      this.spikerbitDevice ??= this.deps.createSpikerbitDevice(this.serialDevice);
      await this.spikerbitDevice.connectAndStream(this.deps.getSpikerbitFlashDataSource());
      return "connected";
    } catch (e) {
      if (isNoDeviceSelected(e)) return "canceled";
      console.error("Spiker:bit connection failed", e);
      return "failed";
    }
  }
}

const connections = new WeakMap<SerialDevice, DeviceConnection>();

export function getDeviceConnection(serialDevice: SerialDevice): DeviceConnection {
  let connection = connections.get(serialDevice);
  if (!connection) {
    connection = new DeviceConnection(serialDevice);
    connections.set(serialDevice, connection);
  }
  return connection;
}
