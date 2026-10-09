# CLUE-709: Timeline marker — create, place, move, delete

**Status:** approved for planning
**Jira:** CLUE-709

## Goal

A student picks a marker tool from the toolbar, places one marker on the timeline graph, moves it
by dragging, and deletes it from its own label. The marker is saved with the document.

## What changed underneath, and why this story exists

CLUE-673 made a click on the graph zoom in — shift-click zooms out, drag pans — so clicking no
longer pins a time. The hover line and label that followed the pointer were removed at the same
time, to match the prototype.

The marker machinery survived that change and is currently unused: the content model still has
volatile `hoverTime` and `pinnedTime` with their set and clear actions, and `TimeMarkerOverlay`
still draws both and clears the pinned marker when its label is clicked. Nothing sets either one.

So this story is not building a marker from nothing. It is giving the existing marker a deliberate
way in — a toolbar mode — and making it persist.

## Scope

**In**

- A toolbar button that turns on marker placement.
- While placing: a crosshair cursor, a dashed preview following the pointer, and a click that
  places the marker rather than zooming. Escape leaves the mode without placing.
- One marker at a time. The button is disabled while a marker exists and re-enabled when it is
  deleted.
- Dragging the placed marker's stem or label to move it.
- An "x" in the placed label that deletes it.
- The marker is saved in the document.
- The Full Timeline strip draws a placed marker; this story supplies its dashed while-placing look.

**Out**

- More than one marker.
- Any change to zoom, pan, or the click-to-zoom behaviour outside placement mode.

## Model

`markerTimeISO` moves from volatile into `.props()` as `types.maybe(types.string)`, stored as an
ISO string like the view bounds beside it. It is a student artifact: it survives a reload, travels
with a copied document, and a teacher reviewing the work sees it.

`hoverTime` stays volatile — it is a transient preview, not content.

`isPlacingMarker` is new and volatile. A half-finished placement is not something to reload into.

**Rename:** `pinnedTime` becomes `markerTime`. The old name described a transient pin; it is now a
placed object the student owns. The surrounding code is being rewritten anyway, so the rename costs
nothing now and avoids a misleading name outliving the change.

**The existing export test at `timeline-content.test.ts:407` asserts `pinnedTime` is absent from
`exportJson`.** That assertion is now wrong by design and must be inverted rather than deleted: the
marker belongs in the exported document.

## Components

**`TimelinePlot`** owns the graph's pointer handling and already branches on modifier keys for its
cursor (`isDragging ? "grabbing" : isShiftDown ? "zoom-out" : "zoom-in"`). Placement mode joins that
branch with a crosshair, and the click handler returns early — setting the marker and ending the
mode — before it reaches the zoom logic.

**`TimeMarkerOverlay`** already draws a preview line, a placed line, a label, and clears on label
click. It gains:

- a dashed treatment while placing
- an "x" control in the placed label
- drag handling on the stem and the label

**The toolbar button** follows the existing registration in `timeline-toolbar.tsx`, where each
button is a small observer component reading `useTimelineContent()`. It is disabled when a marker
exists, and shows its active state while placing.

## Dragging

The one genuinely new mechanism, so it gets the most care.

Pointer-down on the stem or the label captures the pointer. Pointer-move converts clientX to a time
through the same helper the plot already uses. Pointer-up releases.

**Commit on pointer-up, not per move.** During the drag the marker follows the pointer from volatile
state; the model is written once at the end. A drag is hundreds of pointer-moves, and writing each
one would bury the document's undo history under a single gesture.

**Clamp to the loaded time range, not the current view.** A drag cannot strand the marker where there
is no data, but it also does not stop at the edge of what happens to be on screen.

**Pointer capture must survive a lost pointerup.** `TimelinePlot` already guards this with
`onPointerCancel`; the marker drag needs the same, or a missed pointerup leaves a drag running.

## Known edges

- **A marker outside the current view is not drawn** — `isPctInView` already governs this — so its
  delete "x" is unreachable until the student pans back. Accepted: the Full Timeline strip still
  shows where it is, which is the way back to it.
- **Placement mode with no data loaded** has nothing to place against. The button is disabled unless
  the timeline has a time range.

## Testing

Model: the marker persists through `exportJson` and reloads; `isPlacingMarker` does not; the rename
carries the existing set/clear coverage.

Components: the button turns the mode on and is disabled once a marker exists; a click in placement
mode places rather than zooms; Escape leaves the mode; the "x" deletes and re-enables the button; a
drag moves the marker and writes once.

Each behavioural test is mutation-checked — break the mechanism, confirm the test fails — because
this branch's sibling work produced three assertions that could not fail.

**jsdom renders no layout**, so the crosshair cursor, the dashed treatment and the drag's feel need
checking by hand on localhost.
