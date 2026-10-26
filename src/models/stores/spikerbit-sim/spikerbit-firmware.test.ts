import * as path from "path";
import {
  kCcDeviceProtocolName, kCcDeviceProtocolVersion, parseCcDeviceLine, withChecksum
} from "../cc-device-protocol";
import { kSpikerbitFirmwareVersion } from "../spikerbit-device";
import { MakeCodeSim } from "./makecode-sim";

// The Spiker:bit firmware's side of the CC Device Protocol, run on the simulated MakeCode runtime.

const firmwarePath = path.join(__dirname, "../../../plugins/dataflow/firmware/spikerbit-clue.ts");
// The hello line the firmware must send, built from the constants Dataflow checks it against.
const kHello =
  `hello protocol:${kCcDeviceProtocolName} version:${kCcDeviceProtocolVersion} device:spikerbit ` +
  `firmware:${kSpikerbitFirmwareVersion}`;

// The firmware's displays and its identify sound.
const kWaitingIcon = "Asleep";
const kFoundIcon = "Surprised";
const kConnectedIcon = "Yes";
const kIdentifyIcon = "Heart";
const kStreamingIcon = "Chessboard";
const kIdentifySound = "hello";
// How long the connected and identify icons stay.
const kIconMs = 3000;

interface TimedLine { at: number; line: string }

function boot(hardwareVersion?: string) {
  const sim = MakeCodeSim.load(firmwarePath, { hardwareVersion });
  sim.setAnalog("P1", 511);
  return sim;
}

// The board reads a line at its next scheduler step, so lines sent with no `run` between them
// arrive together.
const send = (sim: MakeCodeSim, command: string) => sim.sendSerial(`${withChecksum(command)}\n`);

// Sends one command and lets the board handle it without moving the clock.
function handle(sim: MakeCodeSim, command: string) {
  send(sim, command);
  sim.advance(0);
}

const isReading = (line: string) => parseCcDeviceLine(line)?.kind === "reading";

// A line's body, after checking that it ends in a valid checksum.
function body(line: string) {
  expect(line).toMatch(/\*[0-9A-F]{2}$/);
  expect(parseCcDeviceLine(line)).not.toBeNull();
  return line.slice(0, line.lastIndexOf("*"));
}

// Runs the sim for `ms` in 10 ms steps and returns each line written, with the time it was written.
function run(sim: MakeCodeSim, ms: number): TimedLine[] {
  const lines: TimedLine[] = [];
  for (let elapsed = 0; elapsed < ms; elapsed += 10) {
    sim.advance(10);
    sim.takeSerialLines().forEach(line => lines.push({ at: sim.now, line }));
  }
  return lines;
}

const readings = (lines: TimedLine[]) => lines.filter(l => isReading(l.line));
const replies = (lines: TimedLine[]) => lines.filter(l => !isReading(l.line)).map(l => body(l.line));

// Sends one command and returns the bodies of the replies written in the next 100 ms.
function exchange(sim: MakeCodeSim, command: string) {
  send(sim, command);
  return replies(run(sim, 100));
}

// A booted board with session 7 open and its reply consumed.
function inSession(timeout?: number) {
  const sim = boot();
  run(sim, 100);
  expect(exchange(sim, `open session:7${timeout ? ` timeout:${timeout}` : ""} #1`)).toEqual(["ok #1"]);
  return sim;
}

describe("Spiker:bit firmware", () => {
  it("is silent after power-up and never sends the v1–v3 banner", () => {
    const sim = boot();
    sim.advance(1000);
    expect(sim.takeSerialOutput()).toBe("");

    sim.sendSerial("?\n");
    send(sim, "stream");
    sim.advance(500);
    const output = sim.takeSerialOutput();
    expect(output).toContain("hello ");
    expect(output).not.toContain("CLUE-SPIKERBIT v");
  });

  it("answers ? with the hello line in every state, with or without a checksum", () => {
    const sim = boot();
    expect(exchange(sim, "?")).toEqual([kHello]);
    sim.sendSerial("?\n");
    expect(replies(run(sim, 100))).toEqual([kHello]);

    send(sim, "open session:7 #1");
    expect(exchange(sim, "?")).toEqual(["ok #1", kHello]);
    send(sim, "close session:7");

    send(sim, "stream");
    expect(exchange(sim, "?")).toEqual([kHello]);
    expect(readings(run(sim, 500)).length).toBeGreaterThan(0);
  });

  it("puts a valid checksum on every line it writes", () => {
    const sim = boot();
    ["?", "open session:7 #1", "ping session:7 #2", "ping session:9 #3", "foo", "servo:abc #4", "stream #5"]
      .forEach(command => send(sim, command));
    sim.sendSerial("ping #6*00\n");
    const lines = run(sim, 1000);
    expect(readings(lines).length).toBeGreaterThan(5);
    lines.forEach(({ line }) => {
      expect(line).toMatch(/^[^*]+\*[0-9A-F]{2}$/);
      expect(parseCcDeviceLine(line)).not.toBeNull();
    });
  });

  it("opens a session and sends a reading every 100 ms", () => {
    const sim = boot();
    run(sim, 100);
    send(sim, "open session:7 #1");
    const lines = run(sim, 2000);
    expect(replies(lines)).toEqual(["ok #1"]);
    const times = readings(lines).map(l => l.at);
    expect(times.length).toBeGreaterThanOrEqual(19);
    expect(times.length).toBeLessThanOrEqual(21);
    times.slice(1).forEach((at, i) => {
      expect(at - times[i]).toBeGreaterThanOrEqual(80);
      expect(at - times[i]).toBeLessThanOrEqual(120);
    });
    readings(lines).forEach(({ line }) => expect(body(line)).toMatch(/^emg:\d+$/));
  });

  it("keeps readings 100 ms apart on average when the loop's passes run late", () => {
    const sim = boot();
    expect(exchange(sim, "stream #1")).toEqual(["ok #1"]);
    // Each step lets one pass run, then holds the board until 3 ms after the next pass was due,
    // so passes are 23 ms apart. Restarting the interval from each reading would space them 115.
    const times: number[] = [];
    while (times.length < 100) {
      sim.advance(19);
      sim.takeSerialLines().filter(isReading).forEach(() => times.push(sim.now));
      sim.stall(4);
    }
    const average = (times[times.length - 1] - times[0]) / (times.length - 1);
    expect(average).toBeGreaterThan(99.5);
    expect(average).toBeLessThan(100.5);
  });

  it("sends one reading after a stall, then readings 100 ms apart from it", () => {
    const sim = boot();
    expect(exchange(sim, "stream #1")).toEqual(["ok #1"]);
    run(sim, 1000);
    sim.stall(250);
    const stallEnd = sim.now;
    const times = readings(run(sim, 1000)).map(l => l.at);
    // Readings start over from the end of the stall rather than catching up.
    expect(times.filter(at => at - stallEnd < 100)).toHaveLength(1);
    expect(times.length).toBeGreaterThanOrEqual(9);
    times.slice(1).forEach((at, i) => {
      expect(at - times[i]).toBeGreaterThanOrEqual(80);
      expect(at - times[i]).toBeLessThanOrEqual(120);
    });
  });

  it("keeps a session pinged every second alive past its timeout", () => {
    const sim = inSession();
    for (let second = 0; second < 10; second++) {
      run(sim, 900);
      expect(exchange(sim, `ping session:7 #${second + 2}`)).toEqual([`ok #${second + 2}`]);
    }
    expect(readings(run(sim, 1000)).length).toBeGreaterThanOrEqual(9);
  });

  it("ends a session that isn't pinged 5000 ms after the open", () => {
    const sim = boot();
    run(sim, 100);
    send(sim, "open session:7 #1");
    const openedAt = sim.now;
    const lines = run(sim, 6000);
    const times = readings(lines).map(l => l.at);
    // The last reading comes within one reading interval of the timeout.
    expect(times[times.length - 1]).toBeGreaterThanOrEqual(openedAt + 4900);
    expect(times[times.length - 1]).toBeLessThanOrEqual(openedAt + 5000);
    expect(run(sim, 1000)).toEqual([]);
    expect(exchange(sim, "ping session:7 #3")).toEqual(["err #3 nosession"]);
  });

  it("ends a lapsed session before a ping or long press that arrives ahead of the loop's next pass", () => {
    // Opens session 7 at 110 ms with a 1000 ms timeout and runs to its lapse at 1110 ms. The loop's
    // passes fall on multiples of 20 ms, so none has ended the session yet.
    const atLapse = () => {
      const sim = boot();
      run(sim, 110);
      send(sim, "open session:7 timeout:1000 #1");
      expect(replies(run(sim, 1000))).toEqual(["ok #1"]);
      expect(sim.now).toBe(1110);
      expect(sim.shownIcon()).toBe(kConnectedIcon);
      return sim;
    };

    expect(exchange(atLapse(), "ping session:7 #2")).toEqual(["err #2 nosession"]);

    const pressed = atLapse();
    pressed.pressButton("A", "longClick");
    expect(pressed.shownIcon()).toBe(kStreamingIcon);
  });

  it("uses the timeout given in open, and rejects one out of range or a missing session", () => {
    const sim = boot();
    run(sim, 100);
    send(sim, "open session:7 timeout:1000 #4");
    const openedAt = sim.now;
    const lines = run(sim, 2000);
    expect(replies(lines)).toEqual(["ok #4"]);
    const times = readings(lines).map(l => l.at);
    expect(times[times.length - 1]).toBeGreaterThanOrEqual(openedAt + 900);
    expect(times[times.length - 1]).toBeLessThanOrEqual(openedAt + 1000);

    expect(exchange(sim, "open session:7 timeout:999 #5")).toEqual(["err #5 value"]);
    expect(exchange(sim, "open session:7 timeout:60001 #6")).toEqual(["err #6 value"]);
    expect(exchange(sim, "open session:7 timeout:abc #7")).toEqual(["err #7 value"]);
    expect(exchange(sim, "open")).toEqual(["err value"]);
    expect(exchange(sim, "open timeout:2000 #8")).toEqual(["err #8 value"]);
    expect(exchange(sim, "open session:0 #9")).toEqual(["err #9 value"]);
    expect(exchange(sim, "open session:65536 #10")).toEqual(["err #10 value"]);
    expect(run(sim, 500)).toEqual([]);

    expect(exchange(sim, "open session:65535 timeout:60000 #11")).toEqual(["ok #11"]);
    expect(readings(run(sim, 10000)).length).toBeGreaterThanOrEqual(99);
  });

  it("refuses a ping or close for another session and keeps its own", () => {
    const sim = inSession();
    expect(exchange(sim, "ping session:9 #5")).toEqual(["err #5 othersession"]);
    expect(exchange(sim, "close session:9")).toEqual(["err othersession"]);
    expect(readings(run(sim, 500)).length).toBeGreaterThanOrEqual(4);
    expect(exchange(sim, "ping session:7 #6")).toEqual(["ok #6"]);
  });

  it("answers a bare ping in every state without changing anything", () => {
    const sim = boot();
    expect(exchange(sim, "ping #6")).toEqual(["ok #6"]);
    expect(exchange(sim, "ping")).toEqual([]);
    expect(run(sim, 500)).toEqual([]);

    send(sim, "open session:7 timeout:1000 #1");
    run(sim, 600);
    expect(exchange(sim, "ping #7")).toEqual(["ok #7"]);
    // The bare ping didn't extend the session: it still lapses 1000 ms after the open.
    run(sim, 400);
    expect(run(sim, 500)).toEqual([]);

    send(sim, "stream");
    run(sim, 100);
    expect(exchange(sim, "ping #8")).toEqual(["ok #8"]);
    expect(readings(run(sim, 500)).length).toBeGreaterThanOrEqual(4);
  });

  it("ends the session at once on close, and refuses close outside a session", () => {
    const sim = inSession();
    run(sim, 300);
    send(sim, "close session:7 #2");
    const lines = run(sim, 1000);
    expect(lines.map(l => body(l.line))).toEqual(["ok #2"]);
    expect(exchange(sim, "close session:7 #3")).toEqual(["err #3 nosession"]);
    expect(exchange(sim, "ping session:7")).toEqual(["err nosession"]);
  });

  it("starts a fresh session on open during a session, and takes over from free-run", () => {
    const sim = inSession(60000);
    expect(exchange(sim, "open session:8 #2")).toEqual(["ok #2"]);
    expect(exchange(sim, "ping session:7 #3")).toEqual(["err #3 othersession"]);
    expect(exchange(sim, "ping session:8 #4")).toEqual(["ok #4"]);
    // The new session has the default timeout, not the old one's 60000.
    run(sim, 5100);
    expect(exchange(sim, "ping session:8 #5")).toEqual(["err #5 nosession"]);

    expect(exchange(sim, "stream #6")).toEqual(["ok #6"]);
    expect(exchange(sim, "open session:9 timeout:1000 #7")).toEqual(["ok #7"]);
    run(sim, 1000);
    // Idle, not back to free-run.
    expect(run(sim, 1000)).toEqual([]);
  });

  it("streams on stream until stop, and refuses both during a session", () => {
    const sim = boot();
    expect(exchange(sim, "stream #1")).toEqual(["ok #1"]);
    const streamed = run(sim, 10000);
    expect(readings(streamed).length).toBeGreaterThanOrEqual(99);
    expect(readings(streamed)[readings(streamed).length - 1].at).toBeGreaterThan(sim.now - 120);
    expect(exchange(sim, "stop #2")).toEqual(["ok #2"]);
    expect(run(sim, 1000)).toEqual([]);

    send(sim, "open session:7 #3");
    run(sim, 100);
    expect(exchange(sim, "stream #4")).toEqual(["err #4 insession"]);
    expect(exchange(sim, "stop")).toEqual(["err insession"]);
    expect(readings(run(sim, 500)).length).toBeGreaterThanOrEqual(4);
    expect(exchange(sim, "ping session:7 #5")).toEqual(["ok #5"]);
  });

  it("sets the servo, replying only when asked, clamping, and refusing a bad value", () => {
    const sim = boot();
    expect(exchange(sim, "servo:90")).toEqual([]);
    expect(sim.servoAngle("P0")).toBe(90);
    expect(exchange(sim, "servo:45 #2")).toEqual(["ok #2"]);
    expect(sim.servoAngle("P0")).toBe(45);
    expect(exchange(sim, "servo:200")).toEqual([]);
    expect(sim.servoAngle("P0")).toBe(180);
    expect(exchange(sim, "servo:-5")).toEqual([]);
    expect(sim.servoAngle("P0")).toBe(0);
    expect(exchange(sim, "servo:60.6")).toEqual([]);
    expect(sim.servoAngle("P0")).toBe(61);
    expect(exchange(sim, "servo:abc")).toEqual(["err value"]);
    expect(exchange(sim, "servo:.5")).toEqual(["err value"]);
    expect(exchange(sim, "servo: #3")).toEqual(["err #3 value"]);
    expect(sim.servoAngle("P0")).toBe(61);
  });

  it("checks the whole line before applying any of it", () => {
    const sim = boot();
    send(sim, "servo:30");
    expect(exchange(sim, "servo:90 bogus:1 #8")).toEqual(["err #8 unknown"]);
    expect(exchange(sim, "open session:7 bogus:1 #9")).toEqual(["err #9 unknown"]);
    expect(exchange(sim, "stream extra")).toEqual(["err unknown"]);
    expect(sim.servoAngle("P0")).toBe(30);
    expect(run(sim, 500)).toEqual([]);
  });

  it("refuses a line with a wrong checksum and accepts a missing or lowercase one", () => {
    const sim = boot();
    const good = withChecksum("servo:45 #3");
    const wrong = `${good.slice(0, -2)}${good.slice(-2) === "00" ? "01" : "00"}`;
    sim.sendSerial(`${wrong}\n`);
    expect(replies(run(sim, 100))).toEqual(["err checksum"]);
    sim.sendSerial("servo:45 #3*zz\n");
    expect(replies(run(sim, 100))).toEqual(["err checksum"]);
    // The right checksum, 7C, with a third digit: a checksum is exactly two.
    sim.sendSerial("servo:48 #4*7C0\n");
    expect(replies(run(sim, 100))).toEqual(["err checksum"]);
    expect(sim.servoAngle("P0")).toBeUndefined();

    sim.sendSerial("servo:45 #3\n");
    expect(replies(run(sim, 100))).toEqual(["ok #3"]);
    expect(sim.servoAngle("P0")).toBe(45);

    expect(withChecksum("servo:48 #4")).toBe("servo:48 #4*7C");
    sim.sendSerial("servo:48 #4*7c\n");
    expect(replies(run(sim, 100))).toEqual(["ok #4"]);
    expect(sim.servoAngle("P0")).toBe(48);
  });

  it("refuses an unknown verb, adding #n only when the command had one, and a #n that isn't a number", () => {
    const sim = boot();
    expect(exchange(sim, "foo #9")).toEqual(["err #9 unknown"]);
    expect(exchange(sim, "ping #abc")).toEqual(["err value"]);
    expect(exchange(sim, "foo")).toEqual(["err unknown"]);
    expect(exchange(sim, "caps #10")).toEqual(["err #10 unknown"]);
    expect(exchange(sim, "identify extra:1 #11")).toEqual(["err #11 unknown"]);
  });

  it("accepts \\r\\n and \\n line endings", () => {
    const sim = boot();
    sim.sendSerial(`${withChecksum("ping #1")}\r\n`);
    sim.sendSerial(`${withChecksum("ping #2")}\n`);
    sim.sendSerial("ping #3\r\n");
    expect(replies(run(sim, 100))).toEqual(["ok #1", "ok #2", "ok #3"]);
  });

  it("answers every line of a burst that arrives before it reads the first", () => {
    const sim = boot();
    const commands = [
      "open session:7 timeout:60000 #1", "servo:90 #2", "ping session:7 #3", "identify #4", "ping #5",
      "servo:45.5 #6", "?"
    ];
    const burst = commands.map(command => `${withChecksum(command)}\n`).join("");
    // Nearly fills the 128-character receive buffer.
    expect(burst.length).toBeGreaterThan(110);
    sim.sendSerial(burst);
    expect(replies(run(sim, 100))).toEqual(["ok #1", "ok #2", "ok #3", "ok #4", "ok #5", "ok #6", kHello]);
    expect(sim.servoAngle("P0")).toBe(46);
  });

  it("answers a line that overflows the receive buffer with err value, and every line after it as usual", () => {
    const sim = boot();
    // The 128-character buffer keeps the first 128 x's and drops the rest, the newline included.
    sim.sendSerial(`${"x".repeat(130)}\n`);
    expect(replies(run(sim, 100))).toEqual(["err value"]);
    expect(exchange(sim, "ping #4")).toEqual(["ok #4"]);
    expect(exchange(sim, "ping #5")).toEqual(["ok #5"]);
    send(sim, "ping #6");
    send(sim, "ping #7");
    expect(replies(run(sim, 100))).toEqual(["ok #6", "ok #7"]);
    send(sim, "servo:90");
    send(sim, "ping #9");
    expect(replies(run(sim, 100))).toEqual(["ok #9"]);
    expect(sim.servoAngle("P0")).toBe(90);

    // In a burst that overflows, the lines that fit are handled and the one cut off is answered
    // err value. The line after it is dropped whole.
    sim.sendSerial(`${withChecksum("ping #10")}\n${"x".repeat(200)}\n${withChecksum("ping #11")}\n`);
    expect(replies(run(sim, 100))).toEqual(["ok #10", "err value"]);
    expect(exchange(sim, "ping #12")).toEqual(["ok #12"]);

    // A line that fills the buffer exactly, with its newline, fits.
    const fits = `ping${" ".repeat(120)}#13\n`;
    expect(fits.length).toBe(128);
    sim.sendSerial(fits);
    expect(replies(run(sim, 100))).toEqual(["ok #13"]);
  });

  it("joins a line that arrives over several reads, unless it is too long for the receive buffer", () => {
    const sim = boot();
    sim.sendSerial(`${withChecksum("ping #1")}\nping`);
    expect(replies(run(sim, 100))).toEqual(["ok #1"]);
    sim.sendSerial(" #2\n");
    expect(replies(run(sim, 100))).toEqual(["ok #2"]);

    // A 128-character line, which doesn't fit with its newline. The parser skips the spaces, so
    // only its length keeps it from setting the servo.
    const spaces = " ".repeat(59);
    sim.sendSerial(`${withChecksum("ping #3")}\nservo:90${spaces}`);
    expect(replies(run(sim, 100))).toEqual(["ok #3"]);
    sim.sendSerial(`${spaces}#4\n`);
    expect(replies(run(sim, 100))).toEqual(["err value"]);
    expect(sim.servoAngle("P0")).toBeUndefined();
    expect(exchange(sim, "ping #5")).toEqual(["ok #5"]);
  });

  it("leaves the servo where it was when a session ends", () => {
    const sim = inSession(1000);
    send(sim, "servo:120");
    run(sim, 1500);
    expect(sim.servoAngle("P0")).toBe(120);

    send(sim, "open session:8 #2");
    send(sim, "servo:70");
    send(sim, "close session:8");
    run(sim, 100);
    expect(sim.servoAngle("P0")).toBe(70);
  });
});

describe("Spiker:bit firmware reset (!!)", () => {
  it("ends a session on !! #n, writing an empty line and then the ok", () => {
    const sim = inSession(60000);
    run(sim, 300);
    sim.takeSerialOutput();
    send(sim, "!! #2");
    sim.advance(100);
    expect(sim.takeSerialOutput()).toBe(`\r\n${withChecksum("ok #2")}\r\n`);
    expect(sim.shownIcon()).toBe(kWaitingIcon);
    expect(run(sim, 1000)).toEqual([]);
    expect(exchange(sim, "ping session:7 #3")).toEqual(["err #3 nosession"]);
  });

  it("writes nothing for !! without #n, and ends a session or free-run all the same", () => {
    const session = inSession();
    run(session, 300);
    send(session, "!!");
    expect(run(session, 1000)).toEqual([]);
    expect(session.shownIcon()).toBe(kWaitingIcon);

    const freeRun = boot();
    expect(exchange(freeRun, "stream #1")).toEqual(["ok #1"]);
    expect(readings(run(freeRun, 500)).length).toBeGreaterThanOrEqual(4);
    send(freeRun, "!!");
    expect(run(freeRun, 1000)).toEqual([]);
    expect(freeRun.shownIcon()).toBe(kWaitingIcon);

    const idle = boot();
    send(idle, "!!");
    expect(run(idle, 500)).toEqual([]);
  });

  it("shows the waiting icon on !! while idle with the found icon", () => {
    const sim = boot();
    expect(exchange(sim, "?")).toEqual([kHello]);
    expect(sim.shownIcon()).toBe(kFoundIcon);
    handle(sim, "!!");
    expect(sim.shownIcon()).toBe(kWaitingIcon);
  });

  it("stops the identify sound and icon on !!", () => {
    const sim = boot();
    handle(sim, "identify");
    expect(sim.shownIcon()).toBe(kIdentifyIcon);
    expect(sim.soundsStopped).toBe(0);
    handle(sim, "!!");
    expect(sim.soundsStopped).toBe(1);
    expect(sim.shownIcon()).toBe(kWaitingIcon);
    run(sim, kIconMs);
    expect(sim.shownIcon()).toBe(kWaitingIcon);
  });

  it("checks the checksum on !!", () => {
    expect(withChecksum("!!")).toBe("!!*00");
    const wrong = inSession();
    run(wrong, 300);
    wrong.sendSerial("!!*01\n");
    expect(replies(run(wrong, 100))).toEqual(["err checksum"]);
    expect(readings(run(wrong, 500)).length).toBeGreaterThanOrEqual(4);

    const right = inSession();
    run(right, 300);
    right.sendSerial("!!*00\n");
    expect(run(right, 1000)).toEqual([]);
  });

  it("refuses any other line whose verb contains ! with err unknown, changing nothing", () => {
    const sim = inSession();
    expect(exchange(sim, "! #2")).toEqual(["err #2 unknown"]);
    expect(exchange(sim, "!!! #3")).toEqual(["err #3 unknown"]);
    expect(exchange(sim, "!! x:1 #4")).toEqual(["err #4 unknown"]);
    sim.sendSerial("!!!\n");
    expect(replies(run(sim, 100))).toEqual(["err unknown"]);
    expect(readings(run(sim, 500)).length).toBeGreaterThanOrEqual(4);
    expect(exchange(sim, "ping session:7 #5")).toEqual(["ok #5"]);
  });

  it("still sends the replies to commands that arrived before !! in the same write", () => {
    const sim = inSession();
    run(sim, 300);
    sim.takeSerialOutput();
    send(sim, "ping session:7 #2");
    send(sim, "!! #3");
    sim.advance(100);
    expect(sim.takeSerialOutput()).toBe(`${withChecksum("ok #2")}\r\n\r\n${withChecksum("ok #3")}\r\n`);
  });

  it("answers a host's connect sequence, !! #n then a bare ?, from free-run", () => {
    const sim = boot();
    expect(exchange(sim, "stream #1")).toEqual(["ok #1"]);
    run(sim, 500);
    send(sim, "!! #2");
    sim.sendSerial("?\n");
    sim.advance(100);
    expect(sim.takeSerialOutput()).toBe(`\r\n${withChecksum("ok #2")}\r\n${withChecksum(kHello)}\r\n`);
    expect(sim.shownIcon()).toBe(kFoundIcon);
  });
});

describe("Spiker:bit firmware display, sound and buttons", () => {
  it("shows the waiting icon after power-up and the found icon after ?", () => {
    const sim = boot();
    expect(sim.shownIcon()).toBe(kWaitingIcon);
    run(sim, 1000);
    expect(sim.shownIcon()).toBe(kWaitingIcon);
    expect(exchange(sim, "?")).toEqual([kHello]);
    expect(sim.shownIcon()).toBe(kFoundIcon);
  });

  it("shows the connected icon on open for 3000 ms, then draws nothing for the rest of the session", () => {
    const sim = boot();
    exchange(sim, "?");
    handle(sim, "open session:7 #1");
    expect(sim.shownIcon()).toBe(kConnectedIcon);
    run(sim, kIconMs - 10);
    expect(sim.shownIcon()).toBe(kConnectedIcon);
    run(sim, 40);
    expect(sim.shownIcon()).toBeUndefined();

    const drawn = sim.displayCalls.length;
    for (let second = 0; second < 10; second++) {
      ["?", `ping session:7 #${second + 2}`, "servo:90", "stream", "stop", "ping #99", "foo"]
        .forEach(command => send(sim, command));
      run(sim, 1000);
    }
    expect(sim.displayCalls.length).toBe(drawn);
  });

  it("shows the waiting icon and stops any sound when a session ends", () => {
    const sim = inSession();
    expect(exchange(sim, "identify #2")).toEqual(["ok #2"]);
    expect(sim.soundsStopped).toBe(0);
    handle(sim, "close session:7");
    expect(sim.shownIcon()).toBe(kWaitingIcon);
    expect(sim.soundsStopped).toBe(1);
    // The identify icon's time running out doesn't change the display.
    run(sim, kIconMs);
    expect(sim.shownIcon()).toBe(kWaitingIcon);

    send(sim, "open session:8 #3");
    run(sim, 5100);
    expect(sim.shownIcon()).toBe(kWaitingIcon);
    expect(sim.soundsStopped).toBe(2);
  });

  it("answers identify with its icon and one sound from the speaker alone, then shows what the state calls for", () => {
    const identify = (sim: MakeCodeSim, command: string, reply: string[], after: string | undefined) => {
      const soundsBefore = sim.sounds.length;
      handle(sim, command);
      expect(sim.shownIcon()).toBe(kIdentifyIcon);
      expect(replies(run(sim, kIconMs - 10))).toEqual(reply);
      expect(sim.shownIcon()).toBe(kIdentifyIcon);
      run(sim, 40);
      expect(sim.shownIcon()).toBe(after);
      expect(sim.sounds.slice(soundsBefore)).toEqual([kIdentifySound]);
      expect(sim.speakerEnabled).toBe(true);
      expect(sim.audioPinEnabled).toBe(false);
    };

    const idle = boot();
    identify(idle, "identify #5", ["ok #5"], kWaitingIcon);
    exchange(idle, "?");
    identify(idle, "identify", [], kFoundIcon);

    identify(inSession(), "identify #6", ["ok #6"], undefined);

    const freeRun = boot();
    expect(exchange(freeRun, "stream #1")).toEqual(["ok #1"]);
    identify(freeRun, "identify #7", ["ok #7"], kStreamingIcon);
  });

  it("keeps the identify icon its full time through ? and stream, and the found icon through stop", () => {
    const idle = boot();
    handle(idle, "identify");
    handle(idle, "?");
    expect(idle.shownIcon()).toBe(kIdentifyIcon);
    run(idle, kIconMs - 10);
    expect(idle.shownIcon()).toBe(kIdentifyIcon);
    run(idle, 40);
    expect(idle.shownIcon()).toBe(kFoundIcon);

    const freeRun = boot();
    expect(exchange(freeRun, "stream #1")).toEqual(["ok #1"]);
    handle(freeRun, "identify");
    expect(exchange(freeRun, "stream #2")).toEqual(["ok #2"]);
    expect(freeRun.shownIcon()).toBe(kIdentifyIcon);

    const found = boot();
    exchange(found, "?");
    expect(exchange(found, "stop #3")).toEqual(["ok #3"]);
    expect(found.shownIcon()).toBe(kFoundIcon);
  });

  it("shows the identify icon without a sound on a micro:bit V1, leaving its speaker setting alone", () => {
    const sim = boot("1");
    expect(exchange(sim, "identify #4")).toEqual(["ok #4"]);
    expect(sim.shownIcon()).toBe(kIdentifyIcon);
    run(sim, kIconMs);
    expect(sim.shownIcon()).toBe(kWaitingIcon);
    expect(sim.sounds).toEqual([]);
    expect(sim.speakerEnabled).toBeUndefined();
    expect(sim.audioPinEnabled).toBe(false);

    send(sim, "open session:7 #5");
    handle(sim, "close session:7 #6");
    expect(sim.soundsStopped).toBe(0);
  });

  it("shows the streaming icon on stream and the waiting icon on stop", () => {
    const sim = boot();
    exchange(sim, "?");
    expect(exchange(sim, "stream #1")).toEqual(["ok #1"]);
    expect(sim.shownIcon()).toBe(kStreamingIcon);
    expect(exchange(sim, "stop #2")).toEqual(["ok #2"]);
    expect(sim.shownIcon()).toBe(kWaitingIcon);
  });

  it("starts and stops free-run on a long press of A outside a session, and ignores it in one", () => {
    const sim = boot();
    sim.pressButton("A", "longClick");
    expect(sim.shownIcon()).toBe(kStreamingIcon);
    expect(readings(run(sim, 1000)).length).toBeGreaterThanOrEqual(9);
    sim.pressButton("A", "longClick");
    expect(sim.shownIcon()).toBe(kWaitingIcon);
    expect(run(sim, 1000)).toEqual([]);

    const session = inSession();
    run(session, kIconMs);
    const drawn = session.displayCalls.length;
    session.pressButton("A", "longClick");
    expect(readings(run(session, 500)).length).toBeGreaterThanOrEqual(4);
    expect(exchange(session, "ping session:7 #2")).toEqual(["ok #2"]);
    expect(session.displayCalls.length).toBe(drawn);
    // When the session lapses, the board goes to idle, not free-run.
    run(session, 5100);
    expect(run(session, 1000)).toEqual([]);
  });

  it("ignores a click of A in every state", () => {
    const sim = boot();
    const clickA = () => {
      const drawn = sim.displayCalls.length;
      sim.pressButton("A", "click");
      expect(sim.displayCalls.length).toBe(drawn);
    };

    clickA();
    expect(run(sim, 1000)).toEqual([]);

    expect(exchange(sim, "stream #1")).toEqual(["ok #1"]);
    clickA();
    expect(readings(run(sim, 1000)).length).toBeGreaterThanOrEqual(9);
    expect(sim.shownIcon()).toBe(kStreamingIcon);

    expect(exchange(sim, "open session:7 #2")).toEqual(["ok #2"]);
    run(sim, kIconMs);
    clickA();
    expect(exchange(sim, "ping session:7 #3")).toEqual(["ok #3"]);
  });
});
