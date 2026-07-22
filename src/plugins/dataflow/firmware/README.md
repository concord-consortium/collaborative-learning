# Spiker:bit DataFlow firmware

`spikerbit-clue.hex` is a universal micro:bit hex (V1+V2) authored in MakeCode.
It streams the Spiker:bit EMG envelope over serial as `emg:<value>\r\n`, drives a
servo from bare-integer angle lines, and replies to a `?` query with
`CLUE-SPIKERBIT v<N>`. The DataFlow tile flashes it automatically over WebUSB
(via `@microbit/microbit-connection`) when a connected micro:bit is not already
running it.

As of v3 the firmware computes the EMG envelope itself — it tracks the DC baseline
and full-wave rectifies (`envelope = EMA(|raw - baseline|)`) instead of using the
`pxt-spikerbit` extension's `musclePowerSignal()`, whose fixed 580 noise floor sits
above the board's ~511 resting baseline and misses moderate contractions. It reads the
raw signal on P1 and only needs `P8=0/P9=0` to select EMG mode, so the extension is no
longer required. See the header of `spikerbit-clue.ts` for the full rationale.

- **Source of record:** [`spikerbit-clue.ts`](./spikerbit-clue.ts) — the MakeCode
  program. This directory is excluded from the CLUE tsconfig/eslint because the
  program uses MakeCode-only globals.
- **Compiled artifact:** `spikerbit-clue.hex` — imported by the app as a string
  (webpack `asset/source`) in `dataflow-program.tsx`. **Until this file is committed,
  the production webpack build will fail** (type-checking still passes via the
  ambient `*.hex` declaration in `src/hex.d.ts`).

## Rebuilding the hex

1. Open <https://makecode.microbit.org> and start a new project (no extension needed).
2. Switch to the JavaScript view and paste in `spikerbit-clue.ts`.
3. If behavior changed, bump `VERSION` there and `kSpikerbitFirmwareVersion` in
   `src/models/stores/spikerbit-device.ts` (the `spikerbit-firmware-consistency`
   Jest test enforces that these and the exported hex all agree).
4. Export the **universal hex** and save it as `spikerbit-clue.hex` in this
   directory.

## Bench-test firmware

Two diagnostic programs (never flashed by CLUE — paste into MakeCode and use the
"Show console Device" plotter) used to develop and validate the v3 envelope:

- [`spikerbit-emg-test.ts`](./spikerbit-emg-test.ts) — streams the raw P1 signal
  alongside the extension's `musclePowerSignal()` envelope.
- [`spikerbit-envelope-test.ts`](./spikerbit-envelope-test.ts) — prints the achieved
  sample rate and compares our baseline-relative full-wave envelope against the
  extension's, side by side.
