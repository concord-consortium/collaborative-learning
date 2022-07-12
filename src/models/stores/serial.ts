import { NodeChannelInfo } from "src/plugins/dataflow-tool/model/utilities/node";

export class SerialDevice {
    value: string;
    localBuffer: string;
    private port: SerialPort | null;

    constructor() {
      this.value = '0';
      this.localBuffer = '';
    }

    public hasPort(){
      return this.port !== undefined;
    }

    public async requestAndSetPort(){
      try {
          await (navigator).serial.requestPort()
          .then((p: SerialPort) => {
            this.port = p;
          });
      }

      catch (error) {
        console.error('error requesting port: ', error);
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
      this.localBuffer+= value;

      /* "emg" or "fsr" followed by any number of digits followed by  carriage return + newline */
      const pattern = /(emg|fsr)([0-9]+)[\r][\n]/g;

      /* an array that includes [{the whole match}, {emg|fsr}, {the numeric value}] */
      const match = pattern.exec(this.localBuffer);


      if (match !== null){

        const takeAway = match[0].length + 3; // its either 'emg' or 'msr'
        this.localBuffer = this.localBuffer.substring(0, this.localBuffer.length - takeAway);
        const nice = match[1] + match[2];

        const targetChannel = channels.find((c: NodeChannelInfo) => {
          return c.channelId === nice.substring(0,3);
        });

        const justDigits = /[0-9]+/;
        const foundDigits = justDigits.exec(nice);

        if (foundDigits && targetChannel){
          targetChannel.value = parseInt(foundDigits[0], 10);
        }

      }
    }
}
