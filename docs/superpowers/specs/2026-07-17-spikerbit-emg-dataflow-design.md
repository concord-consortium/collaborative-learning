# Spiker:bit EMG support in the DataFlow tile — Design (CLUE-567)

Date: 2026-07-17
Status: Draft for review

## 1. Overview & scope

Add the **Backyard Brains Spiker:bit** (a micro:bit expansion board for biosignal
recording) as a third hardware option in the DataFlow tile. This first increment
covers **EMG mode only**:

- **EMG signal in** → the existing EMG sensor node.
- **Servo output** → the existing Servo output node drives a servo on the Spiker:bit.

End-to-end goal: a student plugs in a Spiker:bit (with a micro:bit seated in it),
chooses "Spiker:bit" in the connect flow, and the tile connects, detects whether our
fixed program is running, flashes it if not, and then streams EMG data in and servo
angles out — with no manual MakeCode step.

**Fallback:** if the auto-detect/flash work proves too costly, we drop only the flash
step and fall back to manual MakeCode flashing. The data path (connect to an
already-running program, stream EMG, drive servo) is designed to stand on its own so
this fallback is a small, clean removal rather than a redesign.

Out of scope for this increment: EEG/ECG modes, the potentiometer/`fsr`/`tmp`
channels, a reproducible in-repo firmware build, and any change to the existing
Arduino or radio-hub micro:bit flows.

## 2. Background: how the DataFlow tile talks to hardware today

- **Arduino sketches** live in `src/plugins/dataflow-tool/arduino/`. A single sketch
  (`dataflowarduino.ino`, published copy `ccemgfsr.ino`) supports both the EMG
  SpikerShield + gripper servo and the potentiometer + servo, at 9600 baud. It emits
  keyed lines `emg:<int>\r\n`, `fsr:`, `tmp:`, `a1:`, and accepts a bare integer servo
  angle terminated by `\n`.
- **Browser side** is `SerialDevice` in `src/models/stores/serial.ts`, using the
  **Web Serial API** (`navigator.serial`). It opens the port at 9600 baud, parses
  `key:value\r\n` with a regex, updates channel values, and writes servo angles back.
- **Node/channel layer**: `SerialDevice` mutates `NodeChannelInfo.value`
  (`src/plugins/dataflow/model/utilities/channel.ts`); the EMG sensor node
  (`sensor-node.ts`) and Servo output node (`live-output-node.ts`) read/write those
  channels each tick. Nodes read the connection via `services.stores.serialDevice`.
- **Existing device abstraction**: `SerialDevice.deviceFamily` is
  `"arduino" | "microbit"`. Importantly, the existing `"microbit"` path is a **radio
  hub / relay** scenario (a USB "communicator" micro:bit bridging serial↔radio to
  remote hub micro:bits controlling relays and temp/humidity), documented in
  `src/plugins/dataflow-tool/microbit/hub.md` and `communicator.md`. It is **not** EMG,
  and it also runs over Web Serial. The Spiker:bit is therefore a distinct, third
  scenario.

## 3. Feasibility summary (auto-flash over the browser)

Confirmed feasible:

- The micro:bit's DAPLink chip exposes four USB interfaces simultaneously: mass
  storage (drag-drop drive), CDC serial, HID (CMSIS-DAP), and a dedicated
  vendor-specific **WebUSB** interface for browser flashing/serial.
- WebUSB access is gated by Chrome's **per-site/per-device user permission**, a device
  blocklist, and protected-interface-class rules — **not** by the device's
  "allowed origins" descriptor. Third-party (non-MakeCode) pages already flash
  micro:bits over WebUSB, so there is no MakeCode-domain restriction.
- The EMG API is the open-source MakeCode extension `pxt-spikerbit` (envelope value,
  ~250 Hz internally, mapped ~0–1023). The Spiker:bit board has a dedicated servo
  output driven by a standard micro:bit servo pin, and supports micro:bit V1 and V2.

We will use the micro:bit Foundation's **`@microbit/microbit-connection`** library
(MIT), which wraps dapjs and handles the hard parts: WebUSB connect, universal-hex
flashing (partial/full/fallback paths), serial integrity after flash, and
reconnection after unplug.

## 4. Connect UX

The connect button (`src/plugins/dataflow/components/ui/dataflow-serial-connect-button.tsx`)
presents a three-way choice when the user connects:

- **Arduino** → existing Web Serial path (unchanged).
- **micro:bit (radio hub)** → existing Web Serial path (unchanged).
- **Spiker:bit** → new WebUSB path (this design).

Naming the new option "Spiker:bit" (not "micro:bit") avoids colliding with the
existing radio-hub micro:bit, which is also Web Serial. Only the Spiker:bit branch is
new; the two Web Serial flows are not modified.

## 5. The fixed micro:bit program + hex

Authored once in the MakeCode online editor and committed as a static asset. Behavior:

- Import `pxt-spikerbit`; start muscle recording.
- Stream the EMG envelope as **`emg:<value>\r\n`** at roughly 100 ms cadence (matching
  the Arduino's output rate and key), value range ~0–1023.
- Read incoming serial lines and branch on content:
  - a **numeric** line → interpret as a servo angle and drive the servo
    (`servoWritePin` on the Spiker:bit's servo pin — exact pin resolved against the
    board during authoring).
  - a **non-numeric command** (e.g. `?`) → reply with the program version string
    `CLUE-SPIKERBIT v<N>\r\n`.
- On startup, also print the version string once as a secondary signal (banner).

Committed artifacts (under `src/plugins/dataflow/firmware/`):

- `spikerbit-clue.hex` — universal hex (V1+V2), loaded via a webpack asset import.
- `spikerbit-clue.ts` — the MakeCode source, committed for the record.
- `README.md` — the MakeCode project link and the manual re-export steps.

The version number `<N>` is bumped whenever the flashed program changes, so the tile
can tell which firmware a given micro:bit is running (see §7).

## 6. Architecture (dedicated module + shared protocol, single store)

Chosen approach: a dedicated Spiker:bit module that isolates the new/risky WebUSB and
flash code, reuses the Arduino protocol via extracted helpers, and drives the existing
single `serialDevice` store.

- **New module `src/models/stores/spikerbit-device.ts`** owns the WebUSB lifecycle via
  `@microbit/microbit-connection`: connect → detect (§7) → flash-if-needed →
  reconnect → stream. It also owns its own WebUSB **disconnect** handler (the Web
  Serial `"disconnect"` listener in `SerialDevice` will not fire for a WebUSB device),
  clearing the shared state on unplug.
- **Extract shared protocol helpers** out of `SerialDevice`:
  - the Arduino parse (`emg:<value>\r\n` → channel value update), and
  - the servo-angle scaling (`angleScale * n + angleOffset`, rounded).

  Both transports then share one protocol implementation. Inbound serial from
  `microbit-connection` is fed through the shared parse; outbound servo values go
  through the shared scaling.
- **Reuse the single `serialDevice` store.** The module drives its state:
  - reports `deviceFamily = "arduino"` so the existing Arduino EMG sensor channel and
    Servo output node light up unchanged (the channel-mismatch logic in
    `rete-manager.tsx` keys on `deviceFamily`),
  - pushes per-tick EMG channel values,
  - updates connection status / connect messages.
- **Transport-aware output.** `writeLine()` (`serial.ts:265`) routes to the active
  transport: the Web Serial `this.writer` normally, or the `microbit-connection`
  serial write when a Spiker:bit connection is active. This means the write path needs
  a small transport flag beyond `deviceFamily`. `writeToOutForServo` and the Servo
  output node remain unchanged because they call `writeLine()`.

### Component responsibilities

- `spikerbit-device.ts` — WebUSB connect/flash/reconnect state machine; serial
  read/write via `microbit-connection`; drives shared-store state; owns its disconnect
  handling. Depends on `@microbit/microbit-connection`, the bundled hex, the shared
  protocol helpers, and the `serialDevice` store.
- Shared protocol helpers (new small module or exported functions) — pure functions:
  parse a serial buffer chunk into channel updates; scale a value to a servo angle.
  No transport, no store; unit-testable in isolation.
- `SerialDevice` — unchanged transport for Web Serial; gains a transport flag and the
  `writeLine()` routing branch; exposes the small setters the Spiker:bit module uses to
  push state. Constructor is unchanged (it only registers Web Serial listeners and does
  not auto-connect).

## 7. Detect-and-flash state machine

Primary detection is a **version query**, not banner-catching (a banner printed only at
boot is easy to miss):

1. Open the WebUSB serial connection via `microbit-connection`.
2. Send the version-query command (`?`). Wait a short timeout for a
   `CLUE-SPIKERBIT v<N>\r\n` reply.
   - Reply received → our program is running; record the version; start streaming.
     (For this MVP any valid version reply counts as "present"; comparing `<N>` to the
     bundled version to decide on re-flash is future work.)
   - The startup banner, if seen in the window, is accepted as the same signal.
3. No valid reply within the timeout → flash the bundled universal hex, showing a
   progress modal driven by the library's flash-progress events. The library reconnects
   serial after the reset; re-run step 2 to confirm.
4. Flash failure (or auto-flash intentionally disabled) → **fallback UI**: instructions
   to set up the micro:bit in MakeCode, with the project link and a hex download, then
   a retry. This is the same path used for the manual-MakeCode fallback.

We only flash when no valid version reply is received; a micro:bit already running our
program is not re-flashed. No "this will overwrite your micro:bit" confirmation is
shown — the activity assumes a dedicated board.

## 8. Testing

- **Unit tests (pure helpers):** Arduino parse (`emg:` line → channel value, including
  the corrupted/partial-buffer recovery behavior), servo-angle scaling, and the
  **detection predicate** (given a serial-buffer string, is a valid version reply
  present, and what version).
- **Module state machine:** detect → flash → reconnect → stream, tested against a
  **mocked `@microbit/microbit-connection`** interface. No real WebUSB in Jest.
- **Manual hardware verification:** a real Spiker:bit for true end-to-end (connect,
  auto-flash a blank micro:bit, EMG in, servo out, unplug/replug).
- **No Cypress:** real hardware cannot run in Cypress, and this respects the project's
  Cypress it-block budget.

## 9. Dependencies / build considerations

- Add `@microbit/microbit-connection` (MIT) to `package.json`.
- WebUSB requires a secure context. CLUE runs over HTTPS, and `localhost` is treated as
  a secure context, so local development works.
- Confirm the library integrates cleanly with the React 17 / webpack 5 build (a plain
  TS library; expected to be fine — verified during implementation).
- The universal hex is a binary asset imported through webpack (asset/resource).

## 10. Known limitations & future work

These are deliberate MVP shortcuts, to be revisited once this ships:

- **Single-store reuse + `deviceFamily = "arduino"` masquerade.** The Spiker:bit drives
  the one `serialDevice` store and presents as Arduino-compatible to the node layer.
  This keeps node/channel changes minimal but conflates a micro:bit with an Arduino at
  the state layer. The intended longer-term fix is a **transport-pluggable
  `SerialDevice`**: an explicit transport interface (`WebSerialTransport` vs
  `MicrobitUsbTransport`) with protocol parsing kept central, and a real device/board
  abstraction distinct from the wire protocol. A pointed code comment at the coupling
  site will reference this section.
- **`writeLine()` transport branch.** Routing writes by an active-transport flag inside
  `SerialDevice` is a shortcut that keeps the rest of the codebase untouched; it folds
  into the transport-pluggable refactor above.
- **No version-based re-flash.** We detect the running version but do not yet compare it
  to the bundled version to auto-update an out-of-date micro:bit. The version-query is
  designed so this is a small follow-up.
- **Firmware is hand-exported from MakeCode.** A reproducible in-repo pxt/Docker build
  is preferred once the system works end-to-end.
- **`determineDeviceFamily` binary assumption.** The existing USB-id discriminator
  ("not a micro:bit ⇒ Arduino") is untouched here because the Spiker:bit path does not
  go through Web Serial port selection; a real board lookup table is part of the future
  abstraction.
- **No user-facing feedback for connection/flash errors.** `connectSpikerbit` currently
  only `console.error`s on failure, and there is no on-screen flash progress (see §7).
  The most important case observed in practice is a **`device-in-use` error** (WebUSB
  `claimInterface` fails with "Unable to claim interface") when another page or app —
  typically the **MakeCode editor tab** — still holds the micro:bit's WebUSB interface,
  which is exclusive. The user sees nothing and assumes the tile is broken. Follow-up:
  surface a visible, actionable message for this case — e.g. "Another program (such as
  MakeCode) is connected to your micro:bit. Close it, then reconnect." — alongside the
  general flash-progress modal and the MakeCode-fallback UI. Map the library's
  `DeviceError.code` values (`device-in-use`, `no-device-selected`,
  `device-disconnected`, `firmware-update-required`, …) to appropriate messages.
