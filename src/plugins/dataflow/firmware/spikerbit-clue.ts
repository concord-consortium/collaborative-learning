// CLUE Spiker:bit EMG firmware — v3  (source of record)
//
// This is MakeCode (static TypeScript) authored at https://makecode.microbit.org.
// It is NOT compiled by the CLUE build — the `src/plugins/dataflow/firmware` directory
// is excluded from tsconfig.json and eslint, because these globals (serial, pins, basic,
// control, input, AnalogPin, DigitalPin, Delimiters) only exist in the MakeCode runtime.
//
// It is the source of record for spikerbit-clue.hex, which the DataFlow tile flashes over
// WebUSB when a connected micro:bit is not already running it. To rebuild the hex, see
// README.md in this directory.
//
// SIGNAL PROCESSING (v3): we compute the EMG envelope OURSELVES rather than using the
// Backyard Brains pxt-spikerbit extension's spikerbit.musclePowerSignal(). That function
// subtracts a fixed noise floor of 580 and HALF-wave rectifies, but the Spiker:bit's
// resting baseline is ~511 — so moderate contractions (which oscillate around 511 and
// rarely reach 580) collapse to ~0 and only hard, rail-to-rail flexes register. Instead we
// track the DC baseline and FULL-wave rectify around it:  envelope = EMA( |raw - baseline| ).
// Bench-validated on micro:bit V2.
//
// We no longer call the extension at all. Its startMuscleRecording() did exactly one thing
// to the hardware — drive P8=0, P9=0 to put the board's analog front-end in EMG mode
// (P9=1 would select EEG) — so we just do that ourselves below and read the raw signal on
// P1. (The MakeCode project therefore no longer needs the pxt-spikerbit extension added.)
//
// The EMA coefficients are computed from the measured per-sample dt, so the smoothing has a
// FIXED time constant (~76 ms envelope, ~800 ms baseline) regardless of the achieved sample
// rate — the background loop free-runs as fast as the ADC allows (~500 Hz on a V2 with the
// loop to itself) and the envelope behaves the same whatever that rate turns out to be.
// V2-tuned (float math); the universal hex still boots on V1 but isn't tuned for it.
//
// Protocol (unchanged — reuses the Arduino serial contract so the existing EMG sensor /
// Servo nodes work as-is):
//   - streams the EMG envelope as   "emg:<value>\r\n"  (~100 ms cadence)
//   - drives the servo from a bare integer angle line, e.g. "90\n"
//   - replies to a "?" query with   "CLUE-SPIKERBIT v3\r\n"  (version detection)
//
// serial.setWriteLinePadding(0) disables writeLine's default 32-byte space padding, so
// lines are clean ("emg:12\r\n" not "emg:12<spaces>\r\n"). ALL serial writes happen in the
// forever loop (one fiber): the "?" handler only sets a flag, so a version reply can never
// interleave with the emg stream.
//
// Keep VERSION's number in sync with kSpikerbitFirmwareVersion in
// src/models/stores/spikerbit-device.ts whenever this program changes.
//
// NOTE: confirm the servo pin against the Spiker:bit board — documentation cites
// P0 in some places and P8 in others. (P8 is used above as an EMG-mode select line, so if
// the servo really is on P8 the two uses collide — resolve before shipping.) Update
// AnalogPin.P0 below if needed and re-export the hex.

const VERSION = "CLUE-SPIKERBIT v3"

// Smoothing time constants (milliseconds). Derived from the alphas bench-validated at
// ~250 Hz (aEnv 0.05, aBase 0.005 → tau = dt*(1-a)/a at dt=4 ms), but applied per-sample
// via the measured dt so the behavior is independent of the actual sample rate.
const TAU_ENV_MS = 76        // envelope: fast enough to feel responsive
const TAU_BASELINE_MS = 800  // baseline: slow enough to ignore the EMG AC, track only DC drift

// Set by the "?" handler, consumed by the forever loop, so the version reply is written on
// the same fiber as the emg stream (no interleaving).
let versionRequested = false

// Latest smoothed envelope, produced by the background sampler and read by the forever loop.
let latestEnvelope = 0

serial.setWriteLinePadding(0)

// Put the Spiker:bit analog front-end in EMG mode (what the extension's startMuscleRecording
// did). Held for the whole session; nothing else drives these pins.
pins.digitalWritePin(DigitalPin.P8, 0)
pins.digitalWritePin(DigitalPin.P9, 0)

serial.writeLine(VERSION) // startup banner (secondary detection signal)

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

serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    const line = serial.readUntil(serial.delimiters(Delimiters.NewLine)).trim()
    if (line == "?") {
        versionRequested = true
    } else {
        const angle = parseFloat(line)
        if (!isNaN(angle)) {
            pins.servoWritePin(AnalogPin.P0, Math.round(angle))
        }
    }
})

basic.forever(function () {
    if (versionRequested) {
        versionRequested = false
        serial.writeLine(VERSION)
    }
    serial.writeLine("emg:" + Math.round(latestEnvelope))
    basic.pause(100)
})
