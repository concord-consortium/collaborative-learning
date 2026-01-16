import { NodeChannelInfo } from "src/plugins/dataflow/model/utilities/channel";
import { NodeLiveOutputTypes } from "../../plugins/dataflow/model/utilities/node";

export class SerialDevice {
  localBuffer: string;
  private port: SerialPort | null;
  connectChangeStamp: number | null;
  lastConnectMessage: string | null;
  deviceInfo: SerialPortInfo | null;
  serialNodesCount: number;
  writer: WritableStreamDefaultWriter;
  serialModalShown: boolean | null;
  deviceFamily: string | undefined;

  constructor() {
    this.localBuffer = "";

    navigator.serial?.addEventListener("connect", (e) => {
      this.updateConnectionInfo(e.timeStamp, e.type);
    });

    navigator.serial?.addEventListener("disconnect", (e) => {
      this.updateConnectionInfo(e.timeStamp, e.type);
      this.deviceFamily = undefined;
    });
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

  public determineDeviceFamily(info: SerialPortInfo){
    return info.usbProductId === 516 && info.usbVendorId === 3368
      ? "microbit"
      : "arduino";
  }

  public hasPort(){
    return this.port !== undefined && this.port?.readable;
  }

  public async requestAndSetPort(){
    try {
      this.port = await navigator.serial.requestPort();
      this.deviceInfo = await this.port.getInfo();
      this.deviceFamily = this.determineDeviceFamily(this.deviceInfo);
    }
    catch (error) {
      console.error("error requesting port: ", error);
    }
  }

  public async handleStream(channels: Array<NodeChannelInfo>){
    if (!this.port) return;
    await this.port.open({ baudRate: 9600 }).catch((e: any) => console.error(e));

    // set up writer
    const textEncoder = new TextEncoderStream();
    textEncoder.readable.pipeTo(this.port.writable as any);
    this.writer = textEncoder.writable.getWriter();

    // listen for serial data coming in to computer
    while (this.port.readable) {
      const textDecoder = new TextDecoderStream();
      this.port.readable.pipeTo(textDecoder.writable);
      const streamReader = textDecoder.readable.getReader();
      try {
        while (this.port.readable) {
          const { value, done } = await streamReader.read();
          if (done){
            break;
          }
          if (this.deviceFamily === "arduino"){
            this.handleArduinoStreamObj(value, channels);
          }
          if (this.deviceFamily === "microbit"){
            this.handleMicroBitStreamObj(value, channels);
          }
        }
      }
      catch (error) {
        console.error(error);
      }
      finally {
        streamReader.releaseLock();
      }
    }
  }

  public handleMicroBitStreamObj(value: string, channels: Array<NodeChannelInfo>){
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
      const targetChannel = channels.find((c: NodeChannelInfo) => {
        return c.channelId === targetChannelId;
      });

      if (targetChannel && signalType === "s" ){
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
      }
    } while (match);
  }

  public handleArduinoStreamObj(value: string, channels: Array<NodeChannelInfo>){
    this.localBuffer += value;

    // Match any alphanumeric channel name, not just known ones,
    // so unknown channels are still consumed from the buffer.
    // No 'g' flag since we always search from the start of the modified buffer.
    // Note this pattern doesn't handle NaN or negative numbers.
    // We are seeing at least some NAN values from the Arduino. This currently
    // get ignored correctly, by the corrupted data fallback.
    const pattern = /([a-z0-9]+):([0-9.]+)[\r][\n]/;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const match = pattern.exec(this.localBuffer);

      if (match) {
      const [fullMatch, channel, numStr] = match;
        // console.log("serial match", fullMatch);
      this.localBuffer = this.localBuffer.substring(match.index + fullMatch.length);

      const targetChannel = channels.find((c: NodeChannelInfo) => {
        return c.channelId === channel;
      });

      if (targetChannel){
        targetChannel.value = Math.round(Number(numStr));
      }
      } else {
        // No valid pattern found - check for corrupted data we can discard
        const lineEndIndex = this.localBuffer.indexOf("\r\n");
        if (lineEndIndex !== -1) {
          // console.log("serial miss", this.localBuffer.substring(0, lineEndIndex));

          // Discard everything up to and including the \r\n to recover
          this.localBuffer = this.localBuffer.substring(lineEndIndex + 2);
        } else {
          // No complete line to discard, wait for more data
          break;
        }
      }
    }
  }

  public writeToOutForMicroBitRelayHub(data: number, hubId: string, relayType: string){
    const ri = NodeLiveOutputTypes.filter((ot:any) => ot.name === relayType)[0].relayIndex;
    const controlMessage = `c${hubId}${ri}${data}`;
    this.writer.write(`${controlMessage}\n`);
  }

  public writeToOutForBBGripper(n:number, liveOutputType: string){
    const outputConfig = NodeLiveOutputTypes.find(o => o.name === liveOutputType);
    if (this.hasPort() && outputConfig?.angleBase !== undefined){
      const percent = n / 100;
      const openTo = Math.round(outputConfig.angleBase - (percent * outputConfig.sweep));
      this.writer.write(`${openTo.toString()}\n`);
    }
  }

  public writeToOutForServo(n:number, liveOutputType: string){
    const outputConfig = NodeLiveOutputTypes.find(o => o.name === liveOutputType);
    if (this.hasPort() && outputConfig?.angleOffset !== undefined){
      const scaledAngle = (outputConfig.angleScale * n) + outputConfig.angleOffset;
      const roundedScaled = Math.round(scaledAngle);
      this.writer.write(`${roundedScaled.toString()}\n`);
    }
  }
}
