import { NodeChannelInfo } from "src/plugins/dataflow-tool/model/utilities/node"

export class SerialDevice {
    value: string
    localBuffer: string
    private port: any // SERIAL TODO: types SerialPort | null 

    constructor() {
      this.value = '0'
      this.localBuffer = ''
    }

    public hasPort(){
      return this.port !== undefined ? true : false
    }
  
    public async requestAndSetPort(){
      try {
          await (navigator as any).serial.requestPort()
          .then((p: any) => {
            this.port = p
            console.log('we have a port: ', this.port)
          })
      }

      catch (error) {
          console.log('error requesting port: ', error)
      }
    }

    /* in the future, this could discover what channels should exist
      based on keys coming up from arduino
      however, since immediate-term usecases are limited to specific sensors
      on specific pins, for now we are going to hardcode them 
      to match on the arduino and channel sides
      then, it could be called from DataFlowProgram:updateChannels()
    */
    // public createSerialChannels(){
          // if a key from the stream does not yet have a channel
          // create one and add it to the channel store
    // }

    public async handleStream(channels: any){
      await this.port?.open({ baudRate: 9600 }).catch((e: any) => console.log(e))
        
        while (this.port?.readable) {
       
          let textDecoder = new TextDecoderStream()
          let  promiseToBeClosed = this.port.readable.pipeTo(textDecoder.writable)
          let streamReader = textDecoder.readable.getReader()
            
          try {
              while (true) {
                const { value, done } = await streamReader.read();
                if (done){
                  break
                }
                this.handleStreamObj(value, channels)
              }
            } 
            catch (error) {
              console.log(error)
            } 
            finally {
              streamReader.releaseLock();
            }
          }
    }

    public handleStreamObj(value:any, channels:any){
      this.localBuffer+= value

      /* any number of digits followed by a carriage return and a newline */
      const pattern = /(emg|fsr)([0-9]+)[\r][\n]/g
    
      /* an array that includes [{the whole match}, {the captured string we want}] */
      const match = pattern.exec(this.localBuffer)
      
    
      if (match !== null){

        const takeAway = match[0].length + 3 // its either 'emg' or 'msr'

        this.localBuffer = this.localBuffer.substring(0, this.localBuffer.length - takeAway);
        
        const nice = match[1] + match[2];
       
        const targetChannel = channels.find((c: any) => {
          return c.channelId === nice.substring(0,3);
        })

        const justDigits = /[0-9]+/

        const mismo = justDigits.exec(nice) 

        if (mismo){
          targetChannel.value = mismo[0]
        }
    
      }
    }
}