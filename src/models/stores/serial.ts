import { NodeChannelInfo } from "src/plugins/dataflow-tool/model/utilities/node";

export class SerialDevice {
  value: string;
  outValue: number;
  localBuffer: string;
  private port: SerialPort | null;
  connectChangeStamp: number | null;
  lastConnectMessage: string | null;
  deviceInfo: SerialPortInfo | null;
  serialNodesCount: number;
  writer: any;
  //localPorts: any;

  constructor() {
    this.value = "0";
    this.outValue = 0;
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

  public updateConnectionInfo(timeStamp: number | null, status: string ){
    this.connectChangeStamp = timeStamp;
    this.lastConnectMessage = status;
    localStorage.setItem("last-connect-message", status);
    //  TODO - may need this information for a modal
    //  if connectChangeStamp is defined, then
    //  lastConnectMessage represents physical state
  }


  public hasPort(){
    const portHere = this.port !== undefined;
    const readablePort = this.port?.readable;
    return portHere && readablePort;
  }

  public async requestAndSetPort(){

    // arduino uno
    const filters = [
      { usbVendorId: 0x2341, usbProductId: 0x0043 },
      { usbVendorId: 0x2341, usbProductId: 0x0001 }
    ];

    try {
        this.port = await navigator.serial.requestPort({ filters });
        this.deviceInfo = await this.port.getInfo();
    }
    catch (error) {
      console.error("error requesting port: ", error);
    }
  }

  public async handleStream(channels: Array<NodeChannelInfo>){
    // open port
    await this.port?.open({ baudRate: 9600 }).catch((e: any) => console.error(e));

    // get set up to send data down to Arduino when called for
    const textEncoder = new TextEncoderStream();
    textEncoder.readable.pipeTo(this.port?.writable as any);
    this.writer = textEncoder.writable.getWriter();

    // listen for serial data coming up from Arduino
    while (this.port?.readable) {
      const textDecoder = new TextDecoderStream();
      this.port.readable.pipeTo(textDecoder.writable);
      const streamReader = textDecoder.readable.getReader();
      try {
        while (this.port.readable) {
          const { value, done } = await streamReader.read();
          if (done){
            break;
          }
          this.handleStreamObj(value, channels);
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

  public handleStreamObj(value: string, channels: Array<NodeChannelInfo>){
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

  public writeToOut(n:number){
    console.log(this.writer);
    console.log("got an int, 0 - 100: ", n);
    //min angle: 120 max angle: 180, range of 60
    const percent = n / 100;
    let openTo = 120 + (percent * 60);
    // at current senitivity "no flex" hovers in the 130s
    if (openTo < 140 ){
      openTo = 120;
    }
    if(this.hasPort()){
      console.log("ATTEMPT TO WRITE: ", openTo)
      this.writer.write(openTo);
    }
  }
}
