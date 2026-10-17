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
>   -i src/plugins/dataflow-tool/serial.md \
>   -o src/plugins/dataflow-tool/images/dataflow-hardware.svg
> ```
>
> It writes one SVG per Mermaid block in document order (`…-1.svg` = inbound,
> `…-2.svg` = outbound); rename them to match the `![…]` references below.

## The objects

| Object | File | Role |
|---|---|---|
| `WebSerialTransport` | `src/models/stores/web-serial-transport.ts` | Owns the Web Serial port + read loop; `write()` out, `onData` in. `open(port?)` resolves `"opened"`, `"canceled"` or `"failed"`, and skips the chooser when given a port. `lastPort` survives `close()`. |
| `MicrobitUsbTransport` | `src/models/stores/spikerbit-device.ts` | `IDeviceTransport` over a micro:bit WebUSB connection: `write()` out, `serialdata` → `onData` in, `status` → `onDisconnect`. |
| `SpikerbitDevice` | `src/models/stores/spikerbit-device.ts` | Spiker:bit connect/version/flash state machine; taps `onData` for connect-time version detection, then hands the transport to the store. |
| `SerialDevice` | `src/models/stores/serial.ts` | Transport-agnostic connection store: holds the active transport and the registered channel sources, routes writes (`writeLine`) and inbound parsing (`receive`). `isConnected()` is observable. |
| `DeviceConnection` | `src/plugins/dataflow/model/device-connection.ts` | App-wide connect, reconnect and disconnect for the one `SerialDevice`; one instance per `SerialDevice`, from `getDeviceConnection`. Tracks `lastChoice` and `busyChoice`. |
| tile device actions | `src/plugins/dataflow/utilities/device-actions.ts` | Per-tile wrappers around `DeviceConnection` that reset the clicking tile's program and log the change. |
| `parseKeyValueData` | `src/models/stores/serial-protocol.ts` | Shared parser: `emg:<n>\r\n` lines → channel values. |
| tile serial channels | `NodeChannelInfo[]` (`.../model/utilities/channel.ts`) | The shared blackboard: parsers write `channel.value`; the Sensor node reads it. Each mounted, editable tile registers its channels with `SerialDevice` as a channel source. |
| `SensorNode` / `LiveOutputNode` | `.../nodes/sensor-node.ts`, `live-output-node.ts` | DataFlow nodes that read inbound values / emit outbound values each tick. |

`IDeviceTransport` (`src/models/stores/device-transport.ts`) is the shared contract:
`write(line)`, `close()`, and optional `onData(chunk)` / `onDisconnect()`.

Device **identity** (`SerialDevice.deviceFamily`: `arduino` / `microbit` / `spikerbit`)
is distinct from a channel's **protocol** tag (`channel.protocol`: `keyValue` /
`radioHub`). `kDeviceCapabilities` (`.../model/utilities/device-capabilities.ts`) maps
identity → `{ protocol, displayName, outputs }`, so the same wire protocol can be spoken
by more than one device (the Arduino and the Spiker:bit both speak `keyValue`).

## Connecting a device

The connection is app-wide: there is one `DeviceConnection` per `SerialDevice` (from
`getDeviceConnection`), and it does not live in any tile component. At most one device is
connected at a time. The top-bar menu of a DataFlow tile lists three device choices while
nothing is connected: Arduino, micro:bit (radio hub) and Spiker:bit (`kDeviceChoiceLabels`).
While a device is connected the menu shows Reconnect and Disconnect instead. All of the
controls are disabled while a connection attempt is in progress (`busyChoice`). The UI names
the device by the choice the user connected with (`lastChoice`), not by the detected
`deviceFamily`.

`DeviceConnection` provides `connect(choice)`, `reconnect()` and `disconnect()`. Connect and
reconnect resolve `"connected"`, `"canceled"` or `"failed"`. When a device is already
connected, both disconnect it first. A Web Serial board and the
Spiker:bit take different flows, and both end by calling
`SerialDevice.setActiveDevice(deviceFamily, transport)`, which records the active transport,
wires its inbound callbacks, and marks the store connected. `setActiveDevice` does not take
channels; inbound data is matched against registered channel sources (see
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
drive the connect-button UI with it when we think we are getting this `connect` event.

**Spiker:bit:** each Connect disconnects any earlier `SpikerbitDevice` and constructs a new
one with a new `@microbit/microbit-connection` USB connection, so the browser's chooser
shows every time. `connectAndStream` connects over WebUSB, checks and if needed flashes the
firmware (see [Spiker:bit version check and flashing](#spikerbit-version-check-and-flashing)
below), then calls `setActiveDevice("spikerbit", transport)`. If any step fails after the
link opens, `connectAndStream` disconnects the library connection before it rethrows, so a
failed attempt doesn't leave the board open.

**Reconnect.** `reconnect()` repeats the last choice without asking the user to pick again.
For a Web Serial board it tries, in order: the last port (`WebSerialTransport.lastPort`,
which survives `close()`); a previously granted port (`getGrantedSerialPorts()`) with the
same USB vendor and product ids; and finally the browser's chooser. For a Spiker:bit it
runs `connectAndStream` again on the known `SpikerbitDevice`, whose library connection
remembers the board and reopens it without the chooser. If that fails, for example because
the board was unplugged and plugged back in, it disconnects that device and falls back to a
new one, which shows the chooser. CLUE doesn't call the library's `initialize()`, so it
doesn't watch for the board being unplugged.

**Disconnect** closes the transport and clears the active device. For a Spiker:bit, closing
the transport disconnects the library connection; the device is kept for Reconnect.

**Per-tile actions.** The menu calls the tile actions in `device-actions.ts`, which wrap
`DeviceConnection` and log `DATAFLOW_TOOL_CHANGE` events with the operations
`connectDevice`, `reconnectDevice`, `disconnectDevice` and `resetProgram`. A successful
connect or reconnect resets only the clicking tile's program, through
`program.resetRunningState()`. Disconnect never resets. Reset does not touch recorded data,
blocks, connections or settings.

### Channel sources

Each DataFlow tile owns its own `NodeChannelInfo[]`. While a tile is mounted and editable,
`DataflowProgram` registers its channels with `SerialDevice.registerChannelSource(() =>
channels)`, which returns a disposer that it calls on unmount. `SerialDevice.receive`
parses inbound data against the flattened channels of every registered source, and every
channel with a matching id updates, so several tiles can read the same device at once.

## Spiker:bit version check and flashing

The Spiker:bit runs a fixed micro:bit program (`CLUE-SPIKERBIT v<N>`, bundled at
`src/plugins/dataflow/firmware/spikerbit-clue.hex`). Before handing the transport to the
store, `SpikerbitDevice.connectAndStream` makes sure the board is running a current build:

1. It points the transport's `onData` at a connect-time handler (`handleVersionData`) that
   scans inbound data for the version banner using `detectSpikerbitVersion`, recording the
   reported version.
2. `queryVersion` writes `?` and waits up to ~1.5s (`kVersionQueryTimeoutMs`) for that
   banner to arrive.
3. If no banner arrives (no known firmware) or the reported version is older than
   `kSpikerbitFirmwareVersion`, it flashes the bundled hex (a partial flash, reporting
   progress) and queries again. The USB connection stays Connected across the flash — the
   DAPLink interface chip is untouched and serial auto-reinitialises — so no explicit
   reconnect is needed.
4. It then calls `setActiveDevice("spikerbit", transport)`, which repoints
   `onData` from version detection to `SerialDevice.receive` and begins EMG streaming.

Bump `kSpikerbitFirmwareVersion` together with the `VERSION` constant in the MakeCode
source whenever the firmware changes; see
[the firmware README](../dataflow/firmware/README.md) for how to rebuild the hex.

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
  parse["parseKeyValueData<br/>shared parser"]
  mparse["handleRadioHubStreamObj<br/>radio parser"]

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

  parse -->|"writes channel value"| ch
  mparse -->|"writes channel value"| ch
  ch -->|"sampled each tick"| sensor
```

</details>

Walkthrough:

- **Arduino (Web Serial):** the physical device emits `emg:<n>\r\n`. `WebSerialTransport`'s
  read loop decodes each chunk and calls `onData`, which `SerialDevice.setActiveDevice`
  wired to `SerialDevice.receive`. `receive` looks up the device's protocol in the
  capability map and dispatches to `handleKeyValueStreamObj` → `parseKeyValueData`,
  which writes `channel.value` on the matching channel.
- **Spiker:bit (WebUSB):** `MicrobitUsbTransport` owns the connection's `serialdata` event
  and forwards each chunk to `onData`, which `SerialDevice.setActiveDevice` wired to
  `SerialDevice.receive` — exactly like the Web Serial path. The Spiker:bit's `deviceFamily`
  maps to the `keyValue` protocol, so `receive` dispatches to the same
  `handleKeyValueStreamObj` → `parseKeyValueData`. During connect (before
  `setActiveDevice`), `SpikerbitDevice` temporarily points `onData` at a version-detection
  handler to decide whether to flash; EMG parsing begins once the transport becomes the
  active device.
- **Into the node:** both paths mutate the same `NodeChannelInfo` objects (the tile's
  `channels`, found through the registered channel sources). Each tick the Rete manager
  samples them and the `Sensor node`'s `data()` reads `getChannels().find(...).value`.

> **micro:bit vs. Spiker:bit.** Both are physically micro:bits, but they connect
> differently. A **radio-hub micro:bit** connects over **Web Serial** (same transport as
> the Arduino); `receive` routes its data to `handleRadioHubStreamObj` — a different parser
> — because its `deviceFamily` maps to the `radioHub` protocol. The **Spiker:bit** is a
> micro:bit running the flashed CLUE-SPIKERBIT program on an expansion board; it connects
> over **WebUSB** so it can be flashed and read via `@microbit/microbit-connection`.

### Reconstituting messages from the stream

The read loop hands each parser a raw string chunk decoded from the port. A chunk is a
malformed representation of any number of whole or partial serial messages, chomped off
the stream at unpredictable spots that do not respect the original message boundaries. So
the parser cannot assume a chunk is one clean line. Each parser (`parseKeyValueData`,
`handleRadioHubStreamObj`) therefore appends the chunk to a **local buffer**, then scans
the buffer for a complete, legitimate value using a regular expression closely paired to
the devices and the sensors/actuators DataFlow supports. On a match it parses out the
value plus an indicator of which channel the value belongs to, finds that channel, and
sets the value on it — leaving any trailing partial line in the buffer for the next chunk.

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
  fmt["SerialDevice.writeToOutForServo etc.<br/>value becomes a line string"]
  wl["SerialDevice.writeLine<br/>calls activeTransport.write"]

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
  fmt --> wl
  wl -->|"active transport is WebSerialTransport"| wst
  wl -->|"active transport is MicrobitUsbTransport"| mut
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
- The formatter produces a line string and calls `SerialDevice.writeLine(line)`, which is
  the **single unified exit**: `this.activeTransport.write(line)`.
- Only the concrete transport differs: `WebSerialTransport.write` frames the line and
  writes it to the Web Serial port's writer; `MicrobitUsbTransport.write` calls
  `connection.serialWrite`. Neither the node nor `SerialDevice` above `writeLine` knows or
  cares which transport is active.

## Connection status tracking

Beyond the active transport, `SerialDevice` keeps bookkeeping the UI reads to reflect
connection state: `connectChangeStamp`/`lastConnectMessage` (the last time and reason the
status changed, updated via `updateConnectionInfo`), and `serialModalShown` (so the connect
modal isn't shown repeatedly). `isConnected()` is observable, so the menu re-renders as the
connection changes.

Whether a program needs a device is per tile. Each DataFlow tile's `content.needsDevice` is a
volatile value that its `ReteManager` keeps current as the student edits
(`updateNeedsDevice`, using `programNeedsDevice` in
`src/plugins/dataflow/utilities/program-needs-device.ts`). When a tile's program needs a
device and none is connected, `updateNeedsDevice` shows the app-wide alert
(`postSerialModal`), at most once per page load because `serialModalShown` gates it.

The browser's own `navigator.serial` `connect`/`disconnect` events are wired once at store
creation by `initWebSerialConnectionEvents` (`web-serial-transport.ts`), keeping
`navigator.serial` out of `SerialDevice`. Authentic Arduinos raise `connect` before the
user clicks, so this affordance can note a board is present. The `disconnect` handler only
tears down the store when a `WebSerialTransport` currently owns the connection, so an
unrelated Web Serial disconnect cannot kill a live WebUSB (Spiker:bit) session.

## Summary

Both directions run through `SerialDevice` and are transport-agnostic: outbound via
`writeLine → activeTransport.write`, inbound via `transport.onData → SerialDevice.receive`.
The active transport is swapped in at connect through `setActiveDevice`.
