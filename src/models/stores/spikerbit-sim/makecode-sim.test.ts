import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { MakeCodeSim } from "./makecode-sim";

const firmwarePath = path.join(__dirname, "../../../plugins/dataflow/firmware/spikerbit-clue.ts");
const sim = () => MakeCodeSim.load(firmwarePath);

// The emg values in a batch of serial lines.
const emgValues = (lines: string[]) =>
  lines.filter(l => l.startsWith("emg:")).map(l => Number(l.slice("emg:".length)));

describe("MakeCodeSim running the Spiker:bit firmware", () => {
  it("runs the v3 startup banner and streams emg every 100 ms", () => {
    const s = sim();
    s.setAnalog("P1", 511);
    s.advance(1000);
    const lines = s.takeSerialLines();
    expect(lines[0]).toBe("CLUE-SPIKERBIT v3");
    expect(lines.filter(l => l.startsWith("emg:")).length).toBeGreaterThanOrEqual(9);
  });

  it("answers ? on the next loop pass", () => {
    const s = sim();
    s.advance(10);
    s.takeSerialOutput();
    s.sendSerial("?\n");
    s.advance(150);
    expect(s.takeSerialLines()).toContain("CLUE-SPIKERBIT v3");
  });

  it("drives the servo from a bare angle", () => {
    const s = sim();
    s.sendSerial("90\n");
    expect(s.servoAngle("P0")).toBe(90);
  });

  it("feeds the sampler from the analog pin", () => {
    const steady = sim();
    steady.setAnalog("P1", 500);
    steady.advance(3000);
    const steadyEmg = emgValues(steady.takeSerialLines());

    const alternating = sim();
    let high = false;
    alternating.setAnalog("P1", () => {
      high = !high;
      return high ? 700 : 300;
    });
    alternating.advance(3000);
    const alternatingEmg = emgValues(alternating.takeSerialLines());

    // A steady signal leaves only the baseline's remaining error; a 300/700 swing around 500
    // is a 200-count deviation on every sample.
    expect(steadyEmg[steadyEmg.length - 1]).toBeLessThan(50);
    expect(alternatingEmg[alternatingEmg.length - 1]).toBeGreaterThan(150);
  });

  it("ends each line with \\r\\n and clears what it has handed out", () => {
    const s = sim();
    expect(s.takeSerialOutput()).toBe("CLUE-SPIKERBIT v3\r\n");
    expect(s.takeSerialOutput()).toBe("");
    expect(s.takeSerialLines()).toEqual([]);
  });
});

describe("MakeCodeSim runtime", () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "makecode-sim-")); });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  const load = (source: string) => {
    const file = path.join(dir, "program.ts");
    fs.writeFileSync(file, source);
    return MakeCodeSim.load(file);
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

  it("runs fibers due at the same time in the order they were scheduled", () => {
    const s = load(`
      basic.forever(function () { serial.writeLine("one"); basic.pause(10) })
      basic.forever(function () { serial.writeLine("two"); basic.pause(10) })
    `);
    s.advance(30);
    expect(s.takeSerialLines()).toEqual(["one", "two", "one", "two"]);
  });

  it("runs onDataReceived once per delimiter, handing each call the text before it", () => {
    const s = load(`
      serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function () {
        serial.writeLine("got [" + serial.readUntil(serial.delimiters(Delimiters.NewLine)) + "]")
      })
    `);
    s.sendSerial("a\nb");
    expect(s.takeSerialLines()).toEqual(["got [a]"]);
    s.sendSerial("c\nd\n");
    expect(s.takeSerialLines()).toEqual(["got [bc]", "got [d]"]);
  });

  const echoLines = `
    serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function () {
      serial.writeLine("got [" + serial.readUntil(serial.delimiters(Delimiters.NewLine)) + "]")
    })
  `;
  const line30 = "abcdefghijklmnopqrstuvwxyz0123";

  it("truncates a line longer than the default 20-character receive buffer", () => {
    const s = load(echoLines);
    s.sendSerial(`${line30}\n`);
    // The buffer keeps the first 20 characters and drops the rest, the newline included. The
    // dropped newline still raises the event, and the board's readUntil then takes the 20th
    // character as the delimiter.
    expect(s.takeSerialLines()).toEqual([`got [${line30.slice(0, 19)}]`]);
  });

  it("delivers a 30-character line whole after setRxBufferSize(64)", () => {
    const s = load(`serial.setRxBufferSize(64)\n${echoLines}`);
    s.sendSerial(`${line30}\n`);
    expect(s.takeSerialLines()).toEqual([`got [${line30}]`]);
  });

  it("refuses a pause inside an event handler", () => {
    const s = load(`
      serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function () { basic.pause(10) })
    `);
    expect(() => s.sendSerial("x\n")).toThrow("event handlers must not pause");
  });

  it("runs button handlers for the matching button and event only", () => {
    const s = load(`
      input.onButtonPressed(Button.A, function () { serial.writeLine("A click") })
      input.onButtonEvent(Button.A, input.buttonEventValue(ButtonEvent.LongClick), function () {
        serial.writeLine("A long")
      })
      input.onButtonEvent(Button.B, input.buttonEventClick(), function () { serial.writeLine("B click") })
    `);
    s.pressButton("A", "longClick");
    s.pressButton("B", "click");
    s.pressButton("A", "click");
    s.pressButton("B", "longClick");
    expect(s.takeSerialLines()).toEqual(["A long", "B click", "A click"]);
  });

  it("records the icon shown, sounds started and audio settings", () => {
    const s = load(`
      music.setBuiltInSpeakerEnabled(true)
      pins.setAudioPinEnabled(false)
      basic.showIcon(IconNames.Heart, 0)
      music.play(music.builtinPlayableSoundEffect(soundExpression.hello), music.PlaybackMode.InBackground)
      input.onButtonPressed(Button.A, function () { basic.clearScreen(); music.stopAllSounds() })
    `);
    expect(s.shownIcon()).toBe("Heart");
    expect(s.sounds).toEqual(["hello"]);
    expect(s.speakerEnabled).toBe(true);
    expect(s.audioPinEnabled).toBe(false);
    s.pressButton("A", "click");
    expect(s.shownIcon()).toBeUndefined();
  });

  it("leaves the audio settings and display unset until the program sets them", () => {
    const s = load(`serial.writeLine("hi")`);
    expect(s.speakerEnabled).toBeUndefined();
    expect(s.audioPinEnabled).toBeUndefined();
    expect(s.shownIcon()).toBeUndefined();
    expect(s.servoAngle("P0")).toBeUndefined();
  });

  it("refuses calls that would block the caller", () => {
    expect(() => load(`basic.showIcon(IconNames.Heart)`)).toThrow("basic.showIcon");
    expect(() => load(`
      music.play(music.builtinPlayableSoundEffect(soundExpression.hello), music.PlaybackMode.UntilDone)
    `)).toThrow("music.play");
  });
});
