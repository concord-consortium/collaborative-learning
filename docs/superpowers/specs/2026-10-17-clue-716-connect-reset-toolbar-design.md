# CLUE-716: Connect and Reset in the DataFlow Toolbar — Design

**Status:** draft, awaiting review
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
- The automatic connection dialog is an application-wide alert. It is stretched very wide, it
  covers the chat panel, and it gets in the way of the rest of CLUE every time a hardware program
  opens. Its real job is to make it obvious that the program can't work as configured until a
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
- Removing the connect button and its "connect a device" / "click to finish connecting" text from
  the tile's top bar.
- Logging Reset, Connect, Reconnect and Disconnect.
- One app-wide connection that feeds incoming data to every DataFlow tile, not only the one that
  connected (see "One connection, many tiles").
- A per-tile, live "needs a device" check that drives the pulse and the dialog.

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
- **Connection status when the tile isn't selected.** The tile toolbar only appears while the tile
  is selected, so after this change an unselected tile shows no connection status. This is a known
  limitation, accepted because it is what the project lead asked for.

## One connection, many tiles

DataFlow connects to one device at a time. That connection belongs to the whole app, not to a
tile.

**What happens today.** `SerialDevice` (`src/models/stores/serial.ts`) is a single global store,
but each tile gets its own copy of the channels: `setChannels` in `dataflow-content.ts` wraps them
in `observable()`, which copies the channel objects. At connect time the store records only the
connecting tile's channels (`setActiveDevice(..., this.props.tileContent.channels)`, and the same
in `SpikerbitDevice.connectAndStream`). So incoming data reaches only that tile, while
`updateChannels` marks every tile's serial channels as connected. The other tiles look connected
but get no data. The `SpikerbitDevice` instance also lives on the connecting tile's
`DataflowProgram` component.

**What this story does**

- **The connection moves out of the tile component** into something app-wide, for example
  alongside `SerialDevice` in the stores. The transport and the `SpikerbitDevice` live there. A
  tile unmounting no longer affects the connection.
- **Incoming data reaches every live DataFlow tile's channels**, not just the connecting tile's.
  How tiles register and unregister their channels is up to the builder. A tile that mounts while
  a device is already connected starts receiving data without reconnecting.
- **Every tile's button shows the same connection.** Green in one tile means green in all of them.
- **Reconnect and Disconnect act on the one connection**, whichever tile's pane they are clicked
  in.
- **The Reset that follows a successful Connect or Reconnect applies only to the tile where the
  user clicked.** Other tiles keep running.
- **An error belongs to the tile where the attempt was made,** until any connection succeeds.
  Only that tile's button turns yellow for an unseen error, and only that tile's pane shows the
  message. Any successful connection, from any tile, clears every open tile's error, so a later
  disconnect can't bring it back.
- **Outputs.** Every tile's live output blocks already write to the one device on each tick. This
  story doesn't change that, so two tiles driving the same output will still fight over it.

## "Needs a device" is per tile and live

Today, "the program needs a device" is the global `serialDevice.serialNodesCount`, set by
`ReteManager.countSerialDataNodes()`. It has two problems:

- **It's one number for the whole app.** Whichever tile counted last wins, so a tile without
  hardware that loads after a hardware tile turns off the hardware tile's warning.
- **It doesn't update when a block's settings change.** It is recounted only when the channel list
  changes or a block or connection is added or removed. Switching a Sensor block's dropdown to EMG
  doesn't recount it.

This story replaces it with a per-tile value that updates as the student edits, including when a
Sensor block's sensor changes or a Live Output block is wired or its output changes. It uses the same test as today: a `SensorNode` or
`LiveOutputNode` whose `requiresSerial()` is true. That value drives the tile's button pulse and
whether the tile's automatic dialog shows. Remove the global `serialNodesCount` once nothing reads
it.

## Reset

Reset restarts the program's running state for the tile it's clicked in. It does not change the program itself or anything
that was recorded.

**What it clears**

- **Hold blocks (Control node).** Releases every held value and stops every wait timer: the
  volatile `heldValue`, `gateActive` and `waitTimerId`, plus the `timerRunning` flag that lives in
  the node's tick entries.
- **Mini-graph history.** Clears the program's `recentTicks` and every node's `tickEntries`, and
  resets each graph's zoom range (`tickMax`/`tickMin`). `BaseNodeModel.resetGraph()` and
  `DataflowProgramModel.clearRecentTicks()` already do most of this.
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

**Availability**

- Disabled in read-only views. That matches today's connect button.
- *My call:* disabled while a finished recording is being shown (the `Done` program mode). In that
  mode the tile shows the recording, and the live program isn't ticking, so there is nothing
  visible to reset.
- Enabled while recording and when ready.

## The connect button and its pane

### Button

A new tile-toolbar button with the existing lightning-bolt icon
(`assets/icons/serialconnection/serial.svg`). Clicking it opens and closes an attached pane, the
way the Pan button's palette works (`PanButton` in
`src/plugins/dataflow/components/toolbar/dataflow-zoom-pan-buttons.tsx`). The pane closes when the
user:

- clicks the button again,
- clicks outside the button and the pane,
- presses Escape, or
- deselects the tile.

Focus handling follows the Pan palette's: focus moves into the pane on open and goes back to the
button when the pane closes while it holds focus.

### Button states

Yellow means "click here, something needs your attention."

| State | When |
|---|---|
| Gray | No device connected, the program needs none, and there is no unseen error |
| Green | A device is connected |
| Yellow | The program needs a device and none is connected, **or** a connection attempt failed and the user hasn't seen the error yet |

- "The program needs a device" is the per-tile value described in "'Needs a device' is per tile
  and live."
- The yellow button pulses three times when it first turns yellow, to catch the eye, and then
  stays a steady yellow. A button that pulsed constantly was distracting for someone who has no
  device or doesn't want to connect one yet. The pulse replays whenever the state is newly applied,
  including each time the tile is selected and its toolbar appears, so it shows every time, not
  just the first time in a session.
- **Unseen error.** A failed attempt is unseen until the pane is open while the error is showing.
  Usually the user clicked Connect inside the pane, which stays open behind the browser's native
  device chooser, so they see the error at once and the button never pulses for it. If the pane
  was closed when the failure arrived (they clicked away or deselected the tile while it was
  connecting), the button pulses until they open it. Once the error has been seen, the button goes
  back to whatever the program calls for: gray if no device is needed, still pulsing if one is.
  Any successful connection, from any tile, also clears the error on every open tile.
  Connection attempts can fail even when the program needs no device, and this rule covers that
  case too.
- Canceling the browser's device chooser is not a failure. It shows no message and no pulse.
- The pulse keeps today's look: the background animates between `$star-yellow` and `#eee` over
  1.5 s (`slowpulse` in `dataflow-program-topbar.scss`), now run three times instead of forever.
  With reduced motion the button is a steady yellow with no pulse.

**Removed.** The orange states and the "physical connection" logic go away:

- The `physical-connection`, `no-physical-connection` and `nodes-in-need` classes.
- The use of the `last-connect-message` localStorage key to drive the button.
- The orange `$problem-orange-light-2` pulse.

The orange states can't be reached in practice. They need `raisesWebSerialConnect`, which is true
only while a device is connected and is cleared on disconnect. The yellow pulse was driven by a
`last-connect-message` value that could be stale from an earlier visit, so a student opening a
Spiker:bit program usually saw a plain gray button.

`initWebSerialConnectionEvents` still needs its `disconnect` handler, which tears down a Web Serial
connection when the cable is pulled. Whether to keep its `connect` handler and the localStorage key
is up to the builder, once nothing reads them.

**Tooltip.** The text that used to sit beside the button moves into its tooltip. *My call on
wording*, which the builder can adjust:

- Gray: "Connect a device"
- Green: "Connected: Spiker:bit" (the connected device's name)
- Pulsing for a needed device: "This program needs a device. Click to connect."
- Pulsing for an unseen error: "Couldn't connect. Click for details."

The button is disabled in read-only views, as it is today.

### Pane contents

The pane is a fixed-width panel, about 220–240 px wide. It has a heading, a status area, and then
either the device list or the connected-device actions. DataFlow can only connect to one device at
a time, so once a device is connected the other device types disappear.

**Not connected**

- Status: "Not connected"
- One row per device type, each with a Connect button: **Arduino**, **micro:bit (radio hub)**,
  **Spiker:bit**. These are the same three choices as today's menu.

**Connected**

- Status names the device, e.g. "Connected: Spiker:bit".
- **Reconnect** and **Disconnect** buttons.
- No device list.
- The user sees this state when reopening the pane while connected. After a successful Connect or
  Reconnect the pane closes; the green button and its tooltip show the connection.

**While connecting** (*my call*)

- Status: "Connecting to Spiker:bit…" (the chosen device).
- The pane's buttons are disabled until the attempt finishes. A Spiker:bit firmware update can
  take several seconds.

**After a failed attempt**

- Status shows a short message naming the device, e.g. "Couldn't connect to Spiker:bit."
- The device list comes back so the user can try again.
- The message stays until the tile's next Connect, Reconnect or Disconnect replaces it, or until
  any successful connection, from any tile, clears every open tile's error.

**Status area.** The status area must hold a status line plus one short message line without
growing the pane past its fixed width. CLUE-727 will put its specific error text and firmware
update progress here, and will add a "More details…" link that opens a larger secondary dialog.
This story builds neither the link nor the dialog. Today a failed connection only reaches
`console.error`, so this story's generic "Couldn't connect to <device>." line is the first visible
failure message. CLUE-727 replaces it with specific ones.

The device name in the pane and tooltip is the menu choice the user connected with ("Arduino",
"micro:bit (radio hub)" or "Spiker:bit"), not the board's detected `deviceFamily`. The choice is
kept with the app-wide connection, so every tile shows the same name and Reconnect reuses it.

### Connect

Connect runs today's flows, moved out of `dataflow-program.tsx` into the app-wide connection:

- **Arduino** and **micro:bit (radio hub)** use the Web Serial flow, which always shows the
  browser's chooser.
- **Spiker:bit** uses the WebUSB flow, including its firmware check and flash. Each Connect starts
  with a fresh library connection, so the chooser always shows, as it does today. A Spiker:bit
  attempt that fails after the board opened disconnects it.

A successful connection runs Reset. That includes the first connection in a session, so the
behavior is the same every time.

### Reconnect

Reconnect closes the current connection and opens the same device again, skipping the device
chooser when it can:

- Web Serial: it reopens the last port. An unplugged Web Serial board is noticed right away and
  the connection is cleared, so Reconnect isn't offered for one.
- WebUSB: it reuses the known board through `@microbit/microbit-connection`, which remembers it.
  An unplugged Spiker:bit isn't noticed yet (see CLUE-728), so Reconnect can be offered for one;
  reopening it then fails.

If the device can't be reopened that way, Reconnect falls back to the chooser. A successful
Reconnect runs Reset.

### Disconnect

Disconnect closes the active transport (`IDeviceTransport.close()`, which for a Spiker:bit
disconnects the library connection) and clears the active device. The pane closes and focus returns to the button; reopening it shows
"Not connected." Disconnect does not reset the
program.

### Logging

Log an event for each of these:

- **Reset**
- **a successful Connect**, with the device type
- **Reconnect**
- **Disconnect**

The builder picks the event name and shape. `DATAFLOW_TOOL_CHANGE` with an operation field, as
used in `rete-manager.tsx`, is one option. CLUE-727 will add logging for every connection step, so
keep these events easy to extend.

## The automatic "needs a device" dialog

Today `ReteManager.postSerialModal()` calls the app-wide `stores.ui.alert()` once per page load,
gated by the global `serialDevice.serialModalShown` flag. That means only the first hardware tile
a user sees ever shows it.

The new dialog works like a one-time tutorial:

- **Where it shows.** The dialog shows over each editable DataFlow tile whose program needs a
  device when that program opens, as long as no device is connected. The rest of CLUE stays
  usable, including other tiles and the chat panel. The dialog blocks the tile it covers until it
  is acknowledged.
- **Only when the program opens, never after an edit.** "Opens" means the tile's program finishes
  loading and mounting. If the dialog hasn't been dismissed yet, a tile that opens later in the
  page load, such as one in a document opened afterward, shows it too. Editing a program so that
  it needs a device, by adding a hardware block or switching a sensor to a hardware one, doesn't
  show the dialog. That block already turns pink and says "connect device," and the toolbar button
  starts pulsing. Today the dialog can pop up mid-edit, so this is a deliberate change.
- **Dismissing.** Clicking OK on any tile dismisses the dialog on all of them for the rest of the
  page load. The dismissal lives in memory only, like today's flag, so it shows again after a
  reload.
- **It doesn't come back** after a disconnect within the same page load.
- **Read-only views don't show it.** They can't connect anyway.
- **What it says.** It explains that the program needs a device, and that the yellow lightning
  button in the tile's toolbar is where to connect one. *My draft*, which the builder can refine:

  > **This program needs a real device**
  > Connect your Arduino, micro:bit or Spiker:bit to the computer. Then click the yellow ⚡
  > Connect button in this tile's toolbar and choose your device.
  > [OK]

  The title is "Program Requires Connection to External Device" today. Drop the old text about
  "usbserial"/"usbmodem" and "the upper left," which no longer apply.
- **Look.** It still looks like a dialog: a titled box with an OK button, centered on a dimming
  layer over the tile. It has a sensible fixed maximum width instead of stretching. On a tile
  narrower than the dialog, it shrinks to fit.
- *My call:* clicking OK also selects the tile, so the toolbar and its pulsing button appear right
  away.
- **Accessibility.** The dialog is labeled as a dialog, and focus can reach its OK button by
  keyboard. Because it only blocks one tile, it must not trap focus across the whole application.

Remove the `stores.ui.alert()` call. The global flag can be repurposed to hold the in-memory
dismissal.

## Toolbar configuration

The new buttons are registered with `registerTileToolbarButtons('dataflow', …)` in
`dataflow-toolbar-registration.tsx`. *My call on names:* `connect` and `reset`.

- **Default configuration.** Add both to the default DataFlow tools in `src/clue/app-config.json`,
  after `pan`, as their own group separated by `"|"`.
- **Units with their own tool list.** A unit that sets its own DataFlow tool list won't get the new
  buttons until its list is updated. Such a unit would have no way to connect a device at all, so
  check the curriculum units for DataFlow tool overrides and list any that need updating:
  - None of the demo or QA units in `src/public/demo/units/` override the DataFlow tools.
  - An older local copy of the curriculum repo has one override, `curriculum/vibe/content.json`.
  - Curriculum changes are made in the curriculum repo, not in these PRs. The PR description lists
    the units that need the new tool names.
- **Authoring docs.** Document the two new tool names in the DataFlow section of
  `docs/unit-configuration.md`.

## Where things are now

- **Current connect button and menu:**
  `src/plugins/dataflow/components/ui/dataflow-serial-connect-button.tsx`, rendered by
  `dataflow-program-topbar.tsx`. Its styles are in `dataflow-program-topbar.scss`, including the
  `.icon-serial` states, `.serial-message`, and some leftover `.refresh` rules for an icon that no
  longer exists.
- **Connect logic:** `serialDeviceRefresh` and `connectSpikerbit` in
  `src/plugins/dataflow/components/dataflow-program.tsx`, with
  `src/models/stores/web-serial-transport.ts`, `spikerbit-device.ts` and `spikerbit-connection.ts`.
  The connection store is `src/models/stores/serial.ts` (`SerialDevice`), which is global, not
  per tile, but records only one tile's channels (see "One connection, many tiles").
- **Toolbar buttons** render outside the program component. They reach the tile through
  `TileModelContext` and the rete manager through `DataflowReteManagerContext`. The connect and
  reset logic must be reachable from there. How is up to the builder, for example moving it out of
  `dataflow-program.tsx` into something the toolbar can call.
- **Pane open state.** The Pan palette keeps its open state as a volatile on the tile content
  (`panPaletteOpen`) and closes it when the toolbar unmounts. Use the same pattern for the pane.
- **Reset icon.** `src/plugins/dataflow/assets/icons/refresh/` has `refresh.svg`,
  `refresh-hover.svg` and `refresh-active.svg`, which are currently unused.
- **Automatic dialog:** `postSerialModal()` and `countSerialDataNodes()` in
  `src/plugins/dataflow/rete/rete-manager.tsx`.
- **Docs that describe the old behavior:** `src/plugins/dataflow-tool/serial.md` mentions
  `serialModalShown` and the connect button. Update it.

## Testing

What the tests should cover:

- **Reset**
  - releases held values and stops wait timers on Control nodes
  - empties the tick history and the graph zoom ranges
  - leaves the recorded data set alone
  - is disabled in `Done` mode and in read-only views
- **Connect and Reconnect.** A successful Connect or Reconnect runs Reset. A failed or canceled
  attempt doesn't.
- **Disconnect** closes the pane, so reopening it shows "Not connected", and doesn't reset.
- **Pane closing.** A successful Connect, Reconnect or Disconnect closes the pane and returns
  focus to the button; a failed or canceled attempt leaves it open.
- **Button state.** Gray, green and pulsing for each combination of "needs a device," "connected,"
  and "unseen error," including a failure while the program needs no device, and an error that
  becomes seen. A pure function deriving the state from these inputs makes this easy to unit-test.
- **Pane contents** in the not-connected, connected and after-failure states.
- **Many tiles**
  - incoming data reaches the channels of every live tile, including a tile that mounts after the
    connection was made
  - the connect-triggered Reset touches only the clicking tile
  - an unseen error pulses only the tile where the attempt was made
- **Needs a device**
  - is computed per tile, so a tile without hardware doesn't clear another tile's pulse
  - updates when a Sensor block's sensor changes, or a Live Output block is wired or its output
    changes
- **Automatic dialog**
  - shows on every editable tile that needs a device when it opens
  - doesn't show when an edit makes a program need a device
  - one OK dismisses it on all of them
  - doesn't show in read-only views
  - doesn't come back after a disconnect
- **Existing tests to update.** `cypress/e2e/functional/tile_tests/dataflow_tile_keyboard_spec.js`
  looks for the top-bar button's `serial-icon` test id. `dataflow-program-topbar.test.tsx` covers
  the top bar the button is leaving.

## Delivery: two PRs

The whole story touches about 40 files, so it ships as two PRs. Behavior comes first and UI
second.

**PR 1: connection and reset under the hood.** No new toolbar UI.

- **App-wide connection manager.** The connection moves out of the tile into an app-wide manager
  with connect, reconnect (reopening without the chooser when the browser allows) and disconnect.
- **Data to every tile.** Incoming data reaches every tile's channels.
- **Per-tile "needs a device."** The check is per tile and stays current as the student edits.
- **Reset.** The program-model Reset action, run after a successful Connect or Reconnect. PR 1 has
  no Reset button.
- **Logging** for Connect, Reconnect, Disconnect and Reset.
- **The existing top-bar connect button and its menu stay** but call the new manager. While a
  device is connected, the menu shows **Reconnect** and **Disconnect** instead of the three device
  choices, so reconnecting can be tried on real hardware before PR 2. The existing app-wide alert
  stays. It checks the program with the same test as the per-tile value, and follows the same rule
  as the new dialog: it is
  checked only when a tile's program opens, never after an edit, a connection change or a
  disconnect, and still shows at most once per page load.
- **Docs.** `serial.md` describes the app-wide connection, channel sources, Reconnect and the
  per-tile value.

**PR 2: the toolbar UI.**

- **Toolbar buttons.** The connect button and pane, and the Reset button.
- **Button behavior.** The new button states, the unseen-error rule and the tooltips.
- **Tile-scoped dialog.** The dialog that covers only its tile, shown when a program opens.
- **Removals.** The top-bar button, its menu and their styles go.
- **Configuration, docs and tests.** The default toolbar configuration, `unit-configuration.md`,
  `serial.md`'s toolbar and dialog text, and the Cypress update.

## Left to the builder

- Component structure, and how the toolbar reaches the connect and reset logic.
- Exact pane styling within the fixed width, and the wording of status and tooltip text.
- Log event names and payloads.
- Whether to remove the now-unused `connect` event handler and the `last-connect-message` key.
- How Reconnect finds the previously permitted device in each transport.
