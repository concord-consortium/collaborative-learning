# Serial connections to DataFlow

How serial data moves between physical hardware and DataFlow tile nodes, for the two
current hardware paths:

- **Arduino** (and the radio-hub micro:bit) over the **Web Serial API**.
- **Spiker:bit** (a micro:bit expansion board) over **WebUSB**, via
  `@microbit/microbit-connection`.

Two directions are covered: **inbound** (bytes arriving at the computer → a Sensor node)
and **outbound** (a Live Output node → bytes leaving the computer).

> The diagrams below are shown as pre-rendered SVGs (so they display in any Markdown
> viewer); the editable Mermaid source for each is kept in a collapsed **Mermaid source**
> block underneath. If you edit the Mermaid, re-export the matching SVG into
> `images/` (from the repo root):
>
> ```
> PUPPETEER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
>   npx -y @mermaid-js/mermaid-cli \
>   -i src/plugins/dataflow/docs/serial.md \
>   -o src/plugins/dataflow/docs/images/dataflow-hardware.svg
> ```
>
> It writes one SVG per Mermaid block in document order (`…-1.svg` = inbound,
> `…-2.svg` = outbound); rename them to match the `![…]` references below.

## The objects

| Object | File | Role |
|---|---|---|
| `WebSerialTransport` | `src/models/stores/web-serial-transport.ts` | Owns the Web Serial port + read loop; `write()` out, `onData` in. `open(port?)` resolves `"opened"`, `"canceled"` or `"failed"`, and skips the chooser when given a port. `lastPort` survives `close()`. |
| `MicrobitUsbTransport` | `src/models/stores/spikerbit-device.ts` | `IDeviceTransport` over a micro:bit WebUSB connection: `write()` out, `serialdata` → `onData` in, `status` → `onDisconnect("lost")`, and `navigator.usb`'s `disconnect` for its device → `onDisconnect("unplugged")`. |
| `SpikerbitDevice` | `src/models/stores/spikerbit-device.ts` | Spiker:bit connect, reset, firmware check and flash; taps `onData` for connect-time firmware detection, then hands the transport to the store. |
| `SerialDevice` | `src/models/stores/serial.ts` | Transport-agnostic connection store: holds the active transport and the registered channel sources, routes writes (`writeLine`) and inbound parsing (`receive`). `isConnected()` is observable. Keeps `lastLoss`. |
| `DeviceConnection` | `src/plugins/dataflow/model/device-connection.ts` | App-wide connect, reconnect and disconnect; one instance per `SerialDevice`, from `getDeviceConnection`. Tracks `lastChoice`, `busyChoice` and `connectTutorialDismissal`. Keeps the "Is it alive?" check, and exposes `lossMessage` and `notResponding`. |
| tile device actions | `src/plugins/dataflow/utilities/device-actions.ts` | Wrap `DeviceConnection` for one tile: they reset the clicking tile's program, log the change, and record a failed attempt's message on the tile. |
| `parseKeyValueData` | `src/models/stores/serial-protocol.ts` | `keyValue` parser (Arduino): `emg:<n>\r\n` lines → channel values. |
| `CcDeviceSession` | `src/models/stores/cc-device-session.ts` | One CC Device Protocol session (Spiker:bit): opens it, pings it, parses its lines into channel values, and writes its outputs. Exposes `notResponding` and `identify()`. Created by `setActiveDevice` for a `ccDevice` device. |
| tile serial channels | `NodeChannelInfo[]` (`.../model/utilities/channel.ts`) | The shared blackboard: parsers write `channel.value`; the Sensor node reads it. Each mounted, editable tile registers its channels with `SerialDevice` as a channel source. |
| `SensorNode` / `LiveOutputNode` | `.../nodes/sensor-node.ts`, `live-output-node.ts` | DataFlow nodes that read inbound values / emit outbound values each tick. |

`IDeviceTransport` (`src/models/stores/device-transport.ts`) is the shared contract:
`write(line)`, `close()`, and optional `onData(chunk)` / `onDisconnect(loss)`.

Device **identity** (`SerialDevice.deviceFamily`: `arduino` / `microbit` / `spikerbit`)
is distinct from a channel's **protocol** tag (`channel.protocol`: `keyValue` /
`radioHub`). `kDeviceCapabilities` (`.../model/utilities/device-capabilities.ts`) maps
identity → `{ protocol, displayName, outputs, channels? }`: the Arduino speaks `keyValue`,
the radio-hub micro:bit `radioHub`, and the Spiker:bit `ccDevice` (the CC Device Protocol;
see [cc-device-protocol.md](cc-device-protocol.md)). A device with a `channels` list provides
only those channel ids, whatever their tag: the Spiker:bit lists `emg`, so it provides the
`emg` channel, which is tagged `keyValue`.

## Connecting a device

The connection is app-wide: there is one `DeviceConnection` per `SerialDevice` (from
`getDeviceConnection`), and it does not live in any tile component. At most one device is
connected at a time, and a second attempt while one is in progress is ignored (`busyChoice`).
It is started from the `connect` button in the DataFlow tile toolbar
(`components/toolbar/dataflow-connect-button.tsx`), or, in a unit whose own `tools` list leaves
out `connect`, from the older connect menu at the top of the tile. Both call the tile device
actions below. The log events name the device by the choice the user connected with
(`lastChoice`, such as `microbitHub`), not by the detected `deviceFamily`.

`DeviceConnection` provides `connect(choice)`, `reconnect()` and `disconnect()`. Connect and
reconnect resolve `"connected"`, `"canceled"`, `"failed"` or `"inUse"` (see
[Why a device went away](#why-a-device-went-away)). When a device is already
connected, both disconnect it first. A Web Serial board and the Spiker:bit take different
flows, and both end by calling `SerialDevice.setActiveDevice(deviceFamily, transport)`, which
records the active transport, wires its inbound callbacks, and marks the store connected.
Inbound data is matched against the registered channel sources (see
[Channel sources](#channel-sources)).

**Web Serial (Arduino and radio-hub micro:bit):**

1. `new WebSerialTransport()`, then `transport.open()`:
   `navigator.serial.requestPort()` shows the browser's device chooser; on selection we
   read `getInfo()`, resolve `deviceFamily`, and open the port at 9600 baud.
2. `setActiveDevice(transport.deviceFamily, transport)` and
   `setRaisesWebSerialConnect(transport.raisesWebSerialConnect)`.
3. `transport.startReading()` starts the inbound read loop.

`WebSerialTransport.close()` cancels and releases the read loop's reader before it closes
the port, so the port can be opened again.

The device chooser is intentionally **unfiltered**. `requestPort()` could take USB-ID
filters so only Arduino-like boards appear, but working Arduino clones do not all match a
clean filter — one is shipped with the latest generation of Backyard Brains hardware — so
filtering would hide boards that actually work. Rather than chase every non-standard
board's IDs, we show everything and rely on `deviceFamily` resolution afterward. (A future
improvement would be to import an updatable, comprehensive board list and build filters
from it.)

**Device identity** is resolved from the USB descriptor in
`WebSerialTransport.determineDeviceFamily`: a micro:bit reports `usbProductId === 516 &&
usbVendorId === 3368`; anything else is assumed to be an Arduino. We've only seen authentic
Arduinos raise the Web Serial `connect` event. We check for that `usbProductId` (67), and only
drive the top-bar menu's physical-connection UI with it when we think we are getting this
`connect` event.

**Spiker:bit:** each Connect disconnects any earlier `SpikerbitDevice` and constructs a new
one with a new `@microbit/microbit-connection` USB connection, so the browser's chooser
shows every time. `connectAndStream` connects over WebUSB, resets the board with `!!`, checks
and if needed flashes the firmware (see
[Spiker:bit version check and flashing](#spikerbit-version-check-and-flashing) below), then
calls `setActiveDevice("spikerbit", transport)`. If any step fails after the link opens,
`connectAndStream` disconnects the library connection before it rethrows, so a failed attempt
doesn't leave the board open.

**Reconnect.** `reconnect()` repeats the last device choice, so the user doesn't pick a
device type again. For a Web Serial board it tries the last port
(`WebSerialTransport.lastPort`, which survives `close()`) first, and if that fails it shows
the browser's chooser. A Web Serial unplug is noticed quickly, by the browser's `disconnect`
event or by the read loop giving up, and either one clears the active device. So Reconnect
isn't offered for an unplugged board: the pane shows the device choices, and Connect shows
the chooser. For a Spiker:bit it runs `connectAndStream` again on the known
`SpikerbitDevice`, whose library connection remembers the board and reopens it without the
chooser. If that fails, for example because the board was unplugged and plugged back in, it
disconnects that device and falls back to a new one, which shows the chooser. A Spiker:bit
unplug is noticed by `navigator.usb`'s `disconnect` event, or else by the next write to the board
failing (see "Why a device went away").

**Disconnect** ends any CC Device Protocol session (`SerialDevice.endSession`, waiting at most
500 ms, `kEndSessionTimeoutMs`), then closes the transport and clears the active device. For a
Spiker:bit, closing
the transport disconnects the library connection; the device is kept for Reconnect.

**Tile device actions.** The pane, the top-bar menu and the `reset` button call the tile device
actions in `device-actions.ts`, which wrap `DeviceConnection` and log `DATAFLOW_TOOL_CHANGE`
events with the operations `connectDevice`, `reconnectDevice`, `disconnectDevice` and
`resetProgram`. A successful connect or reconnect resets only the clicking tile's program,
through `resetProgramForTile`, which says what Reset leaves alone. Disconnect never resets.

**Log events.** Each is a `DATAFLOW_TOOL_CHANGE` event for one tile (`tileId`): the clicking
tile, or for the connect tutorial's events, the tile it covers. The fields below sit at the top
level of the event.

| `operation` | Other fields | Logged when |
|---|---|---|
| `connectDevice` | `targetType: "device"`, `device`: the choice id (`arduino`, `microbitHub` or `spikerbit`) | A Connect succeeds |
| `reconnectDevice` | `targetType: "device"`, `device` | A Reconnect succeeds |
| `disconnectDevice` | `targetType: "device"`, `device`: the choice that was connected | The user disconnects |
| `resetProgram` | `targetType: "program"`, `trigger`: `connect`, `reconnect` or `button` | The program is reset |
| `showConnectTutorial` | `targetType: "connectTutorial"` | The connect tutorial appears over the tile |
| `dismissConnectTutorial` | `targetType: "connectTutorial"`, `trigger`: `ok` (OK in this tile), `okInAnotherTile` or `connection` | The tutorial over the tile is dismissed |

- A successful Connect or Reconnect logs two events: the device event, then `resetProgram` with
  `trigger` `connect` or `reconnect`.
- A failed, refused (`inUse`) or canceled attempt logs nothing.
- Only a Disconnect the user chooses is logged. An unplug logs nothing, so a `connectDevice` can
  have no matching `disconnectDevice`.
- One OK or one connection dismisses the tutorial on every tile, so each tile it covered logs a
  dismissal; the tile whose OK was clicked has `trigger` `ok`. A tile that closes while the
  tutorial shows, such as a deleted tile, logs no dismissal.

### Channel sources

Each DataFlow tile owns its own `NodeChannelInfo[]`. While a tile is mounted and editable,
`DataflowProgram` registers a channel source,
`SerialDevice.registerChannelSource(() => this.props.tileContent.channels)`, which reads the
tile's current channels on each call, since `setChannels` replaces the array. It returns a
disposer that `DataflowProgram` calls on unmount. `SerialDevice.receive` parses inbound data
against the flattened channels of every registered source, and every channel with a
matching id updates, so several tiles can read the same device at once.

## Spiker:bit version check and flashing

The Spiker:bit runs a fixed micro:bit program, bundled at
`src/plugins/dataflow/firmware/spikerbit-clue.hex`. Before handing the transport to the
store, `SpikerbitDevice.connectAndStream` makes sure the board is running a current build:

1. It points the transport's `onData` at a connect-time handler (`handleFirmwareData`) that
   scans inbound data with `detectFirmwareReply`, recording the reply. A reply is either a
   CC Device Protocol `hello` line with a valid checksum, or the legacy `CLUE-SPIKERBIT v<N>`
   banner that older firmware sends. Stale readings, empty lines and `ok` lines before the
   reply, and a reply split across chunks, are handled; a `hello` with a missing or bad
   checksum is ignored.
2. `queryFirmware` writes `!! #n` and a bare `?` in one write, so that the `hello` starts a
   line of its own after any backlog of old output (see
   [Connecting](cc-device-protocol.md#connecting)). The `ok` to the `!!` needs no handling: a
   valid `hello` identifies the firmware whether or not an `ok` came first, so a `hello` with no
   `ok` before it is accepted too, and firmware v1–v3 answers with its banner.
3. If nothing is identified 200 ms (`kRetryAfterDrainMs`) after the backlog has drained, the
   replies may have been dropped while DAPLink's buffer was still full, so `queryFirmware`
   writes `!!` and `?` once more. Each `serialdata` event carries one DAPLink read, at most 62
   bytes (`kDaplinkReadBytes`), and a backlog drains in full reads, so the first shorter read
   counts as drained. That is only a hint: 100 ms with no data (`kDrainQuietMs`) counts too. If
   nothing is identified within 1.5 s (`kFirmwareQueryTimeoutMs`) in all, there is no reply.
4. The connect-time `!!` counts from 1000, above the 1 to 999 that `CcDeviceSession` uses. A
   late reply to it can reach the session, such as the reply to the first write after the retry
   has identified the board. Its `#n` can't be taken for the `ok` to the session's `open` or a
   `ping`.
5. `shouldFlash` decides. It flashes the bundled hex (a partial flash, reporting progress)
   and queries again when there is no recognized reply, the reply is a legacy banner, the
   `hello` names a protocol or protocol version Dataflow doesn't speak or another device (even
   if its firmware is newer), or its firmware is older than `kSpikerbitFirmwareVersion`. It
   connects without flashing when the `hello` names `CCDeviceProtocol` version 1 and
   `device:spikerbit`, and the firmware is the same or newer. The USB connection stays Connected across the flash: the DAPLink interface chip
   is untouched and serial auto-reinitializes, so no explicit reconnect is needed. The
   re-query after the flash uses the same steps and the same rule, and only warns.
6. It then calls `setActiveDevice("spikerbit", transport)`, which repoints
   `onData` from firmware detection to `SerialDevice.receive` and starts a CC Device
   Protocol session. The board streams EMG readings once it acknowledges the session's
   `open`.

Keep `kSpikerbitFirmwareVersion` equal to the `firmware:` number in the `HELLO` line of
`spikerbit-clue.ts`, and bump both whenever the firmware's behavior changes; see
[the firmware README](../firmware/README.md) for how to rebuild the hex.

## The CC Device Protocol session

`SerialDevice.setActiveDevice` starts a `CcDeviceSession` for a device whose protocol is
`ccDevice`. The session speaks the [CC Device Protocol](cc-device-protocol.md):

1. It sends `open session:<id> #n` with a random id, and re-sends it every 2 s until an
   `ok` arrives.
2. It then sends `ping session:<id> #n` every second, which keeps the session open on the board.
   The replies feed the not-responding count (below).
3. When a pending ping gets `err nosession`, it opens a new session with a new id. Chrome slows
   timers in hidden tabs, so this is how a session that lapsed while its tab was hidden
   recovers. When one gets `err othersession`, it stops, since another host owns the session, and
   counts as not responding (below). A `nosession` or `othersession` that answers anything else,
   such as a ping from before a re-open, changes nothing.
4. Disconnecting sends `close session:<id>` (`SerialDevice.endSession`), also while an `open`
   is still waiting for its `ok`, so the board shows the waiting icon at once instead of after
   the timeout.

Its `#n` counts from 1 to 999 and wraps to 1 (see
[Spiker:bit version check and flashing](#spikerbit-version-check-and-flashing)). Every line
Dataflow sends has a checksum, except the connect-time `?`.

An `open` re-sent because its `ok` was late, not lost, reaches a board that has already started
the session, and the board starts it afresh, with its settings back to their defaults. There are
no settings yet; once there are, they should be sent only after every pending `open` is
answered.

**Not responding.** The session counts the `open`s and `ping`s it has sent since the last reply
to one of them. When a fourth would go out with three still unanswered, about 3–4 s after the
last reply (about 6 s while still opening), it sets the observable `notResponding`. A reply to
one of them (`ok`, or any `err` but `othersession`) clears it and restarts the count.
`err othersession` sets it until the next connect or reconnect. The count is in commands, not
seconds. It pauses while the page is hidden and restarts when it's visible: in a hidden tab the
browser slows timers, and a transport whose reads run on a timer can fall behind the readings, so
replies would look missing.

**Identify.** `identify()` sends `identify #n` and resolves `"answered"` on any reply carrying
that `#n`, `ok` or `err`, or `"noAnswer"` after 2 s. It works whatever state the session is in,
and its reply doesn't count as an answer to the session's commands.

A Live Output servo node sends `servo:<angle>` on every tick, without `#n`. Each reading
updates every channel whose `channelId` is the reading's name, in every registered tile, and
stamps its `lastMessageReceivedAt`. `ok` and `err` drive the session; `hello` and lines it
doesn't recognize are ignored.

## Inbound: hardware → Sensor node

![Inbound: hardware to Sensor node](images/dataflow-hardware-inbound.svg)

<details>
<summary>Mermaid source</summary>

```mermaid
flowchart TB
  subgraph hw [Physical hardware]
    ard["Arduino"]
    mbit["Radio-hub micro:bit"]
    sbit["Spiker:bit<br/>flashed micro:bit + expansion board"]
  end

  subgraph browser [Browser API]
    ws["Web Serial API<br/>navigator.serial port"]
    usb["WebUSB via microbit-connection"]
  end

  subgraph transport [Transport layer]
    wst["WebSerialTransport.startReading<br/>read loop, then onData"]
    mut["MicrobitUsbTransport<br/>serialdata, then onData"]
  end

  recv["SerialDevice.receive<br/>routes by deviceProtocol"]
  parse["parseKeyValueData<br/>keyValue parser"]
  mparse["handleRadioHubStreamObj<br/>radio parser"]
  cparse["CcDeviceSession.receive<br/>CC Device Protocol parser"]

  subgraph tile [DataFlow tile]
    ch["serial channels<br/>NodeChannelInfo value"]
    sensor["Sensor node<br/>reads channel value each tick"]
  end

  ard -->|"emg data"| ws
  mbit -->|"radio data"| ws
  ws --> wst
  wst -->|"onData"| recv

  sbit -->|"emg data"| usb
  usb -->|"serialdata"| mut
  mut -->|"onData"| recv

  recv -->|"keyValue protocol"| parse
  recv -->|"radioHub protocol"| mparse
  recv -->|"ccDevice protocol"| cparse

  parse -->|"writes channel value"| ch
  mparse -->|"writes channel value"| ch
  cparse -->|"writes channel value"| ch
  ch -->|"sampled each tick"| sensor
```

</details>

Walkthrough:

- **Arduino (Web Serial):** the physical device emits `emg:<n>\r\n`. `WebSerialTransport`'s
  read loop decodes each chunk and calls `onData`, which `SerialDevice.setActiveDevice`
  wired to `SerialDevice.receive`. `receive` looks up the device's protocol in the
  capability map and dispatches to `handleKeyValueStreamObj` → `parseKeyValueData`,
  which writes `channel.value` on every matching channel.
- **Spiker:bit (WebUSB):** `MicrobitUsbTransport` owns the connection's `serialdata` event
  and forwards each chunk to `onData`, which `SerialDevice.setActiveDevice` wired to
  `SerialDevice.receive` — exactly like the Web Serial path. The Spiker:bit's `deviceFamily`
  maps to the `ccDevice` protocol, so `receive` hands the chunk to the active
  `CcDeviceSession`, which drops lines with a missing or wrong checksum, handles `ok` and
  `err` itself, and writes each reading to the channels with its name. During connect (before
  `setActiveDevice`), `SpikerbitDevice` temporarily points `onData` at a firmware-detection
  handler to decide whether to flash; EMG parsing begins once the transport becomes the
  active device.
- **Into the node:** both paths mutate the same `NodeChannelInfo` objects (each registered
  tile's `channels`). Each tick the Rete manager samples them and the `Sensor node`'s
  `data()` reads `getChannels().find(...).value`.

> **micro:bit vs. Spiker:bit.** Both are physically micro:bits, but they connect
> differently. A **radio-hub micro:bit** connects over **Web Serial** (same transport as
> the Arduino); `receive` routes its data to `handleRadioHubStreamObj` — a different parser
> — because its `deviceFamily` maps to the `radioHub` protocol. The **Spiker:bit** is a
> micro:bit running the flashed `spikerbit-clue.hex` program on an expansion board; it
> connects over **WebUSB** so it can be flashed and read via `@microbit/microbit-connection`.

### Reconstituting messages from the stream

The read loop hands each parser a raw string chunk decoded from the port. A chunk is a
malformed representation of any number of whole or partial serial messages, chomped off
the stream at unpredictable spots that do not respect the original message boundaries. So
the parser cannot assume a chunk is one clean line. Each parser therefore appends the chunk to
a **local buffer** and leaves any trailing partial line there for the next chunk.
`parseKeyValueData` and `handleRadioHubStreamObj` scan the buffer for a complete, legitimate
value using a regular expression closely paired to the devices and the sensors/actuators
DataFlow supports. On a match they parse out the value plus an indicator of which channel the
value belongs to, find that channel, and set the value on it. `CcDeviceSession.receive` instead
splits whole lines off its buffer (`splitLines`) and parses each with `parseCcDeviceLine`.

## Outbound: Live Output node → hardware

![Outbound: Live Output node to hardware](images/dataflow-hardware-outbound.svg)

<details>
<summary>Mermaid source</summary>

```mermaid
flowchart TB
  subgraph tile [DataFlow tile]
    lout["Live Output node<br/>computes value each tick"]
  end

  send["LiveOutputNode.sendDataToSerialDevice<br/>routes by deviceProtocol"]
  fmt["SerialDevice.writeToOutForServo etc.<br/>scales the value"]
  wl["SerialDevice.writeLine<br/>calls activeTransport.write"]
  cc["CcDeviceSession.sendOutput<br/>servo:angle with its checksum"]

  subgraph transport [Transport layer]
    wst["WebSerialTransport.write<br/>writes the line to the port writer"]
    mut["MicrobitUsbTransport.write<br/>calls connection.serialWrite"]
  end

  subgraph browser [Browser API]
    ws["Web Serial API"]
    usb["WebUSB via microbit-connection"]
  end

  subgraph hw [Physical hardware]
    ard["Arduino"]
    mbit["Radio-hub micro:bit"]
    sbit["Spiker:bit<br/>flashed micro:bit + expansion board"]
  end

  lout --> send
  send --> fmt
  fmt -->|"keyValue or radioHub"| wl
  fmt -->|"ccDevice"| cc
  wl -->|"active transport is WebSerialTransport"| wst
  cc -->|"the session's transport"| mut
  wst --> ws
  ws --> ard
  ws --> mbit
  mut --> usb
  usb --> sbit
```

</details>

Walkthrough:

- Each tick, the `Live Output node`'s `data()` calls `sendDataToSerialDevice`, which reads
  `serialDevice.deviceFamily`, resolves its protocol via the capability map, and calls the
  matching `SerialDevice.writeToOut…` formatter (e.g. servo-angle scaling).
- For `keyValue` and `radioHub`, the formatter produces a line string and calls
  `SerialDevice.writeLine(line)`: `this.activeTransport.write(line)`.
- For `ccDevice` (the Spiker:bit), `writeToOutForServo` hands the rounded angle to the
  active `CcDeviceSession`, which writes `servo:<angle>*hh` through the transport it was
  given by `setActiveDevice`, the same one `writeLine` would use. The session writes its own
  `open`, `ping` and `close` the same way.
- Only the concrete transport differs: `WebSerialTransport.write` frames the line and
  writes it to the Web Serial port's writer; `MicrobitUsbTransport.write` calls
  `connection.serialWrite`. Neither the node nor `SerialDevice` knows or cares which
  transport is active.

## Connection status tracking

The UI reflects connection state through `SerialDevice.isConnected()`, which is observable, so
it re-renders as the connection changes. For the top-bar menu, `SerialDevice` also keeps
`connectChangeStamp`/`lastConnectMessage` (the last time and reason the status changed, updated
via `updateConnectionInfo`).

Whether a program needs a device is per tile. Each DataFlow tile's `content.needsDevice` is a
volatile value that its `ReteManager` keeps current as the student edits
(`updateNeedsDevice`, using `programNeedsDevice` in
`src/plugins/dataflow/utilities/program-needs-device.ts`). When a tile's program needs a
device and none is connected as the program opens, the tile shows the connect tutorial
(`components/ui/dataflow-connect-tutorial.tsx`). That is checked only when the program opens
(`ReteManager.recordNeedsDeviceOnOpen()`), never after an edit or a connection change.

The browser's own `navigator.serial` `connect`/`disconnect` events are wired once at store
creation by `initWebSerialConnectionEvents` (`web-serial-transport.ts`), keeping
`navigator.serial` out of `SerialDevice`. Authentic Arduinos raise `connect` before the user
clicks, so the top-bar menu can note a board is present. The `disconnect` handler acts only on
the port of a `WebSerialTransport`. It records an unplug of the active one, or upgrades a loss
already recorded for it, so another device's unplug, serial or WebUSB, changes nothing.

### Why a device went away

A device that goes away without the user asking is recorded on `SerialDevice.lastLoss`
(observable), with a reason: `"unplugged"` when the browser reported the device removed, `"lost"`
for anything else. Transports report it through `onDisconnect(loss)`, which `setActiveDevice`
wires to `recordUnplug` for `"unplugged"` and to `clearActiveDevice(loss)` for `"lost"`:

| Transport | `"unplugged"` | `"lost"` |
|---|---|---|
| Web Serial | `navigator.serial`'s `disconnect` event for the device's port, from `initWebSerialConnectionEvents`. Authentic Arduinos raise it, and so did the two clone Arduinos tried; the radio hub hasn't been tried. | the read loop giving up on a port that stopped being readable, a few seconds later |
| WebUSB (Spiker:bit) | `navigator.usb`'s `disconnect` event for the library connection's device, which `MicrobitUsbTransport` listens for itself. It then closes the library connection, whose status would otherwise stay Connected. | the library's `Disconnected` status, which follows any failed WebUSB call (see below) |

An unplug can be reported by both paths, in either order. The second finds the device already
cleared, so the guard in `onDisconnect` ignores a second `"lost"`, and `recordUnplug` turns a
`"lost"` already recorded for the same transport into `"unplugged"`, keeping its time.
`DeviceConnection.disconnect` unhooks the transport's `onDisconnect` before closing it, because a
requested close also raises the library's `Disconnected`. A connect attempt clears the record.

`DeviceConnection` turns this into what the connect pane shows: `lossMessage` ("The Spiker:bit was
unplugged." or "The connection to the Spiker:bit was lost.") and `lossAt` (a new value pulses the
connect button three times).

`MicrobitUsbTransport` listens for `navigator.usb`'s `disconnect` itself, since CLUE doesn't call
the library's `initialize()`, where the library would. Without that event, an unplug would be
noticed only when a write fails: the session's `ping` every second, a re-sent `open`, or a servo
command. After `err othersession` the session stops pinging, so the event is then the only way
it's noticed unless a program is writing to the servo.

While connected, `DeviceConnection` also exposes `notResponding` and `canIdentify` from the
session. `identify()` runs the "Is it alive?" check, and `check` reports it: `"checking"`, then
the answer for 3 s. The check remembers the `CcDeviceSession` it asked and counts only while that
object is active, so it survives the pane closing and never shows an earlier board's answer.

A Spiker:bit connect that fails because another tab or app has claimed the board (the library's
`device-in-use` error) returns `"inUse"`, which the pane reports as "Another app is using the
Spiker:bit."

## Hidden pages

What counts as hidden, and how much Chrome slows timers there, is in
[Ticks in a hidden page](../../../../docs/dataflow.md#ticks-in-a-hidden-page), along with what
that does to the program's ticks. For the connection:

- **CLUE doesn't pause the connection.** `@microbit/microbit-connection`'s `initialize()` would
  pause a Spiker:bit's connection while the page is hidden and reconnect when it's shown again,
  but CLUE doesn't call `initialize()`. A program keeps reading and writing the device in a
  hidden page.
- **Web Serial reads keep up.** `WebSerialTransport`'s read loop waits on the port, not on a
  timer, so readings still reach the channels. Only the ticks that sample them slow down.
- **Spiker:bit reads may keep up.** `@microbit/microbit-connection` reads DAPLink's buffer in a
  loop that waits for each USB read and then for a 1 ms `setTimeout`, and a read returns at most
  62 bytes (`startPolling` in its `daplink.js`). In a hidden page Chrome holds that timer back,
  but not to the once a minute of the tick and ping timers: a stand-in for the loop, with a
  `MessageChannel` round trip in place of the USB read, ran about 3 times a second after more
  than 3 minutes hidden. If the real loop does the same, it reads about 180 bytes a second, more
  than the EMG readings' roughly 100 (one `emg:` line of about 10 bytes every 100 ms), and keeps
  up. This hasn't been checked on a board. A loop that reads slower than the readings arrive lets
  DAPLink's buffer fill and drop new output (see [the backlog](cc-device-protocol.md#connecting)):
  the readings that do arrive are old, and replies to the session's commands queue behind them
  or are lost. Using WebUSB directly wouldn't allow a read that waits for data, like the Web
  Serial loop's: DAPLink sends serial data only in reply to a read command, so the host has to
  poll.
- **The session lapses, again and again, in a page from a site.** The Spiker:bit ends a session
  after 5 s without a `ping`. About a minute after the page is hidden, the session's 1 s ping
  timer drops to about once a minute, and the session lapses 5 s after the last ping. The next
  ping, about a minute after the last, gets `err nosession`, and CLUE opens a new session. That
  session's ping timer is a new `setInterval`, which fires about once a second for about 9 s and
  then about once a minute, so the new session lapses about 15 s after it opens. The cycle
  repeats about once a minute until the page is shown, which opens the session again at once. A
  hand test on a branch preview fits this: the session lapsed about 68 s after the tab was
  hidden, was opened again about 45 s later, lapsed again after about 12 s, and kept cycling. On
  `localhost` the ping timer keeps firing about once a second for more than 3 minutes, so the
  session lasts at least that long.
- **Not responding isn't counted while the page is hidden.** See "Not responding" in
  [The CC Device Protocol session](#the-cc-device-protocol-session): the count pauses and starts
  again from zero when the page is shown, so a student coming back doesn't see a false "not
  responding".
- **If DataFlow is ever embedded in a cross-origin iframe,** the count won't pause while the
  iframe is scrolled out of view. Chrome slows the iframe's timers to about once a second, but its
  `visibilityState` stays `visible`, so the connect button could turn yellow. Such an iframe would
  also need `allow="usb; serial"` for the device APIs to work at all.

## Possible improvements

- **Empty DAPLink's buffer at each wake-up in a hidden page.** This would let Dataflow keep up
  with more readings in a hidden page. It adds complexity, so it isn't recommended until there
  is a demonstrated need. `@microbit/microbit-connection`'s read loop sleeps after every read, so
  a hidden page gets 62 bytes per timer wake-up. A loop that reads again straight away while
  reads return data, and sleeps only when the buffer is empty, would empty the whole backlog at
  each wake-up; USB transfers are promises, not timers, so they aren't slowed. Today's readings
  may not need it: if the real loop wakes about 3 times a second in a hidden page, as its
  stand-in did (see [Hidden pages](#hidden-pages)), it already keeps up. With more sensors, ASCII
  readings could arrive faster than 62-byte reads take them. Whether a binary mode for readings
  would also be needed, to cut the bytes per reading, depends on how often the real loop wakes,
  which hasn't been checked on a board. Finally, it means modifying
  `@microbit/microbit-connection`.
- **Not recommended: read the Spiker:bit over Web Serial.** The micro:bit also exposes a serial
  port, which the radio-hub micro:bit uses. Reading it would wait for data like the Arduino's
  read loop and never overflow DAPLink's buffer. But flashing still needs WebUSB, so a student
  would have to pick the board in two device choosers. Users and product owners already dislike
  having one device chooser, so a second isn't worth it.

## Testing

The automated tests stop just above the browser's device APIs:

- `web-serial-transport.test.ts` replaces `navigator.serial` and its ports with fakes.
- `spikerbit-device.test.ts` and `device-connection.test.ts` give `SpikerbitDevice` a fake
  `IMicrobitUsbConnection` in place of the library's WebUSB connection.
- `spikerbit-end-to-end.test.ts` wires that connection to `MakeCodeSim`, which runs the firmware
  source, through a model of DAPLink's buffer (see
  [Testing the firmware in Jest](../firmware/README.md#testing-the-firmware-in-jest)).

Everything below that, the browser's device chooser, its WebUSB and Web Serial code and the USB
link, is checked by hand on real boards.

### Why not test against the browser's real device stack

It would take two things, a device the browser accepts as real and a way to pick it in the
device chooser, and neither is practical. This was checked with Chrome 156 in October 2026.

- **Tests can't pick a device in the chooser.** `requestPort()` and `requestDevice()` open a
  chooser that is part of Chrome's own window, not the page, so Cypress and Playwright selectors
  can't reach it. The DevTools protocol has a `DeviceAccess` domain for this
  (`deviceRequestPrompted`, then `selectPrompt`), which Puppeteer's `waitForDevicePrompt` uses,
  but Chrome raises it only for Web Bluetooth: with `DeviceAccess` enabled, neither the Web
  Serial nor the WebUSB chooser raised `deviceRequestPrompted`. The Chrome policies
  `SerialAllowUsbDevicesForUrls` and `WebUsbAllowDevicesForUrls` grant a device ahead of time, so
  `getPorts()` and `getDevices()` return it, but `requestPort()` and `requestDevice()` still show
  the chooser. Clicking it through the operating system (`xdotool`, macOS accessibility
  scripting) needs a visible browser window and is fragile.
- **Only Linux can fake a USB device in software.** The `dummy_hcd` kernel module provides a
  virtual USB controller pair, so a gadget driver (`g_serial`, Raw Gadget or FunctionFS) can
  appear to the browser as a plugged-in device; USB/IP with `vhci_hcd` does the same from a
  user-space server. A serial gadget would be enough for the Web Serial path. Passing for a
  micro:bit over WebUSB is much more: the fake would have to answer DAPLink's CMSIS-DAP commands,
  its serial commands and flashing, as `@microbit/microbit-connection` uses them. macOS has no
  equivalent of `dummy_hcd`. Whether GitHub's Ubuntu runners ship the module wasn't checked.

## Summary

Both directions run through `SerialDevice` and are transport-agnostic: outbound via
`writeLine → activeTransport.write` (or the `CcDeviceSession`, which writes to the same
transport), inbound via `transport.onData → SerialDevice.receive`.
The active transport is swapped in at connect through `setActiveDevice`.
