import { NodeChannelInfo } from "src/plugins/dataflow-tool/model/utilities/node";

export class SerialDevice {
    value: string;
    localBuffer: string;
    private port: SerialPort | null;
    connectChangeStamp: Number | null;
    lastConnectMessage: string | null;
    deviceInfo: SerialPortInfo | null;
    serialNodesCount: number;

    constructor() {
      this.value = "0";
      this.localBuffer = "";

      navigator.serial.addEventListener('connect', (e) => {
        this.updateConnectionInfo(e.timeStamp, e.type);
      });

      navigator.serial.addEventListener('disconnect', (e) => {
        this.updateConnectionInfo(e.timeStamp, e.type);
      });
    }

    public setSerialNodesCount(n: number){
      this.serialNodesCount = n;
    }

    public updateConnectionInfo(timeStamp: Number | null, status: string ){
      this.connectChangeStamp = timeStamp;
      this.lastConnectMessage = status;
      localStorage.setItem('last-connect-message', status)
      if (this.connectChangeStamp !== undefined){
        if (this.lastConnectMessage == "disconnect"){
          alert('Device has been physically disconnected.')
        }
        if (this.lastConnectMessage == "connect"){
          alert("Device has been plugged in.  Click the yellow button to establish connection.")
        }
      }
    }

    public hasPort(){
      return this.port !== undefined;
    }

    public async requestAndSetPort(){
      try {
          this.port = await navigator.serial.requestPort();
          this.deviceInfo = await this.port.getInfo();
      }

      catch (error) {
        console.error("error requesting port: ", error);
      }
    }

    public async handleStream(channels: Array<NodeChannelInfo>){
      await this.port?.open({ baudRate: 9600 }).catch((e: any) => console.log(e));

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
      if (this.localBuffer.length > 7 ){
        this.localBuffer = this.localBuffer.substring(this.localBuffer.length - 7);
      }
      this.localBuffer+= value;

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
}
