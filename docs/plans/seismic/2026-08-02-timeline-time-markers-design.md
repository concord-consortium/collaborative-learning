# Timeline Time Markers Design

## Overview

Let users read the time of an arbitrary point on the timeline tile. Hovering over
the waveform shows a vertical line under the cursor with a date/time label; clicking
pins a marker that stays until moved or cleared. All marker state is volatile on
`TimelineContentModel` — nothing is serialized, and markers vanish on reload.

## Behavior

- **Hover**: Moving the mouse over the waveform panel shows a vertical line under
  the cursor spanning the waveform height, with a label showing the date and time
  (UTC) at that position. The line renders below the cursor (z-axis); the label
  clears when the mouse leaves the panel.
- **Click to pin**: Clicking the waveform leaves a stationary copy of the marker.
  Clicking elsewhere moves it — there is only ever one pinned marker.
- **Clear**: Clicking the pinned marker's label removes it.
- **Labels**: Two lines — date, then time with seconds — matching the existing
  `range-date` labels in the `timeline-range-row`. Labels sit below the waveform,
  in line with the range row, z-ordered above it with a solid background.
- **Pan/zoom**: The pinned marker is anchored to its timestamp. It moves with the
  waveform and is hidden (not cleared) while its time is outside the view range.
- **Hit area**: Only the waveform panel. The numbered event label buttons above the
  waveform keep their select-event behavior and never place markers.

## Model changes (`timeline-content.ts`)

- `.volatile()`: `hoverTime: DateTime | undefined`, `pinnedTime: DateTime | undefined`
- Actions: `setHoverTime(time)`, `clearHoverTime()`, `setPinnedTime(time)`,
  `clearPinnedTime()`
- View: `timeToViewPct(time: DateTime): number | undefined` — percent offset within
  the current view range, `undefined` when there is no valid view range. The inline
  position math in `EventOverlay.getEventPosition` is refactored to use it.
- Markers out of view are detected by the component via `pct < 0 || pct > 100`.

## Component changes

### New `TimeMarkerOverlay` (`components/time-marker-overlay.tsx` + `.scss`)

Rendered inside `.waveform-wrapper` after `EventOverlay`. Renders a hover marker
when `hoverTime` is set and a pinned marker when `pinnedTime` is set and in view.

Each marker:
- Vertical line: `position: absolute; top: 0; height: 100%`, 1px wide,
  `pointer-events: none`, at `left: <pct>%`, z-index below the event label buttons.
- Label: positioned at `top: 100%` (in line with `timeline-range-row`), centered
  with `translateX(-50%)`, solid background, z-index above the range row text.
- The pinned label is a `<button>` that calls `clearPinnedTime()` on click (with
  `stopPropagation`). The hover label is inert (`pointer-events: none`).

### `WaveformPanel` (`shared-seismogram/components/waveform-panel.tsx`)

Gets optional pass-through props `onMouseMove`, `onMouseLeave`, `onClick` (standard
React mouse handlers) attached to its root `.waveform-panel` div. The seismogram's
"waveform" mode doesn't pass them.

### `Timeline` (`components/timeline.tsx`)

Supplies the handlers:
- `onMouseMove`: mouse x → fraction of panel width (via
  `e.currentTarget.getBoundingClientRect()`) → `viewStart + fraction * range` →
  `setHoverTime`
- `onMouseLeave`: `clearHoverTime()`
- `onClick`: same conversion → `setPinnedTime`

### `EventOverlay` (`components/event-overlay.scss`)

The event rectangles are absolutely-positioned siblings on top of the waveform
panel, so they would swallow mouse events. Add `pointer-events: none` to
`.event-overlay`. The label buttons keep their pointer events; since they sit above
the panel, their clicks never reach the panel handlers.

## Edge behavior

- Hover and pinned markers can both be visible; near-coincident labels may overlap
  (accepted for v1).
- Labels near the tile edges may extend past the waveform bounds, same as event
  labels today (accepted).

## Testing

- Model tests (`timeline-content.test.ts`): volatile actions, `timeToViewPct` math
  (in range, out of range, no view range).
- Component tests (new `time-marker-overlay.test.tsx` or `timeline-tile.test.tsx`):
  hover shows marker/label, click pins, click elsewhere moves the pin, clicking the
  pinned label clears it.
