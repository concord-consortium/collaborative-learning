# CLUE-727: Show and log why a Dataflow hardware connection failed — design

Brainstormed 2026-10-29. Story: CLUE-727, in epic CLUE-714. Builds on the connect pane from CLUE-716
and the Spiker:bit status work from CLUE-728.

## Why

A student connecting a Spiker:bit or Arduino to Dataflow today sees almost nothing when it goes
wrong. A failed attempt leaves one short red line in the connect pane ("Couldn't connect to
Spiker:bit." or "Another app is using the Spiker:bit."), with no next step. A firmware update, the
slowest part of connecting a Spiker:bit, looks like nothing is happening. A stalled open never ends:
the Connect buttons stay disabled until the page is reloaded. And the only record is the browser
console, which nobody sees in a classroom.

This story makes each part of a connection visible to the student, gives every failure a short
message and a way to get step-by-step help, and logs every attempt so someone supporting a classroom
remotely can see which step failed, how long each step took, and what the student did meanwhile.

## Goals

- The connect pane shows which step an attempt is on, with a progress bar during a Spiker:bit
  firmware update.
- Every failure shows a short message in the pane. Most also offer **More…**, which opens a help
  drawer with a plain headline, steps to try, and collapsed technical details.
- An open that stalls gives up after a limit, so the student can try again without reloading.
- Once the device is open, the student can Reconnect or Disconnect if a later step stalls.
- Every attempt, including a canceled one, is logged with the time of each step.
- A failure recorded while the pane is closed is announced to screen readers.
- Covers Arduino, micro:bit (radio hub) and Spiker:bit connections.

## Non-goals

- **The older connect button** at the top of the tile (used by units whose `settings.dataflow.tools`
  leaves out `connect`, in `dataflow-serial-connect-button.tsx`) gets no UI changes. It calls the
  same tile device actions, so it gets the logging and the stalled-open limit without extra work.
  That is intended.
- **Michael's corner triangle on the connect button**, and the pane's corner rounding when it flips
  above the toolbar, moved to their own story, CLUE-770.
- **No modal dialog.** A modal would block the very steps it asks the student to do.
- Help does not come back after a page reload.
- No change to what the program does with data, or to the running program when a board stops
  sending.

## Anti-goals

- **Nothing in the pane jumps.** The device rows and action buttons must not move as an attempt
  goes from idle to connecting to failed and back. The only large change is the switch from the
  device list to the connected actions, which happens once per attempt.
- **No flashing views.** Steps often go by in a fraction of a second. Fast steps may change one line
  of text; they must not make panels or rows appear and disappear.
- **No log spam.** A quick attempt writes two events. A hung tab doesn't write an event every few
  seconds.
- **No keyboard trap** in the help. The student has to get back to the pane to follow it.

## Background: what exists today

- `DeviceConnection` (`src/plugins/dataflow/model/device-connection.ts`) is the one connection shared
  by every Dataflow tile. `connect`, `reconnect` and `disconnect` return a `ConnectResult`
  (`connected | canceled | failed | inUse`). `busyChoice` is set while an attempt runs.
- Tile device actions (`src/plugins/dataflow/utilities/device-actions.ts`) wrap those, store the
  tile's `connectError` / `unseenConnectError`, and log `connectDevice` / `reconnectDevice` **after
  a success**, plus `disconnectDevice` and `resetProgram`.
- `connectDevice` logging was added by CLUE-716 and first shipped in v7.7.0 (tagged 2026-10-23), so
  only days of production logs depend on its meaning. This design changes it (see Logging).
- The connect pane (`dataflow-connect-button.tsx`, `dataflow-connect-pane.scss`) is 230px wide. Its
  status area has a status line and an optional message line, added when needed, which pushes the
  rows down.
- Spiker:bit: `SpikerbitDevice.connectAndStream` opens WebUSB, queries the firmware (1.5 s, no answer
  means it flashes), flashes the bundled hex with an optional `progress(stage, pct)` callback that
  `DeviceConnection` doesn't pass yet, re-queries (1.5 s, warns and connects anyway), then makes the
  transport active.
- Web Serial: `WebSerialTransport.open` asks for a port, opens it at 9600 baud and resolves
  `opened | canceled | failed`.
- **No step has an overall timeout.** The chooser, the Web Serial open, the WebUSB open, and the
  flash as a whole can each wait forever. Nothing waits for the first data.
- Every CLUE log event carries the browser's time (`Logger.log`, `src/lib/logger.ts`).
- Ada, the AI chat tutor, is a drawer fixed to the right edge below the app header
  (`src/components/chat-tutor/chat-sidebar.tsx`, `$chat-tutor-width: 310px`). It is opened by a
  launcher in `clue-app-header.tsx` (`ui.showChatTutor`), offered only to students in units with the
  tutor enabled. While it is open the workspace adds a right margin (`.chat-tutor-open` in
  `clue-app-content.scss`), so the drawer doesn't cover the document. It traps keyboard focus.

## The connection attempt

An attempt starts when the student clicks Connect (or Reconnect) and ends with one **outcome**.

| Step | Applies to | Ends when | Limit |
|---|---|---|---|
| `choose` | Connect, and Reconnect when the known port can't be reopened | The browser's device chooser closes | None. It waits on the student. Dismissing it ends the attempt as `canceled`. |
| `open` | All | The port or USB device is open | **20 s**, then `openTimeout` |
| `checkFirmware` | Spiker:bit | The firmware answers, or 1.5 s passes | Already bounded |
| `update` | Spiker:bit, when its firmware is old or missing | The flash finishes and the re-query is done | **10 s with no progress**, then `updateStalled` |
| `waitForData` | All | The first data arrives from the device | **5 s**, then `notResponding` (Spiker:bit) or `noData` (Web Serial devices) |

The pane has two **views**: the device list (Connect buttons) and the connected actions (Reconnect,
Disconnect, Is it alive?). Which one shows depends on where the attempt is:

- **Before the open finishes,** the device list shows, with its Connect buttons disabled.
- **Once the device is open,** the pane switches to the connected actions. For a Spiker:bit that is
  the USB open, before the firmware check, not the moment it becomes the active device. During
  `checkFirmware`, `update` and `waitForData` the actions are **disabled**, so a student can't
  interrupt a device that is still starting up. They become enabled together, including Is it
  alive? when the device supports it, when either the first data arrives or the current step hits
  its limit. Reconnect and Disconnect during a stalled update act on the device the attempt opened,
  even though it isn't the active device yet. The pane's view therefore follows the attempt's own
  state, not `isConnected`.
- **A Reconnect keeps the connected actions** (disabled) the whole way through, with the first line
  "Connecting to {label}…". It switches to the device list only if it fails before the open. That
  avoids a connected → device list → connected flash, and keeps the focused Reconnect button in
  place.
- **First data** ends the attempt as `connected`. The pane closes, as a successful connect closes it
  today, and the toolbar button turns green.
- **A stall after the open** (`updateStalled`, `notResponding`, `noData`) ends the attempt with that
  outcome, but the device stays open. The actions become enabled, the toolbar button turns yellow,
  and the pane's second line shows the stall message.
- **A failure before or during the open** (`openTimeout`, `openFailed`, `inUse`) leaves the device
  list showing with its Connect buttons enabled.
- **A failed update** (the flash throws, `updateFailed`) closes the device and returns to the device
  list.

The program is reset (`resetProgram`, trigger `connect` or `reconnect`) when the device becomes
the active one: at the open for a Web Serial device, and after the firmware check or update for a
Spiker:bit. That is the `active` step time in the log, and the 5 s wait for data starts there. A
Spiker:bit whose update fails is never made active, so its program isn't reset. This is my call;
today the reset happens on success, which is the same moment for a Web Serial device.

**A stall is not final.** The stalled step keeps running in the background:

- **If it finishes** before the student clicks Reconnect or Disconnect, the attempt carries on: a
  finished update goes on to make the device active and wait for data.
- **Late first data** counts as a successful connection. The red message clears, the toolbar button
  turns green, and an open help drawer shows its "It's working now" notice (see the drawer section).
  It is logged as `connectRecovered`. The connect pane, if open, stays open and just updates its
  lines: it closes only after a Connect or Reconnect the student clicked succeeds, and a late
  recovery has no such click. That is also the simpler code.
- **Reconnect or Disconnect during a stall abandons the stalled step.** For a stalled update, CLUE
  closes the library connection before starting anything new, so two connects never run against
  one board.

Interrupting an update this way is safe: the next connect finds the firmware old or broken and
updates it again.

### Giving up on a stalled open

As far as we know, neither Web Serial nor WebUSB lets a page close a device while its open is still
pending, so "give up" means stop waiting and recover:

1. At 20 s the attempt ends as `openTimeout`. `busyChoice` clears and the Connect buttons enable.
2. CLUE tries `close()` and `forget()` on the stuck port or device as a best effort, and logs whether
   each succeeded. Classroom logs then show whether this works in practice.
3. If the abandoned open finishes later, CLUE closes the device right away, so a device the student
   gave up on never quietly connects. Its eventual result is logged.
4. A retry while the browser still has the old open pending probably fails fast with an "invalid
   state" error, because the browser returns the same port object. That error is treated as
   `openTimeout` too, so the student keeps seeing the unplug advice.

Unplugging the device is what reliably ends a pending open, which is why the help leads with it.

## The connect pane

Layout follows option A from the brainstorm: **the status area is always exactly two lines tall.**

- **First line: the phase.** It changes only when the phase changes.
- **Second line: the detail.** It changes as often as needed: the current step, the progress bar, a
  gray hint, or a red problem with **More…**.

Every text in either line must fit on one line in the pane. Second-line texts are written to about
30 characters and **never include the device name** ("micro:bit (radio hub)" alone would use most
of the line); the first line, the help or the tooltip names the device. As a safety net the second
line doesn't wrap (nowrap with an ellipsis). The longest first lines are the radio-hub ones
("Connecting to micro:bit (radio hub)…"). If they don't fit at 230px, widening the pane is my call
over truncating them; the builder checks.

| State | View | First line | Second line |
|---|---|---|---|
| Idle, nothing connected | device list | Not connected | *Plug in a device, then click Connect.* (gray) |
| Chooser open | device list, disabled | Connecting to {label}… | *Choose it in the browser's list.* (gray) |
| Opening | device list, disabled | Connecting to {label}… | Opening the connection… |
| Checking firmware | actions, disabled | Connected: {label} | Checking its firmware… |
| Updating firmware | actions, disabled | **Updating. Keep it plugged in.** | progress bar, then "45%" |
| Waiting for data | actions, disabled | Connected: {label} | Waiting for data… |
| Receiving data | actions | Connected: {label} | *Receiving data.* (gray) |
| Failed before or at the open | device list | Not connected | red message + More… (see Failure kinds) |
| Stalled after the open | actions | Connected: {label} | red message + More… |
| Unplugged after connecting | device list | Not connected | It was unplugged. (red, no More…) |
| Lost after connecting | device list | Not connected | Connection lost. More… (red) |
| Not responding later (CLUE-728 heartbeat) | actions | Connected: {label} | Not responding. More… (red) |
| Is it alive? checking | actions | Connected: {label} | Look for the heart… |
| Is it alive? answered | actions | Connected: {label} | It answered. |
| Is it alive? no answer | actions | Connected: {label} | No answer. More… (red) |

The firmware update is the one place where the first line doesn't name the phase: the warning to
keep the board plugged in matters more. "Updating firmware. Keep it plugged in." wrapped at 230px,
so it is shortened.

The bar is a determinate progress bar fed by the library's `progress` callback. The builder checks
what the stages and percentages look like and shows overall progress if the library reports several
stages.

The Is it alive? and not-responding texts replace the longer CLUE-728 lines
("Checking the Spiker:bit… look for the heart.", "The Spiker:bit is not responding."), which don't
fit the one-line rule. The toolbar button's tooltip can keep the longer forms.

All wording here is a first draft that the student-facing review may change, but the rules
(one line, no device name on the second line, red only for problems) hold.

## Failure kinds

Each outcome other than `connected` and `canceled` is a failure kind. Each has a pane message and,
except "It was unplugged.", help content. Help steps are **tries**: each numbered step ends with the
click that shows whether it worked, and the next starts with *Still not working?*. The line above
the steps says what success looks like.

`{label}` is the device choice's label; `{board}` is "micro:bit" for the Spiker:bit and radio hub,
and "{label}" otherwise.

| Kind | When | Pane second line | Help headline |
|---|---|---|---|
| `openTimeout` | `open` passes 20 s, or a retry hits the still-pending open | Stuck while opening. More… | The browser couldn't open the {label}. |
| `openFailed` | `open` throws anything else | Couldn't open it. More… | The browser couldn't open the {label}. |
| `inUse` | The device is held by another tab or app (WebUSB `device-in-use`; the Web Serial equivalent is to be found on the bench) | In use by another tab. More… | Another tab or app is using the {label}. |
| `updateFailed` | The flash throws | The update failed. More… | The firmware update didn't finish. |
| `updateStalled` | No update progress for 10 s | Update stalled. More… | The firmware update stopped. |
| `notResponding` | Spiker:bit: no data 5 s after it became active | Not responding. More… | The {label} isn't sending anything. |
| `noData` | Arduino or radio hub: no data 5 s after the open | No data yet. More… | The {label} isn't sending anything. |
| lost | The connection dropped without an unplug | Connection lost. More… | The connection to the {label} was lost. |
| Is it alive? no answer | The identify check timed out | No answer. More… | Same as `notResponding` |

Help steps, first draft:

- **`openTimeout`, `openFailed`**
  1. Unplug the {label}, plug it back in, and click Connect.
  2. *Still not working?* Reload this page, then click Connect.
- **`inUse`**
  1. Close other tabs that are using the {board}, such as MakeCode. Then unplug the {label}, plug it
     back in, and click Connect.
  2. *Still not working?* Reload this page, then click Connect.
- **`updateFailed`, `updateStalled`**
  1. Unplug the {label}, plug it back in, and click Connect. The update starts over.
  2. *Still not working?* Reload this page, then click Connect.
- **`notResponding`** (and Is it alive? with no answer)
  1. Click Reconnect.
  2. *Still not working?* Click Is it alive? If the heart blinks on the board, another tab is reading
     it. Close that tab, then click Reconnect.
  3. *Still not working?* Unplug the {label}, plug it back in, and click Connect.
- **`noData`**
  1. Click Reconnect.
  2. *Still not working?* Unplug the {label}, plug it back in, and click Connect.
  3. *Still not working?* The {label} may not have CLUE's program on it. Ask your teacher.
- **lost**
  1. Click Connect.
  2. *Still not working?* Unplug the {label}, plug it back in, and click Connect.

The success line above the steps: "Try these in order. When it works, the connect button turns
green."

**Details** (collapsed) holds a short technical blurb a student or teacher could search for: the
step, the error's name or code and message, and the time it had taken, e.g. "Step: open. USB open
didn't finish within 20 s." or "Step: open. device-in-use: Unable to claim interface."

Canceling the device chooser is not a failure: no message, no help.

## The connection help drawer

**More…** opens a **Connection help** drawer in the same right-edge slot as Ada's drawer.

- **Placement.** It is fixed to the right edge below the app header, the same width as Ada's drawer.
  The workspace narrows to make room, using the same rule that makes room for Ada, so nothing is
  covered. The tile may shift left once when the drawer opens; after that nothing moves.
- **Who gets it.** Everyone who can use the connect pane, not only students with Ada. This means the
  drawer slot needs a small host that can hold either panel. Today the slot belongs to Ada's code
  in `clue-app-header.tsx`.
- **Title:** "{label} connection", e.g. "Spiker:bit connection", with a ✕.
- **Contents, top to bottom:**
  1. the pane's two status lines, live, so the student can see whether their latest try worked
     without reopening the pane;
  2. the plain headline;
  3. the success line and the numbered tries;
  4. **Details**, collapsed. Expanding it makes the drawer's content longer; nothing above it moves.
- **It never changes or closes on its own.** The student may be partway through reading the steps,
  so the headline, steps and Details stay exactly as they were opened. Only the live status lines
  at the top follow what's happening. It stays open while the student closes the pane, clicks
  elsewhere, unplugs the board or switches browser tabs, and it closes only when the student clicks
  ✕ or a notice's button. It never opens by itself.
- **When the situation changes, a notice appears** between the live status and the steps:
  - **It started working.** This covers any successful connection, including a stall that resolves
    by itself. A green notice reads "**It's working now.** The {label} is sending data." with a
    **Close help** button. The steps below fade but stay in place, so nothing jumps.
  - **A different failure kind** (e.g. a Reconnect that now fails at the open). An orange notice
    reads "**Something else went wrong:** {new help headline, lowercased}" with **Show steps for
    this**, which replaces the steps with the new kind's and removes the notice. The steps being
    read stay until then.
  - **The same failure kind again** shows no notice; the steps still apply.
  - A later change replaces the notice: for example, working again after a different failure shows
    the green notice.
  - Each notice is announced politely to screen readers.
- **With Ada available,** the drawer shows tabs, Ada and Connection help. This applies whenever the
  student has Ada, so opening the help still lets them reach Ada.
  - More… selects the help tab, and Ada's conversation is kept.
  - Closing the help leaves Ada showing if Ada was open, and otherwise closes the drawer.
  - Ada's "AIdeas" launcher, which floats at the viewport's lower-right, is hidden whenever the
    drawer is open, whichever tab is showing, so it never sits on top of the drawer.
  - Ada's focus trap applies only while the Ada tab is selected.
  - These changes to Ada were agreed during the design.
- **Not persisted.** It is UI state only, so a reload starts with it closed.
- **Every route that shows a Dataflow tile toolbar,** including the standalone doc-editor (`/editor/`),
  which has no CLUE app header and is where Cypress tests run, needs a place to show the drawer.

## Toolbar button

- **Green** only once the first data arrives.
- **Yellow** (attention) for a stall after the open, in addition to today's cases: an unseen error,
  a program that needs a device, and not responding.
- **Tooltips:**
  - while connecting: "Connecting to {label}…";
  - after a stall: "{label}: no data yet. Click for details." or the existing not-responding form;
  - otherwise unchanged.

## Accessibility

- **The pane's status area announces only phase changes and problems.** It is a polite live region
  today, so every step change would be read aloud, which is noisy when steps go by fast. Changes to
  the first line are announced, and so are red messages. Step text and progress percentages are not.
- **A failure recorded while the pane is closed** (`unseenConnectError`) is announced politely with
  CLUE's `useAnnounce` at the moment it is recorded. The announcement is the help headline, e.g. "The
  browser couldn't open the Spiker:bit." This is Doug's review note from CLUE-716.
- **The progress bar** is a `progressbar` with its value, not announced per change.
- **More…** joins the pane's arrow-key navigation with the other controls.
- **The drawer:**
  - It is a labeled complementary region, like Ada's.
  - Opening it moves focus to its heading.
  - ✕, or Escape while focus is in the drawer, closes it and returns focus to More… if it is still
    showing, otherwise to the connect button.
  - It does **not** trap focus.
  - Details is a disclosure (`aria-expanded`).

## Logging

All events use `LogEventName.DATAFLOW_TOOL_CHANGE` through `logTileChangeEvent`, from the tile that
started the attempt, with `targetType: "device"`. Every attempt has an `attemptId` that ties its
events together.

**Step times** are milliseconds from the click, so they read forward from the start event. They are
recorded only for steps that happened:

| Key | Recorded when |
|---|---|
| `chooserClosed` | The device chooser closed |
| `opened` | The open finished |
| `firmwareChecked` | The firmware check finished |
| `updateStarted` | The firmware update started |
| `updateFinished` | The firmware update finished |
| `active` | The device became the active device (the program reset) |
| `firstData` | The first data arrived |

| `operation` | Logged when | Fields beyond `device` and `attemptId` |
|---|---|---|
| `connectDevice` | **Connect is clicked** (changed: it used to mean a success) | — |
| `reconnectDevice` | **Reconnect is clicked** (changed in the same way) | — |
| `connectProgress` | The attempt is still running 5, 10, 20, 40, 80… s after the click (gaps doubling) | `trigger`, `elapsedMs`, current `step`, `steps` so far, `updatePercent` during an update |
| `connectResult` | The attempt ends, including `canceled` | `trigger`, `outcome`, `elapsedMs`, `steps`, and for a failure `failedStep` and `error` (`name`, `code`, `message`); for a Spiker:bit, the firmware found and whether it was updated |
| `connectRecovered` | An attempt that ended in a stall (`updateStalled`, `noData`, `notResponding`) gets its first data after all | `elapsedMs`, `steps` |
| `abandonedOpen` | An open given up on settles later, or the best-effort `close()` / `forget()` finish | what each one did |
| `deviceLost` | An unplug or lost connection is detected (not a Disconnect the user chose) | `reason`: `unplugged` or `lost` |
| `showConnectHelp` / `hideConnectHelp` | The help drawer opens or closes | failure `kind`; for hide, `trigger`: `close` (✕) or `closeHelp` (the notice's button) |
| `connectHelpNotice` | A notice appears in the help drawer, or the student uses its button | `notice`: `working` or `differentProblem`, the new `kind` for the latter, and `action`: `shown` or `clicked` |
| `disconnectDevice`, `resetProgram` | Unchanged | — |

How the log reads:

- **A quick attempt** writes `connectDevice` and `connectResult`. Anything the student did in
  between sits between those two in time order.
- **A slow attempt** adds a few `connectProgress` events.
- **A reload or a closed tab** in the middle of an attempt leaves a start, possibly some
  `connectProgress` events, and no result. The last checkpoint shows the step it was on.

`deviceLost` belongs to the tile that made the connection. If that tile is gone, the builder picks a
reasonable owner.

The log table in `src/plugins/dataflow/docs/serial.md` ("Connecting a device") is updated to match,
including the new meaning of `connectDevice` and `reconnectDevice`.

## To verify on hardware

These are unknowns that the design works around. Each result goes into `serial.md` and, where it
changes behavior, the code.

1. Whether `close()` or `forget()` ends a pending open, for Web Serial and for WebUSB.
2. Whether a retry on the same device during a pending open fails fast, and with what error.
3. What Web Serial reports when another tab or app holds the port, to map it to `inUse`.
4. What the library's flash `progress` stages and percentages look like, and how often they arrive,
   since the 10 s no-progress limit depends on them.
5. Whether the Arduino sketch and the radio hub send data on their own within 5 s of the open (an
   Arduino resets when its port opens).
6. How to produce a stalled open at all. If it can't be done on demand, the tests use a fake
   transport.
7. Whether closing the library connection during a flash stops the flash cleanly, and whether the
   next connect's update then succeeds.

## Testing

- **Jest:**
  - `DeviceConnection` with fake transports and fake timers: each limit and outcome, the abandoned
    open closing a late success, the retry during a pending open, and actions enabling at a stall.
  - Device actions: the order and contents of the log events, the doubling checkpoint schedule, and a
    canceled attempt.
  - The pane: the status area keeps the same height in every state, and the text for each state and
    failure kind.
  - The drawer: opening from More…, the live status, the two notices and their buttons, the steps
    staying put when the situation changes, tabs with Ada, Ada's launcher and focus trap, and focus
    return.
  - The unseen-error announcement.
- **Cypress:** the drawer and the pane on `/editor/` with a simulated failure, kept to as few `it`
  blocks as possible. A new spec has to be added to the Manual Regression workflow's `test` list.

## My calls (not discussed; easy to change)

- The limits: 20 s for the open (agreed), 5 s for the first data, and 10 s with no update progress.
- The program resets when the device becomes active, not when the pane switches views.
- A Reconnect keeps the connected actions view throughout.
- A stall is not final: a stalled step that finishes later carries the attempt on, and late first
  data counts as a successful connection.
- The toolbar button turns green only on the first data, and tooltip wording during an attempt.
- Widening the pane rather than truncating if the radio-hub first lines don't fit.
- All message and help wording.
- The help-drawer log events, and the `abandonedOpen` and `connectRecovered` events.
- The notice wording, and fading the old steps under the "It's working now" notice.
- "It was unplugged." has no More…; "Connection lost." does.
- The announcement text for an unseen error is the help headline.

## Left to the builder

- How `DeviceConnection` exposes the attempt's step, progress and stall state to the pane and
  drawer, and when `connectDeviceForTile` resolves.
- The drawer host's structure and how it shares the slot and the workspace margin with Ada.
- How the pane's live region is split so only phase changes and problems are announced.
- Event field names beyond those listed, and the exact `attemptId` format.
