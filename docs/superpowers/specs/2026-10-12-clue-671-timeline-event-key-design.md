# CLUE-671: Timeline event icons, Event Key and rectangle styling

**Status:** approved for planning
**Jira:** CLUE-671, in epic CLUE-674 (Timeline Usability with Long Timescale)

## Goal

Bring the Timeline tile's event marks up to the design: rectangles coloured to match their icon,
narrow events drawn as a single line, an Event Key whose entries switch event types on and off, and
a tidied run-info header.

## What already exists

This story is mostly finishing work. CLUE-673, CLUE-719 and CLUE-720 already landed:

- `timeline-event-colors.scss` — `base` / `hover` / `select` / `transparent` for six colour words
  plus a `default`, and a darker `full-timeline` variant of each.
- `EventShape` — square, circle, triangle-up, triangle-down, double-bar and diamond, with `?` for
  any type past the six, drawn in a 12×12 box.
- `getEventColorClass` and `eventTypeColorWords`, which assigns colour words to the event types
  actually present in the dataset, in first-seen order.
- `EventOverlay`, which already draws the number button and the icon above each rectangle.

So "event items each have a unique icon", "the icon sits below the event number button" and "the key
only shows types present in the sample" are already met. What follows is what is not.

## Scope

**In**

- One named source of truth pairing each event colour word with its colour and its icon.
- Event rectangles coloured from the icon colour rather than the pale base colour.
- Narrow events degenerating to a single line in the outline colour.
- Event Key entries as checkboxes that switch a type's marks on and off, saved with the document,
  with the sheet's rest and hover appearances.
- Prev/Next skipping switched-off events, without renumbering.
- The event number button widening for a 3-digit index.
- The run-info header restyled to three lines.

**Out**

- A seventh icon and colour for student-defined events. That is CLUE-560.
- **The number buttons' keyboard focus state.** Giving them one means putting them in the Tab order,
  and `EventOverlay` deliberately keeps them out of it "until the graph has a keyboard design" — a
  decision CLUE-720 reaffirmed. This sheet is the beginning of that design, and reversing the
  deferral is behaviour, not styling, so it is its own story.

  The key checkboxes are a different case and their focus state is **in**: a native checkbox is
  focusable whether or not anything is styled, so there is no Tab-order decision to make, only
  whether the ring is drawn. The sheet's ring is the repo's existing `$focus-ring-color` with its
  white inner ring, so it costs one rule.
- **Table-select highlighting**, the sheet's green-outlined event and button states for "selected in
  the table". That is selection shared with a linked Table tile, not styling.
- Re-picking any colour value. Every hex in `timeline-event-colors.scss` came from the design and is
  carried over unchanged. The rectangles do switch to a different one of those existing colours, and
  the translucent variants are re-derived from them, but no new colour is chosen.
- Any change to zoom, pan, the marker, or the Full Timeline's scrollbar.

## The colour and icon set

Adding a colour word currently means editing four files and hoping they stay aligned: the words are
a bare string array in `timeline-types.ts`, the shapes a separate record in `event-shape.tsx`, and
`event-overlay.scss` and `timeline-key.scss` each hand-write seven near-identical colour blocks.

CLUE's pattern for a palette is `src/clue/data-colors.scss` — scss variables, an `:export` block and
a hand-written `.d.ts` so TypeScript can read the values, paired with `clueDataColorInfo`, which
gives each a name. **The Timeline takes the shape of that pattern but not its export.** CLUE exports
those values because Graph and BarGraph draw with JavaScript and need the hexes at runtime; the
Timeline draws entirely through CSS classes, so nothing would ever read the export. Declaring one
with no consumer is dead weight.

What the export was serving — one list rather than four — is better had another way. scss gets a
single `$event-colors` map that every `@each` in the plugin iterates, `event-shape.scss` included,
so a colour is declared once per stylesheet instead of seven times. TypeScript gets a single
`timeline-event-styles.tsx` pairing each colour word with its icon, from which `kEventColorWords`
derives, so the order `eventTypeColorWords` hands out is a consequence of the set rather than a
second copy of it. A test then reads the stylesheet and asserts the two lists hold the same words in
the same order, which is a single source of truth that actually fails when it is broken — something
an `:export` nobody imports could never do.

`timeline-key.tsx` imports `clsx`. CLAUDE.md requires `classnames` for conditional classes; it
changes.

## Event rectangles

**Border and interior come from `select`, not `base`.** The acceptance criterion is "a solid opaque
border in the icon color, and a center that is colored but transparent", and the icon is drawn in
the `select` colour. The current `base` border reads far paler than the design against the black
plot.

The interior keeps using the `transparent` variables, but those are re-derived. Each is currently a
hand-expanded `rgba(170, 215, 255, 0.5)` restating its `base` hex in decimal; each becomes
`rgba($blue-select, 0.4)`. That moves the fill onto the icon colour, drops the alpha to what the
sheet shows, and removes the raw numbers. A second set, `rgba($blue-hover, 0.4)`, is added for the
key checkbox's hover state.

The 0.4 is measured twice over, independently: the blue and purple rectangles on the sheet's
waveform panel both solve to α=0.40 against `select` across all three channels, and the key
checkbox's hover fill solves to α=0.40 against `hover` across all three. A fit against `base`, at
any alpha, is incoherent.

**A narrow event degenerates by construction, not by threshold.** `.event-overlay` becomes
`box-sizing: border-box` with `min-width: 2px`. At that minimum the two 1px borders consume the
whole box, leaving no content area, so the element renders as a solid 2px line in the outline
colour; as the event widens, the translucent centre appears continuously. No pixel threshold to
choose and no measuring of the plot.

## The Event Key

Each entry becomes a native `<input type="checkbox">` styled with `appearance: none`, with the
type's icon overlapping its top-left corner and the event type as its `<label>`. A native checkbox
carries its own role, state and Space handling, so no ARIA is needed.

**The control is the event rectangle in miniature, over a black backing.** That is not a metaphor:
the checkbox's measured fill is pixel-identical to the event rectangle's fill on the plot, because
both are the same `select` colour at 40% over `#121212`. The key swatch is therefore a literal
preview of the mark it governs, and the two share their colour rules.

Its structure, outside in: a 3px `#121212` border, a 4px `select` border, and the 40% fill. Checked
adds a white checkmark. Focused, it gains the repo's standard ring outside all of that, around the
icon as well as the box. The only thing that varies with hover is the colour basis — border and fill
move from `select` to `hover` — and the only thing that varies with checked is the checkmark.

The sheet's six rows resolve to four states once measured, because the two labelled "Select" have
the same fill as the default rather than a distinct pressed appearance; they show the *result* of
the click, not a transient. So: checked at rest, unchecked at rest, checked hovered, unchecked
hovered — the last of which shows a grey ghost checkmark, previewing what clicking would do. There
is no separate pressed appearance to build.

In the key the icons sit against that dark box, so they take a white halo in place of the `#121212`
stroke they carry against the white plot surround. `EventShape` gains a variant for it.

`hiddenEventTypes: types.array(types.string)` joins `.props()`, beside `viewStartTimeISO`. It is a
student artifact in the same sense the view range is: it survives a reload, travels with a copied
document, and a teacher reviewing the work sees what the student left on screen.

Filtering applies at exactly two drawing sites. `shownEvents` is the events whose type is not
hidden; `visibleEvents` — which today means "inside the current view", and whose only consumer is
`EventOverlay` — filters from `shownEvents` rather than from `events`, so it comes to mean "shown
and in view", which is what that consumer wants. `FullTimelineEvents` moves from `events` to
`shownEvents`.

## Navigation

Numbering is absolute. `selectedEventIndex` stays an index into the full `events` list and
`selectedEventLabel` stays `Event ${index + 1}`, so an event keeps its number however many types are
switched off. There are *n* events in the record whether or not all *n* are on screen.

Only the walk changes. `canSelectPrev` and `canSelectNext` ask whether any shown event lies before or
after the current index; `selectNextEvent` takes the first shown event after it and `selectPrevEvent`
the last shown one before it. With types 2–4 hidden, Next from 1 lands on 5.

Skipping matters more than it first appears because `selectEvent` calls `focusEvent`, which zooms
and pans the view onto the event. Without skipping, Prev/Next would re-aim the viewport at an event
the student has deliberately switched off.

**Hiding the selected event's type leaves the selection where it is.** The label goes on reading
"Event 3" and the view does not move. The alternative — jumping the selection to the nearest shown
event — would mean ticking a checkbox in the key silently re-aims the graph, because of that same
`focusEvent` call. Prev and Next still work from a hidden selection, since they search by index
direction rather than from a list position.

## The header

`.metadata-display` currently renders four unstyled divs: station label, `modelLabel`, and the data
start and end as full locale date-times. The design shows three lines — station label, start date,
end date — as `MM/DD/YYYY` with no time. `modelLabel` is dropped from the display and left on the
model.

## The event number button

The button is a fixed `width: 24px` today. The sheet keeps 1- and 2-digit indices at one width and
widens the button for 3 digits, so the fixed width becomes a `min-width` with horizontal padding,
letting a 3-digit index widen it without a second rule. Its three fills — `base`, `hover`, `select`
— already match the sheet and do not change.

## Focus order

`TimelineKey` renders inside `.timeline-container`, after the Full Timeline, so the key's checkboxes
are the last focusable controls in the tile's contents. Per the implementation note on this story
from CLUE-720, they must join `kContentControls` in `timeline-tile.tsx` or Shift+Tab into the tile
will land on the scrollbar thumb rather than on the last key control.

CLUE-709 moves `kContentControls` into `timeline-content-controls.ts`. This story branches from
master and absorbs that move when CLUE-709 merges; the conflict is one import and one selector
string.

One wrinkle disappears on its own: the contents slot is reported only while it holds something to
visit, and a tile with event types always has key checkboxes, so it is no longer empty when Prev,
Next and the thumb are all disabled.

## Known edges

- **Every type switched off** disables Prev and Next together. CLUE-720's handling already moves
  focus to a control that is still enabled, and the key checkboxes are now among them.
- **A hidden selected event** keeps its number in the Event label while nothing is drawn for it.
  Accepted above, as the cost of not moving the view on a checkbox click.
- **More than six event types** share the `?` shape and the default grey, as they do today — and,
  because `eventTypeColorWords` stops after six, a seventh type gets no Event Key row, so it is
  drawn but cannot be switched off. Recorded on CLUE-560, whose own acceptance criteria already
  put the `?` type in the key.

## Testing

Model: `hiddenEventTypes` survives `exportJson` and a reload; `shownEvents` excludes hidden types;
`visibleEvents` excludes both hidden types and events outside the view; Prev/Next skip hidden events
without changing any event's number; Prev/Next work from a selection whose own type is hidden; both
disable when every type is hidden.

Components: a key checkbox switches its type's rectangles off in both the graph and the Full
Timeline; the checkbox reflects the saved state on mount; the tile's Tab walk reaches the key
checkboxes last in both directions; the key's icons carry the white halo and the graph's do not.

Styles: jsdom renders no layout, so the rectangle's `box-sizing`/`min-width` degeneration is read
from the stylesheet the way `time-marker-overlay.styles.test.ts` reads `pointer-events`, and the
`@each` loops are checked to emit every colour word.

**Do not sample hexes from the spec sheet.** The PNG attached to the story is Display P3 converted
to sRGB: every saturated colour reads desaturated — blue samples as `#5ea4f8` where the design is
`#42a6ff` — while greys come back exact, because a gamut transform leaves them alone. The greys
matching is therefore not evidence the file is colour-true. The values in `timeline-event-colors.scss`
are correct and confirmed against the designer's own figures; the sheet is authoritative for
*structure* only.

**By hand on localhost**, because jsdom cannot show them: the rectangle colours against the black
plot, the degenerate line at a wide zoom, the key checkbox in all four states plus focus, the
icon's overlap on its corner, and a 3-digit event number in its button. The design comp is attached to CLUE-671; the Zeplin links were
requested on the story and never attached, so the comp is the reference of record.
