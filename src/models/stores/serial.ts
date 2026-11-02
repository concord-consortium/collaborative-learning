import { action, makeObservable, observable } from "mobx";
import { NodeChannelInfo } from "src/plugins/dataflow/model/utilities/channel";
import { NodeLiveOutputTypes } from "../../plugins/dataflow/model/utilities/node";
import { parseKeyValueData } from "./serial-protocol";
import { deviceProtocol } from "../../plugins/dataflow/model/utilities/device-capabilities";
import { DeviceLoss, IDeviceTransport } from "./device-transport";
import { CcDeviceSession } from "./cc-device-session";

// The most recent loss of a device the user didn't ask for, and when.
export interface IDeviceLossRecord {
  reason: DeviceLoss;
  transport: IDeviceTransport;
  at: number;
}

function log(message: string) {
  // eslint-disable-next-line no-console
  console.log(`[SerialDevice] ${message}`);
}

export class SerialDevice {
  localBuffer: string;
  connectChangeStamp: number | null;
  lastConnectMessage: string | null;
  deviceFamily: string | undefined;
  // The active write transport (Web Serial or WebUSB). writeLine routes here.
  activeTransport: IDeviceTransport | undefined;
  // The CC Device Protocol session of the active device, when it speaks that protocol.
  ccDeviceSession: CcDeviceSession | undefined;
  // Cleared by `setActiveDevice` and `clearLastLoss`.
  lastLoss: IDeviceLossRecord | undefined;
  // True once the active transport has delivered any data. Reset by `setActiveDevice` and
  // `clearActiveDevice`.
  dataReceived = false;
  // Functions that each return the channels of one tile. Inbound data is delivered to the
  // channels of every registered source.
  private channelSources = new Set<() => NodeChannelInfo[]>();
  /**
   * True when we think the connected Web Serial board will raise the browser `connect` event.
   * It drives connect-button physical-connection UI. Only ever set
   * by the Web Serial path — stays false for a WebUSB (Spiker:bit) connection.
   */
  raisesWebSerialConnect = false;

  constructor() {
    this.localBuffer = "";
    makeObservable(this, {
      activeTransport: observable.ref,
      ccDeviceSession: observable.ref,
      lastLoss: observable.ref,
      deviceFamily: observable,
      dataReceived: observable,
      setActiveDevice: action,
      clearActiveDevice: action,
      recordUnplug: action,
      recordLoss: action,
      clearLastLoss: action,
      markDataReceived: action
    });
  }

  // Registers a tile's channels to receive inbound data. Returns a disposer.
  public registerChannelSource(getChannels: () => NodeChannelInfo[]): () => void {
    this.channelSources.add(getChannels);
    return () => { this.channelSources.delete(getChannels); };
  }

  private get allChannels(): NodeChannelInfo[] {
    return Array.from(this.channelSources).flatMap(getChannels => getChannels());
  }

  // TODO, revise this so it is more clear how its used
  public updateConnectionInfo(timeStamp: number | null, status: string ){
    this.connectChangeStamp = timeStamp;
    this.lastConnectMessage = status;
    localStorage.setItem("last-connect-message", status);
  }

  public setRaisesWebSerialConnect(raises: boolean){
    this.raisesWebSerialConnect = raises;
  }

  public isConnected(){
    return this.activeTransport != null;
  }

  // Called by a transport (Web Serial or WebUSB) to become the active write path, receive
  // inbound data centrally, and mark the store connected.
  public setActiveDevice(deviceFamily: string, transport: IDeviceTransport){
    // Start each session with an empty parse buffer so a partial line left by a prior
    // connection can't combine with new data into a spurious message.
    this.localBuffer = "";
    this.ccDeviceSession?.stop();
    this.ccDeviceSession = undefined;
    this.lastLoss = undefined;
    this.dataReceived = false;
    this.activeTransport = transport;
    this.deviceFamily = deviceFamily;
    transport.onData = (chunk: string) => {
      if (this.activeTransport !== transport) return;
      this.markDataReceived();
      this.receive(chunk);
    };
    transport.onDisconnect = (loss) => {
      if (loss === "unplugged") this.recordUnplug(transport);
      else if (this.activeTransport === transport) this.clearActiveDevice(loss);
    };
    if (deviceProtocol(deviceFamily) === "ccDevice") {
      // Assigned before start() so a reply that arrives during the first write is routed.
      const session = new CcDeviceSession(line => transport.write(line));
      this.ccDeviceSession = session;
      session.start();
    }
    this.updateConnectionInfo(Date.now(), "connect");
  }

  // Ends the CC Device Protocol session: writes `close` when a session is open or an open is
  // still pending. Resolves at once when there is no session.
  public async endSession(): Promise<void> {
    await this.ccDeviceSession?.close();
  }

  // With a `loss`, records that the active device was lost without the user asking.
  public clearActiveDevice(loss?: DeviceLoss){
    if (loss && this.activeTransport) {
      this.lastLoss = { reason: loss, transport: this.activeTransport, at: Date.now() };
    }
    this.ccDeviceSession?.stop();
    this.ccDeviceSession = undefined;
    this.activeTransport = undefined;
    this.deviceFamily = undefined;
    this.dataReceived = false;
    this.localBuffer = "";
    // Reset so a prior Web Serial session's value can't stick to a later WebUSB device, which
    // never raises the browser connect/disconnect events this flag gates the connect-button UI on.
    this.raisesWebSerialConnect = false;
    this.updateConnectionInfo(Date.now(), "disconnect");
  }

  // The browser reported `transport`'s device removed. Clears it if it's still active. If another
  // path already cleared it as lost (a failed write, or the read loop giving up, can come first),
  // the loss becomes an unplug, keeping its time.
  public recordUnplug(transport: IDeviceTransport){
    if (this.activeTransport === transport) {
      this.clearActiveDevice("unplugged");
    } else if (this.lastLoss?.transport === transport && this.lastLoss.reason === "lost") {
      this.lastLoss = { ...this.lastLoss, reason: "unplugged" };
    }
  }

  // Records the loss of a device that was open but never became active, such as a Spiker:bit
  // unplugged during its firmware update.
  public recordLoss(transport: IDeviceTransport, reason: DeviceLoss){
    this.lastLoss = { reason, transport, at: Date.now() };
  }

  public clearLastLoss(){
    this.lastLoss = undefined;
  }

  public markDataReceived(){
    this.dataReceived = true;
  }

  // Central inbound router: dispatch a serial chunk to the parser for the connected
  // device's protocol, using the channels of every registered source.
  public receive(chunk: string){
    const protocol = deviceProtocol(this.deviceFamily);
    if (protocol === "keyValue") this.handleKeyValueStreamObj(chunk, this.allChannels);
    if (protocol === "radioHub") this.handleRadioHubStreamObj(chunk, this.allChannels);
    if (protocol === "ccDevice") this.ccDeviceSession?.receive(chunk, this.allChannels);
  }

  public handleRadioHubStreamObj(value: string, channels: Array<NodeChannelInfo>){
    this.localBuffer += value;

    // [sc]   signal or control
    // [abcd] which micro:bit
    // [rth]  relay, temp, humidity
    const pattern = /([sc]{1})([abcd]{1})([rth]{1})([0-9.]+)\s{0,}[\r][\n]/g;
    let match: RegExpExecArray | null;

    do {
      match = pattern.exec(this.localBuffer);
      if (!match) break;

      const [fullMatch, signalType, microbitId, element, reading] = match;
      this.localBuffer = this.localBuffer.substring(match.index + fullMatch.length);

      const targetChannelId = `${element}-${microbitId}`;
      const targetChannels = channels.filter((c: NodeChannelInfo) => c.channelId === targetChannelId);

      if (signalType === "s" ){
        targetChannels.forEach(targetChannel => {
          if (["h", "t"].includes(element)){
            // handle message from a humidity or temperature sensor
            if (isFinite(Number(reading))){
              targetChannel.value = Number(reading);
            }
            targetChannel.lastMessageReceivedAt = Date.now();
          }
          if (["r"].includes(element)){
            // handle message about relays state
            targetChannel.relaysState = reading.split('').map(s => Number(s));
            targetChannel.lastMessageReceivedAt = Date.now();
          }
        });
      }
    } while (match);
  }

  public handleKeyValueStreamObj(value: string, channels: Array<NodeChannelInfo>){
    this.localBuffer = parseKeyValueData(this.localBuffer + value, channels);
  }

  public writeLine(line: string){
    if (this.activeTransport){
      this.activeTransport.write(line);
    } else {
      log("Port closed, skipping write");
    }
  }

  public writeToOutForMicroBitRelayHub(data: number, hubId: string, relayType: string){
    const ri = NodeLiveOutputTypes.filter((ot:any) => ot.name === relayType)[0].relayIndex;
    const controlMessage = `c${hubId}${ri}${data}`;
    this.writeLine(controlMessage);
  }

  public writeToOutForBBGripper(n:number, liveOutputType: string){
    const outputConfig = NodeLiveOutputTypes.find(o => o.name === liveOutputType);
    if (this.isConnected() && outputConfig?.angleBase !== undefined){
      const percent = n / 100;
      const openTo = Math.round(outputConfig.angleBase - (percent * outputConfig.sweep));
      this.writeLine(openTo.toString());
    }
  }

  public writeToOutForServo(n:number, liveOutputType: string){
    const outputConfig = NodeLiveOutputTypes.find(o => o.name === liveOutputType);
    if (this.isConnected() && outputConfig?.angleOffset !== undefined){
      const scaledAngle = (outputConfig.angleScale * n) + outputConfig.angleOffset;
      const roundedScaled = Math.round(scaledAngle);
      if (deviceProtocol(this.deviceFamily) === "ccDevice") {
        this.ccDeviceSession?.sendOutput("servo", roundedScaled);
      } else {
        this.writeLine(roundedScaled.toString());
      }
    }
  }
}
