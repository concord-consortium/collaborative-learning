// CLUE Spiker:bit EMG firmware — v4  (source of record)
//
// This is MakeCode (static TypeScript), compiled into spikerbit-clue.hex by `npm run build:firmware`.
// The CLUE app build doesn't compile it — the `src/plugins/dataflow/firmware` directory
// is excluded from tsconfig.json and eslint, because these globals (serial, pins, basic,
// control, input, music, AnalogPin, DigitalPin, Delimiters, IconNames, ...) only exist in the
// MakeCode runtime.
//
// It is the source of record for spikerbit-clue.hex, which the DataFlow tile flashes over
// WebUSB when a connected micro:bit is not already running it. To rebuild the hex, see
// README.md in this directory.
//
// PROTOCOL: the board speaks the CC Device Protocol (see
// src/plugins/dataflow/docs/serial-protocols.md). One ASCII line per message, ending "\r\n"
// from the board and "\n" or "\r\n" from the host; any line may end in "*hh", the XOR of
// every byte before the "*" as two hex digits. The board puts one on every line it writes and
// checks one on every line it reads, accepting a line without one.
//   - "?" answers with the HELLO line below, in any state.
//   - "open session:<id> [timeout:<ms>]" starts a session, which streams "emg:<int>" every
//     100 ms until "close session:<id>", or until no "ping session:<id>" has arrived for the
//     timeout. "stream" and "stop" turn the same readings on and off outside a session.
//   - "identify" shows the identify icon and plays a short sound, in any state.
//   - A line with no verb sets outputs: "servo:<angle>" drives the servo on P0.
//   - A trailing "#n" asks for "ok #n". Errors ("err [#n] <reason>") are sent either way. The
//     whole line is checked before any of it is applied, so a bad line changes nothing.
// A long press of button A starts or stops free-run outside a session, like "stream" and
// "stop". During a session it does nothing, and a click does nothing in any state, so a student
// pressing buttons during a Dataflow program changes nothing.
//
// LED STATUS: the display shows how far a connection got. Waiting (power-up, or a session
// ending), found (a "?" while idle: Dataflow saw the board but hasn't opened a session),
// connected (an "open", for 3 s, then cleared), streaming (free-run), and identify (for 3 s,
// then back to what the state calls for). After the connected icon clears, the firmware doesn't
// touch the display until the session ends or an identify arrives.
//
// SOUND: identify plays on the built-in speaker only. P0 drives the servo, so the edge-pin
// audio output is turned off before anything plays: the first sound connects the audio output
// to every enabled pin, which would make the servo twitch. The hex is universal, and a V1 has no
// speaker (turning one on there stops the program with a panic), so the speaker calls run only
// on a V2 and a V1 shows the identify icon without a sound.
//
// No startup banner: an idle board is silent until it is spoken to. The micro:bit's USB
// interface chip holds about 1 KB of output when nobody reads it, so anything sent while
// nobody listens reaches the next host as stale data. Dataflow sends "?" to find the firmware.
// Nothing this program sends may contain the v1–v3 banner's text (the "CLUE-SPIKERBIT" name,
// a space and "v"): a Dataflow that only knows v3 would then take the board for newer firmware
// it can't talk to, instead of flashing its own v3 hex.
//
// ONE WRITER: every serial write happens in the forever loop. The serial handler only parses
// a line, applies it and queues its reply, so a reply can never land inside a reading.
//
// LOOP RULE: a loop pauses only as its last statement, and a background loop
// (`while (true) { ...; basic.pause(n) }`) keeps its state outside the function. Event
// handlers (serial, buttons) don't pause at all. Jest tests run this source on a simulated
// MakeCode runtime (src/models/stores/spikerbit-sim) that ends a pass at the pause and calls
// the function again for the next one, so code after a pause would never run there. For the
// same reason there is no one-off background function that pauses (show an icon, pause, clear):
// the sim would run it again from the top. The forever loop times the 3 s icons with
// control.millis() deadlines instead, and every display call passes an interval of 0, so none
// of them pauses.
//
// SIGNAL PROCESSING: we compute the EMG envelope OURSELVES rather than using the
// Backyard Brains pxt-spikerbit extension's spikerbit.musclePowerSignal(). That function
// subtracts a fixed noise floor of 580 and HALF-wave rectifies, but the Spiker:bit's
// resting baseline is ~511 — so moderate contractions (which oscillate around 511 and
// rarely reach 580) collapse to ~0 and only hard, rail-to-rail flexes register. Instead we
// track the DC baseline and FULL-wave rectify around it:  envelope = EMA( |raw - baseline| ).
// Bench-validated on micro:bit V2.
//
// We don't call the extension at all. Its startMuscleRecording() did exactly one thing
// to the hardware — drive P8=0, P9=0 to put the board's analog front-end in EMG mode
// (P9=1 would select EEG) — so we just do that ourselves below and read the raw signal on
// P1. (The MakeCode project therefore doesn't need the pxt-spikerbit extension added.)
//
// The EMA coefficients are computed from the measured per-sample dt, so the smoothing has a
// FIXED time constant (~76 ms envelope, ~800 ms baseline) regardless of the achieved sample
// rate — the background loop free-runs as fast as the scheduler allows (measured at 250 Hz on
// a V2) and the envelope behaves the same whatever that rate turns out to be.
// V2-tuned (float math); the universal hex still boots on V1 but isn't tuned for it.
//
// serial.setWriteLinePadding(0) disables writeLine's default 32-byte space padding, so
// lines are clean ("emg:12*0B\r\n" not "emg:12*0B<spaces>\r\n").
//
// Keep HELLO's firmware number in sync with kSpikerbitFirmwareVersion in
// src/models/stores/spikerbit-device.ts whenever this program changes.

const HELLO = "hello protocol:CCDeviceProtocol version:1 device:spikerbit firmware:4"

const READING_INTERVAL_MS = 100
const DEFAULT_TIMEOUT_MS = 5000
const MIN_TIMEOUT_MS = 1000
const MAX_TIMEOUT_MS = 60000
const MAX_SESSION_ID = 65535
// How long the connected and identify icons stay.
const ICON_MS = 3000
// The receive buffer drops whatever arrives while it is full, and its default is 20. The
// longest command, "open session:65535 timeout:60000 #999*hh", is 41 characters with its
// newline; this leaves room for more lines arriving before the handler has read the first.
const RX_BUFFER_SIZE = 128

// Smoothing time constants (milliseconds). Derived from the alphas bench-validated at
// ~250 Hz (aEnv 0.05, aBase 0.005 → tau = dt*(1-a)/a at dt=4 ms), but applied per-sample
// via the measured dt so the behavior is independent of the actual sample rate.
const TAU_ENV_MS = 76        // envelope: fast enough to feel responsive
const TAU_BASELINE_MS = 800  // baseline: slow enough to ignore the EMG AC, track only DC drift

const HEX_DIGITS = "0123456789ABCDEF"

const WAITING_ICON = IconNames.Asleep
const FOUND_ICON = IconNames.Surprised
const CONNECTED_ICON = IconNames.Yes
const IDENTIFY_ICON = IconNames.Heart
const STREAMING_ICON = IconNames.Chessboard

// On a V1, hardwareVersion() is "1"; on a V2 it is "2.0", "2.2" or "2.X".
const HAS_SPEAKER = control.hardwareVersion().charAt(0) != "1"

enum State {
    Idle,
    Session,
    FreeRun
}

let state = State.Idle
let sessionId = 0
let sessionTimeoutMs = DEFAULT_TIMEOUT_MS
// When the session was opened or last pinged with its id.
let lastPingAt = 0
// The time the latest reading was due. Readings are due every READING_INTERVAL_MS from here.
let lastReadingAt = 0
// Reply lines (without checksums) waiting for the forever loop to write them.
let replies: string[] = []
// What idle shows: the waiting icon, or the found icon once "?" has arrived.
let idleIcon = WAITING_ICON
// Whether a connected or identify icon is showing, and when it was shown.
let timedIcon = false
let timedIconAt = 0

// Latest smoothed envelope, produced by the background sampler and read by the forever loop.
let latestEnvelope = 0

serial.setWriteLinePadding(0)
serial.setRxBufferSize(RX_BUFFER_SIZE)

// Before anything plays (see SOUND above). Turning the audio pin off is safe on a V1, where it
// only keeps music off P0.
pins.setAudioPinEnabled(false)
if (HAS_SPEAKER) music.setBuiltInSpeakerEnabled(true)

// Put the Spiker:bit analog front-end in EMG mode (what the extension's startMuscleRecording
// did). Held the whole time; nothing else drives these pins.
pins.digitalWritePin(DigitalPin.P8, 0)
pins.digitalWritePin(DigitalPin.P9, 0)

// Background sampler: read P1 as fast as the scheduler allows, track the DC baseline, then
// full-wave rectify around it and smooth. Time-based EMA (coefficient from measured dt) so
// the smoothing time constant is fixed regardless of sample rate. Runs on its own fiber so
// the rate is decoupled from the ~100 ms serial output cadence.
let baseline = pins.analogReadPin(AnalogPin.P1) // seed so we don't converge from 0
let lastMicros = input.runningTimeMicros()
control.inBackground(function () {
    while (true) {
        const now = input.runningTimeMicros()
        let dtMs = (now - lastMicros) / 1000
        lastMicros = now
        // Guard against the first iteration, scheduler hiccups, and the ~1.2 h micros wrap.
        if (dtMs <= 0 || dtMs > 100) dtMs = 4

        const raw = pins.analogReadPin(AnalogPin.P1)
        const aBase = dtMs / (dtMs + TAU_BASELINE_MS)
        const aEnv = dtMs / (dtMs + TAU_ENV_MS)
        baseline = baseline + (raw - baseline) * aBase
        const dev = Math.abs(raw - baseline)
        latestEnvelope = latestEnvelope + (dev - latestEnvelope) * aEnv

        basic.pause(0)
    }
})

function checksum(body: string): number {
    let sum = 0
    for (let i = 0; i < body.length; i++) {
        sum = sum ^ body.charCodeAt(i)
    }
    return sum & 0xff
}

function withChecksum(body: string): string {
    const sum = checksum(body)
    return body + "*" + HEX_DIGITS.charAt(sum >> 4) + HEX_DIGITS.charAt(sum & 15)
}

// The value of two hex digits, either case, or -1 if the text isn't that.
function hexByte(text: string): number {
    if (text.length != 2) return -1
    const high = HEX_DIGITS.indexOf(text.charAt(0).toUpperCase())
    const low = HEX_DIGITS.indexOf(text.charAt(1).toUpperCase())
    return high < 0 || low < 0 ? -1 : high * 16 + low
}

function isDigits(text: string): boolean {
    if (text.length == 0) return false
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i)
        if (c < 48 || c > 57) return false
    }
    return true
}

// A whole number from min to max, or -1 if the text isn't one.
function wholeNumber(text: string, min: number, max: number): number {
    // More digits than any allowed value has, which also keeps parseInt's result small.
    if (!isDigits(text) || text.length > 6) return -1
    const n = parseInt(text)
    return n < min || n > max ? -1 : n
}

// A number as Dataflow writes one: an optional sign, digits, and an optional fraction.
function isNumber(text: string): boolean {
    const unsigned = text.charAt(0) == "-" ? text.slice(1) : text
    const dot = unsigned.indexOf(".")
    if (dot < 0) return isDigits(unsigned)
    return isDigits(unsigned.slice(0, dot)) && isDigits(unsigned.slice(dot + 1))
}

function ok(seq: string) {
    if (seq != "") replies.push("ok " + seq)
}

function err(seq: string, reason: string) {
    replies.push(seq == "" ? "err " + reason : "err " + seq + " " + reason)
}

// Shows what the state calls for: the idle icon, the streaming icon, or nothing in a session.
function showState() {
    timedIcon = false
    if (state == State.Session) basic.clearScreen()
    else if (state == State.FreeRun) basic.showIcon(STREAMING_ICON, 0)
    else basic.showIcon(idleIcon, 0)
}

// Shows an icon until the forever loop shows what the state calls for, ICON_MS later.
function showTimedIcon(icon: IconNames) {
    basic.showIcon(icon, 0)
    timedIcon = true
    timedIconAt = control.millis()
}

function startStreaming(next: State) {
    if (state == State.Idle) lastReadingAt = control.millis()
    state = next
}

function startFreeRun() {
    startStreaming(State.FreeRun)
    showState()
}

function goIdle() {
    state = State.Idle
    idleIcon = WAITING_ICON
    showState()
}

function endSession() {
    sessionId = 0
    sessionTimeoutMs = DEFAULT_TIMEOUT_MS
    if (HAS_SPEAKER) music.stopAllSounds()
    goIdle()
}

function endSessionIfLapsed() {
    if (state == State.Session && control.millis() - lastPingAt >= sessionTimeoutMs) endSession()
}

// The value given for `name` on a line, or "" when it has none. The last one wins.
function valueOf(names: string[], values: string[], name: string): string {
    let value = ""
    for (let i = 0; i < names.length; i++) {
        if (names[i] == name) value = values[i]
    }
    return value
}

// Checks `ping` or `close` against the running session. Returns true when `id` names it.
function isThisSession(id: number, seq: string): boolean {
    if (state != State.Session) {
        err(seq, "nosession")
        return false
    }
    if (id != sessionId) {
        err(seq, "othersession")
        return false
    }
    return true
}

// Parses, checks and applies one line, queuing its reply.
function handleLine(line: string) {
    if (line.length > 0 && line.charAt(line.length - 1) == "\r") line = line.slice(0, line.length - 1)
    const star = line.indexOf("*")
    if (star >= 0) {
        const sum = hexByte(line.slice(star + 1))
        line = line.slice(0, star)
        // The #n of a line that fails its checksum can't be trusted, so the error goes without it.
        if (sum != checksum(line)) {
            err("", "checksum")
            return
        }
    }

    const tokens = line.split(" ").filter(token => token.length > 0)
    if (tokens.length == 0) return
    let seq = ""
    const last = tokens[tokens.length - 1]
    if (last.charAt(0) == "#") {
        if (!isDigits(last.slice(1))) {
            err("", "value")
            return
        }
        seq = last
        tokens.pop()
    }
    let verb = ""
    if (tokens.length > 0 && tokens[0].indexOf(":") < 0) verb = tokens.shift()

    // Every other token is name:value, with a name this verb takes.
    let allowed: string[] = []
    if (verb == "open") allowed = ["session", "timeout"]
    else if (verb == "ping" || verb == "close") allowed = ["session"]
    else if (verb == "") allowed = ["servo"]
    else if (verb != "?" && verb != "identify" && verb != "stream" && verb != "stop") {
        err(seq, "unknown")
        return
    }
    const names: string[] = []
    const values: string[] = []
    for (const token of tokens) {
        const colon = token.indexOf(":")
        if (colon < 0 || allowed.indexOf(token.slice(0, colon)) < 0) {
            err(seq, "unknown")
            return
        }
        names.push(token.slice(0, colon))
        values.push(token.slice(colon + 1))
    }

    endSessionIfLapsed()

    if (verb == "?") {
        replies.push(HELLO)
        if (state == State.Idle) {
            idleIcon = FOUND_ICON
            if (!timedIcon) showState()
        }
    } else if (verb == "identify") {
        showTimedIcon(IDENTIFY_ICON)
        if (HAS_SPEAKER) {
            music.play(music.builtinPlayableSoundEffect(soundExpression.hello), music.PlaybackMode.InBackground)
        }
        ok(seq)
    } else if (verb == "open") {
        const id = wholeNumber(valueOf(names, values, "session"), 1, MAX_SESSION_ID)
        const timeoutMs = names.indexOf("timeout") < 0
            ? DEFAULT_TIMEOUT_MS
            : wholeNumber(valueOf(names, values, "timeout"), MIN_TIMEOUT_MS, MAX_TIMEOUT_MS)
        if (id < 0 || timeoutMs < 0) {
            err(seq, "value")
            return
        }
        startStreaming(State.Session)
        sessionId = id
        sessionTimeoutMs = timeoutMs
        lastPingAt = control.millis()
        showTimedIcon(CONNECTED_ICON)
        ok(seq)
    } else if (verb == "ping" && names.length == 0) {
        // A liveness check only: it touches no session.
        ok(seq)
    } else if (verb == "ping" || verb == "close") {
        const id = wholeNumber(valueOf(names, values, "session"), 1, MAX_SESSION_ID)
        if (id < 0) {
            err(seq, "value")
        } else if (isThisSession(id, seq)) {
            if (verb == "ping") lastPingAt = control.millis()
            else endSession()
            ok(seq)
        }
    } else if (verb == "stream" || verb == "stop") {
        if (state == State.Session) {
            err(seq, "insession")
        } else {
            if (verb == "stream" && state == State.Idle) startFreeRun()
            else if (verb == "stop" && state == State.FreeRun) goIdle()
            ok(seq)
        }
    } else {
        if (names.length > 0) {
            const servo = valueOf(names, values, "servo")
            if (!isNumber(servo)) {
                err(seq, "value")
                return
            }
            pins.servoWritePin(AnalogPin.P0, Math.max(0, Math.min(180, Math.round(parseFloat(servo)))))
        }
        ok(seq)
    }
}

serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    handleLine(serial.readUntil(serial.delimiters(Delimiters.NewLine)))
})

// input.onButtonPressed only hears clicks, so the long press is the button's own event.
control.onEvent(EventBusSource.MICROBIT_ID_BUTTON_A, DAL.MICROBIT_BUTTON_EVT_LONG_CLICK, function () {
    endSessionIfLapsed()
    if (state == State.Idle) startFreeRun()
    else if (state == State.FreeRun) goIdle()
})

showState()

// A pass runs about every 20 ms: the body doesn't pause, and MakeCode's forever loop sleeps
// 20 ms after each pass.
basic.forever(function () {
    endSessionIfLapsed()
    if (timedIcon && control.millis() - timedIconAt >= ICON_MS) showState()
    while (replies.length > 0) {
        serial.writeLine(withChecksum(replies.shift()))
    }
    if (state != State.Idle) {
        const now = control.millis()
        if (now - lastReadingAt >= READING_INTERVAL_MS) {
            // Step the due time rather than restarting it from now, so readings average 100 ms
            // apart whatever the pass length. After a stall, start over rather than catch up.
            lastReadingAt = now - lastReadingAt >= 2 * READING_INTERVAL_MS ? now : lastReadingAt + READING_INTERVAL_MS
            serial.writeLine(withChecksum("emg:" + Math.round(latestEnvelope)))
        }
    }
})
