# CLUE-669: WaveRunner Date Set-up Styling — Design

**Status:** approved for planning
**Jira:** CLUE-669

## Goal

Style the WaveRunner tile's Data Setup controls — two dropdowns and two date fields — to
Michael's design, and prevent a student from choosing an end date before the start date.

This is a styling story. The stored value, the range logic, and everything downstream of
`TimeRange` are unchanged.

## Why the controls have to be replaced, not just styled

Neither native control can meet the design:

- `<input type="datetime-local">` renders its calendar panel as browser chrome. Chrome, Firefox
  and Safari each draw a different one and none is reachable from CSS.
- A native `<select>`'s option popup is OS chrome for the same reason, so the design's open-list
  states cannot be expressed either.

So "style the dropdowns and the date pickers" necessarily means swapping both for controls whose
markup we own. That is the bulk of the work; the CSS is the easy half.

## Scope

**In**

- Station and Model dropdowns restyled, including hover, focus, open and disabled states.
- Start and End date fields replaced with a styled picker: field, calendar popover, month-year
  dropdown, prev/next navigation, Clear / Cancel / OK footer.
- End-before-start made unselectable, with the existing error checks retained as a backstop.
- Field displays a time of `12:00 AM`.
- `run` accepts a single-day range, matching `loadData`.

**Out**

- The popover's time column, and any ability to set a time. The field shows `12:00 AM` because the
  picker supplies it, not because a time is stored or settable.
- Real time-of-day support: no model change, no change to range construction, nothing downstream.

## Components

### Dropdowns — use the existing `CustomSelect`

`src/clue/components/custom-select.tsx` is already CLUE's dropdown: the app header, the student,
problem and class menus, and sort-work all use it. It is custom markup over
`@concord-consortium/accessibility-tools`' `useDropdown`, so its open list is fully stylable.

Station and Model adopt it. No new dependency, and the two dropdowns inherit CLUE's established
look and keyboard behavior rather than inventing a second one.

`CustomSelect` takes `items: ICustomDropdownItem[]`, so the existing option-building in
`data-setup.tsx` maps onto it directly. The orphaned-station entry and the "No stations configured"
and "Choose a station" placeholder rows carry over as items.

**Constraint:** `CustomSelect` is shared by seven call sites. If the design diverges from how it
already looks, that divergence is handled with a WaveRunner-scoped class in this tile's SCSS. The
shared component's own styles are not modified under this story.

### Date fields — React Aria `DatePicker`

Nothing in the repo or in Concord's own packages provides a date picker; `react-components` and
`accessibility-tools` were both checked. This is the one new dependency:

- `react-aria-components`
- `@internationalized/date`

Both Apache-2.0.

A new `src/plugins/wave-runner/components/date-field.tsx` wraps the picker once and is used twice,
for Start and End. It owns the value conversion and keeps `data-setup.tsx` about layout.

```
interface IDateFieldProps {
  id: string;
  label: string;
  value: string;                      // "YYYY-MM-DD", as stored
  onChange: (value: string) => void;  // same shape back
  minValue?: string;
  maxValue?: string;
  isDisabled?: boolean;
}
```

### Value conversion

`@internationalized/date`'s `CalendarDate` carries no timezone. `parseDate("2025-01-01")` in and
`.toString()` out round-trips exactly the strings the model already stores, so no UTC-versus-local
question arises and no conversion can drift. This is why the picker can be swapped without
touching the model.

The field's `12:00 AM` is presentation only: `granularity` is set so the field renders a time
segment, and the segment is fixed at midnight. Nothing reads it back.

## Interaction

The design's Clear / Cancel / OK footer means the popover **buffers**: picking a day updates the
calendar's own highlight but does not call `onChange`. OK commits, Cancel discards and closes,
Clear empties the field.

This differs from stock React Aria, which commits on selection, so the buffering is implemented in
`date-field.tsx` as local state seeded from `value` when the popover opens.

**Open question for Michael, not blocking:** the model always holds a date, so an empty field is
currently unreachable. Clear would be the only way to produce one. Either Clear restores the
default date, or the model must tolerate an empty string. Until this is settled, Clear restores
the default and does not empty the field.

## Validation

Prevention, as the acceptance criteria ask:

- End picker takes `minValue` = the current start date.
- Start picker takes `maxValue` = the current end date.

Out-of-order dates are then not selectable in the calendar at all.

The existing `loadDataError` and `runError` checks in `wave-runner-content.ts` remain, as a
backstop for any path that bypasses the calendar.

**Inconsistency fixed here:** `loadData` rejects `end < start`, so a single-day range is valid;
`run` rejects `end <= start`, so it is not. Harmless while both dates were pinned to midnight, but
once a student can select the same day in both pickers, Load Data accepts it and Run fails. `run`
changes to `end < start` to match. `endDate` is inclusive, so a single day is a legitimate range.

## Styling

Colors come from CLUE's existing token set in `src/components/vars.scss`. No new hex values.

The house dropdown establishes the vocabulary these controls follow:

| Role | Token |
|---|---|
| Control height / radius | `40px` / `5px` |
| Resting border | `$charcoal-light-1`, 1.5px |
| Resting fill | `$workspace-teal-light-5` |
| Hover / focus fill | `$workspace-teal-light-3` |
| Open / active fill | `$workspace-teal-dark-1`, white text and border |
| Popover surface | `white`, `box-shadow: 0 0 5px 0 rgba(0,0,0,0.5)` |
| Body text | `13px`, `$charcoal-dark-2` |
| Keyboard focus | `@include focus-ring` from `components/mixins` |

Applied to the picker:

- **Field** — resting, hover and open states as above. Calendar glyph takes the teal used for the
  control's border treatment.
- **Popover** — white surface with the shared shadow and 5px radius.
- **Day cells** — today outlined rather than filled; adjacent-month days in `$charcoal-light-1`;
  the selected day uses the open/active fill with white text.
- **Nav chevrons and month-year dropdown** — outlined controls on the white surface, using the same
  border token and radius.
- **Footer** — Clear and Cancel outlined, OK filled with the active fill.

**To confirm against Zeplin:** these mappings are read from the design image against the existing
ramp. Spacing, type sizes and the exact step of each teal are proposed, not measured. If the Zeplin
CSS arrives before implementation, exact values replace the proposed steps; the token names should
not change.

**Note for Michael:** the weekday header in the design reads `Thr`. The usual abbreviation is
`Thu`. Implemented as drawn unless he says otherwise.

## Testing

Unit tests, in `date-field.test.tsx` and alongside the existing WaveRunner tests:

- `"YYYY-MM-DD"` → `CalendarDate` → `"YYYY-MM-DD"` round-trips unchanged.
- An end date earlier than the start is not selectable; `minValue` is passed through.
- OK commits the buffered date; Cancel leaves the value untouched.
- The field renders `12:00 AM` and no time column appears in the popover.
- Both dropdowns and both date fields are disabled while running or loading.
- `run` accepts `start == end`.

**Caveat, as with CLUE-711:** jsdom and Cypress both synthesize pointer events, so these tests
cover structure and wiring, not how the control feels under a real mouse. The states in the design
need checking by hand on localhost.

## Risks

- **Bundle size.** The one measurable unknown. Record the `dist` chunk sizes, install, build again
  and diff. If the delta is unreasonable for one date picker, that is the point to reconsider —
  before the styling work, not after.
- **Shared-component pressure.** If the design's dropdown diverges from `CustomSelect`, resist
  changing the shared component; scope it to this tile.
- **Buffering.** Clear / Cancel / OK is the one place real behavior is being written rather than
  restyled, so it carries the most risk of the picker and deserves the most test attention.
