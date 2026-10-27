# CLUE-728: Dataflow UI for the Spiker:bit connection status

The UI half of CLUE-728 ("Spiker:bit firmware reports that it is connected and working"). The
protocol, the firmware and Dataflow's session code are in
[2026-10-20-clue-728-spikerbit-firmware-protocol-design.md](2026-10-20-clue-728-spikerbit-firmware-protocol-design.md),
built in #3056 and #3055. This half uses what they provide to show students and teachers when a
connection has stopped working, and adds the "Is it alive?" check. It builds on the connect button
and pane that CLUE-716 added to the Dataflow toolbar
([dataflow-connect-button.tsx](../../../src/plugins/dataflow/components/toolbar/dataflow-connect-button.tsx)).

## Why

Today Dataflow only knows a board is working when values arrive. When they stop, nothing tells a
broken connection from a quiet sensor. An unplugged Spiker:bit isn't reliably noticed, and when
it is, the button just goes gray with nothing said about why.

The goal is a better **debugging** experience, not an alarm. When something seems wrong, the
first step we'll tell users is "open the connect button". The button draws the eye, and the pane
says in one line what is going on.

## Goals

- When a connected Spiker:bit stops answering, the connect button turns yellow and the pane says so.
- When a board is unplugged, Spiker:bit or Arduino, the button pulses and the pane says it was
  unplugged, or that the connection was lost when the cause isn't confirmed.
- When Connect fails because another app is using the Spiker:bit, the pane says so.
- An "Is it alive?" control in the pane asks the Spiker:bit to show its heart and play its sound,
  and reports whether it answered.

## Non-goals

- **No dialog or popup** when the connection stops. One may come later; for now it could be
  annoying.
- **No change to the running program or its values.** The program keeps running, and Sensor
  nodes keep showing what they show today (the last value) when a board stops sending.
- **No detail view or log.** CLUE-727 expands the pane's message with a link or button to more
  detail, and decides what reaches the log.
- **The radio-hub micro:bit** is untouched.
- **The older connect button** at the top of the tile, used by units whose
  `settings.dataflow.tools` leaves out `connect`
  ([dataflow-serial-connect-button.tsx](../../../src/plugins/dataflow/components/ui/dataflow-serial-connect-button.tsx)),
  doesn't change. It has its own menu rather than the toolbar's connect pane, so it doesn't get
  the new messages or "Is it alive?".

## Anti-goals

- **A message that doesn't fit.** The pane is small. Every message is one short line under the
  status line.
- **A false "not responding"** when a student comes back to a tab Chrome has been throttling.
- **Pulling the user away from the program.** Nothing here takes focus or covers the canvas.

## The connect button

The button keeps its three looks: gray (`idle`), green (`connected`) and yellow (`attention`).
`attention` pulses three times when it's newly applied and then stays yellow
([dataflow-connect-pane.scss](../../../src/plugins/dataflow/components/toolbar/dataflow-connect-pane.scss)).

| Case | Button | Tooltip (suggested) |
|---|---|---|
| Connected and answering | green, as today | `Connected: Spiker:bit`, as today |
| Connected, **not responding** (including `othersession`) | three pulses, then **stays yellow** until the board answers again, whether or not the program needs a device | `The Spiker:bit is not responding. Click for details.` |
| **Unplugged**, or the connection **lost** | three pulses, then the normal not-connected look: **solid yellow if the program needs a device, gray if not** | the normal not-connected tooltip |

The unplugged case is new behavior: today the pulses only come with a button that stays yellow.
It needs a pulse that settles back to gray. It's a separate `connect-loss-pulse` class, whose
animation runs over the button's normal look. The class is on while a loss recorded after the
toolbar mounted exists, until a connect attempt clears the loss, with no timer.

The loss pulse plays when the loss happens, in whatever toolbar is showing then. It
doesn't replay when a toolbar is shown later, so a user whose toolbar wasn't showing doesn't see
it; the pane's second line still tells them when they open it. Nothing tracks whether the unplug
has been seen.

A board that starts answering again turns the button green again by itself, with no user action.

## The pane

The pane keeps its heading, its status line and its controls. Under the status line goes **one
line** of explanation, in the place `connectError` uses today. Only one shows at a time.

| Case | Status line | Second line |
|---|---|---|
| Unplugged (confirmed) | Not connected | The Spiker:bit was unplugged. / The Arduino was unplugged. |
| Lost another way | Not connected | The connection to the Spiker:bit was lost. / … to the Arduino … |
| Connect refused, `device-in-use` | Not connected | Another app is using the Spiker:bit. |
| Not responding (including `othersession`) | Connected: Spiker:bit | The Spiker:bit is not responding. |
| "Is it alive?" check | Connected: Spiker:bit | see below; replaces the line above while it shows |

The label is the device choice's label (`kDeviceChoiceLabels`). The radio-hub micro:bit uses
Web Serial like the Arduino, so it gets the unplugged message with its own label.

**How long "unplugged" stays:** until the next Connect or Reconnect attempt, as `connectError` is
cleared today. If a connect attempt fails, its "Couldn't connect" error replaces it.

**Reconnect after an unplug** isn't offered: with nothing connected, the pane lists the devices.
This is how the connect pane was designed when it was added to the toolbar (CLUE-716).

### "Is it alive?"

- A third control, **"Is it alive?"**, next to Reconnect and Disconnect, shown **only when a
  Spiker:bit is connected**. Arduinos don't get it: their firmware has no `identify`.
- It's available in every connected state, including not responding, where it is most useful.
- Clicking it sends `identify #n`. The board shows the identify (heart) icon for 3 s and plays a
  short sound on a micro:bit V2.
- **The pane stays open.** Unlike Connect and Disconnect, success doesn't close it, so the student
  sees the result. Focus stays on the control.
- **The check belongs to the connection, not the pane.** `DeviceConnection` keeps it, with the
  `CcDeviceSession` it asked, and shows it only while that object is active. Closing and reopening
  the pane keeps the answer, every tile's pane shows the same check, and a new device or a
  reconnect never shows an earlier board's answer.
- The second line shows, in order:
  1. `Checking the Spiker:bit… look for the heart.` while waiting for the reply;
  2. `The Spiker:bit answered.` when its reply (`ok #n` or `err #n`) arrives, or
     `The Spiker:bit didn't answer.` if none arrives within **2 s**;
  3. then, about 3 s after the result appears, whatever the line showed before (nothing, or the
     not-responding message, as the state is then).
- **The control is disabled while checking**, from the click until the reply arrives or the 2 s
  timeout passes, using the pane's existing disabled look (`PaneControl`'s `busy`, which sets
  `aria-disabled` and keeps the control focusable, so focus isn't lost). Once it re-enables, it
  can be clicked again while the result is still showing, and even while the board is still
  showing the heart. That starts a new check, and the line goes back to "Checking…".
- The second line is inside the existing `role="status"` region, so screen readers announce each
  change.

## Detecting the cases

### Not responding

`CcDeviceSession` ([cc-device-session.ts](../../../src/models/stores/cc-device-session.ts)) counts
the commands sent with no reply since the last reply. Any reply, `ok` or `err`, to a pending `open`
or `ping` resets the count to zero, except `err othersession`, which sets not responding (below).
When **3 in a row** go unanswered, the board is **not responding**. The session exposes this as an
observable.

It counts commands, not seconds, on purpose. Chrome slows timers in a tab that has been hidden for
a while, to as little as about once a minute, so the board's 5 s session lapses. When the student
comes back, the next `ping` gets `err nosession`, which is an answer, and Dataflow reopens. A
count of seconds would turn the button yellow every time the student came back.

**Hidden tabs don't count.** Counting commands isn't enough on its own. The library reads serial
data on a `setTimeout` chain, 62 bytes per read (`startPolling` in
`@microbit/microbit-connection`'s `daplink.js`). In a hidden tab, even ordinary once-a-second
throttling reads slower than the EMG readings arrive, so ping replies queue behind the backlog or
are lost when DAPLink's buffer overflows. Meanwhile the pings keep going out. **Decision:** while
`document.visibilityState` is `hidden`, unanswered commands aren't counted, and the count resets to
zero when the tab becomes visible. Once the backlog drains after the student comes back, the next
ping is answered. A board that has really stopped is reported when the fourth ping goes out,
about 4 s after the tab is visible again. *(My call.)*

The existing `lastHeartbeatAt` now has no reader. It stays.

`identify`'s reply doesn't count toward this: the state is about the session. *(My call.)*

**`err othersession` is shown as not responding.** It means another host owns the session. That
isn't expected in practice: WebUSB lets only one program claim the board (see below), so a second
tab or app can't connect to start one. The session already stops pinging on `othersession`, so the
count would never reach 3; instead the session goes straight to not responding and stays there
until the session ends (Reconnect or Disconnect). The bench script checks the firmware's
`othersession` reply by opening a second session with a different id; it can't hold a session
alongside CLUE, since only one program can have the port. Dataflow's handling of it is covered by
Jest.

### Another app has the board at connect

WebUSB lets only one program claim the board's interface. The library turns Chrome's "Unable to
claim interface" into an error with the code `device-in-use` (`connection.js` in
`@microbit/microbit-connection`). This happens when another CLUE tab, another browser, or another
app using that interface already has the board. Today the connect fails with "Couldn't connect to
Spiker:bit."; it now fails with "Another app is using the Spiker:bit." in the same place
(`connectError`), with the button's usual attention look. `DeviceConnection` has to carry the
reason out of `streamSpikerbit`, which today turns every failure into `"failed"`, to the
connect-failure path in [device-actions.ts](../../../src/plugins/dataflow/utilities/device-actions.ts).

"Another app" covers a second CLUE tab loosely, on purpose, to keep the message to one short line. The
Arduino's Web Serial "port already open" failure isn't changed.

### Unplugged or lost

Both transports report a loss through `IDeviceTransport.onDisconnect(loss)`, which
`SerialDevice.setActiveDevice` wires to `recordUnplug` for `"unplugged"` and to
`clearActiveDevice(loss)` for `"lost"`
([serial.ts](../../../src/models/stores/serial.ts)).

A device can be lost by these paths, and each has to record it:

- **Web Serial (Arduino, radio hub), the browser event:** `initWebSerialConnectionEvents` in
  [web-serial-transport.ts](../../../src/models/stores/web-serial-transport.ts) handles
  `navigator.serial`'s `disconnect` event, which authentic Arduinos raise the moment they're
  unplugged. It acts only when the event's target is the `WebSerialTransport`'s `lastPort`, so
  another port's unplug changes nothing, and records the unplug with `recordUnplug`. Before
  this change it cleared the device directly for any port.
- **Web Serial, the read loop:** for boards that don't raise the browser event, the read loop
  calls `onDisconnect` when it gives up on a port that stopped being readable, not after `close()`.
  Its read timeout means it can take a few seconds to notice.
- **WebUSB (Spiker:bit):** the `@microbit/microbit-connection` library listens for
  `navigator.usb`'s `disconnect` event only in its `initialize()`, which CLUE doesn't call:
  `initialize()` also pauses the connection when the tab is hidden, which CLUE doesn't want.
  `MicrobitUsbTransport` adds its own `navigator.usb` `disconnect` listener and fires
  `onDisconnect("unplugged")` when the event's device is this connection's device. It then closes
  the library connection, whose status would otherwise stay Connected. `SpikerbitDevice.dispose()`
  removes the listener when the device is replaced or a connect attempt with it fails. It stays
  while the board is kept for Reconnect: the library keeps its device after disconnecting itself,
  so an unplug that comes after a failed write still upgrades "lost" to "unplugged".
- **WebUSB, a failed write (already happening).** Without that listener an unplug is still
  noticed today, within about a second: since #3055 a `ping` is written every second, the
  write to an unplugged board fails, the library's `withEnrichedErrors` calls
  `disconnect(true)`, its status becomes `Disconnected`, and `MicrobitUsbTransport` fires
  `onDisconnect`, which clears the device. The console shows the library's "An error occurred
  whilst attempting to use WebUSB." when this happens. A failed read doesn't do this: the
  library's polling loop reports read errors as a `backgrounderror` event, which CLUE doesn't
  listen for, and leaves the status alone. So before #3055 nothing wrote to an idle Spiker:bit,
  and an unplug went unnoticed unless a Live Output node was writing to the servo. This path
  stays: any WebUSB failure, not only an unplug, ends the connection through it.

**Which message.** An unplug confirmed by the browser's `navigator.usb` or `navigator.serial`
`disconnect` event for the active device says "The Spiker:bit was unplugged." (or "The Arduino
was unplugged."). Any other loss the user didn't ask for (a failed WebUSB call, or the Web Serial
read loop giving up) says "The connection to the Spiker:bit was lost." (or the Arduino). Boards
that don't raise `navigator.serial`'s event, such as clone Arduinos and the radio hub, therefore
always show "lost".

**The race between the two Spiker:bit paths.** An unplug sets off both: the `navigator.usb` event,
and a failed `ping` write within the next second. Whichever clears the device first wins, and
the other finds `activeTransport` already changed and is ignored by the existing guard. The event
normally arrives first. If the write fails first, the loss is recorded as "lost", so **an unplug
event for the device whose loss was just recorded upgrades it to "unplugged"**. The same applies
to Web Serial's two paths, though there the browser event fires seconds before the read loop gives
up. A failed write can also come from the `close` that Disconnect writes; that one isn't a loss,
because Disconnect is in progress.

**Decision:** every path that ends the connection without the user asking records why, so the
record is made where all of them go through: the reason goes through `onDisconnect(loss)` to
`clearActiveDevice(loss)` or `recordUnplug`. A Disconnect the user asked for, and the clear that a
connect attempt does first, record no loss. `MicrobitUsbTransport` also fires `onDisconnect` from
the library's `Disconnected` status, which a requested close raises, so
`DeviceConnection.disconnect()` clears the transport's `onDisconnect` before closing it.
`setActiveDevice` wires it again when the transport is next made active, as Reconnect does with the
Spiker:bit's.

**Where the state lives:** the unplugged or lost state is app-wide, like the connection itself, so
it isn't on the tile's content. The record is `SerialDevice.lastLoss`, and `DeviceConnection`
derives `lossMessage` and `lossAt` from it. Every tile's pane shows it. An unplug never sends
`close`: the board is gone, and `clearActiveDevice` stops the session without writing.

## Delivery

- A PR into the CLUE-728 feature branch (`CLUE-728-spikerbit-status`), which #3055 is merged into.
- With it in, the feature branch is complete, and its PR to master (#3059) can be reviewed.

## Testing

- **Jest, the session:** the unanswered count rising with pings and opens, resetting on any reply
  to one (an `ok`, `err nosession`, or an `err` with another reason), and crossing 3; a reply after
  crossing clearing the state; `othersession` making the session not responding until a new
  session; `identify` sending `identify #n` with a checksum and resolving answered on its `ok` or
  `err`, or not answered after 2 s, with fake timers; `stop()` removing its visibility listener.
- **Jest, the button state** (`connect-button-state.test.ts`): each row of the button table,
  including unplugged with and without `needsDevice`.
- **Jest, the pane** (`dataflow-toolbar.test.tsx`): each second line, and only one at a time;
  "Is it alive?" shown only for a Spiker:bit; the check's three messages and the return to the
  earlier line; the control disabled while checking and re-enabled on the answer or the timeout;
  the pane staying open; the answer still there after the pane is closed and opened again; the
  check working under React.StrictMode.
- **Jest, the check on `DeviceConnection`:** checking, then the answer, then cleared after 3 s; no
  answer shown for another session, even when it comes late; an earlier session's late answer not
  replacing a newer check; a new check not cleared by the previous one's timer.
- **Jest, unplug detection:** the WebUSB `disconnect` listener firing `onDisconnect` only for its
  own device, closing the library connection, and removed by `MicrobitUsbTransport.dispose()` and
  `SpikerbitDevice.dispose()`; `DeviceConnection` recording a loss from `onDisconnect` but not
  from a requested Disconnect or the `close` write it makes, and recording one again after
  Disconnect and Reconnect of the same Spiker:bit; `navigator.usb`'s and `navigator.serial`'s
  `disconnect` events recorded as unplugged, the latter only for the device's own port; a failed
  WebUSB write and a Web Serial read loop giving up recorded as lost; a loss recorded as lost
  upgraded to unplugged by a later event for the same device, and an event followed by a failed
  write staying unplugged; a connect attempt clearing the loss.
- **Jest, another app at connect:** `device-in-use` giving `"inUse"` on Connect and on Reconnect,
  without falling back to the chooser, and `device-actions.test.ts` turning it into "Another app
  is using the Spiker:bit." while other connect failures keep "Couldn't connect".
- **Jest, the loss pulse:** it plays in a toolbar showing when the loss happens; not in one shown
  afterward, even when that loss is cleared; not again when an unplug confirms a loss; and again
  on a later loss.
- **Jest, hidden tabs:** unanswered commands not counted while `document.visibilityState` is
  `hidden`, and commands unanswered before the tab was hidden not counted once it's visible.
- **Jest, end to end** (`spikerbit-end-to-end.test.ts`, on `MakeCodeSim`): a board that stops
  answering turns not responding, and `identify` gets its answer.
- **No Cypress spec.** The Jest tests cover the logic, and a Cypress spec can't plug in a board.
- **By hand, with a board, in the browser:** unplug a Spiker:bit and an Arduino while connected;
  hold a Spiker:bit's reset button (or otherwise stall it) to see not responding and recovery;
  connect from a second CLUE tab for `device-in-use`; click "Is it alive?" and see the heart, hear
  the sound on a V2, and read "answered"; leave the tab hidden for several minutes and come back
  without the button turning yellow. After a Spiker:bit's connection is lost (unplug and replug
  it), connect it again in the same tab: the pane shouldn't say "Another app is using the
  Spiker:bit." The library's disconnect after a failed write might leave this tab's claim on the
  interface, which Chrome would then refuse as in use.
- **Retests of #3055's code, on a board.** The review of #3055 asked for these at its head, and
  they were moved here because this branch contains that code. Report the results in this PR's
  description, naming the boards and the commit tested.
  - Spiker:bit V2 and V1, in a Mac browser:
    - Connect a freshly plugged-in board already running v4: it connects with no flash.
    - Auto-flash from other firmware, starting from both the v3 banner firmware and a MakeCode
      program. The MakeCode program doesn't answer, so this takes the 1.5 s timeout path.
    - After Dataflow flashes a board in the browser, Disconnect, then Connect: no second flash.
      This case came up in the original Spiker:bit support (#2929). After the first flash since
      plug-in, the library pushes 2048 dummy bytes into the interface chip's buffers
      (`cdc-saturation.js`), which the Node runs of #3055 never exercised.
    - EMG in a Sensor node, the servo from a Live Output, and Disconnect/Reconnect.
  - Arduino: connect, readings, the servo and gripper outputs, and Disconnect/Reconnect. #3055
    changed `device-capabilities.ts`, `live-output-node.ts` and `DeviceConnection.disconnect` for
    every device.
  - Not the radio hub.
  - Not on a Chromebook. Connecting there at #3055's head works only some of the time, failing
    differently than it did when the connect button moved to the toolbar (#3040), and it stays
    unclear until CLUE-727 adds logging of each connection step.

## Docs

- [serial.md](../../../src/plugins/dataflow/docs/serial.md): "The CC Device Protocol session"
  gains the not-responding count and `identify`. A new "Why a device went away" section covers
  the loss reasons, how each is detected and told apart, the "Is it alive?" check and
  `device-in-use`. The "Reconnect" paragraph and the Web Serial `disconnect` handler's description
  change to match.
- The protocol spec's open question about hidden tabs is answered here: CLUE doesn't pause the
  connection, sessions may lapse in a hidden tab, and the not-responding count is built to
  tolerate that.

## Decided while building

- The pulse is the `connect-loss-pulse` class described above.
- The loss reason goes through `onDisconnect(loss)`, and `DeviceConnection.disconnect` clears
  `onDisconnect` before closing, with no flag.
- `lastHeartbeatAt` stays, with no reader.
- The not-responding tooltip is "The Spiker:bit is not responding. Click for details."
- No Cypress spec.
