# Dataflow serial wire protocols

What actually goes over the wire between Dataflow and the hardware it talks to. For how
those bytes move through the browser and into the tile (transports, `SerialDevice`, the
parsers, flashing), see [serial.md](serial.md).

Dataflow speaks two wire protocols, named in
`src/plugins/dataflow/model/utilities/device-capabilities.ts`:

| Protocol | Spoken by | Transport | Baud |
|---|---|---|---|
| `keyValue` | Arduino running `ccemgfsr.ino` | Web Serial | 9600 |
| `keyValue` | Spiker:bit (micro:bit V2 running `spikerbit-clue.hex`) | WebUSB (`@microbit/microbit-connection`) | 115200, the micro:bit default |
| `radioHub` | micro:bit running the "communicator" program, relaying to radio hubs | Web Serial | 9600 |

Both protocols are line-based ASCII with no checksums, no acknowledgments and no
heartbeat. Neither side ever waits for a reply, except for the Spiker:bit version query.

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
- Spaces or tabs before `\r\n` are allowed. Spiker:bit firmware before v3 padded every
  line with spaces.
- Each matching line updates every channel with that id, in every Dataflow tile, and stamps
  its `lastMessageReceivedAt`. The rete-manager marks
  a channel `missing` when that stamp gets old, which is how a Sensor node notices that its
  device stopped sending that key.
- **A complete line that doesn't match is discarded,** and a key that is not a channel id
  updates nothing. So a device can add new line types without breaking a client that
  doesn't know them, as long as the lines end in `\r\n` and don't reuse a channel id.

What each device sends, about every 100 ms:

| Device | Lines |
|---|---|
| Arduino (`ccemgfsr.ino`) | `emg:<int>`, `fsr:<int>`, `tmp:<float>`, `a1:<int>`, in that order. `emg` is clamped to the sensitivity range set by the shield's button. `tmp` comes from an MLX90614 IR thermometer. |
| Spiker:bit (v3) | `emg:<int>`, the smoothed EMG envelope. |

Neither device can be told which sensors to send or how often. The 100 ms cadence is
fixed in each firmware.

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

How each device reads it:

- **Arduino:** reads up to 3 characters, then calls `atoi` and `Gripper.write` (servo on
  pin 2). Any line drives the servo: a non-numeric line such as `?` gives `atoi` 0 and moves
  the servo to 0. A line longer than 3 characters is cut into pieces, each written as an
  angle; `1234\n` writes 123 and then 0. **Sending the Arduino anything other than an angle
  moves the servo.**
- **Spiker:bit:** trims the line and calls `parseFloat`. A number drives the servo on
  **P0** (`pins.servoWritePin`). A line that isn't a number and isn't `?` is ignored.

### Spiker:bit only: version query

```
Dataflow:   ?\n
Spiker:bit: CLUE-SPIKERBIT v3\r\n
```

The firmware also sends the banner once at startup. `detectSpikerbitVersion` matches
`/CLUE-SPIKERBIT v(\d+)[ \t]*\r\n/` anywhere in the stream and keeps whatever follows the
banner, so readings that arrive after it are still parsed.

`SpikerbitDevice.connectAndStream` (`src/models/stores/spikerbit-device.ts`) sends `?` and
waits up to `kVersionQueryTimeoutMs` (1.5 s). If no banner arrives, or the version isn't
`kSpikerbitFirmwareVersion`, it flashes the bundled hex and asks again. Changing the
version number therefore updates every board the next time it connects.

The banner line has no `:` after a lowercase key, so `parseKeyValueData` discards it once
streaming begins.

The Arduino has no version query and no identification. Dataflow decides a Web Serial
port is an Arduino from its USB ids (`WebSerialTransport.determineDeviceFamily`) and
assumes it runs `ccemgfsr.ino`.

### Spiker:bit firmware internals that shape the protocol

From `src/plugins/dataflow/firmware/spikerbit-clue.ts`:

- A background fiber samples P1 as fast as it can (about 500 Hz) and keeps the smoothed
  envelope. The 100 ms output loop only reports the latest value, so the reporting rate and
  the sampling rate are already separate.
- **All serial writes happen in the `basic.forever` loop.** The input handler only sets
  flags (for example `versionRequested`), so a reply can never land in the middle of a
  reading line.
- `serial.setWriteLinePadding(0)` turns off MakeCode's default padding of each line to 32
  bytes.
- P8 and P9 are held low to put the Spiker:bit's analog front end in EMG mode.

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

## What the current protocols don't do

These are the gaps a new protocol version would have to fill. They are listed here as
facts about the current wire format, not as a design.

- **No liveness signal.** Dataflow can only infer that data stopped from the per-channel
  `lastMessageReceivedAt` stamps. Nothing distinguishes a quiet device from a lost
  connection, and a device can't tell whether Dataflow is still listening.
- **No acknowledgments.** Dataflow never learns whether a command arrived or was acted on.
- **No identification or capability discovery,** except the Spiker:bit version banner.
  What sensors and outputs a device has is hard-coded in `kDeviceCapabilities` and the
  channel list, by device family.
- **No configuration.** The device decides which readings to send and how often.
- **Only one output, unnamed.** The servo command is a bare number with no key, so a
  second output needs a new command form.
- **No integrity checks.** A corrupted line that still matches the pattern is accepted.
- **Value range.** Readings can't be negative and are rounded to integers on
  `keyValue`.
- **The Arduino sketch treats every line as a servo angle.** Anything new sent to an
  Arduino running `ccemgfsr.ino` moves its servo, so new commands can only go to devices
  that are known to understand them.
