# CLUE-708: Event Number as the first column of an events table

**Status:** approved for planning
**Jira:** CLUE-708, in epic CLUE-674 (Timeline Usability with Long Timescale)

## Goal

A table linked to a Wave Runner or a Timeline shows an Event Number as its first column, and that
number is the same one the Timeline puts on the event.

## What is there now

The Wave Runner owns the events dataset. `getOrCreateEventsDataSet` builds it with five
attributes — `eventType`, `windowStart`, `windowEnd`, `confidence`, `modelLabel` — and the model
run appends a case per detected event, a day at a time, so a paused and resumed run adds to a
dataset that already holds events.

Nothing records an event's number. The Timeline derives one: `events` sorts by `windowStart` and
assigns `index`, which `selectedEventLabel` renders as "Event N". The Table tile shows the
dataset's attributes as columns, in attribute order.

The "Table It!" toolbar button is `DataSetViewButton`, which creates a Table tile sharing the same
`SharedDataSet`. So a table linked to a Wave Runner or a Timeline is exactly a table sharing their
events dataset.

## The number is data, not a row position

The table already has a leftmost index column — `useRowLabelColumn`, showing `__index__` with a
show/hide toggle in its header — and it is tempting to relabel that. It would be wrong twice over.
That column is the row-select and drag handle, and its number is the row's position in the grid,
which the user can change: `useColumnsFromDataSet` takes an `onSort`, so sorting the table by event
type would renumber every row while the Timeline went on numbering by time.

The number therefore lives in the dataset, as an attribute. Everything that reads the dataset — the
table, a Data Card view of the same data, an export — then sees it, and sorting the table cannot
disturb it.

## Scope

**In**

- An `eventNumber` attribute, first in the events dataset.
- A shared `renumberEvents` helper that assigns numbers in `windowStart` order.
- The Wave Runner writing numbers whenever it appends events.
- The column being read-only, since it is derived.

**Out**

- Any change to the Timeline. It already numbers by `windowStart` order and will agree by
  construction; see below.
- Numbering student-labelled events. CLUE-560 adds those, and calls the same helper.
- Backfilling a run that is already saved, beyond what happens when the Wave Runner next writes to
  it. See Known edges.

## The attribute

`eventNumber` is added ahead of `eventType`, so it is the dataset's first attribute and therefore
the table's first column. No tile needs to detect "is this a timeline table?" — the column is there
because the data is.

`addAttributeToDataSet(dataset, snapshot, beforeID?)` already takes a `beforeID`, so the same call
puts the attribute first whether the dataset is being created or backfilled.

## `renumberEvents`

One exported function in `src/plugins/shared-seismogram/`, which both plugins already depend on:

```ts
export const kEventNumberAttrName = "eventNumber";

/**
 * Numbers every event by its place in `windowStart` order and writes the numbers into the dataset.
 * Adds the attribute if it is missing, so this also brings up a dataset recorded before CLUE-708.
 * Call it after anything changes which events exist.
 */
export function renumberEvents(dataSet: IDataSet): void
```

**It writes only the cases whose number actually changes.** Opening a document must not dirty it,
and a run that appends events in time order — the usual case — leaves every existing number alone,
so the helper should produce no patches at all.

**Numbers follow time, not insertion.** An event that lands earlier in time than events already
recorded takes its place in the sequence and shifts the ones after it. That is the only rule under
which the table and the Timeline can agree, because the Timeline cannot number any other way: it
sorts by `windowStart` and has no insertion order to consult.

**The Timeline does not change.** Both sides apply the same rule to the same field and reach the
same answer, so the Timeline keeps deriving its own numbering and old documents keep working
without the attribute. The alternative — making the Timeline read the attribute — would be a
single source of truth, but it needs a fallback for every document saved before this story, for no
behavioural gain.

## A read-only column

A derived number a student can type into would desync until the next renumber, which is a bug
waiting to be filed.

`attribute.ts` carries a commented-out `setEditable`, a CODAP concept CLUE never carried over. It
comes back as a plain prop beside `hidden`:

```ts
editable: true,
```

Defaulting to `true` leaves every existing attribute behaving as it does now. It is not free,
though, and the cost was measured rather than guessed: the prop lands on every attribute of every
CLUE document, not only seismic ones. Adding it and running the suite fails six tests across
`drag-tiles.test.ts` and `dc-shared-models.test.ts` — five of them snapshots that assert exact
document JSON. So the plan must re-record those snapshots, saved documents gain one more boolean
per attribute beside the `hidden`, `units` and `title` they already carry, and every document
holding a dataset changes hash once.

That was accepted deliberately: it is a general mechanism rather than a seismic one, and CLUE-560
will want the same for anything else it derives. The Wave Runner sets it `false` on `eventNumber`,
and the Table extends the condition it already uses to suppress the editor on expression columns:

```ts
renderEditCell: !readOnly && !content.hasExpression(attr.id) && attr.editable ? CellTextEditor : undefined
```

The alternative was for the table to recognise the attribute by name, which would put knowledge of
seismic data inside a generic tile. A flag on the attribute keeps that knowledge with the plugin
that owns the data, and gives CLUE-560 the same mechanism for anything else it derives.

## Known edges

- **A run saved before this story shows no Event Number until the Wave Runner next writes to that
  dataset**, at which point `renumberEvents` adds the attribute and fills it. Numbering on load
  would cover those documents, but it means writing to a document merely by opening it, which is
  wrong in a read-only pane — a teacher reviewing a student's work would be editing it. Accepted.
- **An event with no valid `windowStart`** cannot be placed in the sequence. The Timeline already
  drops such cases from `events`; `renumberEvents` sorts them last and numbers them after the
  valid ones, so the two agree on everything either of them draws.
- **The row-label column stays.** It is the row-select and drag handle, and is about rows rather
  than events. The Event Number sits beside it as the first *data* column.

## Testing

Model: `renumberEvents` numbers in `windowStart` order rather than insertion order; an event
inserted earlier in time shifts the numbers after it; a dataset already numbered correctly produces
no patches; a dataset without the attribute gets it, in first position.

Wave Runner: appending a day's events leaves every event numbered in time order.

Table: an attribute with `editable: false` renders no cell editor, and one with `editable: true`
still does.

No Cypress. Nothing here depends on layout or computed style — column order and the presence of a
cell editor are both observable in jsdom — so a browser adds cost without adding coverage. The QA
fixture from CLUE-671 would make a browser check convenient once that merges, but this story does
not wait on it and does not need it.

The plan must also re-record the two document snapshot tests the new attribute prop disturbs, and
check that the only change in them is the added `editable` field: a snapshot re-recorded without
reading it is how an unrelated regression gets baked in.
