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
// the function. A `forever` body that returns without pausing waits 20 ms, as MakeCode's does; an
// `inBackground` function that returns ends its fiber.
//
// Events (serial input and buttons) run their handler synchronously and must not pause.

type Thunk = () => void;
type ButtonName = "A" | "B";
type ButtonEventName = "click" | "longClick";

// How long MakeCode's forever loop waits after a body that returns without pausing.
const kForeverIdleMs = 20;
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

export class MakeCodeSim {
  readonly sounds: string[] = [];

  private _now = 0;
  private fibers: Fiber[] = [];
  private nextOrder = 0;
  private serialInput = "";
  private serialOutput = "";
  private serialHandler: { delimiters: string, handler: Thunk } | undefined;
  private buttonHandlers = new Map<string, Thunk>();
  private analog = new Map<string, () => number>();
  private servos = new Map<string, number>();
  private icon: string | undefined;
  private _speakerEnabled: boolean | undefined;
  private _audioPinEnabled: boolean | undefined;

  static load(sourcePath: string): MakeCodeSim {
    const source = fs.readFileSync(sourcePath, "utf8");
    const js = ts.transpileModule(source, {
      compilerOptions: { target: ts.ScriptTarget.ES2019 },
      fileName: sourcePath
    }).outputText;
    const sim = new MakeCodeSim();
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

  get speakerEnabled() {
    return this._speakerEnabled;
  }

  get audioPinEnabled() {
    return this._audioPinEnabled;
  }

  advance(ms: number) {
    const until = this._now + ms;
    for (let fiber = this.nextDue(until); fiber; fiber = this.nextDue(until)) {
      this._now = fiber.wakeAt;
      this.runFiber(fiber);
    }
    this._now = until;
  }

  sendSerial(text: string) {
    for (const char of text) {
      this.serialInput += char;
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
    const handler = this.buttonHandlers.get(`${button}:${event}`);
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
    try {
      fiber.body();
    } catch (e) {
      if (!(e instanceof YieldSignal)) throw e;
      this.schedule(fiber, e.ms);
      return;
    }
    if (fiber.forever) {
      this.schedule(fiber, kForeverIdleMs);
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

  private readUntil(delimiters: string) {
    const index = [...this.serialInput].findIndex(char => delimiters.includes(char));
    if (index < 0) throw notSimulated("serial.readUntil with no delimiter in the input");
    const text = this.serialInput.slice(0, index);
    this.serialInput = this.serialInput.slice(index + 1);
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
          this.icon = icon;
        },
        clearScreen: () => { this.icon = undefined; }
      }),
      control: namespace("control", {
        inBackground: (body: Thunk) => this.startFiber(body, false),
        millis: () => this._now
      }),
      input: namespace("input", {
        runningTimeMicros: () => this._now * 1000,
        onButtonPressed: (button: ButtonName, handler: Thunk) => {
          this.buttonHandlers.set(`${button}:click`, handler);
        },
        onButtonEvent: (button: ButtonName, event: ButtonEventName, handler: Thunk) => {
          this.buttonHandlers.set(`${button}:${event}`, handler);
        },
        buttonEventValue: (event: ButtonEventName) => event,
        buttonEventClick: () => "click"
      }),
      pins: namespace("pins", {
        digitalWritePin: (pin: string, value: number) => undefined,
        analogReadPin: (pin: string) => this.analog.get(pin)?.() ?? 0,
        servoWritePin: (pin: string, angle: number) => { this.servos.set(pin, angle); },
        setAudioPinEnabled: (enabled: boolean) => { this._audioPinEnabled = enabled; }
      }),
      serial: namespace("serial", {
        setWriteLinePadding: (padding: number) => undefined,
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
          this.sounds.push(sound.name);
        },
        builtinPlayableSoundEffect: (name: string) => ({ name }),
        setBuiltInSpeakerEnabled: (enabled: boolean) => { this._speakerEnabled = enabled; },
        stopAllSounds: () => undefined
      }),
      soundExpression: enumeration("soundExpression", kSoundExpressions),
      radio: namespace("radio", {}),
      AnalogPin: enumeration("AnalogPin", kAnalogPins),
      DigitalPin: enumeration("DigitalPin", kDigitalPins),
      Button: enumeration("Button", ["A", "B", "AB"]),
      ButtonEvent: namespace("ButtonEvent", { Click: "click", LongClick: "longClick" }),
      IconNames: enumeration("IconNames", kIconNames),
      Delimiters: namespace("Delimiters", {
        NewLine: "\n", Comma: ",", Dollar: "$", Colon: ":", Fullstop: ".", Hash: "#", CarriageReturn: "\r",
        Space: " ", Tab: "\t", Pipe: "|", SemiColon: ";"
      })
    };
  }
}
