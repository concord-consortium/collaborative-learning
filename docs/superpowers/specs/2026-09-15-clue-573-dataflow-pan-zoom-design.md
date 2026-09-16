# CLUE-573: Pan and Zoom on Dataflow Tiles — Design

## Problem

The dataflow tile's zoom controls are two raw `+`/`−` buttons rendered on the stage itself
(`src/plugins/dataflow/components/ui/dataflow-program-zoom.tsx`), outside the tile-toolbar system every
other tile uses. There is no mouse-accessible pan: panning exists only via arrow keys
(`setupArrowKeyPan` in `src/plugins/dataflow/rete/rete-manager.tsx`), and drag-to-pan was deliberately
removed in favor of marquee selection. Drawing (and geometry) put zoom in the toolbar; dataflow should
match.

## Decisions (user-approved)

1. **Scope:** toolbar buttons `zoom-in`, `zoom-out`, `fit-all`, plus a **pan flyout button** — one
   toolbar button opening a four-arrow pad, following drawing's stamp/align palette pattern. No Tile
   Navigator mini-map (possible follow-up).
2. **Persistence:** none — session-only, exactly today's behavior. The buttons drive the same volatile
   rete transform (`liveProgramZoom`); fit-on-load and the deprecated `programZoom` prop are untouched.
3. **Stage buttons:** removed outright. No unit config anywhere overrides `settings.dataflow.tools`
   (audited: only `src/clue/app-config.json` defines it), so adding the new buttons to the app-config
   default reaches every unit.

## Architecture

### New toolbar buttons

New file `src/plugins/dataflow/components/toolbar/dataflow-zoom-pan-buttons.tsx` (mirroring drawing's
`toolbar-buttons/zoom-buttons.tsx` split), registered in
`src/plugins/dataflow/dataflow-toolbar-registration.tsx` alongside the existing `delete`/`group`/
`ungroup` buttons:

- **`zoom-in` / `zoom-out`** — observer components wrapping `TileToolbarButton`, consuming
  `DataflowReteManagerContext` (same shape as `DeleteNodeButton`). onClick →
  `reteManager.zoomIn()` / `zoomOut()` (existing methods: ±0.05 step, clamped `MIN_ZOOM 0.1` /
  `MAX_ZOOM 2`). Disabled when at the clamp limit — read the current scale from the content model's
  observable volatile `liveProgramZoom` — or when no manager. Icons: the shared
  `src/clue/assets/icons/zoom-in-icon.svg` / `zoom-out-icon.svg` used by drawing and geometry.
- **`fit-all`** — onClick → existing `reteManager.fitContent()`. Disabled when the program has no
  nodes (or no manager). Icon: shared `fit-view-icon.svg`; title "Fit all" (matches drawing).
- **`pan`** — a flyout button: clicking toggles a small palette anchored to the toolbar containing four
  arrow buttons (up/down/left/right). Each arrow calls the existing public `reteManager.pan(dx, dy)`
  with the arrow-key step (40 px), so toolbar pan and keyboard pan move identically. Open/close state
  is a volatile value on the dataflow content model mirroring drawing's `openPallette` enum pattern —
  the tile-toolbar framework's keyboard/focus handling already knows how to route focus into a palette
  (`paletteElement` in `src/components/toolbar/tile-toolbar.tsx`). The palette closes on outside
  click, on Escape, and when the toolbar unmounts (tile deselected). Follow drawing's palette markup/
  styling (stamp/align) so focus order and appearance match.

All four buttons are disabled when `documentProperties?.dfHasData` — the same condition that hides the
stage zoom control today (the recorded-data view pins the transform).

### Removal of the stage control

- Delete `src/plugins/dataflow/components/ui/dataflow-program-zoom.tsx` and its scss.
- Remove the `showZoomControl` render site in `src/plugins/dataflow/components/dataflow-program.tsx`
  (~lines 108, 171-176) and the now-unused zoom handlers there (~258-266) if nothing else consumes
  them.
- Remove `.program-editor-zoom` from `setupArrowKeyPan`'s accepted-elements selector in
  `rete-manager.tsx` (~line 565).
- Arrow-key pan, marquee selection, and the disabled wheel-zoom handler are untouched.

### Config

`src/clue/app-config.json` `settings.dataflow.tools` becomes:

```json
[["data-set-view", "Table"], ["data-set-link", "Graph"], "delete", "group", "ungroup",
 "|", "zoom-in", "zoom-out", "fit-all", "pan"]
```

Toolbar defaults are purely config-driven (there is no code-level default set), so this is the
"default" placement. No other config files change.

## Error handling

- Buttons render disabled while the rete manager context is absent (tile initializing).
- `reteManager.pan`/`zoomIn`/`zoomOut`/`fitContent` are already async-safe on a disposed manager.
- The pan palette's model-volatile open state resets when the content model is rebuilt; no persistence.

## Testing

Development is test-first throughout: every task in the implementation plan is written red-green
(failing test first, verify the failure, implement, verify green) — no production code before its
test exists.

- **Jest — rete-manager zoom/pan behavior** (extend `src/plugins/dataflow/rete/rete-manager.test.ts`,
  which currently has NO coverage of these methods): `zoomIn` steps +0.05 and clamps at `MAX_ZOOM 2`;
  `zoomOut` steps −0.05 and clamps at `MIN_ZOOM 0.1`; `setZoom` writes the transform through to
  `liveProgramZoom`; `pan(dx, dy)` translates by exactly the requested delta; `fitContent` is a no-op
  on an empty program and computes a bounded scale/offset for a non-empty one. These pin the contract
  the toolbar buttons depend on.
- **Jest — toolbar button components** (new `dataflow-toolbar.test.tsx`, following the established
  `src/plugins/graph/components/__tests__/graph-toolbar.test.tsx` pattern: render each button through
  `getToolbarButtonInfo("dataflow", name)` with real MST content, a stubbed rete manager in
  `DataflowReteManagerContext`, and testing-library assertions):
  - registration: all four names (`zoom-in`, `zoom-out`, `fit-all`, `pan`) resolve in the registry;
  - dispatch: clicking calls `zoomIn()` / `zoomOut()` / `fitContent()` exactly once; each pan arrow
    calls `pan(0, −40)` / `pan(0, 40)` / `pan(−40, 0)` / `pan(40, 0)`;
  - disabled states, each as its own case: no manager in context; `liveProgramZoom.scale` at
    `MAX_ZOOM` disables zoom-in only; at `MIN_ZOOM` disables zoom-out only; empty program disables
    fit-all only; `dfHasData` disables all four;
  - reactivity: driving `setLiveProgramZoom` across a clamp boundary flips the button's disabled
    state without a re-render being forced (observer wiring);
  - palette lifecycle: click opens (open state set on the model volatile), second click closes,
    Escape closes, deselecting the tile/unmounting the toolbar closes; only one palette state exists
    so opening is idempotent;
  - accessibility: each button and pan arrow exposes the expected accessible name (the pattern the
    graph toolbar test file already asserts).
- **Jest — content model** (extend `src/plugins/dataflow/model/dataflow-content.test.ts`): the new
  palette-open volatile defaults closed, toggles via its action, and is excluded from snapshots
  (volatile — assert `getSnapshot` unchanged).
- **Jest — config/registration drift guard**: a test that reads `settings.dataflow.tools` from
  `src/clue/app-config.json` and asserts every string entry (and the name of every `[name, ...args]`
  entry) resolves via `getToolbarButtonInfo("dataflow", ...)` — so a future rename can't silently
  produce a missing toolbar button. Existing dataflow suites must keep passing.
- **Cypress:** `cypress/e2e/functional/tile_tests/dataflow_tile_keyboard_spec.js` asserts the tile's
  tab-focus order including `zoom-in-button`/`zoom-out-button` on the stage — update the focus-order
  array (the buttons leave the tile content's focus order; toolbar buttons are covered by the
  toolbar's own focus handling). Audit other dataflow specs for the old test ids. A new or extended
  spec exercising toolbar zoom/pan end-to-end is desirable but authored blind (Cypress cannot run in
  this dev environment) — written last, validated in CI.
- **Manual QA:** dataflow demo unit and neural-engineering — zoom in/out/fit from the toolbar, pan via
  flyout arrows and arrow keys, recorded-data mode disables the controls, marquee selection unchanged.

## Out of scope

- Tile Navigator (mini-map) for dataflow — possible follow-up ticket.
- Persisting zoom/pan; drag-to-pan or wheel zoom; changes to diagram-viewer or other rete tiles.
