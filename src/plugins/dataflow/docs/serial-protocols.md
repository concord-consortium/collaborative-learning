# Dataflow serial wire protocols

What actually goes over the wire between Dataflow and the hardware it talks to. For how
those bytes move through the browser and into the tile (transports, `SerialDevice`, the
parsers, flashing), see [serial.md](serial.md).

Dataflow speaks three wire protocols, named in
`src/plugins/dataflow/model/utilities/device-capabilities.ts`:

| Protocol | Spoken by | Transport | Baud |
|---|---|---|---|
| `keyValue` | Arduino running `ccemgfsr.ino` | Web Serial | 9600 |
| `radioHub` | micro:bit running the "communicator" program, relaying to radio hubs | Web Serial | 9600 |
| `ccDevice` ([CC Device Protocol](#cc-device-protocol)) | Spiker:bit (micro:bit running `spikerbit-clue.hex`, firmware 4) | WebUSB (`@microbit/microbit-connection`) | 115200, the micro:bit default |

All three are line-based ASCII. `keyValue` and `radioHub` have no checksums, no
acknowledgments and no heartbeat, and neither side waits for a reply. The CC Device Protocol
adds checksums, acknowledgments, identification and a session kept alive by the host.

## Line framing

- **Device to Dataflow:** each message is one line ending in `\r\n`. Arduino's
  `Serial.println` and MakeCode's `serial.writeLine` both end lines this way.
- **Dataflow to device:** each message is one line ending in `\n`. Both transports append
  the `\n` (`WebSerialTransport.write`, `MicrobitUsbTransport.write`). A CC Device Protocol
  device also accepts `\r\n`, for terminals that send it.

Inbound data arrives in chunks that ignore line boundaries (`emg:1`, `23\r`, `\nfsr:2\r\n`),
so the parsers buffer until they see a whole line. See "Reconstituting messages from the
stream" in [serial.md](serial.md). The CC Device Protocol parser does the same
(`splitLines` in `src/models/stores/cc-device-protocol.ts`), so a line split inside its
checksum or between `\r` and `\n` waits for the rest.

## `keyValue`

### Device to Dataflow: readings

```
<key>:<value>\r\n
```

`parseKeyValueData` (`src/models/stores/serial-protocol.ts`) matches
`/([a-z0-9]+):([0-9.]+)[ \t]*\r\n/`:

- `key` is lowercase letters and digits. It is matched against the `channelId` of the
  tile's channels. The `keyValue` channel ids are `emg`, `fsr`, `tmp` and `a1`
  (`src/plugins/dataflow/model/utilities/channel.ts`).
- `value` is digits and dots only. There is no sign, so a negative reading (for example a
  temperature of `-1.5`) does not match and the line is dropped.
- The value is stored with `Math.round`, so the fractional part of a reading such as
  `tmp:23.75` is lost.
- Spaces or tabs before `\r\n` are allowed. Spiker:bit firmware v1 and v2, which spoke
  `keyValue` as v3 did, padded every line with spaces.
- Each matching line updates every channel with that id, in every Dataflow tile, and stamps
  its `lastMessageReceivedAt`. The rete-manager marks
  a channel `missing` when that stamp gets old, which is how a Sensor node notices that its
  device stopped sending that key.
- **A complete line that doesn't match is discarded,** and a key that is not a channel id
  updates nothing. So a device can add new line types without breaking a client that
  doesn't know them, as long as the lines end in `\r\n` and don't reuse a channel id.

What the Arduino (`ccemgfsr.ino`) sends, about every 100 ms: `emg:<int>`, `fsr:<int>`,
`tmp:<float>`, `a1:<int>`, in that order. `emg` is clamped to the sensitivity range set by
the shield's button. `tmp` comes from an MLX90614 IR thermometer.

The Arduino can't be told which sensors to send or how often. The 100 ms cadence is fixed
in the sketch.

### Dataflow to device: servo angle

```
<angle>\n
```

A bare integer. It is the only output command in `keyValue`. `SerialDevice` builds it in
two ways, depending on the Live Output node's type:

- `writeToOutForServo`: `angleScale * n + angleOffset`, rounded.
- `writeToOutForBBGripper`: `angleBase - (n / 100) * sweep`, rounded, for the Backyard
  Brains claw.

The Live Output node sends a value on every tick, whether or not it changed.

The Arduino reads up to 3 characters, then calls `atoi` and `Gripper.write` (servo on
pin 2). Any line drives the servo: a non-numeric line such as `?` gives `atoi` 0 and moves
the servo to 0. A line longer than 3 characters is cut into pieces, each written as an
angle; `1234\n` writes 123 and then 0. **Sending the Arduino anything other than an angle
moves the servo.**

The Arduino has no version query and no identification. Dataflow decides a Web Serial
port is an Arduino from its USB ids (`WebSerialTransport.determineDeviceFamily`) and
assumes it runs `ccemgfsr.ino`.

## `radioHub`

A "communicator" micro:bit on USB passes lines between Dataflow and up to four "hub"
micro:bits (`a` to `d`) over the micro:bit radio, unchanged in both directions. The hubs
have the sensors and relays. The programs and the message format are in
[microbit/communicator.md](microbit/communicator.md) and [microbit/hub.md](microbit/hub.md).

### Device to Dataflow: signals

```
s<hub><element><reading>\r\n
```

`handleRadioHubStreamObj` (`src/models/stores/serial.ts`) matches
`/([sc])([abcd])([rth])([0-9.]+)\s*\r\n/`:

- `hub`: `a`, `b`, `c` or `d`.
- `element`: `t` temperature, `h` humidity, `r` relay state.
- `reading`: a number for `t` and `h` (kept with its fraction), or one digit per relay for
  `r` (for example `010`).

The line updates the channel `<element>-<hub>`, such as `t-a` or `r-b`. Lines starting
with `c` are matched but ignored.

### Dataflow to device: relay control

```
c<hub><relayIndex><value>\n
```

For example `ca11`: hub A, relay 1, on. Built by `writeToOutForMicroBitRelayHub`.

## CC Device Protocol

A line protocol for Concord devices. On the wire its name is `CCDeviceProtocol`; in Dataflow's
`DeviceProtocol` union it is `ccDevice`. This is protocol version 1. Every command can be typed by hand in a serial terminal, and readings plot
in the MakeCode and Arduino IDE serial plotters.

This section describes what every device and host must agree on. Each device adds its own
commands, outputs and states on top, and documents them; for the Spiker:bit, see
[The Spiker:bit firmware](#the-spikerbit-firmware).

The host code is `src/models/stores/cc-device-protocol.ts` (parsing and checksums) and
`src/models/stores/cc-device-session.ts` (the session). The Spiker:bit's device code is
`src/plugins/dataflow/firmware/spikerbit-clue.ts`.

A connection, with the checksums written out. The device's first line is empty (see
[Connecting](#connecting)):

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

### Lines

- One ASCII message per line. The device ends lines with `\r\n`. The host ends lines with
  `\n`, and the device accepts either.
- Tokens are separated by single spaces.
- **A host line** is an optional verb, then zero or more `name:value` assignments, then an
  optional `#n`, then an optional `*hh`. **A device line** is a reading, a reply, the
  `hello` line or an empty line.
- **A device may send empty lines,** and hosts ignore them. An empty line has no checksum. The
  reply to `!!` starts with one (see [Connecting](#connecting)).
- **A host line without a verb sets outputs,** and nothing else: `servo:90`. Every other
  command starts with a verb, so a new command can't collide with an output's name.
- **`#n`** at the end of a host command asks for an acknowledgment, `ok #n`. `n` is a decimal
  number the host chooses. Dataflow's session counts from 1 to 999 and wraps to 1, and the
  `!!` Dataflow sends when it connects counts from 1000, so a late reply to that `!!` can't be
  taken for the session's. A command without `#n` gets no `ok`, so an output sent on every
  tick gets no reply. Errors are sent either way. A well-formed `?` gets the `hello` line, and
  never an `ok`, even with `#n`.
- **`*hh`** may end any line: the XOR of every byte before the `*`, as two hex digits, either
  case (as in NMEA 0183). A receiver that finds one checks it and drops the line if it's
  wrong; a line without one is accepted. The device puts one on every line it sends, and
  Dataflow puts one on every command except `?` (see
  [Recognizing the firmware](#recognizing-the-firmware)). A device answers a line with a bad
  checksum with `err checksum`, without the line's `#n`, which can't be trusted.

### Names and values

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

### Compatibility rules

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

### States

Every device has these two states:

| State | Entered by | Behavior |
|---|---|---|
| **Idle** | power-up; a session ending; `!!` | Sends nothing unless asked. Answers commands. |
| **Session** | `open` | Sends readings. Ends on `close`, or when no `ping` carrying its session id has arrived for the session timeout. |

A device may add states of its own outside a session. The Spiker:bit's free-run, for example,
streams readings with no keepalive, for plotters and terminals; its
[user guide](../firmware/user-guide.md#states) describes it.

- The device starts idle and sends nothing, not even a startup banner, until it is spoken to.
- **Only `open` starts a session,** and the host names it with a **session id**, an integer
  from 1 to 65535. Dataflow picks one at random for each `open`, so a stale host's id is
  unlikely to match a newer session's. The device only stores and compares it.
- `ping session:<id>` keeps that session alive. A bare `ping` is a liveness check that touches
  no session.
- If the session has lapsed, a `ping` or `close` with its id gets `err #n nosession`: the
  device has reset its settings, and the host has to `open` again.
- If a session with a different id is running, a `ping` or `close` with the old id gets
  `err #n othersession` and changes nothing, so a stale host (an old page's timer, or a
  second host) can't keep alive or close a session it doesn't own.
- An `open` from a device-specific state (such as the Spiker:bit's free-run) starts a session;
  when it ends, the device goes to idle. An `open` during a session starts a fresh one, with
  settings back to their defaults.
- A command the device doesn't allow during a session gets `err #n insession` and changes
  nothing.
- When a session ends, readings stop and every setting returns to its default. What else
  changes, such as the display, is up to the device.
- **`!!` resets the device** to its power-up state from any state, without restarting it: it
  ends any session, with no session id needed, leaves any device-specific state such as
  free-run, and returns every setting to its default. The device then looks as it did at
  power-up, apart from outputs such as a servo, which keep their positions as when a session
  ends. Replies already queued for earlier commands are still sent.
- **`!!` may end another host's session,** because the transports let only one host hold the
  device at a time: a host that has just connected owns the device, and any session running
  belongs to a host that has gone. `othersession` guards against a stale timer in a host that
  has moved on, not against a new host taking over.

### Commands and replies

| Host sends | Device does | Reply |
|---|---|---|
| `?` | Identifies itself, in any state. Changes nothing. | the `hello` line |
| `!! [#n]` | Resets the device to its power-up state, in any state. Ends any session without its id. | an empty line, then `ok #n`; nothing without `#n` |
| `open session:<id> [timeout:<ms>] [#n]` | Starts a session with that id. `session` is required. `timeout` is how long the session lasts without a `ping`; the device's documentation gives its default and the range it accepts. | `ok #n`, or `err #n value` for a missing or out-of-range value |
| `ping session:<id> [#n]` | Extends the session with that id. | `ok #n`, or `err #n value` / `err #n nosession` / `err #n othersession` |
| `ping #n` | A liveness check only, in any state. Without `#n` it does nothing. | `ok #n` |
| `close session:<id> [#n]` | Ends that session at once. | `ok #n`, or `err #n value` / `err #n nosession` / `err #n othersession` |
| `identify [#n]` | Optional: a device may support it. Draws attention to the device, in any state, for example with an icon or a sound. A device without it answers `err #n unknown`. | `ok #n` |

Every device answers `?`, `!!`, `open`, `ping` and `close`. A device adds its own commands and
outputs, such as the Spiker:bit's `servo`, `stream` and `stop`; see its documentation.

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
`firmware` changes with every firmware release, which is how Dataflow keeps boards up to
date; `version` changes only for an incompatible protocol change.

### Timing

- A host sends `ping session:<id> #n` well inside the session timeout, and re-sends an `open`
  that gets no `ok`. Dataflow pings every 1 s during a session, and re-sends an unanswered
  `open` every 2 s.
- A device's own timeouts and intervals, such as its default session timeout, the range
  `open` accepts and how often it sends readings, are in its documentation. The Spiker:bit's
  are in [its user guide](../firmware/user-guide.md#timing-and-limits).

Chrome slows timers in hidden tabs, so a session can lapse while its tab is hidden. That is
recoverable: the next `ping` gets `err nosession`, and Dataflow opens a new session.

### Reserved

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

### Connecting

While nobody reads a device's output, it can pile up between the device and the host. On a
micro:bit V2, the USB interface chip keeps about 500 bytes; once that is full it keeps the
oldest bytes and drops the rest, so the backlog usually ends in a cut-off line. A host that
connects reads that backlog first, and a reply it is waiting for can arrive glued onto the
fragment and fail its checksum. A device still streaming, in a session whose host has gone or
in a state of its own such as the Spiker:bit's free-run, keeps the backlog full until a host
stops it.

So a host's first write after connecting is two lines, `!! #n` and then `?`, sent bare,
without a checksum, so that older firmware answers too (see
[Recognizing the firmware](#recognizing-the-firmware)). The `!!` stops whatever the device was
doing, and the empty line before its `ok` ends any cut-off line, so the `ok` and the `hello`
line after it each start a line of their own. Then:

- **`ok #n` followed by a valid `hello` line:** the device is reset and identified.
- **Older firmware** ignores `!!` and answers `?` its own way.
- **If neither arrives,** the replies may have been dropped while the device's output buffer
  was still full. Once that backlog has been read, the host writes `!! #m` and `?` again.

The `hello` line gets no empty line before it: after `!!`, the `ok`'s empty line has already
ended any fragment.

Dataflow counts the backlog as read at the first WebUSB read shorter than the 62 bytes one read
can return, or after 100 ms with no data. It writes `!!` and `?` again if nothing is identified
200 ms after that, and flashes the board if nothing is identified within 1.5 s; see
[Spiker:bit version check and flashing](serial.md#spikerbit-version-check-and-flashing).

### Recognizing the firmware

A host recognizes the firmware by sending `?`, after `!!` (see [Connecting](#connecting)),
and reading the reply. It sends that `?` without a checksum, because Spiker:bit firmware older
than 4 compares the whole line to `?`, and ignores `!!`. Firmware v1–v3 spoke `keyValue` and
answered with the v1–v3 banner, `CLUE-SPIKERBIT v<N>`, which Dataflow recognizes so that it
flashes those boards; see
[Spiker:bit version check and flashing](serial.md#spikerbit-version-check-and-flashing).
Firmware 4 never sends that banner's text, so a Dataflow build that knows only v3 flashes its
own hex rather than accept a board it can't talk to.

### Dataflow's session

`SerialDevice.setActiveDevice` starts a `CcDeviceSession` for a device whose protocol is
`ccDevice`:

1. It sends `open session:<id> #n` with a random id, and re-sends it every 2 s until an
   `ok` arrives.
2. It then sends `ping session:<id> #n` every second. Each `ok` stamps `lastHeartbeatAt`,
   which stops advancing when the board stops answering.
3. On `err nosession` it opens a new session with a new id; on `err othersession` it stops,
   since another host owns the board.
4. Disconnecting sends `close session:<id>` (`SerialDevice.endSession`), so the board shows
   the waiting icon at once instead of after the timeout.

A Live Output servo node sends `servo:<angle>` on every tick, without `#n`. Each reading
updates every channel whose `channelId` is the reading's name, in every registered tile, and
stamps its `lastMessageReceivedAt`; other lines are ignored.

### The Spiker:bit firmware

The Spiker:bit firmware is the first device to speak the protocol. Its commands, displays and
timing are in its [user guide](../firmware/user-guide.md), and its internals in the header of
[`spikerbit-clue.ts`](../firmware/spikerbit-clue.ts). The design and the reasoning behind it
are recorded in
[the design spec](../../../../docs/superpowers/specs/2026-10-20-clue-728-spikerbit-firmware-protocol-design.md).

## What `keyValue` and `radioHub` don't do

The gaps in the two older protocols, as facts about their wire format. The CC Device
Protocol fills the liveness, acknowledgment, identification, output, integrity and value-range
gaps, and reserves `caps` and `set` for discovery and configuration.

- **No liveness signal.** Dataflow can only infer that data stopped from the per-channel
  `lastMessageReceivedAt` stamps. Nothing distinguishes a quiet device from a lost
  connection, and a device can't tell whether Dataflow is still listening.
- **No acknowledgments.** Dataflow never learns whether a command arrived or was acted on.
- **No identification or capability discovery.** What sensors and outputs a device has is
  hard-coded in `kDeviceCapabilities` and the channel list, by device family.
- **No configuration.** The device decides which readings to send and how often.
- **Only one output, unnamed.** The servo command is a bare number with no key, so a
  second output needs a new command form.
- **No integrity checks.** A corrupted line that still matches the pattern is accepted.
- **Value range.** Readings can't be negative and are rounded to integers on
  `keyValue`.
- **The Arduino sketch treats every line as a servo angle.** Anything new sent to an
  Arduino running `ccemgfsr.ino` moves its servo, so new commands can only go to devices
  that are known to understand them. The Arduino therefore stays on `keyValue`.
