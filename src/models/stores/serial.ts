import { NodeChannelInfo } from "src/plugins/dataflow/model/utilities/channel";
import { NodeLiveOutputTypes } from "../../plugins/dataflow/model/utilities/node";
import { parseArduinoSerialData } from "./serial-protocol";
import { IDeviceTransport } from "./device-transport";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function log(message: string) {
  // eslint-disable-next-line no-console
  console.log(`[SerialDevice] ${message}`);
}

// Wraps the Web Serial writer/port for the shared IDeviceTransport write path.
// It reads the current writer through a getter so SerialDevice's reopen logic
// (which recreates the writer) needs no coordination, and guards on the port
// being open so a closed-port write is a no-op, matching prior behavior.
class WebSerialTransport implements IDeviceTransport {
  constructor(
    private getWriter: () => WritableStreamDefaultWriter | undefined,
    private isOpen: () => boolean,
    private closeFn: () => Promise<void>
  ) {}

  write(line: string) {
    if (this.isOpen()) {
      this.getWriter()?.write(textEncoder.encode(`${line}\n`));
    } else {
      log("Port closed, skipping write");
    }
  }

  close() {
    return this.closeFn();
  }
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
  // The active write transport (Web Serial or WebUSB). writeLine routes here.
  activeTransport: IDeviceTransport | undefined;
  // Spiker:bit (WebUSB) transport hooks. Removed in Task 5 once the WebUSB path
  // uses activeTransport; see the design spec §10.
  spikerbitWrite: ((line: string) => void) | undefined;
  private spikerbitConnected: boolean;

  constructor() {
    this.localBuffer = "";
    this.spikerbitConnected = false;

    navigator.serial?.addEventListener("connect", (e) => {
      this.updateConnectionInfo(e.timeStamp, e.type);
    });

    navigator.serial?.addEventListener("disconnect", (e) => {
      this.updateConnectionInfo(e.timeStamp, e.type);
      this.deviceFamily = undefined;
      this.activeTransport = undefined;
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

  /**
   * True only for a Web Serial port (Arduino / radio-hub micro:bit). The Spiker:bit
   * connects over WebUSB and has no port, so for "is any device connected?" use
   * {@link isConnected} instead — this method is intentionally Web-Serial-specific.
   */
  public hasWebSerialPort(){
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
    this.activeTransport = new WebSerialTransport(
      () => this.writer,
      () => !!this.hasWebSerialPort(),
      () => this.closePort()
    );

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
    this.localBuffer = parseArduinoSerialData(this.localBuffer + value, channels);
  }

  public isConnected(){
    return this.hasWebSerialPort() || this.spikerbitConnected;
  }

  public setSpikerbitActive(write: (line: string) => void){
    this.spikerbitWrite = write;
    this.spikerbitConnected = true;
    this.deviceFamily = "arduino";
    this.updateConnectionInfo(Date.now(), "connect");
  }

  public clearSpikerbit(){
    this.spikerbitWrite = undefined;
    this.spikerbitConnected = false;
    this.deviceFamily = undefined;
    this.updateConnectionInfo(Date.now(), "disconnect");
  }

  public writeLine(line: string){
    if (this.spikerbitWrite){
      this.spikerbitWrite(line);
      return;
    }
    if (this.activeTransport){
      this.activeTransport.write(line);
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
    if (this.isConnected() && outputConfig?.angleBase !== undefined){
      const percent = n / 100;
      const openTo = Math.round(outputConfig.angleBase - (percent * outputConfig.sweep));
      this.writeLine(openTo.toString());
    }
  }

  public writeToOutForServo(n:number, liveOutputType: string){
    const outputConfig = NodeLiveOutputTypes.find(o => o.name === liveOutputType);
    if (this.isConnected() && outputConfig?.angleOffset !== undefined){
      const scaledAngle = (outputConfig.angleScale * n) + outputConfig.angleOffset;
      const roundedScaled = Math.round(scaledAngle);
      this.writeLine(roundedScaled.toString());
    }
  }
}
