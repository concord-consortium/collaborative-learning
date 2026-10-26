# Dataflow serial wire protocols

What actually goes over the wire between Dataflow and the hardware it talks to. For how
those bytes move through the browser and into the tile (transports, `SerialDevice`, the
parsers, flashing), see [serial.md](serial.md).

Dataflow speaks two wire protocols, named in
`src/plugins/dataflow/model/utilities/device-capabilities.ts`:

| Protocol | Spoken by | Transport | Baud |
|---|---|---|---|
| `keyValue` | Arduino running `ccemgfsr.ino` | Web Serial | 9600 |
| `radioHub` | micro:bit running the "communicator" program, relaying to radio hubs | Web Serial | 9600 |

Both are line-based ASCII, with no checksums, no acknowledgments and no heartbeat, and
neither side waits for a reply.

A third, the [CC Device Protocol](cc-device-protocol.md), is defined on its own page. It is
line-based ASCII too, and adds checksums, acknowledgments, identification and a session kept
alive by the host. The Spiker:bit firmware (`spikerbit-clue.hex`, firmware 4) speaks it over
WebUSB. Dataflow's side of it, beyond parsing and checksums, isn't built yet.

## Line framing

- **Device to Dataflow:** each message is one line ending in `\r\n`. Arduino's
  `Serial.println` and MakeCode's `serial.writeLine` both end lines this way.
- **Dataflow to device:** each message is one line ending in `\n`. Both transports append
  the `\n` (`WebSerialTransport.write`, `MicrobitUsbTransport.write`).

Inbound data arrives in chunks that ignore line boundaries (`emg:1`, `23\r`, `\nfsr:2\r\n`),
so the parsers buffer until they see a whole line. See "Reconstituting messages from the
stream" in [serial.md](serial.md).

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

## What `keyValue` and `radioHub` don't do

The gaps in the two older protocols, as facts about their wire format. The
[CC Device Protocol](cc-device-protocol.md) fills the liveness, acknowledgment, identification, output, integrity and value-range
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
