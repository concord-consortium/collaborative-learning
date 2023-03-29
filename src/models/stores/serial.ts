import { NodeChannelInfo } from "src/plugins/dataflow/model/utilities/channel";

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

  // TODO, this is brittle and should be replaced
  public updateConnectionInfo(timeStamp: number | null, status: string ){
    this.connectChangeStamp = timeStamp;
    this.lastConnectMessage = status;
    localStorage.setItem("last-connect-message", status);
  }

  public hasPort(){
    return this.port !== undefined && this.port?.readable;
  }

  public async requestAndSetPort(){

    // see note on filters in src/plugins/dataflow-tool/serial.md
    // const filters = [
    //   { usbVendorId: 0x2341, usbProductId: 0x0043 },
    //   { usbVendorId: 0x2341, usbProductId: 0x0001 }
    // ];

    try {
      this.port = await navigator.serial.requestPort();
      this.deviceInfo = await this.port.getInfo();
      const isMicrobit = this.deviceInfo.usbProductId === 516 && this.deviceInfo.usbVendorId === 3368;
      this.deviceFamily = isMicrobit ? "microbit" : "arduino";
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

    // listen for serial data coming up from Arduino
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
    console.log("handle stream bound for microbit");
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
