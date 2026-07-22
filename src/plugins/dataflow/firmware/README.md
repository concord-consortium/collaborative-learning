# Spiker:bit DataFlow firmware

`spikerbit-clue.hex` is a universal micro:bit hex (V1+V2) authored in MakeCode.
It streams the Spiker:bit EMG envelope over serial as `emg:<value>\r\n`, drives a
servo from bare-integer angle lines, and replies to a `?` query with
`CLUE-SPIKERBIT v<N>`. The DataFlow tile flashes it automatically over WebUSB
(via `@microbit/microbit-connection`) when a connected micro:bit is not already
running it.

- **Source of record:** [`spikerbit-clue.ts`](./spikerbit-clue.ts) — the MakeCode
  program. This directory is excluded from the CLUE tsconfig/eslint because the
  program uses MakeCode-only globals.
- **Compiled artifact:** `spikerbit-clue.hex` — imported by the app as a string
  (webpack `asset/source`) in `dataflow-program.tsx`. **Until this file is committed,
  the production webpack build will fail** (type-checking still passes via the
  ambient `*.hex` declaration in `src/hex.d.ts`).

## Rebuilding the hex

1. Open <https://makecode.microbit.org> and start a new project.
2. Add the extension `https://github.com/BackyardBrains/pxt-spikerbit`.
3. Switch to the JavaScript view and paste in `spikerbit-clue.ts`.
4. Confirm the servo pin (`AnalogPin.P0` vs `P8`) against the Spiker:bit board.
5. If behavior changed, bump `VERSION` here and `kSpikerbitFirmwareVersion` in
   `src/models/stores/spikerbit-device.ts`.
6. Export the **universal hex** and save it as `spikerbit-clue.hex` in this
   directory.
