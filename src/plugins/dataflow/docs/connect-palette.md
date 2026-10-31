# The connect palette

The connect button in the DataFlow tile toolbar opens the connect palette, where a student connects
a device and sees how the connection is going. It is `ConnectPalette` in
`components/toolbar/dataflow-connect-button.tsx`, styled in `dataflow-connect-palette.scss`, with
its status text from `connectPaletteStatus` in `utilities/connect-palette-status.ts`. How a
connection attempt works, and what it logs, is in
[The connection attempt](serial.md#the-connection-attempt).

The palette has a "Device connection" heading, a status area, and then one of two views
(`paletteView`): the device list, with a Connect button per device, or the connected actions:
Reconnect, Disconnect, and Is it alive? for a device that supports it. It is 270px wide.

## The status area

The status area is always exactly two lines tall, so the rows below it never move.

- **Line 1 is the phase:** "Not connected", "Connecting to {device}…" or "Connected: {device}". It
  changes only when the phase does. The one exception is a firmware update, where line 1 is
  "Updating. Keep it plugged in.": the warning matters more than the phase, and "Updating
  firmware. Keep it plugged in." didn't fit on one line.
- **Line 2 is the detail:** the current step, the progress bar and percentage during an update, a
  gray hint, or a red problem. Red is only for problems.

Every text fits on one line. Line 2's texts are at most 37 characters and never name the device,
since "micro:bit (radio hub)" alone would fill most of the line; line 1, the connect button's
tooltip and the failure announcement name it instead. As a safety net, both lines are `nowrap`
with an ellipsis.

## Nothing jumps

- The device rows and the actions don't move as an attempt goes from idle to connecting to failed
  and back. The only large change is the switch from the device list to the connected actions,
  once per attempt.
- Steps often go by in a fraction of a second, so a step changes only line 2's text. It never makes
  rows or panels appear and disappear.
- A Reconnect keeps the connected actions while it runs, disabled, with line 1 following the steps
  as in a Connect. It switches to the device list for any outcome but a connection or a stall. That
  avoids a connected → device list → connected flash, and keeps the Reconnect button the student
  just used in place.

## When it closes

A Connect, Reconnect or Disconnect the student clicked closes the palette when it succeeds, and
moves focus to the connect button if the palette had it. While the Connection help shows, the
palette stays open instead: the help's notices report the result, and the student may still be
following its steps. Otherwise the palette stays open: a stall that recovers on its own, with late
first data or a finished update, only updates its lines. Escape closes the palette, moves focus to
the connect button, and leaves the help as it is.

## Connection help

A problem on line 2 has a Help button after its text. Help is an action, not a status: it opens
the Connection help (`ConnectionHelp` in `components/toolbar/connection-help.tsx`) as a second
column on the right of the palette, which grows from 270px to about 570px. The palette's own
column keeps its place and width. While the help for that problem is showing, Help is disabled,
with the title "This problem's help is showing."

The column holds, top to bottom:

- A header, "Connection help", with a ✕ ("Close connection help") that closes it.
- A notice, when the problem has changed since the help opened (below). It is in a live region.
- The headline, which names the device ("The browser couldn't open the Arduino.").
- "Try these in order. When it works, the connect button turns green.", then the numbered tries.
  A later try can be marked "Still not working?"
- Details, a toggle that shows the error behind the problem, such as its error name.

The steps stay as they were opened, so they don't change under the student. The notice says what
has changed, following `currentProblem` on the connection: "It's working now" (with Close help),
"The update is going again", "Something else went wrong" (with Show steps for this, which replaces
the steps with that problem's), "The device was unplugged", or "The device isn't connected".
Opening Help for a different problem, or for the same problem on a different device, replaces the
help. Help for the same problem and device is disabled instead.

**When it opens and closes.** The help's state is on the `DeviceConnection`, not in the palette,
so it stays through the palette closing and opening, and through the tile it was opened from being
deleted. It closes only when the student clicks ✕ or a notice's Close help, which log
`hideConnectHelp`; closing the palette logs nothing.

**Focus.** Opening the help from Help moves focus to its title. A palette that opens with the help
already showing focuses its first control, as it always does. Closing the help moves focus to the
palette's first control, which is Help when a problem shows. Showing steps for a notice moves
focus to the title above the new steps. There is no focus trap: Tab leaves the palette as it does
without help.

**Keyboard.** The help's controls are `div role="button"` like the palette's, and come after the
palette's own in the arrow, Home and End order. The steps scroll on their own, so a control that
is out of view is scrolled into view when the arrow keys reach it.

**Placement.** The palette opens below the connect button and flips above it when there is no room
below; then its bottom edge stays at the button and it grows upward. Its height is capped at the
room on that side of the button (never less than 200px). Only the help's body scrolls, so the
header and any notice stay in view.

**Screen readers.** The help is part of the palette, so its notices are announced only while the
palette is open. A notice that appeared while the palette was closed is already in place when the
palette opens, so it is not announced then.

## The connect button

The button turns green only once data arrives. It turns yellow for a stall after the open, as well
as for an unseen failure, a program that needs a device, and a device that stops responding. While
an attempt runs, its tooltip names the device being connected. See `connect-button-state.ts`.

## Screen readers

- The status area's live region holds line 1, and line 2 only when it is a problem. So phase
  changes and problems are announced, but steps and percentages are not. The progress bar is a
  `progressbar` with its value.
- A failure recorded while the palette is closed and the tile is selected is announced politely
  from beside the connect button, with a sentence that names the device (`problemHeadline` in
  `connect-failures.ts`), such as "The browser couldn't open the Arduino." The toolbar, and the
  live region with it, exists only while the tile is selected, so a failure recorded while the
  tile isn't selected is never announced. The connect button still turns yellow.
- The controls are `div role="button"`, and the arrow keys, Home and End move between them.
