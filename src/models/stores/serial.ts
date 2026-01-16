import { NodeChannelInfo } from "src/plugins/dataflow/model/utilities/channel";
import { NodeLiveOutputTypes } from "../../plugins/dataflow/model/utilities/node";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function log(message: string) {
  // eslint-disable-next-line no-console
  console.log(`[SerialDevice] ${message}`);
}

export class SerialDevice {
  localBuffer: string;
  private port: SerialPort | null;
  connectChangeStamp: number | null;
  lastConnectMessage: string | null;
  deviceInfo: SerialPortInfo | null;
  serialNodesCount: number;
  writer: WritableStreamDefaultWriter;
  serialModalShown: boolean | null;
  deviceFamily: string | undefined;

  constructor() {
    this.localBuffer = "";

    navigator.serial?.addEventListener("connect", (e) => {
      this.updateConnectionInfo(e.timeStamp, e.type);
    });

    navigator.serial?.addEventListener("disconnect", (e) => {
      this.updateConnectionInfo(e.timeStamp, e.type);
      this.deviceFamily = undefined;
    });
  }

  public setSerialNodesCount(n: number){
    this.serialNodesCount = n;
  }

  // TODO, revise this so it is more clear how its used
  public updateConnectionInfo(timeStamp: number | null, status: string ){
    this.connectChangeStamp = timeStamp;
    this.lastConnectMessage = status;
    localStorage.setItem("last-connect-message", status);
  }

  public determineDeviceFamily(info: SerialPortInfo){
    return info.usbProductId === 516 && info.usbVendorId === 3368
      ? "microbit"
      : "arduino";
  }

  public hasPort(){
    return this.port !== undefined && this.port?.readable;
  }

  public async requestAndSetPort(){
    try {
      this.port = await navigator.serial.requestPort();
      this.deviceInfo = await this.port.getInfo();
      this.deviceFamily = this.determineDeviceFamily(this.deviceInfo);
    }
    catch (error) {
      console.error("error requesting port: ", error);
    }
  }

  private readonly READ_TIMEOUT_MS = 2000;

  private async readWithTimeout(
    streamReader: ReadableStreamDefaultReader<Uint8Array>
  ): Promise<{ value: string | undefined; done: boolean; timedOut: boolean }> {
    const timeoutPromise = new Promise<{ value: undefined; done: false; timedOut: true }>((resolve) => {
      setTimeout(() => resolve({ value: undefined, done: false, timedOut: true }), this.READ_TIMEOUT_MS);
    });

    const readPromise = streamReader.read().then(({ value, done }) => ({
      value: value ? textDecoder.decode(value) : undefined,
      done,
      timedOut: false
    }));

    return Promise.race([readPromise, timeoutPromise]);
  }

  private async closePort(streamReader?: ReadableStreamDefaultReader<Uint8Array>) {
    if (!this.port) return;
    try {
      // Cancel and release the reader first
      if (streamReader) {
        try {
          await streamReader.cancel();
        } catch (e) {
          // Reader may already be released
        }
        try {
          streamReader.releaseLock();
        } catch (e) {
          // Lock may already be released
        }
      }
      // Close the writer
      if (this.writer) {
        try {
          await this.writer.close();
        } catch (e) {
          // Writer may already be closed
        }
      }
      await this.port.close();
    } catch (e) {
      console.error("Error closing port:", e);
    }
  }

  private async reopenPort() {
    if (!this.port) return false;
    try {
      await this.port.open({ baudRate: 9600 });
      // Re-setup writer after reopening
      // If port.writable is null, this will throw and be caught below
      this.writer = this.port.writable!.getWriter();
      return true;
    } catch (e) {
      console.error("Error reopening port:", e);
      return false;
    }
  }

  public async handleStream(channels: Array<NodeChannelInfo>){
    if (!this.port) return;
    await this.port.open({ baudRate: 9600 }).catch((e: any) => console.error(e));

    // set up writer directly on the port's writable stream
    if (!this.port.writable) {
      console.error("Port is not writable");
      // This has never happened in practice, but we try to handle it gracefully
      await this.closePort();
      return;
    }
    this.writer = this.port.writable.getWriter();

    // listen for serial data coming in to computer
    while (this.port) {
      if (!this.port.readable) {
        // Port is closed, try to reopen
        log("Port not readable, attempting to reopen...");
        const reopened = await this.reopenPort();
        if (!reopened || !this.port.readable) {
          console.error("Failed to reopen port, stopping stream handler");
          break;
        }
      }

      const streamReader = this.port.readable!.getReader();
      try {
        while (this.port.readable) {
          const { value, done, timedOut } = await this.readWithTimeout(streamReader);

          if (timedOut) {
            log("Read timed out, closing and reopening port...");
            await this.closePort(streamReader);
            break; // Break inner loop to trigger reopen in outer loop
          }

          if (done){
            break;
          }
          if (this.deviceFamily === "arduino"){
            this.handleArduinoStreamObj(value!, channels);
          }
          if (this.deviceFamily === "microbit"){
            this.handleMicroBitStreamObj(value!, channels);
          }
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

  public handleMicroBitStreamObj(value: string, channels: Array<NodeChannelInfo>){
    this.localBuffer += value;

    // [sc]   signal or control
    // [abcd] which micro:bit
    // [rth]  relay, temp, humidity
    const pattern = /([sc]{1})([abcd]{1})([rth]{1})([0-9.]+)\s{0,}[\r][\n]/g;
    let match: RegExpExecArray | null;

    do {
      match = pattern.exec(this.localBuffer);
      if (!match) break;

      const [fullMatch, signalType, microbitId, element, reading] = match;
      this.localBuffer = this.localBuffer.substring(match.index + fullMatch.length);

      const targetChannelId = `${element}-${microbitId}`;
      const targetChannel = channels.find((c: NodeChannelInfo) => {
        return c.channelId === targetChannelId;
      });

      if (targetChannel && signalType === "s" ){
        if (["h", "t"].includes(element)){
          // handle message from a humidity or temperature sensor
          if (isFinite(Number(reading))){
            targetChannel.value = Number(reading);
          }
          targetChannel.lastMessageReceivedAt = Date.now();
        }
        if (["r"].includes(element)){
          // handle message about relays state
          targetChannel.relaysState = reading.split('').map(s => Number(s));
          targetChannel.lastMessageReceivedAt = Date.now();
        }
      }
    } while (match);
  }

  public handleArduinoStreamObj(value: string, channels: Array<NodeChannelInfo>){
    this.localBuffer += value;

    // Match any alphanumeric channel name, not just known ones,
    // so unknown channels are still consumed from the buffer.
    // No 'g' flag since we always search from the start of the modified buffer.
    // Note this pattern doesn't handle NaN or negative numbers.
    // We are seeing at least some NAN values from the Arduino. This currently
    // gets ignored correctly, by the corrupted data fallback.
    const pattern = /([a-z0-9]+):([0-9.]+)[\r][\n]/;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const match = pattern.exec(this.localBuffer);

      if (match) {
        const [fullMatch, channel, numStr] = match;
        this.localBuffer = this.localBuffer.substring(match.index + fullMatch.length);

        const targetChannel = channels.find((c: NodeChannelInfo) => {
          return c.channelId === channel;
        });

        if (targetChannel){
          targetChannel.value = Math.round(Number(numStr));
        }
      } else {
        // No valid pattern found - check for corrupted data we can discard
        const lineEndIndex = this.localBuffer.indexOf("\r\n");
        if (lineEndIndex !== -1) {

          // Discard everything up to and including the \r\n to recover
          this.localBuffer = this.localBuffer.substring(lineEndIndex + 2);
        } else {
          // No complete line to discard, wait for more data
          break;
        }
      }
    }
  }

  public writeLine(line: string){
    if (this.hasPort()){
      this.writer.write(textEncoder.encode(`${line}\n`));
    } else {
      log("Port closed, skipping write");
    }
  }

  public writeToOutForMicroBitRelayHub(data: number, hubId: string, relayType: string){
    const ri = NodeLiveOutputTypes.filter((ot:any) => ot.name === relayType)[0].relayIndex;
    const controlMessage = `c${hubId}${ri}${data}`;
    this.writeLine(controlMessage);
  }

  public writeToOutForBBGripper(n:number, liveOutputType: string){
    const outputConfig = NodeLiveOutputTypes.find(o => o.name === liveOutputType);
    if (this.hasPort() && outputConfig?.angleBase !== undefined){
      const percent = n / 100;
      const openTo = Math.round(outputConfig.angleBase - (percent * outputConfig.sweep));
      this.writeLine(openTo.toString());
    }
  }

  public writeToOutForServo(n:number, liveOutputType: string){
    const outputConfig = NodeLiveOutputTypes.find(o => o.name === liveOutputType);
    if (this.hasPort() && outputConfig?.angleOffset !== undefined){
      const scaledAngle = (outputConfig.angleScale * n) + outputConfig.angleOffset;
      const roundedScaled = Math.round(scaledAngle);
      this.writeLine(roundedScaled.toString());
    }
  }
}
