import * as path from "path";
import { withChecksum } from "../cc-device-protocol";
import { SerialDevice } from "../serial";
import { IMicrobitUsbConnection, SpikerbitDevice } from "../spikerbit-device";
import { MakeCodeSim } from "./makecode-sim";

// Dataflow's Spiker:bit connection talking to the firmware source running on the simulated
// MakeCode runtime, with Jest's fake timers and the sim's clock advanced together.

const firmwarePath = path.join(__dirname, "../../../plugins/dataflow/firmware/spikerbit-clue.ts");

// DAPLink, the micro:bit's USB interface chip, buffers the board's serial output until a host reads
// it. Once the buffer is full it keeps the oldest bytes and drops new ones. A V2 was measured
// holding 500–578 bytes.
const kDaplinkBufferBytes = 512;
// @microbit/microbit-connection reads that buffer at most 62 bytes at a time.
const kDaplinkReadBytes = 62;

// A WebUSB connection wired to the sim: writes go to its serial input. Its serial output goes into
// a model of DAPLink's buffer, which fills while nobody reads, and comes back as serialdata events
// of at most 62 bytes each, as the library's reads return it.
class SimConnection implements IMicrobitUsbConnection {
  serialListeners: Array<(d: { data: string }) => void> = [];
  statusListeners: Array<(d: { status: string }) => void> = [];
  flashed = false;
  connected = false;
  written: string[] = [];
  daplink = "";
  reads: string[] = [];

  constructor(readonly sim: MakeCodeSim) {}

  addEventListener(type: string, listener: any) {
    if (type === "serialdata") this.serialListeners.push(listener);
    if (type === "status") this.statusListeners.push(listener);
  }
  async connect() { this.connected = true; }
  async flash() { this.flashed = true; }
  async serialWrite(data: string) {
    if (!this.connected) throw new Error("not connected");
    this.written.push(data);
    this.sim.sendSerial(data);
  }
  async disconnect() {
    this.connected = false;
    this.statusListeners.forEach(l => l({ status: "Disconnected" }));
  }
  getDevice() { return this.sim; }

  // Moves the board's output into DAPLink's buffer, dropping what doesn't fit.
  collectOutput() {
    const room = kDaplinkBufferBytes - this.daplink.length;
    this.daplink += this.sim.takeSerialOutput().slice(0, room);
  }

  // Reads DAPLink's buffer empty, as the library's polling does while connected.
  deliverOutput() {
    if (!this.connected) return;
    while (this.daplink) {
      const data = this.daplink.slice(0, kDaplinkReadBytes);
      this.daplink = this.daplink.slice(kDaplinkReadBytes);
      this.reads.push(data);
      this.serialListeners.forEach(l => l({ data }));
    }
  }
}

describe("Dataflow and the Spiker:bit firmware", () => {
  let sim: MakeCodeSim;
  let conn: SimConnection;
  let serialDevice: SerialDevice;

  // Advances both clocks in 10 ms steps. Each step reads what DAPLink holds (nothing while
  // disconnected), then runs the board, whose output goes into DAPLink's buffer for the next read.
  async function tick(ms: number) {
    for (let elapsed = 0; elapsed < ms; elapsed += 10) {
      conn.deliverOutput();
      sim.advance(10);
      conn.collectOutput();
      await jest.advanceTimersByTimeAsync(10);
    }
  }

  async function connect() {
    const device = new SpikerbitDevice(serialDevice, conn);
    const connecting = device.connectAndStream("HEX");
    let done = false;
    connecting.finally(() => { done = true; });
    for (let waited = 0; !done && waited < 5000; waited += 10) await tick(10);
    await connecting;
    return device;
  }

  const sessionId = () => Number(/^open session:(\d+)/.exec(conn.written.find(w => w.startsWith("open"))!)![1]);

  // A board that streamed with nobody reading has filled DAPLink's buffer, ending in a cut-off
  // line. The backlog drains in full 62-byte reads, then the empty line ends the fragment, and the
  // ok and the hello follow.
  function expectBacklogThenReplies() {
    const firstReply = conn.reads.findIndex(read => read.startsWith("\r\nok #"));
    expect(firstReply).toBeGreaterThan(0);
    const backlog = conn.reads.slice(0, firstReply);
    expect(backlog.join("").length).toBe(kDaplinkBufferBytes);
    expect(backlog.slice(0, -1).every(read => read.length === kDaplinkReadBytes)).toBe(true);
    expect(backlog.join("")).not.toMatch(/\r\n$/);
  }

  // A 300/700 swing around 500 is a 200-count deviation on every sample.
  function swingSignal() {
    let high = false;
    sim.setAnalog("P1", () => {
      high = !high;
      return high ? 700 : 300;
    });
  }

  async function expectStreaming() {
    const channel = { channelId: "emg", value: 0 } as any;
    serialDevice.registerChannelSource(() => [channel]);
    await tick(2000);
    expect(channel.value).toBeGreaterThan(150);
    expect(serialDevice.ccDeviceSession?.lastHeartbeatAt).toBeGreaterThan(Date.now() - 1500);
  }

  beforeEach(() => {
    jest.useFakeTimers();
    sim = MakeCodeSim.load(firmwarePath);
    conn = new SimConnection(sim);
    serialDevice = new SerialDevice();
  });

  afterEach(() => {
    serialDevice.clearActiveDevice();
    jest.useRealTimers();
  });

  it("connects to v4 firmware without flashing, opens a session and streams emg to a channel", async () => {
    swingSignal();
    const channel = { channelId: "emg", value: 0 } as any;
    serialDevice.registerChannelSource(() => [channel]);

    await connect();
    await tick(3000);

    expect(conn.flashed).toBe(false);
    expect(conn.written.filter(w => w.startsWith("open session:"))).toHaveLength(1);
    expect(channel.value).toBeGreaterThan(150);
    expect(channel.lastMessageReceivedAt).toBeGreaterThan(Date.now() - 200);
  });

  it("moves the servo for a servo output", async () => {
    await connect();
    serialDevice.writeToOutForServo(0, "Servo");
    await tick(100);
    expect(sim.servoAngle("P0")).toBe(30);
  });

  it("keeps the session open with pings", async () => {
    await connect();
    await tick(10000);

    expect(serialDevice.ccDeviceSession?.lastHeartbeatAt).toBeGreaterThan(Date.now() - 1500);
    // Ask the board directly: it still has the session Dataflow opened.
    sim.takeSerialOutput();
    sim.sendSerial(`${withChecksum(`ping session:${sessionId()} #900`)}\n`);
    sim.advance(100);
    expect(sim.takeSerialLines()).toContain(withChecksum("ok #900"));
  });

  it("is not responding while the board is stalled, and recovers", async () => {
    await connect();
    await tick(2000);
    expect(serialDevice.ccDeviceSession?.notResponding).toBe(false);
    // Dataflow's timers run on while the board does nothing.
    await jest.advanceTimersByTimeAsync(4000);
    expect(serialDevice.ccDeviceSession?.notResponding).toBe(true);
    await tick(2000);
    expect(serialDevice.ccDeviceSession?.notResponding).toBe(false);
  });

  it("identify gets the board's answer and shows the heart", async () => {
    await connect();
    await tick(500);
    const result = serialDevice.ccDeviceSession!.identify();
    await tick(200);
    await expect(result).resolves.toBe("answered");
    expect(sim.shownIcon()).toBe("Heart");
  });

  it("leaves the board idle and silent after a disconnect", async () => {
    const device = await connect();
    await tick(1000);

    // As DeviceConnection.disconnect does: end the session, then close the link.
    await serialDevice.endSession();
    await device.disconnect();
    expect(serialDevice.isConnected()).toBe(false);

    // Let the board write the reply to any ping that was in flight, then listen.
    sim.advance(100);
    sim.takeSerialOutput();
    sim.advance(1000);
    expect(sim.takeSerialOutput()).toBe("");
    sim.sendSerial(`${withChecksum(`ping session:${sessionId()} #901`)}\n`);
    sim.advance(100);
    expect(sim.takeSerialLines()).toEqual([withChecksum("err #901 nosession")]);
  });

  it("connects without flashing to a board left in free-run", async () => {
    swingSignal();
    sim.sendSerial("stream\n");
    await tick(15000);
    expect(conn.daplink).toHaveLength(kDaplinkBufferBytes);

    await connect();

    expect(conn.flashed).toBe(false);
    expect(conn.written.filter(w => w.startsWith("!!"))).toHaveLength(1);
    expectBacklogThenReplies();
    await expectStreaming();
  });

  it("connects without flashing to a board still in a session whose host has gone", async () => {
    // Its host stopped reading. Dataflow connects before the default 5 s timeout ends the session.
    swingSignal();
    sim.sendSerial(`${withChecksum("open session:77")}\n`);
    await tick(4500);
    expect(conn.daplink).toHaveLength(kDaplinkBufferBytes);

    await connect();

    expect(conn.flashed).toBe(false);
    expectBacklogThenReplies();
    await expectStreaming();
  });
});
