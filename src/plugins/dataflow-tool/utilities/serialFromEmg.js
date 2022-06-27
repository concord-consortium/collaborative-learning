let port;
let readableStream;
let textDecoder;
let promiseToBeClosed;
let streamReader;
let portInfo;
let listo;
let cleaned = []

async function connect(){
     /* poc - create invisible div that will serve as our ambiguous character cleaner */
    listo = document.createElement('div')
    listo.style.visibility='hidden'

    port = await navigator.serial.requestPort() 
    await port.open({ baudRate: 9600 }).catch((e) => console.log(e))
  
    portInfo = port.getInfo()
    console.log(portInfo)
  
    handleReadableStream(port)
}

async function handleReadableStream(port){
    while (port.readable) {
        textDecoder = new TextDecoderStream()
        promiseToBeClosed = port.readable.pipeTo(textDecoder.writable)
        streamReader = textDecoder.readable.getReader()
      
        try {
            while (true) {
                const { value, done } = await streamReader.read();
                if (done){
                    break
                }
                handleStreamObj(value)
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

function handleStreamObjAndGetValue(val){

    listo.innerHTML += val
  
    cleaned = listo.innerHTML.split('\n')
      .map( x => parseInt(x))
      .filter( n => !isNaN(n))

    console.log(cleaned)
  
}

export async function getStream(){
   return 1975
}