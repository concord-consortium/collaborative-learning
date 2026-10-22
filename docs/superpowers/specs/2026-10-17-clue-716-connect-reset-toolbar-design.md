# CLUE-716: Connect and Reset in the DataFlow Toolbar — Design

**Jira:** CLUE-716 (epic CLUE-714, "Microbits for Inquiry")

## Goal

Move DataFlow's device connection control from the tile's top bar into the tile toolbar, give it
a small attached pane for connecting, reconnecting and disconnecting, add a Reset control that
restarts the program's running state, and make the "this program needs a device" dialog cover
only its own tile instead of the whole application.

## Why

- Users can't tell "my program isn't working" from "my hardware is acting up." So there are two
  controls: Reset, which anyone can use with or without hardware, and Connect/Reconnect, which
  also resets so a freshly connected program always starts from a clean state.
- The automatic connection dialog was an application-wide alert. It was stretched very wide, it
  covered the chat panel, and it got in the way of the rest of CLUE every time a hardware program
  opened. Its real job is to make it obvious that the program can't work as configured until a
  device is connected. Scoping it to the tile keeps that job while removing the annoyance.
- CLUE-727 (connection error messages) and CLUE-728 (firmware heartbeat, "is it alive?") both need
  a place in the connection UI. This story builds that place.

## Scope

**In**

- A connect button in the DataFlow tile toolbar that opens an attached pane.
- A Reset button in the DataFlow tile toolbar.
- Connect, Reconnect and Disconnect in the pane. A successful Connect or Reconnect also resets.
- A status area in the pane, sized for a short message.
- New button color/pulse states.
- The automatic dialog rendered over its own tile, shown as a once-per-page-load tutorial.
- Hiding the top-bar connect button, with its "connect a device" / "click to finish connecting"
  text, when the tile's toolbar has the new button. Removing it entirely moved to CLUE-736 (see
  "Delivery").
- Logging Reset, Connect, Reconnect and Disconnect.
- One app-wide connection that feeds incoming data to every DataFlow tile, not only the one that
  connected (see "One connection, many tiles").
- A per-tile, live "needs a device" check that drives the button color and the dialog.

**Out**

- **The "Is it alive?" button** moves to CLUE-728. It needs CLUE-728's firmware. CLUE-728 already
  says the button goes in this pane.
- **Detailed error messages, a "More details…" link, and a secondary dialog** for error details
  belong to CLUE-727. This story leaves room for them in the status area but does not build the
  link or the dialog.
- **Detecting that a connected device has stopped sending data** belongs to CLUE-728.
- **Resetting Timer and Generator blocks.** See "What Reset does not touch." If they should reset,
  that is a new story.
- **A coachmark pointing at the connect button.** One could replace the dialog, or show when a
  student picks a sensor or output that needs hardware. CLUE has no coachmark system yet, so this
  would be a separate story.
- **Removing the top-bar connect button and migrating the curriculum** belong to CLUE-736.
- **A non-color cue for the button's states**, and support for forced colors, belong to CLUE-735.
- **Toolbar palettes closing when the toolbar wraps** to two rows belongs to CLUE-734.
- **Connection status when the tile isn't selected.** The tile toolbar only appears while the tile
  is selected, so an unselected tile shows no connection status. This is a known limitation,
  accepted because it is what the project lead asked for.

## One connection, many tiles

DataFlow connects to one device at a time. That connection belongs to the whole app, not to a
tile.

**Before this story.** `SerialDevice` (`src/models/stores/serial.ts`) was a single global store,
but each tile has its own copy of the channels: `setChannels` in `dataflow-content.ts` wraps them
in `observable()`, which copies the channel objects. At connect time the store recorded only the
connecting tile's channels. So incoming data reached only that tile, while `updateChannels` marked
every tile's serial channels as connected. The other tiles looked connected but got no data. The
`SpikerbitDevice` instance also lived on the connecting tile's `DataflowProgram` component.

**The design**

- **The connection is `DeviceConnection`** in `src/plugins/dataflow/model/device-connection.ts`.
  It owns connect, reconnect and disconnect, the transports and the `SpikerbitDevice`.
  `getDeviceConnection(serialDevice)` returns one instance per `SerialDevice`. It lives in the
  DataFlow plugin, not beside `SerialDevice` in the stores, because it imports the Spiker:bit
  firmware hex, which must stay in the DataFlow chunk. A tile unmounting doesn't affect the
  connection.
- **`DeviceConnection` tracks two choices.** `lastChoice` is the device choice the user last
  connected with (`arduino`, `microbitHub` or `spikerbit`). Reconnect repeats it, the pane and
  tooltip name the device by it, and the log events record it. `busyChoice` is set while a connect
  or reconnect attempt is in progress. A second attempt while one is running is ignored, and the
  UI disables its connection buttons.
- **Incoming data reaches every live DataFlow tile's channels.** While a tile is mounted and
  editable, `DataflowProgram` registers a channel source with
  `SerialDevice.registerChannelSource(() => this.props.tileContent.channels)`. The getter reads the
  tile's current channels on each call, since `setChannels` replaces the array. It returns a
  disposer, which `DataflowProgram` calls on unmount. `SerialDevice.receive` parses inbound data
  against the channels of every registered source, and every channel with a matching id updates.
  A tile that mounts while a device is already connected starts receiving data without
  reconnecting.
- **Every tile's button shows the same connection.** Green in one tile means green in all of them.
- **Reconnect and Disconnect act on the one connection**, whichever tile's pane they are clicked
  in.
- **The Reset that follows a successful Connect or Reconnect applies only to the tile where the
  user clicked.** Other tiles keep running.
- **An error belongs to the tile where the attempt was made,** until any connection succeeds
  (PR 2). Only that tile's button turns yellow for an unseen error, and only that tile's pane shows
  the message. Any successful connection, from any tile, clears every open tile's error, so a
  later disconnect can't bring it back.
- **Outputs.** Every tile's live output blocks already write to the one device on each tick. This
  story doesn't change that, so two tiles driving the same output still fight over it.

## "Needs a device" is per tile and live

Before this story, "the program needs a device" was the global `serialDevice.serialNodesCount`,
set by `ReteManager.countSerialDataNodes()`. It had two problems:

- **It was one number for the whole app.** Whichever tile counted last won, so a tile without
  hardware that loaded after a hardware tile turned off the hardware tile's warning.
- **It didn't update when a block's settings changed.** It was recounted only when the channel list
  changed or a block or connection was added or removed. Switching a Sensor block's dropdown to EMG
  didn't recount it.

Each tile now has its own `needsDevice` volatile on its content. An autorun in the tile's
`ReteManager` keeps it current as the student edits (`updateNeedsDevice`), including when a Sensor
block's sensor changes or a Live Output block is wired or its output changes. The autorun runs only
for an editable tile, not in read-only views or playback. It uses the same test as before,
`programNeedsDevice` in `src/plugins/dataflow/utilities/program-needs-device.ts`: a `SensorNode` or
`LiveOutputNode` whose `requiresSerial()` is true.

`needsDevice` drives whether the tile's connect button turns yellow. The automatic dialog's check
runs the same `programNeedsDevice` test once, when the program opens (see "The automatic 'needs a
device' dialog"). The global `serialNodesCount` and `countSerialDataNodes` are removed.

## Reset

Reset restarts the program's running state for the tile it's clicked in. It does not change the
program itself or anything that was recorded. It is `DataflowProgramModel.resetRunningState()`,
which calls each node's `resetRunningState()`, clears the program's tick history, and adds one new
tick for the nodes to write into.

**What it clears**

- **Hold blocks (Control node).** `ControlNodeModel.resetRunningState()` releases every held value
  and stops every wait timer: the volatile `heldValue`, `gateActive` and `waitTimerId`, plus the
  `timerRunning` flag that lives in the node's tick entries.
- **Mini-graph history.** Clears the program's `recentTicks` and every node's `tickEntries`, and
  resets each graph's ranges (`tickMax`/`tickMin` and `dsMax`/`dsMin`) through
  `BaseNodeModel.resetGraph()`.
- **Ramp (Transform node).** Ramp computes each value from the previous tick's value, so clearing
  the tick history makes it start fresh. It needs no separate handling.

After clearing, the program carries on ticking from an empty history, the same way a newly
loaded program does.

**What Reset does not touch**

- **Recorded data.** The existing Clear button still owns that. Reset during a recording leaves
  the recorded rows alone and the recording continues.
- **Timer and Generator blocks.** Both compute their output from the wall clock
  (`Date.now() % period`), so they have no state to clear. After a Reset, a Timer does not start
  over at the beginning of its "on" phase. Making it do so would need a stored start time and is
  out of scope.
- **Hardware.** Reset sends nothing special to a device. Live outputs are sent on every tick, so a
  servo or gripper moves to whatever the reset program produces on the next tick.
- **The program's blocks, connections and settings.**

**Shared documents.** The tick history is saved in the document, so in a shared document one
person's Reset clears the mini-graphs for everyone viewing it. That is intended.

**Undo.** Reset doesn't create an undo step, so a Reset clicked by mistake loses the mini-graphs
the student was looking at, with no way back. Two reasons:
- Reset isn't an edit. It clears the program's running state, not its blocks, connections,
  settings or recorded data, and undo is for the student's edits.
- The program keeps ticking after a Reset. By the time the student chose Undo, new ticks would
  have been added on top of the reset history, so undoing the Reset has no clear meaning.

Undo would fit if the program could be stopped: Reset could stop it, and undoing the Reset would
restore the stopped program's state. But the product owners want the program to run all the
time, with no way to stop it.

**The Reset button (PR 2)**

- The `reset` toolbar button (`ResetProgramButton` in `dataflow-toolbar-registration.tsx`) has the
  tooltip "Reset program" and uses Number Line's reset icon, copied into the DataFlow plugin as
  `assets/icons/reset-icon.svg` so the plugins stay independent.
- It is disabled in read-only views, matching the connect button.
- It is disabled while a finished recording is being shown (the `Done` program mode). In that mode
  the tile shows the recording, and the live program isn't ticking, so there is nothing visible to
  reset. The toolbar then sees the playback rete manager, which is read-only, so one check covers
  both cases.
- The disabled message is "Reset isn't available while a recording is shown or in a read-only
  view".
- It is enabled while recording and when ready.

## The connect button and its pane

The connect button and pane are in PR 2. They are `ConnectDeviceButton` and `ConnectPane` in
`src/plugins/dataflow/components/toolbar/dataflow-connect-button.tsx`, styled by
`dataflow-connect-pane.scss` beside it.

### Button

A tile-toolbar button named `connect` with a lightning-bolt icon (`assets/icons/connect-icon.svg`,
drawn at the toolbar's icon size). Clicking it opens and closes an attached pane, the way the Pan
button's palette works (`PanButton` in
`src/plugins/dataflow/components/toolbar/dataflow-zoom-pan-buttons.tsx`). The pane's open state is
the `connectPaneOpen` volatile on the tile content, as the Pan palette uses `panPaletteOpen`, and
it is set to false when the toolbar unmounts. The pane closes when the user:

- clicks the button again,
- clicks outside the button and the pane,
- presses Escape, or
- deselects the tile.

Focus handling follows the Pan palette's: focus moves into the pane on open and goes back to the
button when the pane closes while it holds focus. The arrow keys and Home/End move between the
pane's controls, wrapping at the ends; Tab is left to the toolbar.

The pane opens below the button and flips above it when the tile's scroll area has no room below.
It is positioned with Floating UI, measured against the tile's scroll containers, because the
toolbar renders in a portal outside them. The toolbar passes its tile element to its buttons
through `TileToolbarTileElementContext` (`src/components/toolbar/tile-toolbar-context.ts`) for this.

### Button states

Yellow means "click here, something needs your attention." `connectButtonState` in
`src/plugins/dataflow/utilities/connect-button-state.ts` derives the state, which the button
applies as the class `connect-idle`, `connect-connected` or `connect-attention`.

| State | When |
|---|---|
| Gray (`idle`) | No device connected, the program needs none, and there is no unseen error |
| Green (`connected`) | A device is connected |
| Yellow (`attention`) | The program needs a device and none is connected, **or** a connection attempt failed and the user hasn't seen the error yet |

- "The program needs a device" is the tile's `needsDevice` value described in "'Needs a device' is
  per tile and live."
- The yellow button pulses three times when it first turns yellow, to catch the eye, and then
  stays a steady yellow. A button that pulsed constantly was distracting for someone who has no
  device or doesn't want to connect one yet. The pulse replays whenever the state is newly applied,
  including each time the tile is selected and its toolbar appears, so it shows every time, not
  just the first time in a session.
- **Unseen error.** A failed attempt is unseen until the pane is open while the error is showing.
  Usually the user clicked Connect inside the pane, which stays open behind the browser's native
  device chooser, so they see the error at once and the button never turns yellow for it. If the
  pane was closed when the failure arrived (they clicked away or deselected the tile while it was
  connecting), the button is yellow until they open it. Once the error has been seen, the button
  goes back to whatever the program calls for: gray if no device is needed, yellow if one is.
  Any successful connection, from any tile, also clears the error on every open tile.
  Connection attempts can fail even when the program needs no device, and this rule covers that
  case too. The tile content holds this as `connectError` and `unseenConnectError`.
- Canceling the browser's device chooser is not a failure. It shows no message and no yellow.
- The pulse keeps the top-bar button's look: the background animates between `$star-yellow` and
  `#eee` over 1.5 s (`connect-slowpulse` in `dataflow-connect-pane.scss`, copied from the top bar's
  `slowpulse`), run three times instead of forever.
  With reduced motion the button is a steady yellow with no pulse.

**Not carried over.** The new button leaves out the top-bar button's orange states and its
"physical connection" logic:

- The `physical-connection`, `no-physical-connection` and `nodes-in-need` classes.
- The use of the `last-connect-message` localStorage key to drive the button.
- The orange `$problem-orange-light-2` pulse.

The orange states can't be reached in practice. They need `raisesWebSerialConnect`, which is true
only while a device is connected and is cleared on disconnect. The yellow pulse was driven by a
`last-connect-message` value that could be stale from an earlier visit, so a student opening a
Spiker:bit program usually saw a plain gray button.

The top-bar button keeps all of this while it remains as a fallback (see "Toolbar
configuration"). CLUE-736 removes it with the button: the `connect` handler in
`initWebSerialConnectionEvents` and the localStorage key go, and the `disconnect` handler, which
tears down a Web Serial connection when the cable is pulled, stays.

**Tooltip.** The text that used to sit beside the top-bar button moves into the new button's
tooltip (`connectButtonTooltip` in `connect-button-state.ts`):

- Gray: "Connect a device"
- Green: "Connected: Spiker:bit" (the connected device's name)
- Yellow for a needed device: "This program needs a device. Click to connect."
- Yellow for an unseen error: "Couldn't connect. Click for details."

The button is disabled in read-only views, as the top-bar button is. Its disabled message is
"Connecting a device isn't available in a read-only view".

### Pane contents

The pane is a fixed-width panel, 230 px wide. It is a group labeled "Device connection", with that
heading, a status area, and then either the device list or the connected-device actions. DataFlow
can only connect to one device at a time, so once a device is connected the other device types
disappear.

**Not connected**

- Status: "Not connected"
- One row per device type, each with a Connect button: **Arduino**, **micro:bit (radio hub)**,
  **Spiker:bit**. These are the same three choices as the top-bar menu (`kDeviceChoiceOrder` and
  `kDeviceChoiceLabels` in `device-connection.ts`).

**Connected**

- Status names the device, e.g. "Connected: Spiker:bit".
- **Reconnect** and **Disconnect** buttons.
- No device list.
- The user sees this state when reopening the pane while connected. After a successful Connect or
  Reconnect the pane closes; the green button and its tooltip show the connection.

**While connecting**

- Status: "Connecting to Spiker:bit…" (the chosen device, from `busyChoice`).
- The pane's buttons are disabled until the attempt finishes. A Spiker:bit firmware update can
  take several seconds.

**After a failed attempt**

- Status shows a short message naming the device, e.g. "Couldn't connect to Spiker:bit."
- The device list comes back so the user can try again.
- The message stays until the tile's next Connect, Reconnect or Disconnect replaces it, or until
  any successful connection, from any tile, clears every open tile's error.

**Status area.** The status area holds a status line plus one short message line without growing
the pane past its fixed width. CLUE-727 will put its specific error text and firmware update
progress here, and will add a "More details…" link that opens a larger secondary dialog. This
story builds neither the link nor the dialog. Before this story a failed connection only reached
`console.error`, so the generic "Couldn't connect to <device>." line is the first visible failure
message. CLUE-727 replaces it with specific ones.

The device name in the pane and tooltip is the device choice the user connected with ("Arduino",
"micro:bit (radio hub)" or "Spiker:bit"), not the board's detected `deviceFamily`. The choice is
kept with the app-wide connection (`lastChoice`), so every tile shows the same name and Reconnect
reuses it.

### Connect

Connect runs the existing connection flows, moved out of `dataflow-program.tsx` into
`DeviceConnection.connect(choice)`:

- **Arduino** and **micro:bit (radio hub)** use the Web Serial flow, which always shows the
  browser's chooser.
- **Spiker:bit** uses the WebUSB flow, including its firmware check and flash. Each Connect starts
  with a fresh library connection, so the chooser always shows, as it did before. A Spiker:bit
  attempt that fails after the board opened disconnects it.

Connect and Reconnect resolve `"connected"`, `"canceled"` or `"failed"`. A successful connection
runs Reset. That includes the first connection in a session, so the behavior is the same every
time.

### Reconnect

Reconnect closes the current connection and opens the same device again, skipping the device
chooser when it can:

- Web Serial: it reopens the last port (`WebSerialTransport.lastPort`, which survives `close()`).
  An unplugged Web Serial board is noticed right away and the connection is cleared, so Reconnect
  isn't offered for one.
- WebUSB: it reuses the known `SpikerbitDevice`, whose `@microbit/microbit-connection` connection
  remembers the board. An unplugged Spiker:bit isn't noticed yet (see CLUE-728), so Reconnect can
  be offered for one; reopening it then fails.

If the device can't be reopened that way, Reconnect falls back to the chooser. A successful
Reconnect runs Reset.

### Disconnect

Disconnect closes the active transport (`IDeviceTransport.close()`, which for a Spiker:bit
disconnects the library connection) and clears the active device. The pane closes, moving focus
to the button if the pane held it; reopening it shows "Not connected." Disconnect does not reset
the program.

### Tile device actions

The toolbar buttons and the top-bar menu don't call `DeviceConnection` directly. They call the tile
device actions in `src/plugins/dataflow/utilities/device-actions.ts`: `connectDeviceForTile`,
`reconnectDeviceForTile`, `disconnectDeviceForTile` and `resetProgramForTile`. These wrap
`DeviceConnection` for one tile: they reset the clicking tile's program after a successful Connect
or Reconnect, log the events, and, in PR 2, record and clear the tile's connection error.

### Logging

Each event is a `DATAFLOW_TOOL_CHANGE` event for the clicking tile (`tileId`), with these fields:

| `operation` | Other fields | Logged when |
|---|---|---|
| `connectDevice` | `targetType: "device"`, `device`: the choice id (`arduino`, `microbitHub` or `spikerbit`) | A Connect succeeds |
| `reconnectDevice` | `targetType: "device"`, `device` | A Reconnect succeeds |
| `disconnectDevice` | `targetType: "device"`, `device`: the choice that was connected | The user disconnects |
| `resetProgram` | `targetType: "program"`, `trigger`: `connect`, `reconnect` or `button` | The program is reset |

- `device` is the choice id, not its label, so rewording a label doesn't change the logged value.
- A successful Connect or Reconnect logs two events: the device event, then `resetProgram` with
  `trigger` `connect` or `reconnect`.
- A failed or canceled attempt logs nothing.
- Only a Disconnect the user chooses is logged. An unplug logs nothing, so a `connectDevice` can
  have no matching `disconnectDevice`.

CLUE-727 will add logging for every connection step, and can add operations alongside these.

The log table is also in `src/plugins/dataflow-tool/serial.md`.

## The automatic "needs a device" dialog

Before this story, `ReteManager.postSerialModal()` called the app-wide `stores.ui.alert()` once per
page load, gated by the global `serialDevice.serialModalShown` flag. That meant only the first
hardware tile a user saw ever showed it.

PR 1 keeps that alert, with the on-open rule below. PR 2 replaces it with a dialog over the tile,
`DataflowConnectTutorial` in `src/plugins/dataflow/components/ui/dataflow-connect-tutorial.tsx`,
and deletes `postSerialModal`. The dialog works like a one-time tutorial:

- **Where it shows.** The dialog shows over each editable DataFlow tile whose program needs a
  device when that program opens, as long as no device is connected. The rest of CLUE stays
  usable, including other tiles and the chat panel. The dialog blocks the tile it covers until it
  is acknowledged.
- **Only when the program opens, never after an edit.** "Opens" means the tile's program finishes
  loading and mounting: after `ReteManager.setup()` completes, `recordNeedsDeviceOnOpen` sets the
  tile's `showConnectTutorialOnOpen` volatile once. If the dialog hasn't been dismissed yet, a tile
  that opens later in the page load, such as one in a document opened afterward, shows it too.
  Editing a program so that it needs a device, by adding a hardware block or switching a sensor to
  a hardware one, doesn't show the dialog. That block already turns pink and says "connect
  device," and the toolbar button turns yellow. The old alert could pop up mid-edit, so this is a
  deliberate change.
- **Dismissing.** Clicking OK on any tile dismisses the dialog on all of them for the rest of the
  page load. Any successful connection, from any tile, dismisses it the same way. The dismissal is
  `DeviceConnection.connectTutorialDismissed`, in memory only like the old flag, so the dialog
  shows again after a reload.
- **It doesn't come back** after a disconnect within the same page load.
- **Read-only views don't show it.** They can't connect anyway.
- **What it says.** It explains that the program needs a device, and that the yellow lightning
  button in the tile's toolbar is where to connect one:

  > **This program needs a real device**
  > Connect your Arduino, micro:bit or Spiker:bit to the computer. Then click the yellow ⚡
  > Connect button in this tile's toolbar and choose your device.
  > [OK]

  When the tile's toolbar has no `connect` button (see "Toolbar configuration"), the second
  sentence points at the top-bar button instead: "Then click the ⚡ button at the top of this tile
  and choose your device." That button doesn't turn yellow on its own, so the color is left out.

  The old alert's title was "Program Requires Connection to External Device". Its text about
  "usbserial"/"usbmodem" and "the upper left" no longer applies and is gone.
- **Look.** It still looks like a dialog: a titled box with an OK button, centered on a dimming
  layer over the tile. Its maximum width is 320 px instead of stretching. On a tile narrower than
  the dialog, it shrinks to fit and scrolls if needed.
- **Clicking OK also selects the tile**, so the toolbar and its yellow button appear right away.
  If focus was in the dialog, it moves to the tile.
- **Accessibility.** The dialog has `role="dialog"`, labeled by its title and described by its
  text, and focus can reach its OK button by keyboard. It doesn't move focus when it appears,
  because several tiles may show it at once. Because it only blocks one tile, it doesn't trap focus
  across the whole application. While it shows, the tile's focus slots
  (`components/dataflow-focus-slots.ts`) report the dialog as the tile's content and hide the
  title, top bar and block palette, so Tab and Enter can't reach controls it covers. The toolbar,
  drag handle and resize handle stay reachable.

PR 2 deletes the old `serialModalShown` flag, which nothing reads once `postSerialModal` is gone.

## Toolbar configuration

The new buttons are registered with `registerTileToolbarButtons('dataflow', …)` in
`dataflow-toolbar-registration.tsx`, under the names `connect` and `reset`.

- **Default configuration.** Both are in the default DataFlow tools in `src/clue/app-config.json`,
  after `pan`, as their own group separated by `"|"`.
- **Units with their own tool list.** A unit that sets its own DataFlow tool list doesn't get the
  new buttons until its list is updated. So that such a unit still has a way to connect, the
  top-bar connect button stays as a fallback: it shows only when the configured tools have no
  `connect` button (`toolbarShowsConnect` in `connect-button-state.ts`), and the dialog's text
  points at whichever button the tile has. CLUE-736 updates those units and then removes the
  top-bar button.
  - None of the demo or QA units in `src/public/demo/units/` override the DataFlow tools.
  - As of 2026-10-20 the curriculum repo has one override, `curriculum/vibe/content.json`, on
    `main` and 12 other branches.
  - Curriculum changes are made in the curriculum repo, not in these PRs.
- **Authoring docs.** The DataFlow section of `docs/unit-configuration.md` documents `connect` and
  `reset` and lists them in the defaults.

## Where things are

Key files as built, after PR 2. Paths are under `src/plugins/dataflow/` unless they start with
`src/`.

| File | What it owns |
|---|---|
| `src/models/stores/serial.ts` | `SerialDevice`: the active transport and `deviceFamily`, the registered channel sources (`registerChannelSource`), inbound parsing (`receive`) and writes (`writeLine`). `isConnected()` is observable. Until CLUE-736 it also keeps the connect-event state the top-bar button reads. |
| `src/models/stores/web-serial-transport.ts` | `WebSerialTransport`: `open(port?)` resolves `"opened"`, `"canceled"` or `"failed"` and skips the chooser when given a port; `lastPort` survives `close()`. `initWebSerialConnectionEvents` handles the browser's `connect` and `disconnect` events; CLUE-736 drops the `connect` handler. |
| `src/models/stores/spikerbit-device.ts`, `spikerbit-connection.ts` | The Spiker:bit WebUSB transport, version check and firmware flash. |
| `model/device-connection.ts` | `DeviceConnection` and `getDeviceConnection`: app-wide connect, reconnect and disconnect, `lastChoice`, `busyChoice`, `connectTutorialDismissed` (PR 2), and the device choices. |
| `utilities/device-actions.ts` | The tile device actions: connect, reconnect, disconnect and reset for one tile, the reset after connecting, logging, and the tile's connection error (PR 2). |
| `utilities/program-needs-device.ts` | `programNeedsDevice`, the "needs a device" test. |
| `rete/rete-manager.tsx` | The autorun that keeps the tile's `needsDevice` current, and the on-open check (PR 1: the alert; PR 2: `showConnectTutorialOnOpen`). In PR 2 it also clears the tile's error when any device connects. |
| `model/dataflow-content.ts` | The tile's volatiles: `needsDevice`; in PR 2 also `showConnectTutorialOnOpen`, `connectPaneOpen`, `connectError` and `unseenConnectError`. |
| `model/dataflow-program-model.ts`, `nodes/base-node.ts`, `nodes/control-node.ts` | `resetRunningState` for the program and for each node. |
| `components/dataflow-program.tsx` | Registers the tile's channel source, and passes the top-bar menu its handlers. |
| `components/ui/dataflow-serial-connect-button.tsx` | The top-bar connect button and menu, shown as a fallback after PR 2. CLUE-736 deletes it. |
| `components/toolbar/dataflow-connect-button.tsx`, `dataflow-connect-pane.scss` | PR 2: the `connect` toolbar button and its pane. |
| `utilities/connect-button-state.ts` | PR 2: `connectButtonState`, `connectButtonTooltip` and `toolbarShowsConnect`. |
| `dataflow-toolbar-registration.tsx` | Registers the toolbar buttons; PR 2 adds `connect` and `reset` (`ResetProgramButton`). |
| `components/ui/dataflow-connect-tutorial.tsx`, `.scss` | PR 2: the tile dialog, the gate that decides when it shows, and `acknowledgeConnectTutorial`. |
| `components/dataflow-focus-slots.ts` | PR 2: the tile's keyboard focus slots, which the dialog takes over while it shows. |
| `src/components/toolbar/tile-toolbar-context.ts` | PR 2: `TileToolbarTileElementContext`, the tile element for toolbar buttons that position against it. |
| `assets/icons/connect-icon.svg`, `reset-icon.svg` | PR 2: the button icons. The unused `assets/icons/refresh/` icons are deleted in CLUE-736. |
| `src/plugins/dataflow-tool/serial.md` | How the connection, channel sources, Reconnect, the per-tile value, the toolbar, the dialog and the log events work. |

## Delivery: two PRs and a follow-up story

The work ships as two PRs, behavior first and UI second, followed by CLUE-736.

**PR 1 (#3039): connection and reset under the hood.** No new toolbar UI.

- **App-wide connection.** `DeviceConnection` takes the connection out of the tile, with connect,
  reconnect (reopening without the chooser when the browser allows) and disconnect.
- **Data to every tile.** Channel sources, so incoming data reaches every tile's channels.
- **Per-tile "needs a device."** The `needsDevice` value is per tile and stays current as the
  student edits. `serialNodesCount` and `countSerialDataNodes` are removed.
- **Reset.** The program-model Reset action, run after a successful Connect or Reconnect. PR 1 has
  no Reset button.
- **Logging** for Connect, Reconnect, Disconnect and Reset.
- **The existing top-bar connect button and its menu stay** but call the tile device actions.
  While a device is connected, the menu shows **Reconnect** and **Disconnect** instead of the three
  device choices, so reconnecting can be tried on real hardware before PR 2. The menu's buttons
  are disabled while an attempt is in progress. The existing app-wide alert stays. It checks the
  program with the same test as the per-tile value, and follows the same rule as the new dialog:
  it is checked only when a tile's program opens, never after an edit, a connection change or a
  disconnect, and still shows at most once per page load.
- **Docs.** `serial.md` describes the app-wide connection, channel sources, Reconnect, the
  per-tile value and the log events.

**PR 2 (#3040): the toolbar UI.**

- **Toolbar buttons.** The `connect` button and pane, and the `reset` button.
- **Button behavior.** The button states, the unseen-error rule and the tooltips.
- **Tile-scoped dialog.** The dialog that covers only its tile, shown when a program opens. It
  replaces the app-wide alert.
- **Top-bar fallback.** The top-bar button stays, shown only when the configured tools have no
  `connect` button, so PR 2 can be released before the curriculum changes.
- **Configuration and docs.** The default toolbar configuration, `unit-configuration.md`, and
  `serial.md`'s toolbar and dialog text.

**CLUE-736 (#3044): removing the top-bar button.** Once every unit's DataFlow tool list includes
`connect`, CLUE-736 removes:

- the top-bar button and menu (`DataflowSerialConnectButton`), its styles, its `serial.svg` icon
  and the unused `refresh/` icons;
- the connect-event state only it read: `SerialDevice`'s `lastConnectMessage`,
  `connectChangeStamp` and `raisesWebSerialConnect`, the `last-connect-message`
  localStorage key, `WebSerialTransport.raisesWebSerialConnect`, and the `connect` handler in
  `initWebSerialConnectionEvents` (the `disconnect` handler stays);
- the fallback: `toolbarShowsConnect` and the dialog's alternate text.

`docs/unit-configuration.md` then says a unit's own DataFlow tool list must include `connect`.
CLUE-736 was first part of PR 2, and was split out so PR 2 could ship before the curriculum
changes.
