# CLUE-728: Spiker:bit firmware status and the CC Device Protocol

Design for [CLUE-728](https://concord-consortium.atlassian.net/browse/CLUE-728)
("Spiker:bit firmware reports that it is connected and working"): the serial protocol, the
firmware that speaks it, and the Dataflow code that speaks the other end. The Dataflow UI for
this story (the "connection stopped" display and the "Is it alive?" button) is designed
separately; it builds on the connect pane CLUE-716 added.

The current wire protocols are documented in
[serial-protocols.md](../../../src/plugins/dataflow/docs/serial-protocols.md). Read it first.

## Why

CLUE-728 needs things the current `keyValue` protocol can't express: a heartbeat,
acknowledgments of commands, an "are you alive?" check, and a way for the firmware to tell
"waiting for Dataflow" from "connected". CLUE-715 then adds more sensors and outputs, and
Dataflow will need to learn what a board provides.

Rather than bolt these onto `keyValue`, we add **one new protocol type**, alongside `keyValue`
and `radioHub`. It is designed now so that the features we expect later can be added to it
without a fourth protocol type:

- the device describing which sensors and outputs it has, ideally including whether the
  Spiker:bit shield is attached;
- the host choosing which sensors the device reads and how often;
- a binary mode, for slow links carrying several sensors with many-digit values;
- checksums on commands and responses.

Rate control and binary mode share a motivation: don't send data the host isn't using, and
don't waste a slow link. On the Spiker:bit, serial traffic may also compete with EMG
sampling.

## Scope

**CLUE-728 builds:** the protocol's framing, identification, sessions with keepalive,
acknowledgments, the alive check, free-run mode, the servo output, EMG readings, and the LED
status icons, in firmware version 4. And the Dataflow side of the protocol: recognizing v4,
the keepalive, parsing, and sending the servo command (see "Dataflow protocol code"). The
Dataflow UI comes later, in the same feature branch (see "Delivery").

**Designed here, built later:** capability discovery, shield detection, per-sensor selection
and rates, binary mode, and the display and sound outputs CLUE-715 adds. These are reserved
commands with defined behavior, so that a later story fills them in without redesigning.

**Not in scope:** the Dataflow UI; the Arduino (it keeps `keyValue`, because
`ccemgfsr.ino` treats any line as a servo angle, so new commands would move its servo); the
radio-hub micro:bit setup.

**Anti-goal:** a protocol that only Dataflow can talk to. A person with a serial terminal
should be able to drive it by hand, and a person debugging in the MakeCode or Arduino serial
plotter should be able to see readings.

## Prior art

No existing protocol fits well enough to adopt: firmware written in MakeCode TypeScript, a
browser host, and a model built around sensors rather than pins. This design borrows from:

| Idea | Source |
|---|---|
| ASCII lines with an optional `*hh` XOR checksum | NMEA 0183 |
| Identification and capability queries | Firmata (`REPORT_FIRMWARE`, `CAPABILITY_QUERY`), Telemetrix (`GET_FEATURES`), Vernier Go Direct (sensor id list plus per-sensor info) |
| Per-sensor on/off and rate | Jacdac sensor services (`streaming_interval`), Go Direct (`START_MEASUREMENTS` with a channel mask) |
| Streaming that stops unless the host renews it | Jacdac (`streaming_samples`, rewritten by the client about once a second) |
| Acks matched by a host-chosen sequence number; explicit "not implemented" errors | Go Direct (rolling counter), Jacdac (`ACK_REQUESTED`, `command_not_implemented`) |
| Binary framing for later | COBS with a CRC-16, as in Jacdac's frames; MIN as a fuller example |

Jacdac came closest and has all of these. We didn't adopt it because its micro:bit browser
transport uses its own WebUSB connection, which would compete with
`@microbit/microbit-connection` (our flashing and serial library), its MakeCode runtime is
large, it is binary only, and it has no standard EMG service.

## The protocol

**Name: CC Device Protocol** (CC for Concord Consortium), because other Concord applications
may use it. It covers outputs as well as sensors and will get a binary mode, so the name
avoids "sensor", "serial" and "line". On the wire it is spelled out in full, as
`CCDeviceProtocol`, in the identification line. In Dataflow's `DeviceProtocol` union it is
`ccDevice`, matching the style of `keyValue` and `radioHub`.

### Lines

- One ASCII message per line. The device ends lines with `\r\n`. The host ends lines with
  `\n`, and the device accepts either.
- Tokens are separated by single spaces.
- **`name:value`** is the one form for every value: readings from the device, outputs and
  settings from the host. `:` is used, not `=`, because both the MakeCode and Arduino IDE
  serial plotters recognize `name:value` (see "Plotters" below).
- **`#n`** at the end of a host command asks for an acknowledgment, which echoes `#n`. `n`
  is a decimal number the host chooses. `#n` is optional on every command, and commands
  without it get no `ok`; that lets outputs sent on every Dataflow tick (the servo) skip
  replies. Errors are sent either way. Dataflow adds `#n` wherever it needs the reply
  (`open`, `ping`, `identify`). The one exception is `?`, which always replies with the
  `hello` line, since getting it is the command's whole purpose.
- **`*hh`** may end any line: the XOR of every byte before the `*`, as two hex digits
  (NMEA style). A receiver that finds one checks it and drops the line if it's wrong; a line
  without one is accepted. The firmware adds a checksum to every line it sends. Dataflow
  should add one to every command. A person typing in a terminal can leave it off.

So a host line is: an optional verb, then zero or more `name:value` assignments, then an
optional `#n`, then an optional `*hh`. A device line is a reading, a reply or the
identification line.

**A host line without a verb sets outputs,** and nothing else: `servo:90`. Everything else
starts with a verb, so a new kind of command is a new verb and can't collide with an
output's name. Settings use the `set` verb (see "Reserved for later").

### Names and values

- **Names are opaque paths.** A name is lowercase letters, digits, `_` and `/`. `/`
  separates a sub-device from its sensor or output, as in `a/temp` for the temperature
  sensor on radio hub `a`. Names mean only what the device says they mean (later, through
  `caps`); neither side derives anything from their shape.
- **`.` is reserved for settings of a sensor or output:** `<name>.<setting>`, as in
  `set emg.rate:50` or `set a/temp.rate:1000`. Settings of the whole device have no `.`, as
  in `set mode:bin`.
- **Values are single tokens:** no spaces, `:`, `#` or `*`. Readings are numbers, with an
  optional sign and fraction. Other values may be words, as in the `hello` line.
- **An output may report its state** as a reading under its own name. A relay set with
  `a/relay1:1` reports `a/relay1:1`.

### Compatibility rules

These let either side be newer than the other without breaking it, so features are added
to version 1 without changing the version:

1. **Hosts ignore what they don't recognize:** device lines with an unknown verb, and
   readings with an unknown name.
2. **Devices reject what they don't recognize:** an unknown verb or name gets
   `err #n unknown`, and nothing on that line is applied. That's how a host finds out what
   a device supports.
3. **Replies can arrive late and out of order,** with other lines in between. Hosts match
   them by `#n`, never by position. A device that relays commands, such as the radio hub,
   sends `ok` only once the command has been carried out.
4. **A device may send `cap` lines at any time,** not only in answer to `caps`: when a radio
   hub appears, or when the Spiker:bit shield is plugged in or removed. (Reserved, like
   `caps`.)

The Spiker:bit firmware in CLUE-728 needs none of this beyond rule 2: it has one sensor and
one output, and it replies in order. The rules mostly constrain Dataflow's parser, which
must accept `/` in names, ignore unknown lines and not assume reply order, so that a
Dataflow released now doesn't break on a board built later.

### Plotters

From their parsing code
([MakeCode `serial.tsx`](https://github.com/microsoft/pxt/blob/master/webapp/src/serial.tsx),
`processMessageLine`;
[Arduino `msgAggregatorWorker.ts`](https://github.com/arduino/arduino-serial-plotter-webapp/blob/main/src/msgAggregatorWorker.ts)):

- MakeCode plots a line that **starts with** `name:value` (or a plain number). It reads only
  the first pair and ignores everything after the number, so a trailing `*hh` is harmless.
- Arduino IDE 2 plots every `name:value` pair on a line and drops words without a colon.
  It reads values with `parseFloat`, so `*hh` is harmless there too.

Therefore readings go **one per line**, `emg:512*3A`, which plots in both. Reply lines
contain no `:` so MakeCode doesn't plot them.

### Device states

| State | Entered by | Behavior |
|---|---|---|
| **Idle** | power-up; a session ending; `stop` or a long press in free-run | Sends nothing unless asked. Shows the "waiting" icon. Answers commands. |
| **Session** | `open` | Streams readings. Ends on `close`, or when no `ping` carrying its session id has arrived for the session timeout. |
| **Free-run** | `stream`, or a long press of button A, from idle | Streams readings with no keepalive. For plotters and terminals. |

- The device starts idle: a board nobody is talking to stays quiet.
- **Only `open` starts a session,** and the host names it with a **session id** it chooses,
  as an MQTT client chooses its client id. A `ping` keeps the session alive only when it
  carries that id, so the two jobs of `ping` are explicit: `ping session:<id>` is a
  keepalive, and a bare `ping` is only a liveness check that touches no session.
- If a session lapses and the host keeps pinging with its id, it gets `err #n nosession`, so
  it knows the board has reset its settings and has to `open` again. A `ping` that silently
  started a new session would leave the host believing settings were in place that the board
  had dropped.
- If a different session is running, for example because the page reloaded and opened a new
  one while the old page's timer was still firing, or because a second host connected, a
  `ping` or `close` with the old id gets `err #n othersession` and changes nothing. A stale
  host can't keep alive or close a session it doesn't own.
- Session ids are integers from 1 to 65535. Dataflow picks one at random for each `open`,
  so a stale host's id is very unlikely to match a newer session's. The board only stores
  and compares the id; it never generates one.
- An `open` while free-running starts a session; when it ends, the board goes to idle. An
  `open` during a session starts a fresh one, with settings back to their defaults.
- The long press, `stream` and `stop` are ignored during a session (`stream`/`stop` reply
  `err #n insession`), so a student who presses a button during a Dataflow program changes
  nothing. A long press, not a click or double click, because students tap buttons.
- When a session ends: readings stop, every setting returns to its default, sound stops, and
  the display shows the waiting icon. The servo keeps its position.

**Why a keepalive.** Closing the Dataflow tab or disconnecting sends nothing to the board,
and the USB stays powered, so the only sign that Dataflow left is that its messages stop.
The keepalive gives:

- the "waiting" versus "connected" states this story asks for, including going back to
  waiting;
- a fresh start for every session: settings, including a future binary mode, can't leak
  from one tab or page load into the next;
- a safe state for outputs when Dataflow disappears mid-program;
- a round-trip check: the reply shows the board is reading and acting on commands, not just
  writing;
- no backlog of old readings. The micro:bit's USB interface chip buffers about 1 KB of
  output when nobody reads (per comments in `@microbit/microbit-connection`'s
  `cdc-saturation.js`), so a board that streams while idle gives the next connection stale
  data first;
- no streaming into a stalled host, and less power used by a battery-powered board.

### Commands built in CLUE-728

| Host sends | Device does | Reply |
|---|---|---|
| `?` | Identifies itself, in any state. Changes nothing. | `hello protocol:CCDeviceProtocol version:1 device:spikerbit firmware:4` |
| `open session:<id> [timeout:<ms>] [#n]` | Starts a session with that id. `session` is required. `timeout` is how long the session lasts without a `ping`: default 5000, allowed 1000–60000. A missing or out-of-range value is `err #n value`. | `ok #n` if `#n` was given |
| `ping session:<id> [#n]` | Extends the session with that id. | `ok #n` if `#n` was given, or `err #n nosession` / `err #n othersession` |
| `ping #n` | Liveness check only; touches no session, in any state. Without `#n` it does nothing at all. | `ok #n` |
| `close session:<id> [#n]` | Ends that session at once, so the board shows the waiting icon as soon as Dataflow disconnects instead of after the session timeout. | `ok #n` if `#n` was given, or `err #n nosession` / `err #n othersession` |
| `identify [#n]` | The alive check: shows the alive icon and plays a short sound, in any state. The name comes from Jacdac's control service, whose `identify` draws attention to the device the same way. | `ok #n` if `#n` was given |
| `servo:<angle> [#n]` | Sets the servo on P0. Values are rounded and clamped to 0–180, as `servoWritePin` already does. | `ok #n` if `#n` was given |
| `stream [#n]` | Idle → free-run. | `ok #n`, or `err #n insession` |
| `stop [#n]` | Free-run → idle. | `ok #n`, or `err #n insession` |

Only `open`, `ping` and `close` carry the session id. Outputs such as `servo` don't: they are sent
on every tick, and the transports allow one host at a time, so a stale host sending outputs
is unlikely enough not to justify the extra bytes. (Claude's call.)

Readings: `emg:<int>` every 100 ms, in session and free-run, as in v3.

The `timeout` parameter on `open` follows MQTT, where the client states its keep-alive
interval when it connects. It lets Dataflow ask for a longer timeout if hidden-tab timer
throttling turns out to be a problem (see "Timing") without a firmware change.

**Replies:**

- `ok #n` means the command was received, its checksum (if any) was valid, it was
  understood, and it has been applied.
- `err [#n] <reason>`, with reasons `checksum`, `unknown` (a verb or name this firmware
  doesn't know), `value` (a value it can't use), `insession` (not allowed during a session),
  `nosession` (no session is running) and `othersession` (a session with a different id is
  running). Errors are sent even without `#n`, so a person typing in a terminal sees them.
- A line with several assignments is checked as a whole before any of it is applied, so one
  bad value means nothing changes.

**The identification line.** `hello` answers `?`, which today's Dataflow already sends.
It must not contain the text `CLUE-SPIKERBIT v`: a Dataflow build that only knows v3 then
finds "no known firmware" and flashes its own v3 hex, instead of accepting a board it can't
talk to. `firmware` continues the existing firmware numbering (`kSpikerbitFirmwareVersion`).
It changes with every firmware release, including fixes and additions that leave the
protocol version alone, which is how Dataflow keeps boards up to date (see "Recognizing the
firmware" for when it flashes). `protocol` names the protocol, so a
host can tell from the first reply what it is talking to. `version` is the protocol's
version. It changes only for incompatible changes. Additions such as new commands don't
change it, because a host can find out whether a command exists from the `err unknown`
reply. `device` lets other boards speak the same protocol later, for example an Arduino
sketch.

**The heartbeat** the story asks for is the `ok` reply to each `ping`. The device doesn't send
a separate unprompted heartbeat.

### Timing

- Dataflow sends `ping session:<id> #n` every **1 s** during a session.
- The device ends the session after the `open` timeout without a `ping` carrying its id:
  **5 s** unless
  Dataflow asks for another value.
- The connected icon shows for **3 s**; the alive icon and sound last up to **3 s**.

These numbers are starting points. Chrome slows timers in hidden tabs; after a tab has been
hidden for several minutes, chained timers can be limited to about once a minute. The
Dataflow half has to check whether a page with an open WebUSB connection is exempt. If it
isn't, either Dataflow asks for a longer timeout in `open`, or the session lapses in a hidden
tab. A lapse is acceptable: the next `ping` gets `err nosession`, and Dataflow sends `open`
again, followed by any settings it needs.

### Reserved for later

Defined now so that they fit. They are **not** built in CLUE-728; firmware v4 answers them
with `err #n unknown`.

- **`caps`**: one line per sensor and per output, then `ok #n`. Something like
  `cap sensor:emg units:... min:0 max:1023 rate:100` and `cap output:servo min:0 max:180`.
  The exact fields are settled when it's built. Whether the Spiker:bit shield is attached
  would appear here, as a field or by listing the shield's sensor and output only when it's
  present. We don't yet know whether the firmware can detect the shield; that needs
  research on the hardware.
- **`set`**: changes settings, which all reset to their defaults when the session ends. One
  line may set several, checked as a whole like any other line.
- **Per-sensor settings**: `set emg.on:0|1` and `set emg.rate:<ms>`.
- **Binary mode**: `set mode:bin #n`, acknowledged in text, then binary frames from the next
  byte onward: COBS framing with a CRC-16 is the current plan. It ends with the session, so
  every session starts in text.
- **New outputs** follow the same `name:value` form, for example the LED display and sound
  outputs in CLUE-715.

### Worked example: the radio hub

A test of whether the protocol can grow without a new version: the radio-hub micro:bit
setup (see `radioHub` in [serial-protocols.md](../../../src/plugins/dataflow/docs/serial-protocols.md))
could move to this protocol later using only the rules above. It isn't part of CLUE-728.

| radioHub needs | Today | CC Device Protocol |
|---|---|---|
| Several boards behind one USB micro:bit | the hub letter inside each message | the hub as a name prefix |
| Readings | `sat20.31`, `sah45` | `a/temp:20.31`, `a/humidity:45` |
| Relay control | `ca11` | `a/relay1:1` |
| Relay state | `sar010`, all relays in one value | `a/relay0:0`, `a/relay1:1`, `a/relay2:0` |
| Hubs coming and going | inferred from stale channels | per-channel freshness as today, plus `cap` lines sent when a hub appears |
| Commands carried over the radio | no confirmation | `ok #n` once the hub confirms, possibly after other lines |

The USB "communicator" micro:bit would be the device that speaks the protocol and keeps the
session; the hubs stay behind it on the radio.

One thing that project has to settle: Dataflow documents save a Sensor node's sensor by
channel id (`t-a`, `r-b`), so either the wire names match the existing ids or Dataflow maps
between them.

## Firmware behavior

### LED status

What the board can know: that it booted, that Dataflow sent `?`, that a session started or
lapsed, and that an alive check arrived. It cannot tell that a program opened its serial
port. (The micro:bit V2 runtime can ask whether it is powered from USB or a battery,
`getPowerSource` in CODAL, but that isn't exposed in MakeCode and can't tell a laptop running
Dataflow from a phone charger.) It also can't draw anything while being flashed: the processor
is stopped, and the yellow LED on the back flickers instead.

The icons show how far a connection got, so a stuck connection can be diagnosed:

| Stage | Trigger | Display |
|---|---|---|
| Waiting | power-up, or a session ending | the waiting icon, steady |
| Found | first `?` | a "found" icon. If it stays, Dataflow saw the board but never started a session: look at version checking and flashing. |
| Connected | `open` | the connected icon for 3 s, then the display is cleared |
| Alive check | `identify` | the alive icon for up to 3 s, then the display goes back to what the state calls for |
| Free-run | long press or `stream` | a "streaming" icon |

**CLUE-715 constraint:** students will control the LED matrix and speaker. The firmware may
use them only while connecting (until the connected icon clears) or right after an alive
check. After the connected icon clears, the firmware doesn't touch the display until the
session ends or an alive check arrives. When CLUE-715 adds a display output, the alive check
has to restore what the student's program last drew; in CLUE-728 nothing else draws during a
session, so clearing is enough.

**Builder's call:** the icon designs. They should be easy to tell apart at a glance.

### Sound

The alive check plays a short sound on the **built-in speaker only**. On a micro:bit V2,
MakeCode may also send sound to the P0 edge pin, and P0 drives the servo, so the sound could
make the servo twitch. Turn the P0 audio output off (something like
`pins.setAudioPinEnabled(false)`), and test on a board with a servo attached.

**Decision (Claude's call): the hex stays universal (V1 and V2), as it is today.** V1 has no
built-in speaker, so on a V1 the alive check shows the icon with no sound. If the V2 speaker
calls won't compile into a universal hex, or can't be guarded so that they do nothing on a V1,
stop and ask rather than switching to a V2-only hex: that would change which boards Dataflow
can flash.

### Structure

Keep the v3 pattern: the serial input handler only parses lines and records what to do, and
**every serial write happens in the main loop**, so a reply can never land inside a reading
line. Replies now need a small queue rather than a single flag. Icons and sound must not
block that loop for long enough to delay readings: play sound in the background. The EMG
sampling fiber is unchanged.

**Builder's call:** how commands are parsed and queued, the `#n` range, and whether the
connected and found icons are separate images or one.

## Dataflow protocol code

The Dataflow end of the protocol, without UI. It is written against master after CLUE-716
(#3039 and #3040), which rewrote the connection code: `SerialDevice`
(`src/models/stores/serial.ts`), `SpikerbitDevice` (`src/models/stores/spikerbit-device.ts`),
`serial-protocol.ts` and `device-capabilities.ts`.

### Recognizing the firmware

`SpikerbitDevice.queryVersion` still sends `?`, and now recognizes two replies:

- `hello protocol:CCDeviceProtocol version:<P> device:spikerbit firmware:<N>`: the new
  firmware.
- `CLUE-SPIKERBIT v<N>`: older firmware, always older than 4, so it gets flashed.
  `detectSpikerbitVersion` stays for this.

What Dataflow does with the reply. The protocol check comes first: a board Dataflow can't
talk to gets flashed with Dataflow's own firmware, even if that firmware is older.

| Reply | Dataflow |
|---|---|
| none, or not recognized | flashes |
| `CLUE-SPIKERBIT v<N>` | flashes |
| a `protocol` and `version` pair Dataflow doesn't speak (a newer protocol version, for example) | flashes, even if `firmware` is newer than its own |
| a pair it speaks, `firmware` older than `kSpikerbitFirmwareVersion` | flashes |
| a pair it speaks, `firmware` the same or newer | connects, as a newer version is accepted today |

So an older Dataflow that meets a board from a newer one keeps using it while the protocol
version still matches, and reverts it to its own firmware once it doesn't. Moving a board
back and forth between those two builds reflashes it each time.

### The protocol type

- Add the new type to `DeviceProtocol`, and map `spikerbit` to it in `kDeviceCapabilities`.
  The Arduino stays `keyValue`.
- **Channel matching has to change.** `channelSatisfiedBy` currently compares the device's
  protocol with the channel's `protocol` tag, and the `emg` channel is tagged `keyValue`.
  Switching the Spiker:bit's protocol without changing this would mark its EMG channel
  missing (`rete-manager.tsx`, `updateChannels`). **Decision (Claude's call):** give
  `DeviceCapability` an optional list of the channel ids the device provides
  (`spikerbit: ["emg"]`). When the list is present, a channel is satisfied if its id is in it;
  otherwise the protocol comparison applies as today. This is the static version of what
  `caps` will report later. A side effect: with a Spiker:bit connected, the `fsr`, `tmp` and
  `a1` channels show as missing right away, instead of after the 7 s freshness timeout.
- `SerialDevice.receive` dispatches the new protocol to a new parser in `serial-protocol.ts`.

### Parsing device lines

- Check the `*hh` checksum when present, and drop the line if it's wrong.
- **Readings** (`name:value`): update every channel whose `channelId` is `name` and stamp
  `lastMessageReceivedAt`, as `parseKeyValueData` does. Unlike `keyValue`, accept a sign and
  a fraction, and **don't round**.
- **`ok #n`** answering the latest `open` (matched by `#n`): start pinging.
- **`ok #n`** answering a `ping`: record the time of the latest one as an observable on
  `SerialDevice` (for example `lastHeartbeatAt`). The UI half uses it to show that the
  connection stopped.
- **`err #n nosession`** answering a `ping`: the session lapsed. Send `open` again (see
  "Keepalive").
- **`err #n othersession`** answering a `ping`: another session has taken the board. Stop
  pinging and log it; don't `open` again, or two hosts would keep taking the board from each
  other. The UI half decides what to show.
- **Any other `err`**: log it with `console.warn`. CLUE-727 decides what reaches the log.
- Ignore `hello` and anything unrecognized, following the compatibility rules: names may
  contain `/`, and replies may arrive late or out of order.

### Keepalive

- When a device on the new protocol becomes active (`setActiveDevice`), pick a random session id
  and send `open session:<id> #n`, with no `timeout` (the 5 s default) unless testing shows
  Dataflow needs longer. Once it's acknowledged, send `ping session:<id> #n` every 1 s. Stop when the device is
  cleared.
- If `open` gets no reply within a couple of seconds (a dropped line, for example), send it
  again.
- On `err nosession`, send `open` again, with a new random id. CLUE-728 has no settings to restore afterward;
  once settings exist, they're re-sent after the new `open`.
- On Disconnect, send `close session:<id>` before closing the connection.
- `#n` counts up and wraps. **Builder's call:** the range.

### Writing commands

- Every command gets a `*hh` checksum.
- The servo: for the new protocol, the Live Output node sends `servo:<angle>` with no `#n`,
  using the same scaling as `writeToOutForServo`. `sendDataToSerialDevice` in
  `live-output-node.ts` routes by protocol and needs a branch for the new one. The gripper
  output stays Arduino only.

**Builder's call:** whether the keepalive, the `#n` counter and the parser live in
`SerialDevice` or in a small class it owns for the new protocol.

## Delivery

- **A CLUE-728 feature branch** off master. The firmware isn't released without the UI that
  justifies it: nothing from CLUE-728 merges to master until the UI half is done.
- **First PR into the feature branch:** the firmware, the Dataflow protocol code and the docs in
  "Docs to update" at the end. They have to land together: without the protocol code, Dataflow reflashes a v4 board
  on every connect, never starts a session, can't parse its readings and can't drive its servo.
- **Later PR into the feature branch:** the UI half.
- **Bench checkpoint (Claude's call):** stop for a check on a real board once
  identification, sessions, acknowledgments and EMG streaming work, before adding the icons,
  sound and long press. The EMG sampling rate and the servo-twitch results could change how
  those are built.

## Testing

- **Jest, Dataflow side:** the parser (checksums right, wrong and absent; readings with signs
  and fractions; `ok` and `err`; `hello`); the flash decision (no reply, legacy banner, old
  `firmware`, unknown protocol version (even with a newer `firmware`), newer `firmware`); `open` then `ping` repeating and stopping, with
  fake timers; the session id chosen for `open` carried into every `ping`; re-sending an unanswered
  `open`; re-opening on `err nosession`; stopping without re-opening on `err othersession`;
  `close` on disconnect; the servo command's format; and `channelSatisfiedBy`
  with and without a channel list.
- **On the bench**, through a serial terminal at 115200 baud, since every command can be
  typed by hand: identification, a session opening, closing and lapsing (with the default and a custom
  `timeout`), a bare `ping` in every state, `ping` and `close` with a wrong or stale session
  id, acknowledgments with and
  without `#n`, each error reason, checksums right and wrong, free-run by command and by long
  press, the long press doing nothing during a session, and the alive check with a servo
  attached (no twitch).
- **Check that the EMG sampling rate doesn't drop** with replies and keepalives flowing,
  compared with v3 (about 500 Hz).
- **Plotters:** free-run readings appear in the MakeCode serial plotter.
- **Jest:** `spikerbit-firmware-consistency.test.ts` reads the version from
  `VERSION = "CLUE-SPIKERBIT v<N>"` in the source and looks for the same text in the hex. Both
  change with the new identification line.

## Docs to update with the firmware

- [serial-protocols.md](../../../src/plugins/dataflow/docs/serial-protocols.md): a section on
  the new protocol.
- The firmware [README](../../../src/plugins/dataflow/firmware/README.md) and the header
  comment in `spikerbit-clue.ts`, which both describe the v3 protocol.
