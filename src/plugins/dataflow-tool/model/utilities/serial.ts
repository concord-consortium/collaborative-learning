export class SerialChannel {
    value: string
    nodeId: number
    localBuffer: string
    private port: any //SerialPort | null

    constructor(nodeId: number) {
      this.value = '0'
      this.nodeId = nodeId
      // this.port = port
      this.localBuffer = ''
    }

    // public updateReteValue(v: string){
    //   console.log('rete node: ' + this.nodeId + 'should have value of: ' + this.value)
    // }

    // argh my types found by VSC but not by app
    // public async findPort(): Promise<SerialPort> {
    //     return await (navigator as Navigator).serial.requestPort()
    // }

    public async findPort(){
        return await (navigator as any).serial.requestPort()
    }

    public async handleStream(){
      await this.port?.open({ baudRate: 9600 }).catch((e: any) => console.log(e))
        while (this.port?.readable) {
          console.log('noice')
          let textDecoder = new TextDecoderStream()
          let  promiseToBeClosed = this.port.readable.pipeTo(textDecoder.writable)
          let streamReader = textDecoder.readable.getReader()
            
            try {
              while (true) {
                const { value, done } = await streamReader.read();
                if (done){
                  break
                }
                this.handleStreamObj(value)
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

    private handleStreamObj(val: any){
      this.localBuffer+= val

      /* any number of digits followed by a carriage return and a newline */
      const pattern = /([0-9]+)[\r][\n]/g
    
      /* an array that includes [{the whole match}, {the captured string we want}] */
      const match = pattern.exec(this.localBuffer)
    
      //console.log(match)
      if (match){
        /* remove our current match from the end of the buffer */
        this.localBuffer = this.localBuffer.substring(0, this.localBuffer.length - match[0].length)
        const nice = match[1]
        this.value = nice
        console.log(this.value)
        // GROK 5 - this is only problem - this should just update the channel.value, not the "rete"
        // GROK 6 - whoa, which I already did since UI does it
        // this.updateReteValue(this.value)
      }
    }
}