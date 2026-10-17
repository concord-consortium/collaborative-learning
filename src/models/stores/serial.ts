import { action, makeObservable, observable } from "mobx";
import { NodeChannelInfo } from "src/plugins/dataflow/model/utilities/channel";
import { NodeLiveOutputTypes } from "../../plugins/dataflow/model/utilities/node";
import { parseKeyValueData } from "./serial-protocol";
import { deviceProtocol } from "../../plugins/dataflow/model/utilities/device-capabilities";
import { IDeviceTransport } from "./device-transport";

function log(message: string) {
  // eslint-disable-next-line no-console
  console.log(`[SerialDevice] ${message}`);
}

export class SerialDevice {
  localBuffer: string;
  connectChangeStamp: number | null;
  lastConnectMessage: string | null;
  serialNodesCount: number;
  serialModalShown: boolean | null;
  deviceFamily: string | undefined;
  // The active write transport (Web Serial or WebUSB). writeLine routes here.
  activeTransport: IDeviceTransport | undefined;
  // Functions that each return the channels of one tile. Inbound data is delivered to the
  // channels of every registered source.
  private channelSources = new Set<() => NodeChannelInfo[]>();
  /**
   * True when we think the connected Web Serial board will raise the browser
   * connect/disconnect events. It drives connect-button physical-connection UI. Only ever set
   * by the Web Serial path — stays false for a WebUSB (Spiker:bit) connection.
   */
  raisesWebSerialConnect = false;

  constructor() {
    this.localBuffer = "";
    makeObservable(this, {
      activeTransport: observable.ref,
      deviceFamily: observable,
      setActiveDevice: action,
      clearActiveDevice: action
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

  public setSerialNodesCount(n: number){
    this.serialNodesCount = n;
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
    this.activeTransport = transport;
    this.deviceFamily = deviceFamily;
    transport.onData = (chunk: string) => { if (this.activeTransport === transport) this.receive(chunk); };
    transport.onDisconnect = () => { if (this.activeTransport === transport) this.clearActiveDevice(); };
    this.updateConnectionInfo(Date.now(), "connect");
  }

  public clearActiveDevice(){
    this.activeTransport = undefined;
    this.deviceFamily = undefined;
    this.localBuffer = "";
    // Reset so a prior Web Serial session's value can't stick to a later WebUSB device, which
    // never raises the browser connect/disconnect events this flag gates the connect-button UI on.
    this.raisesWebSerialConnect = false;
    this.updateConnectionInfo(Date.now(), "disconnect");
  }

  // Central inbound router: dispatch a serial chunk to the parser for the connected
  // device's protocol, using the channels of every registered source.
  public receive(chunk: string){
    const protocol = deviceProtocol(this.deviceFamily);
    if (protocol === "keyValue") this.handleKeyValueStreamObj(chunk, this.allChannels);
    if (protocol === "radioHub") this.handleRadioHubStreamObj(chunk, this.allChannels);
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
      this.writeLine(roundedScaled.toString());
    }
  }
}
