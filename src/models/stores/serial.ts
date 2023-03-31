import { NodeChannelInfo } from "src/plugins/dataflow/model/utilities/channel";

interface RelayStatus {
  hubId: string,
  relayIndex: number,
  status: 0 | 1
}
export class SerialDevice {
  localBuffer: string;
  private port: SerialPort | null;
  connectChangeStamp: number | null;
  lastConnectMessage: string | null;
  deviceInfo: SerialPortInfo | null;
  serialNodesCount: number;
  writer: WritableStreamDefaultWriter;
  serialModalShown: boolean | null;
  deviceFamily: string | null;
  remoteRelays: RelayStatus[];

  constructor() {
    this.localBuffer = "";

    navigator.serial?.addEventListener("connect", (e) => {
      this.updateConnectionInfo(e.timeStamp, e.type);
    });

    navigator.serial?.addEventListener("disconnect", (e) => {
      this.updateConnectionInfo(e.timeStamp, e.type);
    });
  }

  public setSerialNodesCount(n: number){
    this.serialNodesCount = n;
  }

  // TODO, this is brittle
  public updateConnectionInfo(timeStamp: number | null, status: string ){
    this.connectChangeStamp = timeStamp;
    this.lastConnectMessage = status;
    localStorage.setItem("last-connect-message", status);
  }

  public determineDeviceFamily(info: SerialPortInfo){
    const isMicrobit = info.usbProductId === 516 && info.usbVendorId === 3368;
    return isMicrobit ? "microbit" : "arduino";
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
    //our port cannot be null if we are to open streams
    if (!this.port){
      return;
    }
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

    const pattern = /([a-z]{1})([a-z]{1})([a-z 0-9]{1})([0-9.]+)\s{0,}[\r][\n]/g;
    let match: RegExpExecArray | null;

    do {
      match = pattern.exec(this.localBuffer);
      if (!match) break;

      // capturing encoded information from regex
      // [0] fullMatch
      // [1] signalType r|s (relay | sensor)
      // [2] microBitId a|b|c|d
      // [3] readingSource t|h|0|1|2 (temp, humidity, relay indices 0,1,2 )
      // [4] reading (number)


      const [fullMatch, signalType, microbitId, readingSource, reading] = match;
      this.localBuffer = this.localBuffer.substring(match.index + fullMatch.length);

      const targetChannelId = `${readingSource}-${microbitId}`;
      const targetChannel = channels.find((c: NodeChannelInfo) => {
        return c.channelId === targetChannelId;
      });

      if (targetChannel && signalType === "s"){
        targetChannel.value = Number(reading);
      }

      if (signalType === "r"){
        console.log("SERIAL: this relay state on to SerialConnection:", `${readingSource}, ${microbitId}, ${reading}`);
        // this is information about the state of a relay
        // update SerialConnection.relays with relays status report
      }
    } while (match);
  }

  public writeToOutForMicroBit(n:any){
    console.log("write output for microbit");
  }

  public handleArduinoStreamObj(value: string, channels: Array<NodeChannelInfo>){
    this.localBuffer += value;

    const pattern = /(emg|fsr):([0-9]+)[\r][\n]/g;
    let match: RegExpExecArray | null;

    do {
      match = pattern.exec(this.localBuffer);
      if (!match) break;

      const [fullMatch, channel, numValue] = match;
      this.localBuffer = this.localBuffer.substring(match.index + fullMatch.length);

      const targetChannel = channels.find((c: NodeChannelInfo) => {
        return c.channelId === channel;
      });

      if (targetChannel){
        targetChannel.value = parseInt(numValue, 10);
      }
    } while (match);
  }

  public writeToOutForArduino(n:number){
    // number visible to user represents "percent closed"
    // so we need to map x percent to an angle in range where
    // 100% (closed) is 120deg, and 0% (open) is 180deg
    const percent = n / 100;
    let openTo = Math.round(180 - (percent * 60));

    if (openTo > 160){
      openTo = 180;
    }

    if (openTo < 130){
      openTo = 120;
    }

    // Arduino readBytesUntil() expects newline as delimiter
    if(this.hasPort()){
      this.writer.write(`${openTo.toString()}\n`);
    }
  }
}

