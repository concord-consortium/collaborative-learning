// CLUE Spiker:bit EMG signal test / diagnostic firmware  (NOT the source of record)
//
// This is a bench-test program, separate from spikerbit-clue.ts. CLUE never flashes
// it — its only job is to let you see, side by side, the RAW analog signal the
// Spiker:bit feeds the micro:bit ADC and the PROCESSED envelope the pxt-spikerbit
// extension derives from it (spikerbit.musclePowerSignal()). Use it to check whether
// the extension's fixed noise floor and half-wave/peak-hold envelope match what the
// hardware is actually producing.
//
// Like spikerbit-clue.ts this is MakeCode (static TypeScript) authored at
// https://makecode.microbit.org with the Backyard Brains "spikerbit" extension
// (https://github.com/BackyardBrains/pxt-spikerbit). The firmware directory is
// excluded from the CLUE tsconfig/eslint because these globals (spikerbit, serial,
// pins, AnalogPin, basic) only exist in the MakeCode runtime.
//
// HOW TO USE
//   1. Open https://makecode.microbit.org, add the pxt-spikerbit extension, switch
//      to the JavaScript view, and paste this file in.
//   2. Download to the micro:bit, then in MakeCode click "Show console Device"
//      (appears once the board is paired over WebUSB).
//   3. MakeCode graphs any "name:value" serial line, so "raw" and "env" plot as two
//      separate lines on one time axis. Use the console's Download button for a CSV.
//   4. NOTE: only one program can own the micro:bit serial port at a time, so close
//      CLUE's connection to this board while testing here.
//
// WHAT TO LOOK FOR
//   - "raw" at rest ~ the extension's hardcoded NOISE_FLOOR (currently 580). If your
//     board rests well above/below that, the fixed floor is mis-tuned: too high kills
//     weak contractions, too low leaves resting jitter.
//   - "env" should sit near 0 at rest and rise with contraction. Compare its rise to
//     how far "raw" swings above the floor to judge sensitivity / headroom.
//
// serial.setWriteLinePadding(0) disables writeLine's default 32-byte space padding so
// the "name:value" lines stay clean for the plotter's parser.

serial.setWriteLinePadding(0)
spikerbit.startMuscleRecording()

basic.forever(function () {
    // Raw ADC sample on P1 — the same pin the extension samples to build its
    // envelope. Non-destructive, so reading it here doesn't disturb the extension.
    const raw = pins.analogReadPin(AnalogPin.P1)
    // The extension's processed EMG envelope (noise-floor subtracted, half-wave
    // clamped, peak-hold with linear decay).
    const env = spikerbit.musclePowerSignal()

    serial.writeValue("raw", raw)
    serial.writeValue("env", Math.round(env))

    basic.pause(50) // 20 Hz — smooth enough for the envelope, light on the console
})
