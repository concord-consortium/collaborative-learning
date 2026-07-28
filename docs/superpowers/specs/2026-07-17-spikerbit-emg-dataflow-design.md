# Spiker:bit EMG support & DataFlow hardware architecture — Design (CLUE-567)

Date: 2026-07-27
Status: Implemented (PR #2929)

## 1. Overview & scope

This work adds the **Backyard Brains Spiker:bit** (a micro:bit expansion board for
biosignal recording) as a hardware option in the DataFlow tile — **EMG signal in** to a
Sensor node and **servo out** from a Live Output node, over WebUSB — and, together with
it, refactors how the DataFlow tile talks to *all* serial hardware onto a
**device-capability model** and a **transport abstraction**.

The two halves are one design, not two. The Spiker:bit is a third hardware path
alongside the existing Arduino and radio-hub micro:bit, and the refactor is what lets it
be a first-class device rather than something impersonating an Arduino. Read them
together: §3 is the resulting architecture, §4 is why it is shaped that way.

**In scope:** the Spiker:bit connect/flash/stream path; the WebUSB firmware; the
device-capability model (identity vs. protocol); the transport interface and a
transport-agnostic connection store; unified inbound/outbound data paths; support-driven
output gating; and the label/field cleanups that fall out of honest device identity.

**Out of scope (separate tickets / future work, see §7):** EEG/ECG modes and additional
channels; a per-sensor support list; a reproducible in-repo firmware build; renaming
`SerialDevice`; connect-error UI; and connect-menu dedup/dismissal.

## 2. Background: the three hardware paths

- **Arduino** over the **Web Serial API**. A single sketch emits keyed lines
  (`emg:<int>\r\n`, `fsr:`, `tmp:`, `a1:`) at 9600 baud and accepts a bare integer servo
  angle terminated by `\n`.
- **Radio-hub micro:bit** over **Web Serial**. A distinct, pre-existing scenario: a USB
  "communicator" micro:bit bridges serial↔radio to remote hub micro:bits controlling
  relays and temp/humidity sensors. It is *not* EMG, and its wire framing is different
  (`[sc][abcd][rth]<value>`). Documented in `src/plugins/dataflow-tool/microbit/`.
- **Spiker:bit** over **WebUSB**, via the micro:bit Foundation's
  `@microbit/microbit-connection` (MIT), which handles WebUSB connect, universal-hex
  flashing, serial integrity after flash, and reconnection. The Spiker:bit is physically
  a micro:bit running a fixed program; it emits/accepts the *same* keyed-line protocol as
  the Arduino by design.

## 3. Architecture (final result)

### 3.1 Device identity vs. wire protocol

Two concepts that a device connection must track are kept explicitly distinct:

- **Device identity** — what is plugged in. `SerialDevice.deviceFamily ∈ {"arduino",
  "microbit", "spikerbit"}`.
- **Wire protocol** — what language the bytes speak. A channel carries `channel.protocol
  ∈ {"keyValue", "radioHub"}`.

They are bridged by a capability table keyed on identity
(`src/plugins/dataflow/model/utilities/device-capabilities.ts`):

```ts
export const kDeviceCapabilities = {
  arduino:   { protocol: "keyValue", displayName: "Arduino",    outputs: ["gripper", "servo"] },
  microbit:  { protocol: "radioHub", displayName: "micro:bit",  outputs: ["relay"] },
  spikerbit: { protocol: "keyValue", displayName: "Spiker:bit", outputs: ["servo"] },
};
```

- **`protocol`** drives sensor channel-match and output routing. A device *satisfies* a
  channel when its protocol equals the channel's `protocol` tag, so a Spiker:bit lights
  up the Arduino's keyValue EMG/servo channels while being honestly identified.
- **`outputs`** declares the live-output types a device can actually drive — finer than
  protocol (Arduino and Spiker:bit share the `keyValue` protocol, but the Spiker:bit has
  a servo and no Backyard Brains gripper). This drives output gating (§3.6).

Predicates: `deviceProtocol`, `channelSatisfiedBy`, `deviceSupportsOutput`,
`deviceDisplayName`.

The two protocols are named for their **wire format**: `keyValue` is labeled
`channelId:number\r\n` lines (Arduino and Spiker:bit), parsed by `parseKeyValueData`;
`radioHub` is the multi-hub radio framing (radio-hub micro:bit), parsed by
`handleRadioHubStreamObj`.

### 3.2 Transport abstraction

```ts
export interface IDeviceTransport {
  write(line: string): void;      // transport supplies its own framing (\n)
  close(): Promise<void>;
  onData?: (chunk: string) => void;       // wired by the store when active
  onDisconnect?: () => void;
}
```

- **`WebSerialTransport`** (`web-serial-transport.ts`) owns the entire Web Serial world:
  the port, writer, `open()` (requestPort + open + resolve identity from USB ids), the
  read loop with reopen/timeout recovery, and the app-start `navigator.serial`
  connect/disconnect listeners (`initWebSerialConnectionEvents`). It delivers decoded
  chunks via `onData` and fires `onDisconnect` when the read loop gives up.
- **`MicrobitUsbTransport`** (`spikerbit-device.ts`) is its WebUSB peer: `serialdata →
  onData`, `status → onDisconnect`, `write → connection.serialWrite`.
- **`SerialDevice`** (`serial.ts`) is a transport-agnostic connection store. It holds the
  active transport and the connecting tile's channels; `writeLine → activeTransport.write`
  is the single outbound exit; `receive(chunk)` is the single inbound router;
  `isConnected()` is `activeTransport != null`. `navigator.serial` does not appear in it.

### 3.3 Data flow — both directions unified

- **Outbound:** each tick a Live Output node calls `sendDataToSerialDevice`, which
  resolves the connected device's protocol, calls the matching `writeToOut…` formatter
  (e.g. servo-angle scaling), and ends at `writeLine → activeTransport.write`. Neither the
  node nor `SerialDevice` above `writeLine` knows which transport is active.
- **Inbound:** every device flows `transport.onData → SerialDevice.receive`, which picks
  the parser by protocol (`parseKeyValueData` for Arduino/Spiker:bit,
  `handleRadioHubStreamObj` for the radio hub) and writes the shared
  `NodeChannelInfo.value`. A Sensor node samples that value each tick.

(Diagrams and a fuller walkthrough live in
`src/plugins/dataflow-tool/serial.md`.)

### 3.4 Connect flows

Both flows end at `SerialDevice.setActiveDevice(deviceFamily, transport, channels)`, which
records the transport, identity-guards and wires its `onData`/`onDisconnect`, and marks
the store connected.

- **Web Serial** (`serialDeviceRefresh`): `new WebSerialTransport()` → `open()` →
  `setActiveDevice` → `setRaisesWebSerialConnect` → `startReading()`. The device chooser
  is intentionally **unfiltered** — working Arduino clones (one ships with current
  Backyard Brains hardware) don't all match a clean USB-id filter, so filtering would hide
  boards that work.
- **Spiker:bit** (`connectSpikerbit`): `SpikerbitDevice.connectAndStream` connects over
  WebUSB, checks/flashes firmware (§3.5), then `setActiveDevice("spikerbit", …)`.

### 3.5 Firmware & flashing

The Spiker:bit runs a fixed micro:bit program (`CLUE-SPIKERBIT v<N>`), committed as a
universal hex (`spikerbit-clue.hex`) with its MakeCode source of record
(`spikerbit-clue.ts`) and imported into the app as a string via webpack `asset/source`.
On connect, before becoming the active device, `SpikerbitDevice` points the transport's
`onData` at a connect-time version handler, sends `?`, and waits ~1.5s for a
`CLUE-SPIKERBIT v<N>` banner. If none arrives (unknown firmware) or the version is older
than `kSpikerbitFirmwareVersion`, it flashes the bundled hex (partial flash; the USB
connection survives it) and re-queries, then hands the transport to the store — which
repoints `onData` at `receive`.

As of v3 the firmware computes the EMG envelope itself (tracks the DC baseline,
full-wave rectifies) rather than using the `pxt-spikerbit` extension's
`musclePowerSignal()`, whose fixed noise floor sits above the board's resting baseline and
misses moderate contractions.

### 3.6 Output gating & sensor labels

- **Output gating** is a three-state gate — `live` / `unsupported` / `no-device` — via
  `outputGateState` + `deviceSupportsOutput`. A connected Spiker:bit shows Servo as live
  and the Grabber as **unsupported** (it has a servo, not the BB gripper).
- **Sensor-missing prompt** is a generic "Connect a device for live &lt;sensor&gt;".
- **Sensor-select label** is the channel's `displayName` ("EMG", "Temperature A").

## 4. Design decisions & rationale

The most valuable part of this design is *why* each piece is shaped the way it is —
several of these are alternatives that were prototyped and rejected.

### 4.1 Honest device identity, not an Arduino masquerade

The Spiker:bit reports `deviceFamily = "spikerbit"`. The rejected alternative was to fake
`"arduino"` so the node layer lit up with no changes. That was rejected because it
collapses three separable things into one dishonest value: it conflates identity with
protocol; nothing at the state layer can then tell a Spiker:bit from an Arduino; and it
**misrepresents output support** — the node layer would offer the Backyard Brains Grabber
on a board that only has a servo. The roadmap makes the cost compound: more Spiker:bit
*modes* (EEG/ECG, extra channels) are expected on the same WebUSB transport, and each mode
built on the masquerade enlarges the eventual untangling. Honest identity now is cheap;
honest identity later is not.

### 4.2 Identity and protocol are separate fields

Both a device and a channel used to be tagged `deviceFamily`, conflating "what is plugged
in" with "what wire language this speaks." They are split — `SerialDevice.deviceFamily`
(identity) and `channel.protocol` (protocol) — because the same protocol is spoken by more
than one device: the Arduino and the Spiker:bit both speak `keyValue`. Keeping one field
would force exactly the masquerade §4.1 removes.

### 4.3 Protocols named for the wire format, not hardware

The protocols are `keyValue` and `radioHub`, not `arduino` and `microbit`. Naming a
protocol after hardware misleads the moment a second device speaks it — a Spiker:bit
speaking the "arduino" protocol reads as a contradiction. The format-named versions
describe what actually differs (labeled key:value lines vs. multi-hub radio framing).
Device **identity** keeps hardware names, because there it is accurate. The parser and
handler functions follow suit (`parseKeyValueData`, `handleKeyValueStreamObj`,
`handleRadioHubStreamObj`).

### 4.4 A fully transport-agnostic store, not a half-abstraction

`SerialDevice` owns no transport; Web Serial is a `WebSerialTransport` on equal footing
with `MicrobitUsbTransport`. The rejected shape kept `SerialDevice` owning the Web Serial
port, reader/writer, read loop, and `navigator.serial` while *also* claiming to be
transport-agnostic. That is incoherent: an interface cannot meaningfully abstract the
transport while the class that consumes it *is* one of the transports. A WebUSB device
can only be a peer if the store is neutral. So the whole Web Serial cluster moved into its
own transport, and the store keeps only what is genuinely transport-independent
(identity, channels, connection status, output formatters, the protocol router).

### 4.5 Inbound is unified through `receive`, not device-specific

Spiker:bit inbound flows `transport.onData → SerialDevice.receive`, exactly like Web
Serial. The rejected alternative had `SpikerbitDevice` parse its own inbound stream
directly (calling the shared parser but bypassing `receive`). That left inbound
**asymmetric** — two code paths doing the same routing — for no benefit once the transport
delivers chunks via `onData`. The one genuinely device-specific inbound concern is
connect-time **version detection**, and that is handled as a connect-phase step: during
connect `SpikerbitDevice` temporarily points `onData` at a version handler, then
`setActiveDevice` repoints it at `receive`. Version detection is not part of the
steady-state data path, so it does not justify a second inbound path.

*Accepted tradeoff:* EMG bytes arriving in the connect/flash window (before
`setActiveDevice`) are not parsed — only version detection runs then. This is fine because
the tile shows no live values until the node is connected and sampling, which is after
`setActiveDevice`.

### 4.6 Stale-transport callbacks are identity-guarded

`setActiveDevice` wires `onData`/`onDisconnect` behind an `activeTransport === transport`
guard, and the app-start disconnect listener only tears down when a `WebSerialTransport`
currently owns the connection. Without the guards, a slow old read loop (its read timeout
is ~2s) could fire `onDisconnect` *after* a newer device connected and silently tear it
down, and an unrelated Web Serial disconnect could kill a live WebUSB (Spiker:bit)
session. The guards ensure a stale transport can never affect a newer connection.

### 4.7 `raisesWebSerialConnect`, not `knownBoard`

This flag's sole purpose is deciding whether the connect button can trust the browser
`connect`/`disconnect` events to reflect physical-connection state — so it is named for
that, and it applies only to the Web Serial path (it stays false for a WebUSB
connection). The old name `knownBoard` described the *implementation* (an authentic
Arduino, USB productId 67) rather than the purpose, and read as if it were a general
device-quality flag. The empirical basis is unchanged: of the boards tested, only
authentic Arduinos were observed to raise the `connect` event, which is why the button
trusts the "not connected" signal only for such a board.

### 4.8 Sensor label by `displayName`; `hubId`/`hubName` removed

The sensor-select label was `hubName:type` (e.g. "Arduino:emg-reading"). Because the
Spiker:bit reuses the Arduino keyValue channels, that mislabeled a **Spiker:bit's** EMG as
"Arduino." The label is now the channel's `displayName` ("EMG", "Temperature A"), which is
device-neutral and already carries the same across-hub disambiguation `hubName` provided —
the micro:bit `displayName` embeds the hub letter (its 2019 origin was distinguishing
same-type sensors across radio hubs, which `displayName` preserves). With that change,
`hubName` had no readers and was deleted; `hubId` was already dead (nothing read it). The
sensor-missing prompt likewise dropped its device-specific wording ("Connect Arduino" /
"Connect micro:bit") for a generic "Connect a device …", because the EMG channel is served
by both an Arduino and a Spiker:bit, so naming one device was always incomplete.

### 4.9 Output gating is support-driven with an explicit "unsupported" state

The three-state gate exists specifically to make honest identity safe. With identity
honest (`spikerbit ≠ arduino`), the old `deviceFamily === "arduino"` literal gates would
show the Servo output as "connect a device" while a Spiker:bit *is* connected, or offer
the Grabber it can't drive. The `unsupported` state — driven by the device's `outputs`
list — is what catches "connected, but this device can't do this output."

## 5. What we deliberately did *not* do

- **One `serialDevice` store, kept.** A tile connects one device at a time, so a single
  global connection store is correct; multiplexing was not added.
- **Connect/detect/flash kept out of the transport interface.** The two connect flows are
  legitimately different (Web Serial `requestPort()` + read loop vs. WebUSB
  connect → version-query → flash → reconnect). Each transport exposes its own connect
  entry point and is handed to the store once established; forcing both behind one
  interface method adds no value.
- **No per-sensor support list yet.** Sensor channel-match stays protocol-based, so a
  Spiker:bit (EMG only) marks an FSR channel present until it times out to `missing` rather
  than immediately saying "this device doesn't provide FSR." The natural trigger for a
  `sensors` list is the first EEG/ECG mode, when sensor sets genuinely diverge.
- **`SerialDevice` not renamed.** Now that it is transport-agnostic, a name like
  `DeviceConnection` would be more accurate, but the rename ripples the `stores.serialDevice`
  key across the app; deferred.
- **`determineDeviceFamily`'s binary USB-id assumption** ("not a micro:bit ⇒ Arduino") is
  kept; a real board lookup table is future work.
- **`IDeviceTransport.close()`** is defined but not yet wired to a programmatic disconnect
  path (disconnect comes from the transports' own lifecycle events).

## 6. Testing

- **Unit:** capability predicates (protocol lookup, channel-satisfaction, output support);
  the three output-gate states; `WebSerialTransport` lifecycle (identity/`raisesWebSerialConnect`
  resolution, write framing + closed no-op, chunk delivery → timeout → give-up →
  `onDisconnect`); central `receive()` protocol routing and the stale-transport identity
  guard; `keyValue` line parsing (incl. partial-buffer recovery); Spiker:bit
  connect/flash/inbound-through-`receive`; firmware-version consistency.
- **No Cypress for hardware** (real hardware can't run there; respects the it-block
  budget). The **simulation → dataflow** path *is* covered by `simulator_tile_spec.js`
  ("Simulator Tile with Dataflow"): a simulated EMG channel appears, is selected, and
  values flow.
- **Manual hardware (pending human):** Arduino / radio-hub micro:bit / Spiker:bit —
  connect, stream, drive output, unplug/replug, including a reconnect within ~2s to
  exercise the stale-transport guard.

## 7. Known limitations & future work

- **Reproducible in-repo firmware build.** The hex is hand-exported from MakeCode; a
  pxt/Docker build is preferred once the system is stable.
- **Connect-error UI.** `connectSpikerbit` only `console.error`s on failure. The most
  important case is `device-in-use` (WebUSB `claimInterface` fails because another
  page/app — typically a MakeCode tab — holds the micro:bit's exclusive WebUSB interface);
  the user currently sees nothing. Map the library's `DeviceError.code` values to visible,
  actionable messages, alongside a flash-progress modal and the MakeCode fallback.
- **Connect menu.** The chooser has no click-outside dismissal, and the two Web Serial
  options behave identically; dedup/collapse and add dismissal.
- **Listener cleanup / in-flight connect guard.** A fresh `SpikerbitDevice` is created per
  connect and `connectSpikerbit` guards only on `isConnected()`, not on an in-progress
  connect; repeated/double-click connects can leak listeners.
- **Per-sensor support list** (EEG/ECG), **`SerialDevice` rename**, a dedicated
  **protocol module**, and **wiring `close()`** — see §5.
