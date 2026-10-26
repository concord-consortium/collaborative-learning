# CC Device Protocol

A line protocol for Concord devices. On the wire its name is `CCDeviceProtocol`. This is
protocol version 1. Every command can be typed by hand in a serial terminal, and readings plot
in the MakeCode and Arduino IDE serial plotters.

This page describes what every device and host must agree on. Each device adds its own
commands, outputs and states on top, and documents them; for the Spiker:bit, see
[The Spiker:bit firmware](#the-spikerbit-firmware).

The Spiker:bit firmware (`spikerbit-clue.hex`, firmware 4) speaks it over WebUSB
(`@microbit/microbit-connection`) at 115200 baud, the micro:bit default. Dataflow's code for it
is `src/models/stores/cc-device-protocol.ts` (parsing and checksums) and
`src/models/stores/cc-device-session.ts` (the session); how Dataflow connects and runs a
session is in [serial.md](serial.md#the-cc-device-protocol-session). The Spiker:bit's device
code is `src/plugins/dataflow/firmware/spikerbit-clue.ts`.

Dataflow's two older protocols, `keyValue` and `radioHub`, and the gaps this protocol fills, are
in [serial-protocols.md](serial-protocols.md). For how bytes move through the browser and into
the tile, see [serial.md](serial.md).

A connection, with the checksums written out. The device's first line is empty (see
[Connecting](#connecting)). Dataflow numbers the `#n` on its connect-time `!!` from 1000; see
[serial.md](serial.md#spikerbit-version-check-and-flashing).

```
Dataflow:   !! #1000*02
Spiker:bit:
Spiker:bit: ok #1000*06
Dataflow:   ?
Spiker:bit: hello protocol:CCDeviceProtocol version:1 device:spikerbit firmware:4*65
Dataflow:   open session:4821 #1*4D
Spiker:bit: ok #1*36
Spiker:bit: emg:12*56
Dataflow:   ping session:4821 #2*4A
Spiker:bit: ok #2*35
Dataflow:   servo:90*4E
Dataflow:   close session:4821*1D
```

## Lines

- One ASCII message per line. The device ends lines with `\r\n`. The host ends lines with
  `\n`, and the device accepts either.
- Inbound data arrives in chunks that ignore line boundaries, so Dataflow's parser
  (`splitLines` in `src/models/stores/cc-device-protocol.ts`) buffers until it sees a whole
  line: a line split inside its checksum or between `\r` and `\n` waits for the rest.
- Tokens are separated by single spaces.
- **A host line** is an optional verb, then zero or more `name:value` assignments, then an
  optional `#n`, then an optional `*hh`. **A device line** is a reading, a reply, the
  `hello` line or an empty line.
- **A device may send empty lines,** and hosts ignore them. An empty line has no checksum. The
  reply to `!!` starts with one (see [Connecting](#connecting)).
- **A host line without a verb sets outputs,** and nothing else: `servo:90`. Every other
  command starts with a verb, so a new command can't collide with an output's name.
- **`#n`** at the end of a host command asks for an acknowledgment, `ok #n`. `n` is a decimal
  number the host chooses. A command without `#n` gets no `ok`, so an output sent on every
  tick gets no reply. Errors are sent either way. A well-formed `?` gets the `hello` line, and
  never an `ok`, even with `#n`.
- **`*hh`** may end any line: the XOR of every byte before the `*`, as two hex digits, either
  case (as in NMEA 0183). A receiver that finds one checks it and drops the line if it's
  wrong; a line without one is accepted. The device puts one on every line it sends. A host
  should put one on every command except the `?` that recognizes the firmware (see
  [Recognizing the firmware](#recognizing-the-firmware)). A device answers a line with a bad
  checksum with `err checksum`, without the line's `#n`, which can't be trusted.

**Why a checksum over USB.** USB checks every packet it carries and retries a bad one, so bytes
aren't corrupted on the cable. They can be lost at either end, though. The micro:bit's USB
interface chip drops bytes that arrive while its buffer is full (see [Connecting](#connecting)),
and the device drops bytes that arrive while its own receive buffer is full. A line with a lost
byte can still parse: `emg:1234` missing a digit becomes `emg:124`. The checksum catches any
single lost byte. It almost always catches two lines run together when the end of one and the
start of the next were lost: about 1 in 256 such lines still passes, when the lost bytes happen to
XOR to the same value. It doesn't catch a line lost whole: a command's `#n` covers that, since its `ok`
never arrives. It also misses two equal bytes lost from the same line, because they cancel out in
the XOR.

## Names and values

- **Names are opaque paths** of lowercase letters, digits, `_` and `/`. `/` separates a
  sub-device from its sensor or output, as in `a/temp` for the temperature sensor on radio
  hub `a`. A name means only what the device says it means; neither side derives anything
  from its shape.
- **`.` is reserved for settings of a sensor or output,** `<name>.<setting>`, as in
  `emg.rate`. Settings of the whole device have no `.`.
- **`!` is reserved for the reset command, `!!`.** No other verb, name or value contains it, so
  a cut-off or merged line can't turn into a reset: only a line that is exactly `!!`, with an
  optional `#n` and an optional `*hh`, resets the device, and any other line whose verb
  contains `!` (`!`, `!!!`, `!! x:1`) gets `err unknown`.
- **Values are single tokens:** no spaces, `:`, `#`, `*` or `!`. Readings are numbers, with an
  optional sign and fraction (`-1.5`). Other values may be words, as in the `hello` line.
- **An output may report its state** as a reading under its own name: a relay set with
  `a/relay1:1` reports `a/relay1:1`.

## Compatibility rules

These let either side be newer than the other, so features are added to version 1 without
changing the version. The version changes only for an incompatible change.

1. **Hosts ignore what they don't recognize:** device lines with an unknown verb, and
   readings with an unknown name.
2. **Devices reject what they don't recognize:** an unknown verb or name gets
   `err #n unknown`, and nothing on that line is applied. That's how a host finds out what a
   device supports.
3. **Replies can arrive late and out of order,** with other lines in between. Hosts match
   them by `#n`, never by position. A device that relays commands sends `ok` only once the
   command has been carried out.
4. **A device may send `cap` lines at any time,** not only in answer to `caps` (reserved, see
   below).

## States

Every device has idle and session. Free-run is optional, like `identify`: a device without it
answers `stream` and `stop` with `err #n unknown`.

| State | Entered by | Behavior |
|---|---|---|
| **Idle** | power-up; a session ending; `stop`; `!!` | Sends nothing unless asked. Answers commands. |
| **Session** | `open` | Sends readings. Ends on `close`, or when no `ping` carrying its session id has arrived for the session timeout. |
| **Free-run** (optional) | `stream`, from idle | Sends readings with no keepalive, for plotters and terminals. Ends on `stop` or `!!`, to idle, or on `open`, to a session. |

A device may add other states of its own outside a session, and documents them. It may also
offer its own way into and out of free-run, such as the Spiker:bit's button.

- The device starts idle and sends nothing, not even a startup banner, until it is spoken to.
- **Only `open` starts a session,** and the host names it with a **session id**, an integer
  from 1 to 65535. A host picks one at random for each `open`, so a stale host's id is
  unlikely to match a newer session's. The device only stores and compares it.
- `ping session:<id>` keeps that session alive. A bare `ping` is a liveness check that touches
  no session.
- If the session has lapsed, a `ping` or `close` with its id gets `err #n nosession`: the
  device has reset its settings, and the host has to `open` again.
- If a session with a different id is running, a `ping` or `close` with the old id gets
  `err #n othersession` and changes nothing, so a stale host (an old page's timer, or a
  second host) can't keep alive or close a session it doesn't own.
- An `open` from free-run, or from a state of the device's own, starts a session; when it
  ends, the device goes to idle. An `open` during a session starts a fresh one, with settings
  back to their defaults.
- Free-run has no session id and no keepalive, so it runs until something stops it. A host
  that wants readings opens a session instead, so that they stop when the host goes away.
- A command the device doesn't allow during a session gets `err #n insession` and changes
  nothing.
- When a session ends, readings stop and every setting returns to its default. What else
  changes, such as the display, is up to the device.
- **`!!` resets the device** to its power-up state from any state, without restarting it: it
  ends any session, with no session id needed, leaves free-run and any state of the device's
  own, and returns every setting to its default. The device then looks as it did at
  power-up, apart from outputs such as a servo, which keep their positions as when a session
  ends. Replies already queued for earlier commands are still sent.
- **`!!` may end another host's session,** because the transports let only one host hold the
  device at a time: a host that has just connected owns the device, and any session running
  belongs to a host that has gone. `othersession` guards against a stale timer in a host that
  has moved on, not against a new host taking over.

## Commands and replies

| Host sends | Device does | Reply |
|---|---|---|
| `?` | Identifies itself, in any state. Changes nothing. | the `hello` line |
| `!! [#n]` | Resets the device to its power-up state, in any state. Ends any session without its id. | an empty line, then `ok #n`; nothing without `#n` |
| `open session:<id> [timeout:<ms>] [#n]` | Starts a session with that id. `session` is required. `timeout` is how long the session lasts without a `ping`; the device's documentation gives its default and the range it accepts. | `ok #n`, or `err #n value` for a missing or out-of-range value |
| `ping session:<id> [#n]` | Extends the session with that id. | `ok #n`, or `err #n value` / `err #n nosession` / `err #n othersession` |
| `ping #n` | A liveness check only, in any state. Without `#n` it does nothing. | `ok #n` |
| `close session:<id> [#n]` | Ends that session at once. | `ok #n`, or `err #n value` / `err #n nosession` / `err #n othersession` |
| `identify [#n]` | Optional: a device may support it. Draws attention to the device, in any state, for example with an icon or a sound. A device without it answers `err #n unknown`. | `ok #n` |
| `stream [#n]` | Optional, with free-run. Starts free-run from idle. In free-run it changes nothing. | `ok #n`, or `err #n insession` |
| `stop [#n]` | Optional, with free-run. Stops free-run, back to idle. In idle it changes nothing. | `ok #n`, or `err #n insession` |

Every device answers `?`, `!!`, `open`, `ping` and `close`. A device adds its own commands and
outputs, such as the Spiker:bit's `servo`; see its documentation.

`ok #n` is sent only when the command had a `#n`. Only `open`, `ping` and `close` carry the
session id; outputs such as `servo` don't, since they are sent on every tick and the
transports allow one host at a time.

**Readings:** one `name:value` reading per line, so both serial plotters plot it: MakeCode
reads only the first `name:value` on a line, and the Arduino IDE ignores the `*hh` after the
number. Reply lines contain no `:`, so neither plots them.

**Replies:**

- `ok #n`: the command arrived, its checksum (if any) was valid, it was understood, and it has
  been applied.
- `err [#n] <reason>`, sent even without `#n` so a person typing in a terminal sees it. The
  reasons are `checksum`, `unknown` (a verb or name the device doesn't know), `value` (a
  value it can't use), `insession` (a command the device doesn't allow during a session),
  `nosession` (no session is running) and `othersession` (a session with a different id is
  running).
- A line is checked as a whole before any of it is applied, so one bad value on a line with
  several assignments changes nothing.

**The `hello` line** names the protocol (`protocol:CCDeviceProtocol`), its version
(`version:1`), the device (`device:<name>`, such as `device:spikerbit`) and its firmware build
(`firmware:<n>`).
`firmware` changes with every firmware release, so a host can tell when a board's firmware is
out of date; `version` changes only for an incompatible protocol change.

## Timing

- A host sends `ping session:<id> #n` well inside the session timeout, and re-sends an `open`
  that gets no `ok`.
- A device's own timeouts and intervals, such as its default session timeout, the range
  `open` accepts and how often it sends readings, are in its documentation. The Spiker:bit's
  are in [its user guide](../firmware/user-guide.md#timing-and-limits).

Chrome slows timers in hidden tabs, so a browser host's session can lapse while its tab is
hidden. That is recoverable: the next `ping` gets `err nosession`, and the host opens a new
session.

## Reserved

Defined so that they fit later, and not built yet. A device that doesn't support one
answers `err #n unknown`.

- **`caps`**: one `cap` line per sensor and per output, then `ok #n`, something like
  `cap sensor:emg min:0 max:1023 rate:100`. The fields are settled when it is built.
- **`set`**: changes settings, which all return to their defaults when the session ends. One
  line may set several, checked as a whole.
- **Per-sensor settings**: `set emg.on:0|1` and `set emg.rate:<ms>`.
- **Binary mode**: `set mode:bin #n`, acknowledged in text, then binary frames (COBS framing
  with a CRC-16 is the current plan). It ends with the session, so every session starts in
  text.
- **New outputs** take the same `name:value` form, such as the LED display and sound.

## Connecting

While nobody reads a device's output, it can pile up between the device and the host. On a
micro:bit V2, the USB interface chip keeps about 500 bytes; once that is full it keeps the
oldest bytes and drops the rest, so the backlog usually ends in a cut-off line. A host that
connects reads that backlog first, and a reply it is waiting for can arrive glued onto the
fragment and fail its checksum. A device still streaming, in free-run or in a session whose
host has gone, keeps the backlog full until a host stops it.

So a host's first write after connecting is two lines: `!! #n` with its checksum, and then a
bare `?` without one, so that older firmware answers too (see
[Recognizing the firmware](#recognizing-the-firmware)). The `!!` stops whatever the device was
doing, and the empty line before its `ok` ends any cut-off line, so the `ok` and the `hello`
line after it each start a line of their own. Then:

- **`ok #n` followed by a valid `hello` line:** the device is reset and identified.
- **Older firmware** ignores `!!` and answers `?` its own way.
- **If neither arrives,** the replies may have been dropped while the device's output buffer
  was still full. Once that backlog has been read, the host writes `!! #m` and `?` again.

## Recognizing the firmware

A host recognizes the firmware by sending `?`, after `!!` (see [Connecting](#connecting)),
and reading the reply. It sends that `?` without a checksum, because Spiker:bit firmware older
than 4 compares the whole line to `?`, and ignores `!!`. Firmware v1–v3 spoke `keyValue` and
answered with the v1–v3 banner, `CLUE-SPIKERBIT v<N>`, which Dataflow recognizes so that it
flashes those boards; see
[Spiker:bit version check and flashing](serial.md#spikerbit-version-check-and-flashing).
Firmware 4 never sends that banner's text, so a Dataflow build that knows only v3 flashes its
own hex rather than accept a board it can't talk to.

## The Spiker:bit firmware

The Spiker:bit firmware is the first device to speak the protocol. Its commands, displays and
timing are in its [user guide](../firmware/user-guide.md), and its source is
[`spikerbit-clue.ts`](../firmware/spikerbit-clue.ts). The design and the reasoning behind it
are recorded in
[the design spec](../../../../docs/superpowers/specs/2026-10-20-clue-728-spikerbit-firmware-protocol-design.md).
