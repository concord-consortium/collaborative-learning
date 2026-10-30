# The connect palette

The connect button in the DataFlow tile toolbar opens the connect palette, where a student connects
a device and sees how the connection is going. The code calls it the pane: `ConnectPane` in
`components/toolbar/dataflow-connect-button.tsx`, styled in `dataflow-connect-pane.scss`, with its
status text from `connectPaneStatus` in `utilities/connect-pane-status.ts`. How a connection
attempt works, and what it logs, is in [The connection attempt](serial.md#the-connection-attempt).

The palette has a "Device connection" heading, a status area, and then one of two views
(`paneView`): the device list, with a Connect button per device, or the connected actions:
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
moves focus to the connect button if the palette had it. Otherwise the palette stays open: a stall
that recovers on its own, with late first data or a finished update, only updates its lines.

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
