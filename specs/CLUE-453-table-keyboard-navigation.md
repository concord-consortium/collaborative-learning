# CLUE-453: Table Tile Keyboard Navigation

Spec for adding keyboard navigation to the CLUE table tile, including
`accessibility-tools` focus-trap integration. Builds on the design context
in [`docs/table-tile-focus-trap.md`](../docs/table-tile-focus-trap.md), which
explains the underlying constraints (RDG beta.44 roving tabindex,
virtualization, edit-mode handoff). Read that first.

## 1. Goal

Make the table tile fully keyboard-navigable, matching the cycle every other
selected tile gets via `tile-component.tsx`: **title → header row → body →
toolbar → resize → (back to title)**. The user can enter the tile, walk every
piece of it without a mouse, and return to where they were when they Tab away
and Tab back.

## 2. Scope

**In scope (Phase 1):**

- Wire the table tile into the existing focus-trap framework.
- Make the column-header row keyboard-navigable, including the "+" add-column
  button.
- Make body cells keyboard-navigable with both Tab (cell-to-cell, exits at
  edges) and RDG's native arrow keys.
- Add three small additions to `@concord-consortium/accessibility-tools`
  required to support composite-widget slots (the body and the header).
- Edit-mode Escape cancels the cell edit rather than exiting the tile.
- Memory: re-entering a slot lands on the previously-focused element where
  reasonable, using DOM `tabindex="0"` as the source of truth.

**Out of scope (Phase 2 / follow-up tickets):**

- Switching from RDG `selectCell` to `setActivePosition({ shouldFocus:
  false })` once we upgrade past React 18. (Mechanical rename in the new
  helper module — see §6.)
- The toolbar-roving focus-vs-state desync the user observed (file as its
  own bug).
- Framework "remember last slot on Escape/Enter" — a future
  `accessibility-tools` enhancement; this spec is forward-compatible with
  it via the `focusContent` signature (§5.3).
- Virtualization recovery (scrolling the active cell back into view when
  re-entering the body if RDG has unmounted it).
- Multi-cell selection, fill-handle, and column-reorder via keyboard.

## 3. Behavior specification

### 3.1 Slot cycle

The table tile registers these slots with `createClueTileStrategy`:

| Slot | Element |
|---|---|
| `title` | `EditableTableTitle` root |
| `topbar` | Header row inside the grid (queried from `gridRef.current?.element`) |
| `content` | `gridRef.current?.element` (the grid root) |
| `toolbar` | Existing `TileToolbar` (no change) |
| `resize` | Existing tile resize handle (handled by framework) |

Cycle order: `["title", "topbar", "content", "palette", "toolbar",
"resize"]`. This is the framework default; we do not change it.

### 3.2 Header row (topbar slot)

Tab walks each control in DOM order: `[remove][name][sort]` per data column,
plus the trailing `+` button on the controls column.

Within the slot:
- **Tab / Shift+Tab**: moves between header controls; roving `tabindex`
  is updated so the most-recently-focused control is marked `tabindex="0"`
  and others `tabindex="-1"`.
- **Focus into a header control auto-selects the column.** Mirrors the
  existing mouse behavior (clicking anywhere on a header cell selects the
  column via `handleHeaderClick`). Tabbing into column A's header triggers
  `onSelectColumn("A")`; subsequently Tabbing to column B's header
  triggers `onSelectColumn("B")` and replaces the selection
  (`setSelectedAttributes` replaces, not appends). Cross-tile effect:
  data-card and graph tiles linked to the same dataset reflect the
  selected attribute, so keyboard navigation through table headers
  updates them too — same as mouse-clicking the headers does today.
- **Enter on the remove button**: shows the existing remove-column
  confirmation alert (`useCautionAlert`). The existing
  `if (isColumnSelected)` gate on `handleClick` is preserved; because
  focus-in already auto-selected the column by the time Enter fires, the
  alert opens on the first Enter press. (As a side effect this also fixes
  the pre-existing mouse quirk where the first click on the remove button
  only auto-selected the column and a second click was needed to open the
  alert — clicks now also auto-focus the button, hitting the same
  auto-select path.)
- **Enter on the column name** (static state): begins rename, entering the
  existing `HeaderCellInput` edit mode.
- **Enter on the sort button**: triggers the existing sort action.
- **Enter on the `+` button**: triggers add-column.
- **Escape while renaming**: cancels the rename (per §3.6).
- **Arrow keys**: not specified for Phase 1; whatever RDG does by default.
  Cross-slot arrow behavior (ArrowUp from body to header, etc.) is in the
  test list (§7) rather than designed up front.

At the slot edges:
- Tab past the last header control → trap advances to the body.
- Shift+Tab past the first header control → trap returns to the title.

### 3.3 Body (content slot)

Tab follows RDG's native cell-to-cell navigation. RDG owns the in-grid
navigation; the table-side code only owns the slot edges.

Within the slot:
- **Tab / Shift+Tab**: RDG's native behavior. Cell-to-cell, with row
  wrapping. In edit mode: commits the current edit and moves to the next
  cell (CODAP-style).
- **Arrow keys**: RDG's native behavior (cell navigation in select mode,
  caret movement within an open cell editor).
- **Enter / F2**: RDG's native behavior (opens cell editor).
- **Escape in edit mode**: cancels the cell edit, returns to select mode
  on the same cell (per §3.6).
- **Escape in select mode**: exits the focus trap (framework default).

At the slot edges:
- Tab past the bottom-right cell → trap advances to the toolbar.
- Shift+Tab past the top-left cell → trap returns to the header.

### 3.4 Memory on slot re-entry

Slot memory is read from DOM `tabindex="0"`. Each slot's
roving-tabindex bookkeeping is the single source of truth.

This memory survives across selection toggles because the trap (per the
managed-for-tabindex semantic in §5.1) leaves the roving-tabindex state of
managed slots alone — `setChildrenNonTabbable` no longer destroys it when
the tile is unselected.

**Header (topbar)**: When the trap re-enters the slot, `pickSlotEntryTarget`
finds the header control marked `tabindex="0"` (the last-focused one) and
focuses it. If none has it, the first control is the fallback.

**Body (content)**: Handled via custom `focusContent`, branching on the
`reverse` argument (see §5.3 for the signature):

- **Reverse entry** (`reverse: true`, e.g. Shift+Tab from toolbar): focuses
  the body's `tabindex="0"` cell — RDG's record of the last-active cell.
  If no such cell is in the DOM (virtualized out, never set), falls back
  to bottom-right.
- **Forward entry** (`reverse: false`, e.g. Tab from header): resets the
  active cell to (0, 0) via `setGridActivePosition`. This is the "Tab
  forward through the tile starts fresh" rule the user adopted to keep
  cycle-walking sensible.

The forward-entry reset is restricted to body entry from header by virtue
of cycle order — `topbar` is the only slot that precedes `content` in
forward direction. If the framework later adds a "remember last slot on
Escape/Enter" feature (currently `enterTrap` always lands on `title`),
the body's `focusContent` will need an additional signal to distinguish
"forward cycle entry" from "trap restore." The signature is an options
object expressly to allow that future field (§5.3).

### 3.5 Tab handoff mechanism

Body and header are composite widgets that use roving `tabindex`
internally. The existing `tabWithinSlots` mechanism in `accessibility-tools`
walks `getVisibleFocusables`, which filters out `tabindex="-1"` elements
([dom-utils.ts:56-58](../../accessibility-tools/src/hooks/dom-utils.ts#L56-L58));
combined with roving tabindex (every control but one has `tabindex="-1"`),
the framework sees a single focusable per slot, decides it's at the
boundary on the first Tab, and exits the slot.

Both slots therefore use the new `tabHandlers` mechanism (§5.1) instead.
Each handler decides per-Tab whether to handle the move itself or to let
the trap advance the slot.

**No RDG patch is required for this design.** Earlier exploration
(see [`docs/table-tile-focus-trap.md`](../docs/table-tile-focus-trap.md) §4)
considered using RDG's `onCellKeyDown` callback as the handoff mechanism,
which would have needed CODAP's "fire onCellKeyDown for header rows" patch.
With the trap-level approach the table never reads `onCellKeyDown` — body
edge detection uses `getGridActivePosition` and the trap intercepts Tab
in capture phase before RDG's keydown runs. CLUE currently ships
[patches/react-data-grid+7.0.0-beta.44.patch](../patches/react-data-grid+7.0.0-beta.44.patch)
which contains that header onCellKeyDown change; the patch is harmless and
this spec neither relies on it nor requires changes to it.

### 3.6 Escape handling

The framework's Escape behavior is "always exit the trap" — it
`preventDefault`s and `stopPropagation`s in capture phase ([focus-trap-controller.ts:288-293](../../accessibility-tools/src/hooks/focus-trap-controller.ts#L288-L293)),
so RDG's edit-mode Escape (which cancels the edit) and the
header-rename editor's Escape never run. This is the root cause of the
known bug where pressing Escape during a cell edit commits the partial
edit instead of reverting it: the trap exits, the cell editor blurs, and
RDG commits the in-progress value as its default blur behavior. The
`escapeHandlers` mechanism below fixes that bug as a direct consequence
of letting the body opt out of the trap's universal Escape handling.

This spec adds an `escapeHandlers` mechanism (§5.2) and registers handlers
on the `content` and `topbar` slots:

- **Body** (`content`): if `getGridActivePosition` reports `mode === "EDIT"`
  (or RDG exposes equivalent), return `"handled"` and do not preventDefault.
  RDG's `onCellKeyDown` will then run its native cancel logic. Otherwise
  return `"exit"` and let the trap exit.
- **Header** (`topbar`): if the focused element is the rename input,
  return `"handled"` (the input handles Escape — `HeaderCellInput`
  already calls `onClose` with `cancel`). Otherwise return `"exit"`.

Title slot's Escape behavior is unchanged (existing exit-trap behavior).
The title editor's own cancel-on-Escape can be added later if needed.

### 3.7 Click and mouse interactions

Out of scope for this spec — clicking interactions are unchanged. Mouse
clicks into a cell continue to select it; the trap's `focusin` handler
takes care of entering the trap when focus moves into the tile from
outside.

## 4. Test surface

This list informs the test plan in §7 — it's also "things to test by hand
once Phase 1 is implemented" because some are behavioral questions we
deliberately punted:

- ArrowUp from body row 0: does RDG move focus to the header row, or does
  it stay? Does the trap's `slotIndex` re-derive correctly on the next Tab?
- ArrowDown from a header control to a body cell: same question.
- Click on a body cell while the tile is unselected: does the trap enter
  cleanly, and does RDG's `tabindex="0"` get set on the clicked cell?
- Click on a header control while the tile is unselected: same.
- Tab past `+` button when there is no controls column: should still
  advance to the body.
- Virtualization: scroll a previously-focused cell out of view, then
  re-enter the body via Shift+Tab. Where does focus land?
- Rename a column, press Tab: does the rename commit and focus move to
  the next header control?
- Rename a column, press Escape: does the rename cancel and focus return
  to the column name?
- Edit a cell, press Escape: edit cancels, cell remains active.
- Edit a cell, press Tab: edit commits, focus moves to next cell.
- Tab full cycle: title → header → body → toolbar → resize → title.
- Escape from body cell → focus returns to tile container. Enter → trap
  re-entered at title (framework limitation; intentional for Phase 1).
- Body memory: enter body, navigate to C5, Tab to toolbar, Shift+Tab back.
  Focus lands on C5.
- Body memory reset: navigate body to C5, Tab to toolbar, then Tab around
  cycle back to body via header. Focus lands on (0, 0) — not C5.

## 5. `@concord-consortium/accessibility-tools` changes

Three additions to `FocusTrapStrategy` (`types.ts`) and corresponding
behavior in `FocusTrapController` (`focus-trap-controller.ts`).

### 5.1 `tabHandlers`

```ts
type TabHandlerResult = "handled" | "exit";

interface FocusTrapStrategy {
  // ...existing fields
  tabHandlers?: Record<
    string,
    (event: KeyboardEvent, reverse: boolean) => TabHandlerResult
  >;
}
```

**Trap behavior on Tab while trapped:**

1. Re-derive `slotIndex` from `document.activeElement` (existing behavior at
   [focus-trap-controller.ts:299-306](../../accessibility-tools/src/hooks/focus-trap-controller.ts#L299-L306)).
2. Look up `strategy.tabHandlers?.[currentSlotName]`.
3. If a handler exists:
   - `"handled"`: trap returns immediately. The handler is responsible for
     `event.preventDefault()` and any focus movement. The handler may
     intentionally _not_ preventDefault to let RDG/native Tab proceed.
   - `"exit"`: trap takes over the remainder of its existing path —
     `event.preventDefault()`, advance `slotIndex`, focus next slot via
     `focusSlot`.
4. If no handler, existing `tabWithinSlots` / advance-slot logic runs
   unchanged.

`tabHandlers` takes precedence over `tabWithinSlots` for any slot that has
both. Slots without a handler keep their existing behavior — this is purely
additive for tiles that don't opt in.

**Managed-for-tabindex semantic:** any slot present in `tabHandlers` is also
treated as managing its own tabindex. The trap's `setChildrenNonTabbable`
will not mutate `tabindex` on the slot's element or its descendants. This
keeps roving-tabindex patterns (RDG cells, the header roving managed by
`createHeaderTabHandler`) intact across selection toggles, which the §3.4
memory behavior depends on. See
`docs/superpowers/specs/2026-05-13-trap-managed-slots-design.md` for the
design.

### 5.2 `escapeHandlers`

```ts
type EscapeHandlerResult = "handled" | "exit";

interface FocusTrapStrategy {
  // ...existing fields
  escapeHandlers?: Record<
    string,
    (event: KeyboardEvent) => EscapeHandlerResult
  >;
}
```

**Trap behavior on Escape while focus is inside the trap:**

1. Re-derive `slotIndex` from `document.activeElement`.
2. Look up `strategy.escapeHandlers?.[currentSlotName]`.
3. If a handler exists:
   - `"handled"`: trap returns immediately without `preventDefault` /
     `stopPropagation`. The handler is responsible for any escape semantics
     (canceling an edit, etc.) or for explicitly suppressing the event.
   - `"exit"`: trap proceeds with its existing exit behavior
     (`preventDefault`, `stopPropagation`, `exitTrap`).
4. If no handler, existing behavior (always exit) runs unchanged.

### 5.3 `focusContent` signature change

Change `focusContent: () => boolean` → `focusContent: (context: { reverse:
boolean }) => boolean`.

```ts
type FocusContentContext = {
  reverse: boolean;
  // Future: additional fields like `entryMode: "cycle" | "trap-restore"`
};

interface FocusTrapStrategy {
  // ...existing fields
  focusContent?: (context: FocusContentContext) => boolean;
}
```

**Why an options object**: the framework may later gain a "remember last
slot on Enter/Escape" feature. When that happens, the trap may enter the
content slot for reasons other than a forward cycle, and the body needs
to distinguish that case. Adopting an options object now lets future
fields be added without a breaking change.

**Trap behavior**: `focusContent` is called from `focusSlot(slotName,
reverse)` ([focus-trap-controller.ts:340-366](../../accessibility-tools/src/hooks/focus-trap-controller.ts#L340-L366))
when the slot is the content slot. The call site passes the existing
`reverse` argument through as `{ reverse }`.

**Migration impact**: three existing implementations
([drawing-tile.tsx:149](../src/plugins/drawing/components/drawing-tile.tsx#L149),
[bar-graph-tile.tsx:68](../src/plugins/bar-graph/bar-graph-tile.tsx#L68),
[text-tile.tsx:221](../src/components/tiles/text/text-tile.tsx#L221)) all
ignore the argument. The change is type-only for them — no behavior shift.
The type changes propagate through CLUE's
[`tile-api.tsx:23`](../src/components/tiles/tile-api.tsx#L23),
[`use-clue-accessibility.ts:31`](../src/hooks/use-clue-accessibility.ts#L31),
and one test file.

### 5.4 Test surface in `accessibility-tools`

Extend `focus-trap-controller.test.ts` with cases for:

- `tabHandlers`: handler returns `"handled"` → trap does not preventDefault,
  does not advance slot.
- `tabHandlers`: handler returns `"exit"` → trap advances forward / backward.
- `tabHandlers`: no handler on a slot → existing behavior unchanged.
- `tabHandlers`: handler defined but slot not currently active → handler
  not called.
- `escapeHandlers`: handler returns `"handled"` → trap does not preventDefault,
  does not exit.
- `escapeHandlers`: handler returns `"exit"` → trap exits.
- `escapeHandlers`: no handler → trap exits (existing behavior).
- `focusContent`: called with `{ reverse: false }` on forward entry.
- `focusContent`: called with `{ reverse: true }` on reverse entry.

## 6. CLUE-side wiring

All on the CLUE side, no further `accessibility-tools` changes.

### 6.1 New helper module: `src/components/tiles/table/keyboard-nav.ts`

Per the existing design doc's naming/abstraction recommendations
([table-tile-focus-trap.md §5](../docs/table-tile-focus-trap.md)), all
keyboard-specific logic lives in one module so Phase 2 (React 19 / RDG
main APIs) is a mechanical rename.

**Exports:**

- `setGridActivePosition(gridRef, position): void` — wraps
  `selectCell(position, undefined, true)` today, opting in to the new
  `shouldFocusCell` parameter added by
  [patches/react-data-grid+7.0.0-beta.44.patch](../patches/react-data-grid+7.0.0-beta.44.patch)
  (commit `f71c4eb0f`). The opt-in is required because we use this helper
  in `focusContent` to land focus on a body cell on slot re-entry; without
  it, the cell is logically selected but DOM focus stays on the previous
  element. Phase 2 will wrap `setActivePosition(position, { shouldFocus:
  true })` — both APIs now default to "no focus" so the migration shape
  is consistent.
- `getGridActivePosition(gridRef): { idx, rowIdx, mode } | null` — reads
  the current active cell from a ref maintained by an
  `onSelectedCellChange` prop on `<ReactDataGrid>`. Mode comes from RDG's
  cell state (SELECT vs EDIT).
- `isCellNavMode(mode): boolean` — returns `mode === "SELECT"` today,
  `mode === "ACTIVE"` later.
- `createBodyTabHandler(deps)` — returns the `tabHandlers.content` callback.
- `createHeaderTabHandler(deps)` — returns the `tabHandlers.topbar`
  callback. Also manages the header's roving `tabindex`.
- `createBodyEscapeHandler(deps)` — returns the `escapeHandlers.content`
  callback.
- `createHeaderEscapeHandler(deps)` — returns the `escapeHandlers.topbar`
  callback.
- `createBodyFocusContent(deps)` — returns the body's `focusContent`
  callback.

`deps` includes `gridRef`, a ref to current `columns` and `rows`, and a
getter for the header DOM element.

### 6.2 Registration in `table-tile.tsx`

Wire `ClueTileAccessibilityBridge` (function-component path) with:

```ts
{
  tileType: "table",
  titleRef,                      // EditableTableTitle root
  getTopbarElement: () => gridRef.current?.element
    ?.querySelector<HTMLElement>('[role="row"][aria-rowindex="1"]') ?? undefined,
  getContentElement: () => gridRef.current?.element,
  focusContent: createBodyFocusContent({ gridRef, columnsRef, rowsRef }),
  toolbarRef,                    // existing
  tabHandlers: {
    topbar: createHeaderTabHandler({ getTopbarElement }),
    content: createBodyTabHandler({ gridRef, columnsRef, rowsRef }),
  },
  escapeHandlers: {
    topbar: createHeaderEscapeHandler({ getTopbarElement }),
    content: createBodyEscapeHandler({ gridRef }),
  },
}
```

Also pass `onSelectedCellChange` to `<ReactDataGrid>` and stash the result
in a ref consumed by `getGridActivePosition`.

The exact selector for the header row (`[role="row"][aria-rowindex="1"]`)
is to confirm against the rendered DOM — RDG may use a different
`aria-rowindex` numbering. Worst case: use a class selector exposed via
RDG's `headerRowClass` prop.

### 6.3 Body tab handler

```ts
function bodyTabHandler(event, reverse) {
  const pos = getGridActivePosition(gridRef);
  if (!pos) {
    event.preventDefault();
    return "exit"; // grid has no active cell — let trap advance
  }
  const lastCol = columnsRef.current.length - 1;
  const lastRow = rowsRef.current.length - 1;
  const atFirst = pos.idx === 0 && pos.rowIdx === 0;
  const atLast = pos.idx === lastCol && pos.rowIdx === lastRow;
  if (reverse ? atFirst : atLast) {
    event.preventDefault();
    return "exit";
  }
  return "handled"; // don't preventDefault — RDG handles native cell-to-cell Tab
}
```

The handler returns `"handled"` **without calling `preventDefault`**. RDG's
own `onCellKeyDown` (which fires in React's event system, after the trap's
capture-phase listener returns) will then handle the cell move. In edit
mode, RDG commits and moves as part of the same path.

### 6.4 Header tab handler

```ts
function headerTabHandler(event, reverse) {
  const topbarEl = getTopbarElement();
  if (!topbarEl) {
    event.preventDefault();
    return "exit";
  }
  const focusables = getHeaderFocusables(topbarEl);   // includes tabindex="-1"
  const currentIdx = focusables.indexOf(document.activeElement);
  if (currentIdx === -1) {
    event.preventDefault();
    return "exit";
  }
  const nextIdx = reverse ? currentIdx - 1 : currentIdx + 1;
  if (nextIdx < 0 || nextIdx >= focusables.length) {
    event.preventDefault();
    return "exit";
  }
  // Move within slot, updating roving tabindex.
  event.preventDefault();
  focusables[currentIdx].setAttribute("tabindex", "-1");
  focusables[nextIdx].setAttribute("tabindex", "0");
  focusables[nextIdx].focus();
  return "handled";
}
```

`getHeaderFocusables` queries `button, [contenteditable], [tabindex]` and
filters by visibility — including `tabindex="-1"` elements, since the
roving-tabindex pattern means all but one have that.

### 6.5 Body focus-content

```ts
function focusBodyContent({ reverse }) {
  const grid = gridRef.current;
  if (!grid?.element) return false;
  if (!reverse) {
    // Forward entry — reset to top-left.
    setGridActivePosition(grid, { idx: 0, rowIdx: 0 });
    return true;
  }
  // Reverse entry — use memory (RDG's tabindex="0" cell).
  const cell = grid.element.querySelector<HTMLElement>(
    '[role="row"]:not([aria-rowindex="1"]) [role="gridcell"][tabindex="0"]'
  );
  if (cell) { cell.focus(); return true; }
  // Memory missing (virtualized out) — fall back to bottom-right.
  setGridActivePosition(grid, {
    idx: columnsRef.current.length - 1,
    rowIdx: rowsRef.current.length - 1,
  });
  return true;
}
```

### 6.6 Body escape handler

```ts
function bodyEscapeHandler(event) {
  const pos = getGridActivePosition(gridRef);
  if (pos?.mode === "EDIT") {
    // Let RDG cancel the edit. Don't preventDefault; don't exit trap.
    return "handled";
  }
  return "exit";
}
```

### 6.7 Header escape handler

```ts
function headerEscapeHandler(event) {
  const active = document.activeElement;
  if (active instanceof HTMLInputElement &&
      active.closest(".editable-header-cell")) {
    // Let HeaderCellInput handle Escape (calls onClose with cancel).
    return "handled";
  }
  return "exit";
}
```

### 6.8 Header controls — DOM/a11y changes

Currently the per-column header has three controls inside a `<div
className="column-header-cell">`:

- **`RemoveColumnButton`** — `<div onClick>`. Convert to `<button
  type="button">` with `aria-label="Remove column {colName}"` and reset
  UA button styles in SCSS. Keep the existing `if (isColumnSelected)`
  gate in `handleClick`. With auto-select-on-focus (§6.9) in place,
  focusing the button — whether by Tab or by mouse click — selects the
  column before activation, so the gate is satisfied by the time Enter
  or click runs the handler.
- **`EditableHeaderCell`** static state — `<div className="header-name">`.
  Add `tabIndex={0}`, `role="button"`, `aria-label` reflecting the column
  name, and an `onKeyDown` that calls `onBeginHeaderCellEdit` on Enter or
  F2. The `<input>` in edit mode is already focusable and already handles
  Enter to commit / Escape to cancel.
- **Sort button** — `<div className="column-button sort-column-button"
  onClick>`. Convert to `<button type="button">`, move the SVG's
  `aria-label` (already reflects current sort direction) onto the button,
  reset UA button styles in SCSS. Existing `handleSort` becomes `onClick`
  unchanged.
- **`ControlsHeaderRenderer` "+"** —
  [src/components/tiles/table/use-controls-column.tsx:61](../src/components/tiles/table/use-controls-column.tsx#L61).
  Convert `<div className="add-column-button" onClick>` to `<button
  type="button" aria-label="Add column">`.

These conversions get keyboard Enter/Space activation, real ARIA
semantics, and native focus styling for free.

### 6.9 Header auto-select-on-focus

Add an `onFocus` handler on the existing `column-header-cell` parent
`<div>` ([column-header-cell.tsx:72](../src/components/tiles/table/column-header-cell.tsx#L72)).
React's synthetic `onFocus` receives bubbled focus events from descendant
elements, so any focus on a header control (remove button, name field,
sort button) triggers the parent's handler:

```ts
const handleHeaderFocus = () => {
  if (!gridContext?.isColumnSelected(column.key)) {
    gridContext?.onSelectColumn(column.key);
  }
};
```

This mirrors the existing `handleHeaderClick` logic — same gate, same
call, just driven by focus rather than click. `setSelectedAttributes`
replaces the selection, so Tabbing from one column to the next moves
selection with focus.

No change is needed for the trailing controls-column `+` button — it
isn't part of a data column so it doesn't trigger selection.

### 6.10 Header roving tabindex

The header tab handler in §6.4 updates roving `tabindex` on each Tab.
Additionally:

- On render, the helper sets `tabindex="0"` on the first focusable header
  control and `tabindex="-1"` on the rest. If the slot is re-entered and a
  control already has `tabindex="0"`, that one is kept.
- On `focusin` to a header control (e.g. via mouse click), update the
  roving target — same pattern as
  [`use-roving-tabindex.ts:50-67`](../src/hooks/use-roving-tabindex.ts#L50-L67).

This is small enough to inline in `keyboard-nav.ts`; `useRovingTabindex` is
designed for arrow-key-driven toolbars and isn't a clean reuse here. The
arrow-key vs Tab distinction in the existing hook is intentional —
trying to extend it to support Tab too would compromise its toolbar use.

## 7. Test plan

### 7.1 Unit tests

- `accessibility-tools/focus-trap-controller.test.ts`: cases enumerated in
  §5.4.
- `keyboard-nav.test.ts` (new): unit tests for the handlers — body Tab
  edges, header Tab edges, mode-aware Escape, focus-content reset vs
  memory paths. Mock `gridRef` and DOM as needed.

### 7.2 Component tests

Extend `table-tile.test.tsx`:

- Full Tab cycle works (title → header → body → toolbar → resize → title).
- Re-entering body via Shift+Tab lands on the last-active cell.
- Re-entering body via forward Tab from header lands on (0, 0).
- Edit-mode Escape cancels the edit and keeps focus in the cell.
- Edit-mode Tab commits and moves to the next cell.
- Header rename via Enter, commit via Enter, cancel via Escape.
- Tab to a header remove button, press Enter, verify the confirmation
  alert opens. Confirm via the alert's button and verify the column is
  removed.
- Tab between two column headers and verify the column-selection state
  updates (visual `.selected-column` class, and — if a linked graph or
  data-card tile is present — the selected attribute in those tiles).

### 7.3 Cypress tests

Add to `tableTile.spec.ts` (or equivalent):

- Tab into a table tile, navigate body via Tab+arrow combinations, edit a
  cell, Tab to commit, verify cell contents.
- Tab to header, rename a column, Tab to next, verify.
- Tab to toolbar, perform a toolbar action, Shift+Tab back to body,
  verify focus restored.

### 7.4 Manual / exploratory test list

The items in §4 — most of them are behavioral edge cases that need eyes-on
verification rather than automation.

## 8. Phase 2 notes (post-React 19)

These are deliberately not in Phase 1 scope, but the Phase 1 architecture
lets each become a localized change:

- **`setActivePosition({ shouldFocus: false })`** replaces `selectCell`.
  Localized to `setGridActivePosition` in `keyboard-nav.ts`. Unlocks
  preserving the active cell across slot transitions without a focus
  race.
- **`onClose(commit, shouldFocus)`** for edit-mode handoff. Localized to
  `closeGridEditor` (new helper) — relevant if we ever need to commit an
  edit programmatically from outside RDG's flow.
- **Mode rename `SELECT` → `ACTIVE`**. Localized to `isCellNavMode`.
- **Drop the focus-sink workaround if any survives**.
- **Framework "remember last slot on Escape/Enter"**: when the framework
  adds this, the body's `focusContent` adds a branch on the new context
  field (e.g. `entryMode === "trap-restore"`) to use memory rather than
  reset. Existing forward-cycle behavior is preserved.
- **Toolbar focus/roving desync** (separate ticket): the bug where Tab
  into the toolbar lands focus on the first button while the roving
  index points elsewhere. Independent of the table feature; flagged here
  because the user encountered it during this work.

### 8.1 RDG beta.44 → main API renames

CLUE is pinned to RDG beta.44 because beta.48 dropped React 18 support
and the focus-relevant API improvements all landed after that. The
[`keyboard-nav.ts`](../src/components/tiles/table/keyboard-nav.ts) helper
module isolates the beta.44-specific call sites so the eventual upgrade
is a mechanical rename.

| Beta.44 (current) | Main (upgrade target) | Migration site |
|---|---|---|
| `selectCell(pos, enableEditor?, shouldFocusCell?)` | `setActivePosition(pos, { enableEditor, shouldFocus })` | `setGridActivePosition` in `keyboard-nav.ts` |
| `mode === 'SELECT'` | `mode === 'ACTIVE'` | `isCellNavMode` in `keyboard-nav.ts` |
| `onSelectedCellChange` prop | `onActivePositionChange` prop | `onSelectedCellChange` handler in `table-tile.tsx` |
| `textEditor` export | `renderTextEditor` export | import alias, if used |
| Focus sink div for row-level focus | Rows are focusable directly | don't reference `.rdg-focus-sink` selectors |
| `args.onClose(commit)` (EditCellKeyDownArgs) | `args.onClose(commit, shouldFocus)` | new helper if/when an external commit is needed |

The `shouldFocusCellRef` machinery this work depends on is gone upstream
(state-based `shouldFocusCell` in beta.59+, removed entirely by canary.49),
so the patches in
[`patches/react-data-grid+7.0.0-beta.44.patch`](../patches/react-data-grid+7.0.0-beta.44.patch)
for `shouldFocusCell` will fail to apply on upgrade and can simply be
deleted at that point.

### 8.2 RDG patches inventory

**CLUE's own patch** ([`patches/react-data-grid+7.0.0-beta.44.patch`](../patches/react-data-grid+7.0.0-beta.44.patch),
introduced in commit `e1474547a`) backports beta.59's `shouldFocusCell`
opt-in onto `selectCell`. Default is `false`; only `keyboard-nav.ts`
callsites opt in. This is unrelated to the trap handoff design — it
fixes a separate focus-race bug where RDG's `shouldFocusCellRef`-gated
layout effect stole focus from freshly-mounted editors (the title-edit
race against `table_tool_spec.js:37`). See §9.3.

**CODAP's seven patches** at `../codap/v3/patches/` were surveyed during
this work. None are required for CLUE's trap handoff because the
`tabHandlers` approach (§3.5) sidesteps `onCellKeyDown` entirely,
including the header-row case CODAP's `onCellKeyDown`-for-headers patch
addresses. The others (`columnWidths` controlled prop,
`onColumnResize(isComplete)`, `textEditorClassname` export, stale-row
check via `rowKeyGetter`, out-of-bounds guard, `nextColumn?.parent`
null-safety) are either adopted upstream, fixed differently, or
unrelated to focus.

CODAP's case-table reference at
[`collection-table.tsx`](../../codap/v3/src/components/case-table/collection-table.tsx)
~line 270 and
[`use-selected-cell.ts`](../../codap/v3/src/components/case-table/use-selected-cell.ts)
~line 72 shows the `onCellKeyDown` Tab-within-grid pattern CLUE rejected.

## 9. Design decisions and rejected alternatives

The original design context lived at `docs/table-tile-focus-trap.md`
(removed; this section captures the durable design-choice rationale).
The plan was iterated during implementation; the divergences below are
the decisions that matter.

### 9.1 Trap handoff: `tabHandlers` API, not RDG's `onCellKeyDown`

**Alternative considered**: Use RDG's `onCellKeyDown` callback to detect
Tab at the grid's last cell and hand off to the trap. This is the
pattern CODAP uses (see §8.2).

**Decision**: Add a new `tabHandlers` API to
`@concord-consortium/accessibility-tools` (§5.1). The trap intercepts
Tab in capture phase; the body tab handler reads RDG's selected position
via `onSelectedCellChange` (mirrored into `selectedCellRef`) and decides
at-edge cases.

**Rationale**:
- Keeps the trap as the single source of truth for slot-level
  navigation; routing through `onCellKeyDown` would split ownership.
- Avoids needing CODAP's "fire `onCellKeyDown` for header rows" patch.
- The `tabHandlers` API generalizes to other RDG-using tiles and to
  non-RDG composite widgets.

### 9.2 `tabHandlers` precedence over per-tile `tabWithinSlots`

**Alternative considered**: Make `tabWithinSlots` per-tile-configurable
so the table could opt out of intra-slot Tab handling for the content
slot.

**Decision**: Keep `tabWithinSlots: ["topbar", "content"]` global in
[`create-clue-tile-strategy.ts`](../src/hooks/create-clue-tile-strategy.ts).
Add `tabHandlers` as a separate API that takes precedence (§5.1).

**Rationale**: Tiles that don't need custom handling keep getting the
default `tabWithinSlots` behavior without any opt-in. Tiles that need
it opt in via `tabHandlers`. One opt-in surface beats two.

### 9.3 RDG `shouldFocusCell` patch, despite the "no RDG changes" goal

**Alternative considered**: Avoid all RDG patches — the original design
called for "minimum viable focus trap (beta.44, no RDG changes)."

**Decision**: Add the RDG patch (commit `e1474547a`) forward-porting
beta.59's `shouldFocusCell` opt-in onto `selectCell`. Default is
`false`; only `keyboard-nav.ts` callsites opt in. See §8.2.

**Rationale**: The patch fixes a focus-race bug (RDG's
`shouldFocusCellRef`-gated layout effect stole focus from freshly-mounted
editors). That bug is separate from the trap handoff design — the
handoff itself remains patch-free. The pragmatic call was that the
race was a real user-visible failure (cypress `enterTableTitle`,
`renameColumn`) and the upstream fix was already structured as the same
opt-in we needed.

### 9.4 Header merged into content slot

**Alternative considered**: Separate `topbar` and `content` slots, each
with their own tab handler. This was the design in §3.1 / §3.2 / §3.5
as originally written.

**Decision** (commit `fc5fc917b`): Drop the topbar slot; treat the
entire grid (header rows + body rows) as the content slot. The body's
`selectedCellRef` already tracks the header row (`rowIdx === -1`); the
body tab handler's "at first" check is now `rowIdx === -1 && idx === 0`.

**Rationale**: Once cooperative-roving was in place (commits
`c36b1e814`/`e511f07f9`/`be2cc4273` — threading RDG's `tabIndex` prop
through cell formatters), RDG's `navigate()` handles header↔body Tab
internally. The header-specific tab handler became redundant.

**Spec impact**: §3.1's slot table is outdated. The table tile registers
only `title`, `content`, `toolbar`, `resize`. §3.2 (header row tab
behavior) and §3.5 (separate header handler) describe the original
two-slot design, which has been superseded.

### 9.5 `focusContent` context shape: `{ reverse }` → `{ entryMode }`

**Decision** (commit `0a9d3780b`): Changed `FocusContentContext` from
`{ reverse: boolean }` to `{ entryMode: "forward" | "reverse" }`, with a
forward-compat contract that future modes (e.g. `"restore"`) should be
treated as `"forward"` by clients that don't recognize them.

**Rationale**: An enum field with an explicit open-set contract makes
the eventual "remember last slot on Escape/Enter" framework feature
(noted in §8) a non-breaking addition. The original boolean shape
collapsed forward-vs-restore into the same `false` value, which would
have required a breaking change to distinguish them later.

## 10. Open follow-ups

Items deferred during Phase 1. Each has natural code locality.

- **RDG `selectedPosition` sync gap (header).** Cooperative roving across
  header cells via Tab requires `gridRef.current.selectedPosition.rowIdx ===
  -1` for RDG's `navigate()` to advance. Nothing syncs this today —
  `selectColumn` in [`use-grid-context.ts`](../src/components/tiles/table/use-grid-context.ts)
  only updates `dataSet.setSelectedAttributes`, and `handleHeaderClick` in
  [`column-header-cell.tsx`](../src/components/tiles/table/column-header-cell.tsx)
  calls `e.stopPropagation()` to block RDG's HeaderCell `onClick`. The
  keyboard-nav cypress spec works around this with `realClick()`. Possible
  fixes: sync inside `selectColumn` (fires on programmatic selects too),
  sync inside `handleHeaderFocus` (narrower), or rework so CLUE drives
  Tab. Use the patched `selectCell(pos, enableEditor, shouldFocusCell=false)`
  so syncing doesn't steal focus.
- **Click on inner header controls bypasses cell selection.** Pre-existing
  behavior, user-flagged as undesirable: clicking `.header-name` enters
  rename mode directly ([`editable-header-cell.tsx`](../src/components/tiles/table/editable-header-cell.tsx));
  clicking `.remove-column-button` opens the remove dialog directly
  ([`column-header-cell.tsx`](../src/components/tiles/table/column-header-cell.tsx)).
  A header-cell click should select the column first; activation should
  take a second interaction. Separate UX decision; blocks "click cell to
  seed RDG selection" approaches to the sync gap above.
- **`pickSlotEntryTarget` lands on cell, not inner control.** First Tab
  from the title lands on the index column header *cell* (RDG sets
  `tabindex="0"` on the cell), not on `.show-hide-row-labels-button`
  inside it. Fix lives in `@concord-consortium/accessibility-tools`
  (teach `pickSlotEntryTarget` to prefer inner interactive controls) or
  in CLUE (provide a custom slot-entry function via the strategy).
- **Persistent roving target inside a header cell.** Current arrow-roving
  design resets a cell's entry to `.header-name` on every Tab into the
  cell ([`column-header-cell.tsx`](../src/components/tiles/table/column-header-cell.tsx)
  `handleArrow`). Standard ARIA composite-widget guidance is to remember
  the within-cell roving target across cell entries.
- **Optional: Jest unit test for `ColumnHeaderCell.handleArrow`.**
  Composite-widget arrow roving has cypress coverage only; a Jest unit
  test would catch regressions faster. Low priority.
- **Focus ring missing after Enter-commit on editable titles.** Enter in
  any of the four `*editable*-title*` components calls `handleClose(true)`,
  which unmounts the input without restoring focus to the display-mode
  button — focus drops to `document.body`. Tab-commit appears to work
  because the browser's default Tab moves focus before the input
  unmounts. Reproduces beyond the table tile; surfaced during CLUE-453
  manual testing. Fix shape:
  [`EditableTitleButton`](../src/components/tiles/editable-title-button.tsx)
  accepts a forwarded ref + `autoFocusOnMount` prop that the parent
  toggles only on keyboard-driven closes (Enter / Escape; blur-driven
  closes must not focus-snap).
- **Unify the editable-title state machines.** `EditableTitleButton` (the
  display shell) is already shared, but the `isEditing` state machine is
  duplicated across
  [`editable-table-title.tsx`](../src/components/tiles/table/editable-table-title.tsx),
  [`editable-tile-title.tsx`](../src/components/tiles/editable-tile-title.tsx),
  [`custom-editable-tile-title.tsx`](../src/components/tiles/custom-editable-tile-title.tsx),
  and `basic-editable-tile-title.tsx` (thin wrapper). They differ in
  input component, sizing, voice typing, and title persistence (model
  vs. callback) — but the state machine itself is identical. Extracting
  a `useEditableTitleCommit` hook is the natural place to land the
  focus-ring fix above instead of fixing it four times.

## 11. References

- Tab-order spec (CLUE-391): [`specs/CLUE-391-tab-order-in-tiles-toolbars-text-tiles.md`](CLUE-391-tab-order-in-tiles-toolbars-text-tiles.md)
- Table tile: [`src/components/tiles/table/table-tile.tsx`](../src/components/tiles/table/table-tile.tsx)
- Column header cell: [`src/components/tiles/table/column-header-cell.tsx`](../src/components/tiles/table/column-header-cell.tsx)
- Controls column (the "+"): [`src/components/tiles/table/use-controls-column.tsx`](../src/components/tiles/table/use-controls-column.tsx)
- Focus-trap controller: [`../accessibility-tools/src/hooks/focus-trap-controller.ts`](../../accessibility-tools/src/hooks/focus-trap-controller.ts)
- DOM focus utilities: [`../accessibility-tools/src/hooks/dom-utils.ts`](../../accessibility-tools/src/hooks/dom-utils.ts)
- CLUE strategy: [`src/hooks/create-clue-tile-strategy.ts`](../src/hooks/create-clue-tile-strategy.ts)
- Existing `useRovingTabindex`: [`src/hooks/use-roving-tabindex.ts`](../src/hooks/use-roving-tabindex.ts)
- RDG vendored: `../react-data-grid/` (checked out at beta.44)
- RDG `canExitGrid`: [`../react-data-grid/src/utils/selectedCellUtils.ts`](../../react-data-grid/src/utils/selectedCellUtils.ts)
- CODAP reference: [`../codap/v3/src/components/case-table/`](../../codap/v3/src/components/case-table/)
