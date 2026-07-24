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

> **Note:** the `spikerbit-firmware-consistency` test only checks that the version
> *string* is embedded in the hex — it can't verify the hex was actually compiled from
> `spikerbit-clue.ts`. Always confirm real behavior with the bench-test firmware after a
> re-export; the hex is a hand-built binary, not a reproducible in-repo build.

## Bench-test firmware

Two diagnostic programs (never flashed by CLUE — paste into MakeCode and use the
"Show console Device" plotter) used to develop and validate the v3 envelope:

- [`spikerbit-emg-test.ts`](./spikerbit-emg-test.ts) — streams the raw P1 signal
  alongside the extension's `musclePowerSignal()` envelope.
- [`spikerbit-envelope-test.ts`](./spikerbit-envelope-test.ts) — prints the achieved
  sample rate and compares our baseline-relative full-wave envelope against the
  extension's, side by side.

## Spiker:bit hardware reference (pinout & power)

From the Backyard Brains [Spiker:bit technical schematic][schematic] (`SpikerBit_V421`,
2025-01-14). Useful when adding firmware that touches new pins.

### micro:bit pin usage

| Pin | Use on the Spiker:bit |
|-----|-----------------------|
| P0  | Servo control signal (connector J1, pin 3) |
| P1  | EMG signal (analog in), routed to the P1 edge pad via solder-jumper JP2 |
| P2  | **Free** analog-in, broken out on the "2" edge pad — the pin to use for new analog inputs |
| P8, P9 | Analog front-end mode select — held low (`0/0`) for EMG (`P9=1` selects EEG) |
| P3, P4, P6, P7, P9, P10 | Shared with the LED matrix columns |
| P5 / P11 | Button A / Button B; P12 reserved (accessibility) |

Servo connector **J1** (M20-9960345) is a standard 3-pin header: pin 1 = GND,
pin 2 = **+5 V**, pin 3 = P0 signal.

### Power

`2×AA (BT2) → reverse-protect MOSFET (Q2) → power switch (SW3) → VIN (~3 V raw)`, and
VIN then feeds two PAM2401 boost converters: **U6 → +5 V** (servo V+ and analog rails)
and **U8 → +3.3 VP** (filtered by FL1 for the EMG front-end).

### Battery monitoring

Every rail downstream of VIN is **regulated (boosted)**, including the servo's +5 V V+ —
so monitoring any of them does *not* track battery charge: a boost converter holds its
output flat as the cells drain, then collapses off a cliff. (And +5 V would over-volt the
3.3 V ADC anyway.) The only way to gauge battery state is to tap the **raw VIN / battery+
node** (not exposed on any header — splice at the battery holder or switch output) through
a voltage divider into the free **P2** pin. 2×AA can reach ~3.6 V (fresh lithium), above
the 3.3 V ADC limit, so the divider is protection as well as scaling — e.g. 100 kΩ/100 kΩ
(÷2), read as `Vbatt_mV = analogReadPin(P2) / 1023 * 3300 * 2`.

[schematic]: https://docs.backyardbrains.com/assets/files/Spikerbit_Schematics-4a5f9592d8260dad3636a734aa6c08b4.pdf
