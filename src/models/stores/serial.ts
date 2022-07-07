export class SerialDevice {
    value: string
    localBuffer: string
    private port: any //TODO: types SerialPort | null 

    constructor() {
        this.value = '0'
        this.localBuffer = ''
      }
  
      public async findPort(){
        try {
            await (navigator as any).serial.requestPort()
            .then((p: any) => {
              this.port = p
            })
        }

        catch (error) {
            console.log('error requesting port: ', error)
        }
      }
}