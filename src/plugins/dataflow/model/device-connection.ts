// This lives in the DataFlow plugin, not src/models/stores, because it imports the Spiker:bit
// firmware hex, which has to stay in the DataFlow chunk.
import { makeAutoObservable, observable, reaction, runInAction } from "mobx";
import { SerialDevice } from "../../../models/stores/serial";
import { CcDeviceSession, IdentifyResult } from "../../../models/stores/cc-device-session";
import { SpikerbitDevice } from "../../../models/stores/spikerbit-device";
import {
  createSpikerbitConnection, makeSpikerbitFlashDataSource
} from "../../../models/stores/spikerbit-connection";
import { WebSerialTransport } from "../../../models/stores/web-serial-transport";
import spikerbitHex from "../firmware/spikerbit-clue.hex";

// The device choices, in the order the UI lists them. The type is derived from this list, so a
// new choice can't be left out of it.
export const kDeviceChoiceOrder = ["arduino", "microbitHub", "spikerbit"] as const;

export type DeviceChoice = typeof kDeviceChoiceOrder[number];

export const kDeviceChoiceLabels: Record<DeviceChoice, string> = {
  arduino: "Arduino",
  microbitHub: "micro:bit (radio hub)",
  spikerbit: "Spiker:bit"
};

// How long disconnect waits for the board to take the `close` write before closing the transport
// anyway. A write to a stalled port may never settle.
export const kEndSessionTimeoutMs = 500;

// "inUse": another tab or app has claimed the board.
// How long the answer to "Is it alive?" stays before the check is cleared.
export const kIdentifyResultMs = 3000;

// An "Is it alive?" check: waiting for the board, or its answer.
export type IdentifyCheckState = "checking" | IdentifyResult;

interface IIdentifyCheck {
  session: CcDeviceSession;
  state: IdentifyCheckState;
}

export type ConnectResult = "connected" | "canceled" | "failed" | "inUse";

// What dismissed the connect tutorial: OK in one tile, or any connection.
export type ConnectTutorialDismissal = { by: "ok", tileId: string } | { by: "connection" };

export interface IDeviceConnectionDeps {
  createWebSerialTransport(): WebSerialTransport;
  createSpikerbitDevice(serialDevice: SerialDevice): SpikerbitDevice;
  getSpikerbitFlashDataSource(): unknown;
}

const kNoDeviceSelected = "no-device-selected";

const kDeviceInUse = "device-in-use";

function errorCode(error: unknown) {
  return (error as { code?: string } | null)?.code;
}

/**
 * The one device connection shared by every DataFlow tile. It owns connect, reconnect and
 * disconnect. Tiles start them through the tile device actions in `device-actions.ts`.
 */
export class DeviceConnection {
  // The device choice the user last connected with. Reconnect repeats it, and the log events name
  // the device by it.
  lastChoice: DeviceChoice | undefined = undefined;
  // Set while a connect or reconnect attempt is in progress.
  busyChoice: DeviceChoice | undefined = undefined;
  // What first dismissed the connect tutorial, which then stays dismissed on every tile. In memory
  // only, so it can show again after a page reload.
  connectTutorialDismissal: ConnectTutorialDismissal | undefined = undefined;

  private serialDevice: SerialDevice;
  private deps: IDeviceConnectionDeps;
  private lastWebSerialTransport: WebSerialTransport | undefined;
  // The Spiker:bit from the last Spiker:bit attempt, cleared when an attempt fails. Its library
  // connection remembers the board, so Reconnect reopens it without the chooser. Connect
  // replaces it with a fresh one, which shows the chooser.
  private spikerbitDevice: SpikerbitDevice | undefined;
  // The latest "Is it alive?" check, with the session it asked. It counts only while that session is
  // the active one, so a reconnect or a new device never shows an earlier board's answer.
  private identifyCheck: IIdentifyCheck | undefined = undefined;

  constructor(serialDevice: SerialDevice, deps?: Partial<IDeviceConnectionDeps>) {
    this.serialDevice = serialDevice;
    this.deps = {
      createWebSerialTransport: () => new WebSerialTransport(),
      createSpikerbitDevice: (device) => new SpikerbitDevice(device, createSpikerbitConnection()),
      getSpikerbitFlashDataSource: () => makeSpikerbitFlashDataSource(spikerbitHex),
      ...deps
    };
    makeAutoObservable<DeviceConnection,
        "serialDevice" | "deps" | "lastWebSerialTransport" | "spikerbitDevice" | "identifyCheck">(
      this,
      {
        serialDevice: false,
        deps: false,
        lastWebSerialTransport: false,
        spikerbitDevice: false,
        identifyCheck: observable.ref,
        connect: false,
        reconnect: false,
        disconnect: false,
        identify: false
      }
    );
    // A connection made any way, from any tile, ends the connect tutorial, so a later disconnect
    // can't bring it back. fireImmediately covers a connection that exists before this is created.
    reaction(() => this.isConnected, connected => {
      if (connected) this.dismissConnectTutorial({ by: "connection" });
    }, { fireImmediately: true });
  }

  get isConnected() {
    return this.serialDevice.isConnected();
  }

  get connectedLabel(): string | undefined {
    return this.isConnected && this.lastChoice ? kDeviceChoiceLabels[this.lastChoice] : undefined;
  }

  // The label of the device last chosen, whether or not it's still connected.
  get label(): string | undefined {
    return this.lastChoice ? kDeviceChoiceLabels[this.lastChoice] : undefined;
  }

  get notResponding() {
    return this.isConnected && !!this.serialDevice.ccDeviceSession?.notResponding;
  }

  // Only a device speaking the CC Device Protocol can be asked to identify itself.
  get canIdentify() {
    return this.isConnected && !!this.serialDevice.ccDeviceSession;
  }

  // The "Is it alive?" check for the connected device, as every tile's pane shows it.
  get check(): IdentifyCheckState | undefined {
    const check = this.identifyCheck;
    return this.isConnected && check?.session === this.serialDevice.ccDeviceSession ? check?.state : undefined;
  }

  // Asks the device to identify itself, and keeps `check` up to date: checking, then the answer for
  // kIdentifyResultMs.
  async identify(): Promise<IdentifyResult> {
    const session = this.serialDevice.ccDeviceSession;
    if (!session) return "noAnswer";
    const checking: IIdentifyCheck = { session, state: "checking" };
    runInAction(() => { this.identifyCheck = checking; });
    const result = await session.identify();
    // A newer check replaces this one, and its answer stands.
    if (this.identifyCheck !== checking) return result;
    const answered: IIdentifyCheck = { session, state: result };
    runInAction(() => { this.identifyCheck = answered; });
    // A newer check by then keeps its own state.
    setTimeout(() => {
      runInAction(() => { if (this.identifyCheck === answered) this.identifyCheck = undefined; });
    }, kIdentifyResultMs);
    return result;
  }

  // Why the last device went away without the user asking, until the next connect attempt.
  get lossMessage(): string | undefined {
    const loss = this.serialDevice.lastLoss;
    if (this.isConnected || !loss) return undefined;
    const label = this.label ?? "device";
    return loss.reason === "unplugged"
      ? `The ${label} was unplugged.`
      : `The connection to the ${label} was lost.`;
  }

  // When that loss happened. A new value means a new loss; an unplug confirming a loss keeps it.
  get lossAt(): number | undefined {
    return this.serialDevice.lastLoss?.at;
  }

  get connectTutorialDismissed() {
    return !!this.connectTutorialDismissal;
  }

  // Keeps the first dismissal, so the tiles that log it agree on what dismissed it.
  dismissConnectTutorial(dismissal: ConnectTutorialDismissal) {
    this.connectTutorialDismissal ??= dismissal;
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
    // The close asked for here can be reported back as a loss; it isn't one.
    if (transport) transport.onDisconnect = undefined;
    // Tell the board the session is over before its transport closes.
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timedOut = new Promise<"timeout">(resolve => {
        timer = setTimeout(() => resolve("timeout"), kEndSessionTimeoutMs);
      });
      const result = await Promise.race([this.serialDevice.endSession(), timedOut]);
      if (result === "timeout") console.error("Device session end timed out; closing the transport anyway");
    } catch (e) {
      console.error("Device session end failed", e);
    } finally {
      clearTimeout(timer);
    }
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
    this.serialDevice.clearLastLoss();
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
    }

    const chooserTransport = this.deps.createWebSerialTransport();
    const result = await chooserTransport.open();
    return result === "opened" ? this.finishWebSerial(chooserTransport) : result;
  }

  private finishWebSerial(transport: WebSerialTransport) {
    this.lastWebSerialTransport = transport;
    return this.activateWebSerial(transport);
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
      if (errorCode(e) === kNoDeviceSelected) return "canceled";
      console.error("Spiker:bit connection failed", e);
      await this.disposeSpikerbit();
      return errorCode(e) === kDeviceInUse ? "inUse" : "failed";
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
    device?.dispose();
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
