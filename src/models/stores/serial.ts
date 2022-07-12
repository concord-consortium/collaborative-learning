import { NodeChannelInfo } from "src/plugins/dataflow-tool/model/utilities/node";

export class SerialDevice {
    value: string;
    localBuffer: string;
    private port: SerialPort | null;

    constructor() {
      this.value = "0";
      this.localBuffer = "";
    }

    public hasPort(){
      return this.port !== undefined;
    }

    public async requestAndSetPort(){
      try {
          this.port = await navigator.serial.requestPort();
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

      // keep buffer from growing too large
      if (this.localBuffer.length < 1000 ){
        this.localBuffer += value;
      } else {
        this.localBuffer = "";
      }

      // "emg" or "fsr" + : + some digits + return + newline */
      const pattern = /(emg|fsr)(:)([0-9]+)[\r][\n]/g;
      const match = pattern.exec(this.localBuffer);

      if (match !== null){ // match is e.g. [ "emg:44\r\n", "emg", ":", "44" ]

        // reduce the length of the buffer by the length of the match
        this.localBuffer = this.localBuffer.substring(0, this.localBuffer.length - match[0].length);

        // find the channel with the id that matches this type of data, e.g. emg == emg
        const targetChannel = channels.find((c: NodeChannelInfo) => {
          return c.channelId === match[1];
        });

        // put the value in the channels value
        if (targetChannel){
          targetChannel.value = parseInt(match[3], 10);
        }

      }
    }
}
