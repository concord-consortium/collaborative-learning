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
}