import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { withChecksum } from "../cc-device-protocol";
import { MakeCodeSim } from "./makecode-sim";

const firmwarePath = path.join(__dirname, "../../../plugins/dataflow/firmware/spikerbit-clue.ts");
const sim = () => MakeCodeSim.load(firmwarePath);
const kHello = "hello protocol:CCDeviceProtocol version:1 device:spikerbit firmware:4";

// The emg values in a batch of serial lines, each ending in its checksum.
const emgValues = (lines: string[]) =>
  lines.filter(l => l.startsWith("emg:")).map(l => Number(l.slice("emg:".length, l.indexOf("*"))));

describe("MakeCodeSim running the Spiker:bit firmware", () => {
  it("is silent until streaming, then streams emg every 100 ms", () => {
    const s = sim();
    s.setAnalog("P1", 511);
    s.advance(1000);
    expect(s.takeSerialLines()).toEqual([]);
    s.sendSerial(`${withChecksum("stream")}\n`);
    s.advance(1000);
    expect(emgValues(s.takeSerialLines()).length).toBeGreaterThanOrEqual(9);
  });

  it("answers ? on the next loop pass", () => {
    const s = sim();
    s.advance(10);
    s.sendSerial("?\n");
    expect(s.takeSerialLines()).toEqual([]);
    s.advance(20);
    expect(s.takeSerialLines()).toEqual([withChecksum(kHello)]);
  });

  it("drives the servo from servo:<angle>", () => {
    const s = sim();
    s.sendSerial(`${withChecksum("servo:90")}\n`);
    s.advance(0);
    expect(s.servoAngle("P0")).toBe(90);
  });

  it("feeds the sampler from the analog pin", () => {
    const streaming = (read: number | (() => number)) => {
      const s = sim();
      s.setAnalog("P1", read);
      s.sendSerial(`${withChecksum("stream")}\n`);
      s.advance(3000);
      return emgValues(s.takeSerialLines());
    };
    const steadyEmg = streaming(500);
    let high = false;
    const alternatingEmg = streaming(() => {
      high = !high;
      return high ? 700 : 300;
    });

    // A steady signal leaves only the baseline's remaining error; a 300/700 swing around 500
    // is a 200-count deviation on every sample.
    expect(steadyEmg[steadyEmg.length - 1]).toBeLessThan(50);
    expect(alternatingEmg[alternatingEmg.length - 1]).toBeGreaterThan(150);
  });

  it("ends each line with \\r\\n and clears what it has handed out", () => {
    const s = sim();
    s.sendSerial("?\n");
    s.advance(10);
    expect(s.takeSerialOutput()).toBe(`${withChecksum(kHello)}\r\n`);
    expect(s.takeSerialOutput()).toBe("");
    expect(s.takeSerialLines()).toEqual([]);
  });
});

describe("MakeCodeSim runtime", () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "makecode-sim-")); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  const load = (source: string, hardwareVersion?: string) => {
    const file = path.join(dir, "program.ts");
    fs.writeFileSync(file, source);
    return MakeCodeSim.load(file, { hardwareVersion });
  };

  it("reports an API the firmware uses but the sim doesn't fake", () => {
    expect(() => load(`radio.sendString("hi")`)).toThrow("not simulated: radio.sendString");
    expect(() => load(`serial.readString()`)).toThrow("not simulated: serial.readString");
    expect(() => load(`basic.showIcon(IconNames.Unicorn, 0)`)).toThrow("not simulated: IconNames.Unicorn");
  });

  it("runs the top level at time 0 and keeps its variables shared by its closures", () => {
    const s = load(`
      let count: number = 0
      serial.writeLine("start " + control.millis())
      basic.forever(function () {
        count += 1
        serial.writeLine(count + " at " + control.millis() + " / " + input.runningTimeMicros())
        basic.pause(50)
      })
    `);
    expect(s.now).toBe(0);
    s.advance(150);
    expect(s.now).toBe(150);
    // Each pass takes its 50 ms pause plus the 20 ms forever sleeps after every pass.
    expect(s.takeSerialLines()).toEqual(["start 0", "1 at 0 / 0", "2 at 70 / 70000", "3 at 140 / 140000"]);
  });

  it("waits 20 ms after a forever body that doesn't pause, and ends a background fiber that returns", () => {
    const s = load(`
      basic.forever(function () { serial.writeLine("f " + control.millis()) })
      control.inBackground(function () { serial.writeLine("b " + control.millis()) })
    `);
    s.advance(45);
    expect(s.takeSerialLines()).toEqual(["f 0", "b 0", "f 20", "f 40"]);
  });

  it("runs each fiber that came due during a stall once, late, when the stall ends", () => {
    const s = load(`basic.forever(function () { serial.writeLine("f " + control.millis()) })`);
    s.advance(5);
    s.stall(50);
    s.advance(30);
    expect(s.takeSerialLines()).toEqual(["f 0", "f 55", "f 75"]);
  });

  it("runs fibers due at the same time in the order they were scheduled", () => {
    const s = load(`
      basic.forever(function () { serial.writeLine("one"); basic.pause(10) })
      basic.forever(function () { serial.writeLine("two"); basic.pause(10) })
    `);
    s.advance(30);
    expect(s.takeSerialLines()).toEqual(["one", "two", "one", "two"]);
  });

  const echoLines = `
    serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function () {
      serial.writeLine("got [" + serial.readUntil(serial.delimiters(Delimiters.NewLine)) + "]")
    })
  `;
  const line30 = "abcdefghijklmnopqrstuvwxyz0123";

  it("runs onDataReceived at the next scheduler step, once per delimiter, handing each call its line", () => {
    const s = load(echoLines);
    s.sendSerial("a\nb");
    expect(s.takeSerialLines()).toEqual([]);
    s.advance(0);
    expect(s.takeSerialLines()).toEqual(["got [a]"]);
    s.sendSerial("c\nd\n");
    s.advance(0);
    expect(s.takeSerialLines()).toEqual(["got [bc]", "got [d]"]);
  });

  it("holds every line of one write in the receive buffer before the handler reads the first", () => {
    const s = load(echoLines);
    // The first two lines take 12 of the default 20 characters, so the buffer keeps 8 of the third
    // and drops the rest, and the board's readUntil takes the last one kept as its delimiter.
    s.sendSerial("abcde\nfghij\nklmnopqrstu\n");
    s.advance(0);
    expect(s.takeSerialLines()).toEqual(["got [abcde]", "got [fghij]", "got [klmnopq]"]);
  });

  it("truncates a line longer than the default 20-character receive buffer", () => {
    const s = load(echoLines);
    s.sendSerial(`${line30}\n`);
    s.advance(0);
    // The buffer keeps the first 20 characters and drops the rest, the newline included. The
    // dropped newline still raises the event, and the board's readUntil then takes the 20th
    // character as the delimiter.
    expect(s.takeSerialLines()).toEqual([`got [${line30.slice(0, 19)}]`]);
  });

  it("delivers a 30-character line whole after setRxBufferSize(64)", () => {
    const s = load(`serial.setRxBufferSize(64)\n${echoLines}`);
    s.sendSerial(`${line30}\n`);
    s.advance(0);
    expect(s.takeSerialLines()).toEqual([`got [${line30}]`]);
  });

  it("refuses a pause inside an event handler", () => {
    const s = load(`
      serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function () { basic.pause(10) })
    `);
    s.sendSerial("x\n");
    expect(() => s.advance(0)).toThrow("event handlers must not pause");
  });

  it("raises a button's click or long-click event for the handlers registered for it", () => {
    const s = load(`
      input.onButtonPressed(Button.A, function () { serial.writeLine("A click") })
      control.onEvent(EventBusSource.MICROBIT_ID_BUTTON_A, DAL.MICROBIT_BUTTON_EVT_LONG_CLICK, function () {
        serial.writeLine("A long")
      })
      control.onEvent(EventBusSource.MICROBIT_ID_BUTTON_B, DAL.MICROBIT_BUTTON_EVT_CLICK, function () {
        serial.writeLine("B click")
      })
    `);
    s.pressButton("A", "longClick");
    s.pressButton("B", "click");
    s.pressButton("A", "click");
    s.pressButton("B", "longClick");
    expect(s.takeSerialLines()).toEqual(["A long", "B click", "A click"]);
  });

  it("doesn't fake button event APIs that pxt-microbit doesn't have", () => {
    expect(() => load(`input.onButtonEvent(Button.A, 4, function () {})`)).toThrow("not simulated: input.onButtonEvent");
    expect(() => load(`let e = ButtonEvent.LongClick`)).toThrow("ButtonEvent is not defined");
  });

  it("reports a micro:bit V2 unless loaded as another hardware version", () => {
    expect(load(`serial.writeLine(control.hardwareVersion())`).takeSerialLines()).toEqual(["2.0"]);
    expect(load(`serial.writeLine(control.hardwareVersion())`, "1").takeSerialLines()).toEqual(["1"]);
  });

  it("panics on a micro:bit V1 that turns the speaker on or plays a sound expression", () => {
    const play = `music.play(music.builtinPlayableSoundEffect(soundExpression.hello), music.PlaybackMode.InBackground)`;
    expect(() => load(`music.setBuiltInSpeakerEnabled(true)`, "1")).toThrow("panic");
    expect(() => load(play, "1")).toThrow("panic");
    const s = load(`music.setBuiltInSpeakerEnabled(false)`, "1");
    expect(s.speakerEnabled).toBe(false);
  });

  it("records the icon shown, display calls, sounds started and stopped, and audio settings", () => {
    const s = load(`
      music.setBuiltInSpeakerEnabled(true)
      pins.setAudioPinEnabled(false)
      basic.showIcon(IconNames.Heart, 0)
      music.play(music.builtinPlayableSoundEffect(soundExpression.hello), music.PlaybackMode.InBackground)
      input.onButtonPressed(Button.A, function () { basic.clearScreen(); music.stopAllSounds() })
    `);
    expect(s.shownIcon()).toBe("Heart");
    expect(s.sounds).toEqual(["hello"]);
    expect(s.soundsStopped).toBe(0);
    expect(s.speakerEnabled).toBe(true);
    expect(s.audioPinEnabled).toBe(false);
    s.pressButton("A", "click");
    expect(s.shownIcon()).toBeUndefined();
    expect(s.displayCalls).toEqual(["Heart", "clear"]);
    expect(s.soundsStopped).toBe(1);
  });

  it("leaves the audio settings and display unset until the program sets them", () => {
    const s = load(`serial.writeLine("hi")`);
    expect(s.speakerEnabled).toBeUndefined();
    expect(s.audioPinEnabled).toBeUndefined();
    expect(s.shownIcon()).toBeUndefined();
    expect(s.displayCalls).toEqual([]);
    expect(s.servoAngle("P0")).toBeUndefined();
  });

  it("refuses calls that would block the caller", () => {
    expect(() => load(`basic.showIcon(IconNames.Heart)`)).toThrow("basic.showIcon");
    expect(() => load(`
      music.play(music.builtinPlayableSoundEffect(soundExpression.hello), music.PlaybackMode.UntilDone)
    `)).toThrow("music.play");
  });
});
