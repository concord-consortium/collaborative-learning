import * as fs from "fs";
import * as ts from "typescript";

// A fake MakeCode micro:bit runtime that runs a MakeCode program's source in Jest, so the
// Spiker:bit firmware's serial protocol can be tested without a board. The MakeCode simulator
// can't receive serial input, and no emulator runs a micro:bit V2 hex.
//
// The source is transpiled with `typescript` (no type check) and its top level runs against
// the fake globals below, at simulated time 0. Only what the firmware calls is faked: any other
// member of a namespace or enum throws `not simulated: <name>`.
//
// Fibers: `basic.forever(fn)` and `control.inBackground(fn)` each become a fiber, and running a
// fiber calls `fn`. `basic.pause(ms)` throws a yield signal that ends the call and wakes the
// fiber `ms` later, so a loop may pause only as its last statement: the next pass is a fresh call
// of `fn`, and code after a pause never runs. A background loop therefore keeps its state outside
// the function. MakeCode's forever loop sleeps 20 ms after every pass, so a `forever` fiber wakes
// 20 ms after its pass ends, on top of any pause the body made. An `inBackground` function that
// returns ends its fiber. One that pauses and then returns would run again from the top here,
// though the board runs it once, so a program times one-off waits (such as how long an icon
// stays) from its forever loop with `control.millis()` deadlines instead.
//
// Events (serial input and buttons) run their handler synchronously and must not pause. A button
// raises the events CODAL does: a click, or a long click when it was held for a second or more.
//
// `control.hardwareVersion()` reports a micro:bit V2 ("2.0") unless the sim is loaded with another
// version; a V1 reports "1". A V1 has no speaker, so on one, turning the speaker on or playing a
// sound expression panics, as pxt-microbit's V1 build does.
//
// Serial input goes through a receive buffer of MakeCode's size, as described at `sendSerial`.

type Thunk = () => void;
type ButtonName = "A" | "B";
type ButtonEventName = "click" | "longClick";

export interface MakeCodeSimOptions {
  hardwareVersion?: string;
}

// How long MakeCode's forever loop sleeps after each pass of its body.
const kForeverSleepMs = 20;
// The receive buffer's capacity until the program calls serial.setRxBufferSize.
const kDefaultRxBufferSize = 20;
// The shortest pause. A fiber that yields with pause(0) still lets this much time pass, about one
// pass of the firmware's sampler on a V2, so a free-running loop can't stop the clock.
const kMinPauseMs = 2;

class YieldSignal {
  constructor(readonly ms: number) {}
}

interface Fiber {
  body: Thunk;
  forever: boolean;
  wakeAt: number;
  order: number;      // ties between fibers due at the same time run in scheduling order
}

const notSimulated = (name: string) => new Error(`not simulated: ${name}`);
const notOnV1 = (name: string) => new Error(`panic: ${name} isn't supported on a micro:bit V1`);

// A namespace or enum whose unknown members throw.
function namespace<T extends Record<string, unknown>>(name: string, members: T): T {
  return new Proxy(members, {
    get(target, key) {
      if (typeof key !== "string" || Object.prototype.hasOwnProperty.call(target, key)) {
        return Reflect.get(target, key);
      }
      throw notSimulated(`${name}.${key}`);
    }
  });
}

// Enum members are their own names, which is all the firmware needs to tell them apart.
function enumeration(name: string, keys: string[]) {
  return namespace(name, Object.fromEntries(keys.map(key => [key, key])));
}

const kAnalogPins = ["P0", "P1", "P2", "P3", "P4", "P10"];
const kDigitalPins = [
  "P0", "P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10", "P11", "P12", "P13", "P14", "P15", "P16",
  "P19", "P20"
];
const kIconNames = [
  "Heart", "SmallHeart", "Yes", "No", "Happy", "Sad", "Confused", "Angry", "Asleep", "Surprised", "Silly",
  "Fabulous", "Meh", "TShirt", "Rollerskate", "Duck", "House", "Tortoise", "Butterfly", "StickFigure", "Ghost",
  "Sword", "Giraffe", "Skull", "Umbrella", "Snake", "Rabbit", "Cow", "QuarterNote", "EigthNote", "Pitchfork",
  "Target", "Triangle", "LeftTriangle", "Chessboard", "Diamond", "SmallDiamond", "Square", "SmallSquare", "Scissors"
];
const kSoundExpressions = [
  "giggle", "happy", "hello", "mysterious", "sad", "slide", "soaring", "spring", "twinkle", "yawn"
];
// Message bus ids and button event values, from pxt-microbit's dal.d.ts and enums.d.ts.
const kButtonIds: Record<ButtonName, number> = { A: 1, B: 2 };
const kButtonEvents: Record<ButtonEventName, number> = { click: 3, longClick: 4 };

export class MakeCodeSim {
  // Every sound started, by name.
  readonly sounds: string[] = [];
  // Every display call in order: an icon's name, or "clear".
  readonly displayCalls: string[] = [];

  private _now = 0;
  private fibers: Fiber[] = [];
  private nextOrder = 0;
  private serialInput = "";
  private rxBufferSize = kDefaultRxBufferSize;
  private serialOutput = "";
  private serialHandler: { delimiters: string, handler: Thunk } | undefined;
  private eventHandlers = new Map<string, Thunk>();
  private analog = new Map<string, () => number>();
  private servos = new Map<string, number>();
  private icon: string | undefined;
  private _speakerEnabled: boolean | undefined;
  private _audioPinEnabled: boolean | undefined;
  private _soundsStopped = 0;

  constructor(private readonly hardwareVersion = "2.0") {}

  static load(sourcePath: string, options: MakeCodeSimOptions = {}): MakeCodeSim {
    const source = fs.readFileSync(sourcePath, "utf8");
    const js = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2019 },
      fileName: sourcePath
    }).outputText;
    const sim = new MakeCodeSim(options.hardwareVersion);
    const globals = sim.globals();
    // The program's top-level declarations become locals of this function, shared by its closures.
    const program = new Function(...Object.keys(globals), js);
    try {
      program(...Object.values(globals));
    } catch (e) {
      if (e instanceof YieldSignal) throw notSimulated("a pause in the top level");
      throw e;
    }
    return sim;
  }

  get now() {
    return this._now;
  }

  private get isV1() {
    return this.hardwareVersion.startsWith("1");
  }

  get speakerEnabled() {
    return this._speakerEnabled;
  }

  get audioPinEnabled() {
    return this._audioPinEnabled;
  }

  // How many times the program called music.stopAllSounds.
  get soundsStopped() {
    return this._soundsStopped;
  }

  advance(ms: number) {
    const until = this._now + ms;
    for (let fiber = this.nextDue(until); fiber; fiber = this.nextDue(until)) {
      this._now = fiber.wakeAt;
      this.runFiber(fiber);
    }
    this._now = until;
  }

  // Follows codal-core's Serial::dataReceived: the receive buffer holds `rxBufferSize` characters
  // and drops any that arrive while it is full. A delimiter raises the data-received event even
  // when it is dropped, because CODAL checks for delimiters before it checks for room.
  sendSerial(text: string) {
    for (const char of text) {
      if (this.serialInput.length < this.rxBufferSize) this.serialInput += char;
      if (this.serialHandler?.delimiters.includes(char)) {
        this.runEvent(this.serialHandler.handler);
      }
    }
  }

  takeSerialOutput() {
    const output = this.serialOutput;
    this.serialOutput = "";
    return output;
  }

  takeSerialLines() {
    const output = this.takeSerialOutput();
    return output ? output.replace(/\r\n$/, "").split("\r\n") : [];
  }

  pressButton(button: ButtonName, event: ButtonEventName) {
    const handler = this.eventHandlers.get(`${kButtonIds[button]}:${kButtonEvents[event]}`);
    if (handler) this.runEvent(handler);
  }

  setAnalog(pin: string, read: number | (() => number)) {
    this.analog.set(pin, typeof read === "number" ? () => read : read);
  }

  servoAngle(pin: string) {
    return this.servos.get(pin);
  }

  shownIcon() {
    return this.icon;
  }

  private nextDue(until: number) {
    let next: Fiber | undefined;
    for (const fiber of this.fibers) {
      if (fiber.wakeAt <= until &&
          (!next || fiber.wakeAt < next.wakeAt || (fiber.wakeAt === next.wakeAt && fiber.order < next.order))) {
        next = fiber;
      }
    }
    return next;
  }

  private schedule(fiber: Fiber, ms: number) {
    fiber.wakeAt = this._now + ms;
    fiber.order = this.nextOrder++;
  }

  private startFiber(body: Thunk, forever: boolean) {
    const fiber: Fiber = { body, forever, wakeAt: 0, order: 0 };
    this.schedule(fiber, 0);
    this.fibers.push(fiber);
  }

  private runFiber(fiber: Fiber) {
    let pausedMs: number | undefined;
    try {
      fiber.body();
    } catch (e) {
      if (!(e instanceof YieldSignal)) throw e;
      pausedMs = e.ms;
    }
    if (fiber.forever) {
      this.schedule(fiber, (pausedMs ?? 0) + kForeverSleepMs);
    } else if (pausedMs !== undefined) {
      this.schedule(fiber, pausedMs);
    } else {
      this.fibers = this.fibers.filter(f => f !== fiber);
    }
  }

  private runEvent(handler: Thunk) {
    try {
      handler();
    } catch (e) {
      if (e instanceof YieldSignal) throw notSimulated("a pause in an event handler; event handlers must not pause");
      throw e;
    }
  }

  // Like pxt-microbit's registerWithDal, a new handler for an event replaces the old one.
  private onEvent(source: number, value: number, handler: Thunk) {
    this.eventHandlers.set(`${source}:${value}`, handler);
  }

  private showIcon(name: string) {
    this.icon = name;
    this.displayCalls.push(name);
  }

  private readUntil(delimiters: string) {
    const index = [...this.serialInput].findIndex(char => delimiters.includes(char));
    if (index >= 0) {
      const line = this.serialInput.slice(0, index);
      this.serialInput = this.serialInput.slice(index + 1);
      return line;
    }
    // No delimiter in the buffer: the line overflowed it and its delimiter was dropped. On the
    // board, readUntil then waits for the next delimiter event and returns the buffer up to its
    // last character, consuming that character as if it were the delimiter (codal-core's
    // Serial::readUntil in SYNC_SLEEP mode, which MakeCode uses). Handlers can't wait here, so
    // the sim returns that text at once. The board loses the next line too, which fills the
    // still-full buffer while readUntil waits; the sim reads that line normally.
    const text = this.serialInput.slice(0, -1);
    this.serialInput = "";
    return text;
  }

  private globals(): Record<string, unknown> {
    const PlaybackMode = enumeration("music.PlaybackMode", ["UntilDone", "InBackground", "LoopingInBackground"]);
    return {
      basic: namespace("basic", {
        forever: (body: Thunk) => this.startFiber(body, true),
        pause: (ms: number) => { throw new YieldSignal(Math.max(ms, kMinPauseMs)); },
        showIcon: (icon: string, interval = 600) => {
          // A nonzero interval pauses the caller, which would hold up the loop it is called from.
          if (interval !== 0) throw notSimulated("basic.showIcon with a pause; pass an interval of 0");
          this.showIcon(icon);
        },
        clearScreen: () => {
          this.icon = undefined;
          this.displayCalls.push("clear");
        }
      }),
      control: namespace("control", {
        inBackground: (body: Thunk) => this.startFiber(body, false),
        millis: () => this._now,
        hardwareVersion: () => this.hardwareVersion,
        onEvent: (source: number, value: number, handler: Thunk) => this.onEvent(source, value, handler)
      }),
      input: namespace("input", {
        runningTimeMicros: () => this._now * 1000,
        onButtonPressed: (button: number, handler: Thunk) => this.onEvent(button, kButtonEvents.click, handler)
      }),
      pins: namespace("pins", {
        digitalWritePin: (pin: string, value: number) => undefined,
        analogReadPin: (pin: string) => this.analog.get(pin)?.() ?? 0,
        servoWritePin: (pin: string, angle: number) => { this.servos.set(pin, angle); },
        setAudioPinEnabled: (enabled: boolean) => { this._audioPinEnabled = enabled; }
      }),
      serial: namespace("serial", {
        setWriteLinePadding: (padding: number) => undefined,
        setRxBufferSize: (size: number) => {
          // CODAL takes the size as a uint8_t, holds at most 254 characters, and empties the buffer.
          const byte = size % 256;
          this.rxBufferSize = byte === 255 ? 254 : byte;
          this.serialInput = "";
        },
        writeLine: (text: string) => { this.serialOutput += `${text}\r\n`; },
        onDataReceived: (delimiters: string, handler: Thunk) => { this.serialHandler = { delimiters, handler }; },
        delimiters: (delimiter: string) => delimiter,
        readUntil: (delimiters: string) => this.readUntil(delimiters)
      }),
      music: namespace("music", {
        PlaybackMode,
        play: (sound: { name: string }, mode: string) => {
          // Waiting for the sound would hold up the loop it is called from.
          if (mode !== PlaybackMode.InBackground) throw notSimulated("music.play that waits for the sound");
          if (this.isV1) throw notOnV1("a sound expression");
          this.sounds.push(sound.name);
        },
        builtinPlayableSoundEffect: (name: string) => ({ name }),
        setBuiltInSpeakerEnabled: (enabled: boolean) => {
          if (enabled && this.isV1) throw notOnV1("the built-in speaker");
          this._speakerEnabled = enabled;
        },
        stopAllSounds: () => { this._soundsStopped++; }
      }),
      soundExpression: enumeration("soundExpression", kSoundExpressions),
      radio: namespace("radio", {}),
      AnalogPin: enumeration("AnalogPin", kAnalogPins),
      DigitalPin: enumeration("DigitalPin", kDigitalPins),
      Button: namespace("Button", { ...kButtonIds, AB: 3 }),
      EventBusSource: namespace("EventBusSource", {
        MICROBIT_ID_BUTTON_A: kButtonIds.A, MICROBIT_ID_BUTTON_B: kButtonIds.B, MICROBIT_ID_BUTTON_AB: 3
      }),
      DAL: namespace("DAL", {
        MICROBIT_ID_BUTTON_A: kButtonIds.A, MICROBIT_ID_BUTTON_B: kButtonIds.B, MICROBIT_ID_BUTTON_AB: 3,
        MICROBIT_BUTTON_EVT_CLICK: kButtonEvents.click, MICROBIT_BUTTON_EVT_LONG_CLICK: kButtonEvents.longClick
      }),
      IconNames: enumeration("IconNames", kIconNames),
      Delimiters: namespace("Delimiters", {
        NewLine: "\n", Comma: ",", Dollar: "$", Colon: ":", Fullstop: ".", Hash: "#", CarriageReturn: "\r",
        Space: " ", Tab: "\t", Pipe: "|", SemiColon: ";"
      })
    };
  }
}
