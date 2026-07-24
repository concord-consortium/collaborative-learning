// CLUE Spiker:bit envelope test / measurement firmware  (NOT the source of record)
//
// Two jobs, both for the bench only — CLUE never flashes this:
//   1. MEASURE the achievable sample rate on your actual board, so we know how much
//      processor headroom we have and can size the smoothing constants correctly.
//   2. PROVE, live on the plotter, that a baseline-relative / full-wave envelope
//      tracks flexes that the library's spikerbit.musclePowerSignal() misses.
//
// WHY a second envelope: the CSV showed the library subtracts a fixed floor of 580 and
// half-wave rectifies, but your resting baseline is ~511 — so moderate flexes (which
// oscillate around 511) never clear 580 and read as ~0. Here we instead track the DC
// baseline ourselves and rectify the FULL swing around it: env = smoothed(|raw - baseline|).
//
// ── SAMPLE-RATE CAVEAT ──────────────────────────────────────────────────────────────
// This build calls spikerbit.startMuscleRecording() so the board's analog front-end is
// configured correctly AND so we can print the library's envelope for comparison. But
// that also runs the library's own background sampler, which competes with ours for the
// ADC. So the "rate=" number printed here is a CONSERVATIVE FLOOR — the shipping firmware
// will drop the library and run its sampler alone, roughly doubling this. If even this
// floor is comfortably above 250 Hz, we have plenty of headroom.
//
// ── HOW TO USE ──────────────────────────────────────────────────────────────────────
//   1. https://makecode.microbit.org → add extension github.com/BackyardBrains/pxt-spikerbit
//      → JavaScript view → paste this in → download to the board.
//   2. "Show console Device". Plotted series: raw, base (tracked baseline), envOurs, envLib.
//      The sample rate prints once/sec as a text line "rate=NNN samples-per-sec" (no colon,
//      so it is NOT graphed — read it from the console text).
//   3. Relax, then flex. Watch envOurs rise with the raw "noisiness" while envLib stays flat.
//   4. Only one program can own the serial port — close CLUE's connection to this board.
//
// The BASELINE_ALPHA / ENV_ALPHA smoothing factors below assume a few-hundred-Hz rate;
// once step 2 tells us the real rate we'll retune them for the shipping firmware.

const BASELINE_ALPHA = 0.005 // how fast the tracked DC baseline follows raw (slow = ignores EMG AC)
const ENV_ALPHA = 0.05       // how fast the envelope follows |raw - baseline| (fast = responsive)

serial.setWriteLinePadding(0)
spikerbit.startMuscleRecording() // configures the EMG front-end (and starts the library sampler)

// Shared between the background sampler and the foreground reporter.
let latestRaw = pins.analogReadPin(AnalogPin.P1)
let baseline = latestRaw // seed so we don't spend seconds converging from 0
let envOurs = 0
let sampleCount = 0

// Fast sampler: read P1 as fast as the scheduler allows, track baseline, full-wave
// rectify around it, and smooth. pause(0) each iteration matches how the library paces,
// so the measured rate is an apples-to-apples comparison.
control.inBackground(function () {
    while (true) {
        const raw = pins.analogReadPin(AnalogPin.P1)
        baseline = baseline + (raw - baseline) * BASELINE_ALPHA
        const dev = Math.abs(raw - baseline)
        envOurs = envOurs + (dev - envOurs) * ENV_ALPHA
        latestRaw = raw
        sampleCount = sampleCount + 1
        basic.pause(0)
    }
})

// Reporter: print the plottable series at a modest cadence, and the achieved sample
// rate once per second. Rate is computed from a monotonic counter delta (no reset race).
let lastCount = 0
let lastReport = input.runningTime()
basic.forever(function () {
    serial.writeValue("raw", latestRaw)
    serial.writeValue("base", Math.round(baseline))
    serial.writeValue("envOurs", Math.round(envOurs))
    serial.writeValue("envLib", Math.round(spikerbit.musclePowerSignal()))

    const now = input.runningTime()
    const elapsed = now - lastReport
    if (elapsed >= 1000) {
        const hz = Math.round((sampleCount - lastCount) * 1000 / elapsed)
        serial.writeLine("rate=" + hz + " samples-per-sec")
        lastCount = sampleCount
        lastReport = now
    }
    basic.pause(100)
})
