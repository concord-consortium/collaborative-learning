// CLUE Spiker:bit EMG firmware — v1  (source of record)
//
// This is MakeCode (static TypeScript) authored at https://makecode.microbit.org
// with the Backyard Brains "spikerbit" extension
// (https://github.com/BackyardBrains/pxt-spikerbit). It is NOT compiled by the
// CLUE build — the `src/plugins/dataflow/firmware` directory is excluded from
// tsconfig.json and eslint, because these globals (spikerbit, serial, pins,
// basic, AnalogPin, Delimiters) only exist in the MakeCode runtime.
//
// It is the source of record for spikerbit-clue-v1.hex, which the DataFlow tile
// flashes over WebUSB when a connected micro:bit is not already running it.
// To rebuild the hex, see README.md in this directory.
//
// Protocol (reuses the Arduino serial contract so the existing EMG sensor / Servo
// nodes work unchanged):
//   - streams the EMG envelope as   "emg:<value>\r\n"  (~100 ms cadence)
//   - drives the servo from a bare integer angle line, e.g. "90\n"
//   - replies to a "?" query with   "CLUE-SPIKERBIT v1\r\n"  (version detection)
//
// Keep VERSION's number in sync with kSpikerbitFirmwareVersion in
// src/models/stores/spikerbit-device.ts whenever this program changes.
//
// NOTE: confirm the servo pin against the Spiker:bit board — documentation cites
// P0 in some places and P8 in others. Update AnalogPin.P0 below if needed and
// re-export the hex.

const VERSION = "CLUE-SPIKERBIT v1"

spikerbit.startMuscleRecording()
serial.writeLine(VERSION) // startup banner (secondary detection signal)

serial.onDataReceived(serial.delimiters(Delimiters.NewLine), function () {
    const line = serial.readUntil(serial.delimiters(Delimiters.NewLine)).trim()
    if (line == "?") {
        serial.writeLine(VERSION)
    } else {
        const angle = parseFloat(line)
        if (!isNaN(angle)) {
            pins.servoWritePin(AnalogPin.P0, Math.round(angle))
        }
    }
})

basic.forever(function () {
    const value = spikerbit.musclePowerSignal()
    serial.writeLine("emg:" + Math.round(value))
    basic.pause(100)
})
