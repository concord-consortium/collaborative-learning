# Spiker:bit DataFlow firmware

`spikerbit-clue.hex` is a universal micro:bit hex (V1+V2) authored in MakeCode. It
reads the Spiker:bit's EMG signal, sends its envelope over USB serial, and drives a servo
on P0. The DataFlow tile flashes it automatically over WebUSB (via
`@microbit/microbit-connection`) when a connected micro:bit is not already running it.

It speaks the CC Device Protocol, described in
[`serial-protocols.md`](../../dataflow-tool/serial-protocols.md): one text line per message,
each ending in an XOR checksum (`*hh`). `?` gets a `hello` line naming the protocol and the
firmware version, which is how Dataflow decides whether to flash. `open session:<id>` starts a
session that sends an `emg:<value>` reading every 100 ms and ends on `close`, or when no
`ping session:<id>` has arrived for its timeout (5 s unless `open` asks for another).
`stream` and `stop` turn the same readings on and off without a session, for a plotter or a
terminal, and so does a long press of button A, outside a session. `identify` shows an icon and
plays a short sound on the built-in speaker (a V1 has no speaker, so it only shows the icon).
`servo:<angle>` sets the servo. A trailing `#n` asks for an `ok #n` reply, and errors are sent
either way.

The LED display shows how far a connection got: a waiting icon at power-up and after a session
ends, a "found" icon once Dataflow has sent `?`, a connected icon for 3 s after `open`, then
nothing for the rest of the session, and a streaming icon in free-run. `serial-protocols.md`
lists the icons.

**The board is silent until it is spoken to.** It sends no startup banner and no readings
until a session or `stream` starts them, so a board nobody is talking to doesn't fill the USB
interface chip's buffer with stale data for the next connection.

As of v3 the firmware computes the EMG envelope itself — it tracks the DC baseline
and full-wave rectifies (`envelope = EMA(|raw - baseline|)`) instead of using the
`pxt-spikerbit` extension's `musclePowerSignal()`, whose fixed 580 noise floor sits
above the board's ~511 resting baseline and misses moderate contractions. It reads the
raw signal on P1 and only needs `P8=0/P9=0` to select EMG mode, so the extension is no
longer required. See the header of `spikerbit-clue.ts` for the full rationale.

- **Source of record:** [`spikerbit-clue.ts`](./spikerbit-clue.ts) — the MakeCode
  program. This directory is excluded from the CLUE tsconfig/eslint because the
  program uses MakeCode-only globals.
- **Compiled artifact:** `spikerbit-clue.hex` — built from `spikerbit-clue.ts` by
  `npm run build:firmware` and committed, so the app build doesn't need the MakeCode
  toolchain. It is imported by the app as a string (webpack `asset/source`) in
  `dataflow-program.tsx`; TypeScript resolves the import via the ambient `*.hex` declaration
  in `src/typings.d.ts`. The file must be present for the production webpack build
  (`asset/source` reads it at build time).

## Rebuilding the hex

The hex is built from `spikerbit-clue.ts` with the MakeCode command-line tools, pinned to
exact versions in [`scripts/spikerbit-firmware/`](../../../../scripts/spikerbit-firmware/), so
the same source always produces the same hex.

1. Edit `spikerbit-clue.ts`.
2. If behavior changed, bump the `firmware:` number in its `HELLO` line and
   `kSpikerbitFirmwareVersion` in `src/models/stores/spikerbit-device.ts`.
3. Run `npm run build:firmware`. It reinstalls the pinned toolchain into
   `scripts/spikerbit-firmware/node_modules` (about 550 MB) with `npm ci`, compiles, and
   overwrites `spikerbit-clue.hex`. A compile error is printed and leaves the hex untouched.
4. Commit the source and the hex together. Any edit to the source changes the hex, even a
   comment, because the hex embeds the source.

Two checks keep them in sync:

- **Jest** (`spikerbit-firmware-consistency.test.ts`) checks the version numbers, and checks
  that the source embedded in the hex equals `spikerbit-clue.ts`.
- **The `CI Firmware` workflow** runs on every pull request that changes this directory or the
  build tooling, and on master when a merge changes them. Like `npm run check:firmware`, it
  rebuilds the hex and fails if it differs from the committed one.

Behavior changes still need a bench test on real hardware; the checks only prove the hex
was built from the source. `npm run bench:spikerbit -- --flash --expect-identify` flashes a
plugged-in board and checks its protocol replies (see [`scripts/spikerbit-bench/`](../../../../scripts/spikerbit-bench/)).

### Prototyping in the MakeCode editor

Importing `spikerbit-clue.hex` into <https://makecode.microbit.org> opens its embedded source.
That's handy for trying changes with the simulator or the device console, but copy the
result back into `spikerbit-clue.ts` and rebuild with `npm run build:firmware`. Don't commit a
hex exported from the website: the website adds files to the embedded project (and may run a
newer MakeCode), so the CI check fails.

### Upgrading MakeCode

Change `pxt-core` and `pxt-microbit` in `scripts/spikerbit-firmware/package.json` together
(exact versions; the micro:bit target's `package.json` names the `pxt-core` it was built
with), run `npm --prefix scripts/spikerbit-firmware install`, rebuild, and bench test. The
build records the versions in the hex itself.

## Testing the firmware in Jest

The MakeCode simulator can't receive serial input, and no emulator runs a micro:bit V2 hex,
so Jest runs `spikerbit-clue.ts` itself on a simulated MakeCode runtime,
[`MakeCodeSim`](../../../models/stores/spikerbit-sim/makecode-sim.ts). It transpiles the
source with `typescript`, runs it against fake MakeCode globals on a simulated clock, and
lets a test send serial input, read serial output, click or long-press a button, set the
analog input on a pin, and check the servo angle, the icon shown and the sounds played. It acts
as a micro:bit V2 unless it is loaded with `hardwareVersion: "1"`; then, like a V1, it panics
if the program turns the speaker on or plays a sound expression.

- **Only what the firmware uses is faked.** Calling anything else throws
  `not simulated: <name>`; add a fake to `makecode-sim.ts` when the firmware starts using
  something new.
- **The loop rule.** `basic.pause` ends the current pass of a `forever` or background loop,
  and the simulator calls the function again for the next pass. So a loop pauses only as
  its last statement, a background loop (`while (true) { ...; basic.pause(n) }`) keeps its
  state outside the function, and event handlers don't pause at all. A one-off wait, such
  as how long an icon stays, is timed from the `forever` loop with `control.millis()`
  deadlines, and display calls pass an interval of 0 so they don't pause. The header of
  `spikerbit-clue.ts` states the same rule.
- `basic.pause(0)` lets 2 ms pass, about one pass of the sampler on a V2, and the `forever`
  loop sleeps 20 ms after every pass, as MakeCode's does.
- **The serial receive buffer** holds 20 characters unless the firmware calls
  `serial.setRxBufferSize`, and a longer line is truncated, as on the board.

These tests check the program's logic, not its timing on the board or the compiled hex.

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
