# Timeline Events Display Design

## Overview

The timeline tile will display events overlaying the waveform. Events come from the tile's SharedDataSet (attached when created via wave-runner's "Timeline It!" button). Users can navigate between events with Prev/Next buttons or by clicking event labels.

## Data Access

New views on `TimelineContentModel`:

- **`sharedDataSet`** — looks up SharedDataSet via shared model manager, same pattern as `sharedSeismogram`
- **`events`** — array of `{ windowStart: DateTime, windowEnd: DateTime, eventType: string }` parsed from dataset cases, sorted by `windowStart`
- **`eventTypeColorWords`** — `Map<string, string>` mapping each unique `eventType` to a color word in order of first appearance in the dataset
- **`visibleEvents`** — filters `events` to those overlapping the current view window

## Color System

Event types are assigned color words in the order they first appear in the dataset:

```
blue, orange, red, yellow, magenta, purple
```

A color map constant translates color words to hex values, designed to be expandable:

```ts
const kEventColorMap: Record<string, { default: string }> = {
  blue:    { default: "#aad7ff" },
  orange:  { default: "#ffd097" },
  red:     { default: "#ff9494" },
  yellow:  { default: "#e8ea95" },
  magenta: { default: "#eea3ff" },
  purple:  { default: "#cbb1ff" },
};
```

## Selected Event State & Navigation

New persisted MST property:

- **`selectedEventIndex`** — `types.optional(types.number, 0)`, defaults to 0 (first event)

New views:

- **`selectedEvent`** — `events[selectedEventIndex]`, or undefined if no events
- **`canSelectPrev`** — `selectedEventIndex > 0 && events.length > 0`
- **`canSelectNext`** — `selectedEventIndex < events.length - 1`
- **`selectedEventLabel`** — `"Event ${selectedEventIndex + 1}"` or `"Event"` if no events

New actions:

- **`selectPrevEvent()`** — decrements `selectedEventIndex` if `canSelectPrev`
- **`selectNextEvent()`** — increments `selectedEventIndex` if `canSelectNext`
- **`selectEvent(index)`** — sets `selectedEventIndex`, clamped to valid range. Adjusts view to show the event's duration plus 25% padding on each side, clamped to data bounds.

View adjustment on active selection:

```
eventDuration = windowEnd - windowStart
padding = eventDuration * 0.25
viewStart = windowStart - padding
viewEnd = windowEnd + padding
```

The initial default selection (first event on load) does NOT adjust the view.

## Component Structure

```
.timeline-tile
  BasicEditableTileTitle
  TileToolbar
  .timeline-content (renamed from timeline-container)
    .event-row
      Prev button (disabled when !canSelectPrev)
      "Event N" label (selectedEventLabel)
      Next button (disabled when !canSelectNext)
    .timeline-container (new positioned wrapper)
      Timeline (waveform via WaveformPanel)
      Event overlay rectangles + label buttons
    TimelineKey
```

## Event Rendering

Event rectangles are rendered as absolutely positioned divs within `.timeline-container`:

- Full height of the waveform area
- Horizontal position/width computed from `windowStart`/`windowEnd` relative to the current view range
- Background color from `kEventColorMap[colorWord].default` at 50% opacity
- Clickable

Event label buttons hover above each event rectangle:

- 24x20px, centered horizontally above the event, 4px gap
- Background color matches event color (full opacity)
- Text: event's 1-based number in `#121212`
- Clicking selects the event (calls `selectEvent`)

No visual distinction for the selected event on the rectangles themselves. Selection is shown via the "Event N" label in the event row.

## Timeline Key

The `TimelineKey` component populates `.event-types` with one entry per unique event type:

- Color swatch using the event type's color
- Event type name label
- Listed in order of first appearance (matching color assignment order)
