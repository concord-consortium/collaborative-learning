

let port: any;
let portInfo: any;
let textDecoder: any;
let promiseToBeClosed: any;
let streamReader: any;

export async function connectToPort(channel: any){
 
  port = await (navigator as any).serial.requestPort();
  await port.open({ baudRate: 9600 }).catch((e:any) => console.log(e));
  channel.serialPort = port;
  let btn = document.getElementById('serial-connect-button');
  if (btn){
    btn.style.backgroundColor = 'green'
    btn.innerText = 'connected to serial port'
  }
  if (port.readable){
    handleReadableStream(port)
  }
}

export async function handleReadableStream(port: any){
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

let localBuffer = ''

export function handleStreamObj(val: any){
  localBuffer+= val

  /* any number of digits followed by a carriage return and a newline */
  const pattern = /([0-9]+)[\r][\n]/g

  /* an array that includes [{the whole match}, {the captured string we want}] */
  const match = pattern.exec(localBuffer)

  if (match){
    /* remove our current match from the end of the buffer */
    localBuffer = localBuffer.substring(0, localBuffer.length - match[0].length)
    const nice = match[1]
    global.emgVal = parseInt(nice)
  }
}