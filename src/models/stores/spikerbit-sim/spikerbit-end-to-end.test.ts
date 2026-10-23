import * as path from "path";
import { withChecksum } from "../cc-device-protocol";
import { SerialDevice } from "../serial";
import { IMicrobitUsbConnection, SpikerbitDevice } from "../spikerbit-device";
import { MakeCodeSim } from "./makecode-sim";

// Dataflow's Spiker:bit connection talking to the firmware source running on the simulated
// MakeCode runtime, with Jest's fake timers and the sim's clock advanced together.

const firmwarePath = path.join(__dirname, "../../../plugins/dataflow/firmware/spikerbit-clue.ts");

// A WebUSB connection wired to the sim: writes go to its serial input, and its serial output
// comes back as serialdata events each time the clocks advance.
class SimConnection implements IMicrobitUsbConnection {
  serialListeners: Array<(d: { data: string }) => void> = [];
  statusListeners: Array<(d: { status: string }) => void> = [];
  flashed = false;
  connected = false;
  written: string[] = [];

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

  deliverOutput() {
    const data = this.sim.takeSerialOutput();
    if (data && this.connected) this.serialListeners.forEach(l => l({ data }));
  }
}

describe("Dataflow and the Spiker:bit firmware", () => {
  let sim: MakeCodeSim;
  let conn: SimConnection;
  let serialDevice: SerialDevice;

  // Advances both clocks in 10 ms steps, delivering the board's output after each step.
  async function tick(ms: number) {
    for (let elapsed = 0; elapsed < ms; elapsed += 10) {
      sim.advance(10);
      conn.deliverOutput();
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
    let high = false;
    sim.setAnalog("P1", () => {
      high = !high;
      return high ? 700 : 300;
    });
    const channel = { channelId: "emg", value: 0 } as any;
    serialDevice.registerChannelSource(() => [channel]);

    await connect();
    await tick(3000);

    expect(conn.flashed).toBe(false);
    expect(conn.written.filter(w => w.startsWith("open session:"))).toHaveLength(1);
    // A 300/700 swing around 500 is a 200-count deviation on every sample.
    expect(channel.value).toBeGreaterThan(150);
    expect(channel.lastMessageReceivedAt).toBeGreaterThan(Date.now() - 200);
  });

  it("moves the servo from a Live Output", async () => {
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

  it("leaves the board idle and silent after a disconnect", async () => {
    const device = await connect();
    await tick(1000);

    // What DeviceConnection.disconnect does.
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
});
