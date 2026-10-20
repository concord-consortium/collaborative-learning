import { makeAutoObservable, reaction, runInAction } from "mobx";
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
  // True once any tile's "needs a device" tutorial dialog has been acknowledged. In memory only,
  // so the dialog shows again after a page reload.
  connectTutorialDismissed = false;

  private serialDevice: SerialDevice;
  private deps: IDeviceConnectionDeps;
  private lastWebSerialTransport: WebSerialTransport | undefined;
  // The Spiker:bit from the last Spiker:bit Connect. Its library connection remembers the
  // board, so Reconnect reopens it without the chooser. Connect replaces it, which shows
  // the chooser.
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
    // A connection made any way, from any tile, ends the tutorial, so a later disconnect can't
    // bring it back.
    reaction(() => this.isConnected, connected => {
      if (connected) this.dismissConnectTutorial();
    }, { fireImmediately: true });
  }

  get isConnected() {
    return this.serialDevice.isConnected();
  }

  get connectedLabel(): string | undefined {
    return this.isConnected && this.lastChoice ? kDeviceChoiceLabels[this.lastChoice] : undefined;
  }

  dismissConnectTutorial() {
    this.connectTutorialDismissed = true;
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
      return choice === "spikerbit" ? this.reconnectSpikerbit() : this.reconnectWebSerial();
    });
  }

  async disconnect(): Promise<void> {
    const transport = this.serialDevice.activeTransport;
    try {
      await transport?.close();
    } catch (e) {
      console.error("Device disconnect failed", e);
    }
    // Another connect may have replaced the device while the close was pending.
    if (this.serialDevice.activeTransport === transport) this.serialDevice.clearActiveDevice();
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
    transport.startReading();
    return "connected";
  }

  private async reconnectWebSerial(): Promise<ConnectResult> {
    const lastPort = this.lastWebSerialTransport?.lastPort ?? null;

    if (lastPort) {
      const transport = this.deps.createWebSerialTransport();
      if (await transport.open(lastPort) === "opened") return this.finishWebSerial(transport);
      // Chrome gives a replugged board a new port object, so a missing lastPort means the
      // board was unplugged and maybe replugged. USB ids only identify the board model, so
      // a match is trusted only when it is the single one. If lastPort is still granted,
      // the original board is still attached and another port could be a different board.
      const matching = await this.findOnlyGrantedPortMatching(lastPort);
      if (matching) {
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

  private async findOnlyGrantedPortMatching(lastPort: SerialPort): Promise<SerialPort | undefined> {
    const { usbVendorId, usbProductId } = lastPort.getInfo();
    const granted = await this.deps.getGrantedSerialPorts();
    if (granted.includes(lastPort)) return undefined;
    const matches = granted.filter(port => {
      const info = port.getInfo();
      return info.usbVendorId === usbVendorId && info.usbProductId === usbProductId;
    });
    return matches.length === 1 ? matches[0] : undefined;
  }

  // A fresh device has a fresh library connection, which shows the chooser.
  private async connectSpikerbit(): Promise<ConnectResult> {
    await this.disposeSpikerbit();
    const device = this.deps.createSpikerbitDevice(this.serialDevice);
    this.spikerbitDevice = device;
    return this.streamSpikerbit(device);
  }

  // Reopens the known board without the chooser. If that fails, for example because the
  // board was unplugged, falls back to a fresh device and the chooser.
  private async reconnectSpikerbit(): Promise<ConnectResult> {
    const known = this.spikerbitDevice;
    if (known) {
      const result = await this.streamSpikerbit(known);
      if (result !== "failed") return result;
    }
    return this.connectSpikerbit();
  }

  private async streamSpikerbit(device: SpikerbitDevice): Promise<ConnectResult> {
    try {
      await device.connectAndStream(this.deps.getSpikerbitFlashDataSource());
      return "connected";
    } catch (e) {
      if (isNoDeviceSelected(e)) return "canceled";
      console.error("Spiker:bit connection failed", e);
      await this.disposeSpikerbit();
      return "failed";
    }
  }

  private async disposeSpikerbit() {
    const device = this.spikerbitDevice;
    this.spikerbitDevice = undefined;
    try {
      await device?.disconnect();
    } catch (e) {
      console.error("Spiker:bit disconnect failed", e);
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
