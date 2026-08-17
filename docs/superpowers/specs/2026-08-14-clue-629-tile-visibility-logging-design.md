# CLUE-629: Tile scroll-into-focus (visibility) logging

Repo: `collaborative-learning`
Branch: `CLUE-629-tile-scroll-into-focus-logging` (off fresh `master`, independent of the in-review
CLUE-628 tile-focus PR)

## Goal

Researchers want to know **which tiles are on screen, and how much of each is showing**, as the
student interacts. A tile's visibility changes when the student **scrolls**, and also when the layout
reflows: **window resize**, **divider-position change** (the resources/workspace split), and **tile
(row) resize**. Today none of those layout changes are logged, and the only layout signal on any log
event is the boolean `navTabsOpen` (derived from `dividerPosition > kDividerMin`), which cannot tell a
half/half split from a fully-open resources panel.

## What we build

A single new log event, **`TILE_VISIBILITY_CHANGE`**, emitted (after the interaction settles) whenever
a tracked document's tile visibility may have changed. Each emission carries a snapshot of the
currently-visible tiles with their percentage visible. The four layout-changing causes are recorded
via a `cause` field, so "log the divider/window/tile-resize changes" and "report % visible per tile"
are the same event.

### Decisions (confirmed with product)

- **Scope: all full-document views** — the **editable workspace**, the **resources reading panel**,
  documents opened full in **Class Work / My Work** and **Sort Work**, and the **comparison** view.
  Exclude thumbnails and 4-up group cells. (Standalone doc-editor / iframe authoring hosts share the
  same full-view component but don't run in a logging-enabled mode, so they never emit.)
- **Percentage: vertical only** — `visibleHeight / tileHeight`. (A tile scrolled off the side reads as
  fully visible; documents scroll vertically, so this matches "scrolled into view".)
- **One event with a `cause` field** (not four event names).
- **Per-tile payload mirrors tile-copy events**: `tileId`, `tileType`, `tileTitle`, plus
  `percentVisible`. We deliberately omit the heavy `serializedObject` snapshot that copy events carry.
- **"Stopped" heuristic**: trailing `debounce(…, 500ms)`, `.flush()` on unmount.
- **Independent of CLUE-628.**

## The event

Append `TILE_VISIBILITY_CHANGE` to the `LogEventName` enum in `src/lib/logger-types.ts`. The enum is
**positional/unvalued** (members auto-number; the numeric value is reverse-looked-up via
`LogEventName[event]`), so it MUST be appended at the end — never inserted mid-list.

Payload:

```ts
{
  cause: "scroll" | "windowResize" | "dividerResize" | "tileResize" | "documentChange"
       | "commentsToggle" | "comparisonToggle",
  documentId,        // the document whose visibility is reported (key, or curriculum section path)
  documentType,      // saved docs only — problem/personal/learningLog/publication/…
  documentTitle,     // saved docs only, when the doc has a title
  documentOwner,     // saved docs only — owner uid (identifies whose doc, e.g. in Sort Work)
  tileCount,         // total tiles in the document (denominator: "how many of N are visible")
  viewportHeight,    // scroll container clientHeight, for context
  visibleTiles: [    // only tiles with percentVisible > 0, in document order
    { tileId, tileType, tileTitle, percentVisible }   // percentVisible: integer 0–100
  ],
  dividerPosition,   // present ONLY when cause === "dividerResize" (0 | 50 | 100)
  resizedRowId       // present ONLY when cause === "tileResize" (row height is the resize unit)
}
```

The vertical-geometry math and the params assembly are extracted into a pure module
(`src/components/document/tile-visibility.ts`) so they are unit-testable without mounting the heavy,
MobX-injected `DocumentContentComponent` (which has no existing test harness).

- `tileType` = the tile model's `content.type`; `tileTitle` = `getTileTitleForLogging(tileId, document)`
  (i.e. `content.getTile(tileId)?.computedTitle ?? "<no title>"`) — both pulled from the document
  content model, not the DOM.
- Emit through `Logger.log(LogEventName.TILE_VISIBILITY_CHANGE, params)` with document context
  attached (documentId/type/etc., following the existing document-event helpers). The transport-layer
  `isLoggingEnabled` guard already excludes researchers and non-authed modes, so no call-site guard is
  needed.

## Visibility computation (vertical %)

Add `computeVisibleTiles(): VisibleTile[]` to `DocumentContentComponent`
(`src/components/document/document-content.tsx`), which already owns the `.document-content` scroll
container ref (`this.domElement`) and already computes a row-level version in `updateVisibleRows`
(bottom-edge-only, `:231-254`).

```
containerRect = this.domElement.getBoundingClientRect()
for each tile node (this.domElement.querySelectorAll('.tool-tile[data-tool-id]')):
  tileRect = node.getBoundingClientRect()
  visibleH = max(0, min(tileRect.bottom, containerRect.bottom) − max(tileRect.top, containerRect.top))
  percentVisible = Math.round(visibleH / tileRect.height * 100)
  if percentVisible > 0: record { tileId: node.dataset.toolId, percentVisible }
```

Then enrich each record with `tileType`/`tileTitle` from the content model (`content.getTile(tileId)`).
Refactor so `updateVisibleRows` and `computeVisibleTiles` share one geometry pass/helper rather than
maintaining two independent rect scans.

## The "stopped" heuristic and emit

One shared debounced settle per instrumented component:

```ts
private settle = debounce((cause: VisibilityCause, extra?: object) => {
  const visibleTiles = this.computeVisibleTiles();
  Logger.log(LogEventName.TILE_VISIBILITY_CHANGE, {
    cause, documentId, tileCount, viewportHeight, visibleTiles, ...extra
  });
}, 500);
```

`.flush()` on `componentWillUnmount` so a pending snapshot isn't lost. A burst of scroll events (or a
resize drag) collapses to a single event ~500ms after motion stops.

**No event when the pane is collapsed / nothing is visible.** A collapsed pane (e.g. the resources
panel at `dividerPosition === kDividerMin`) keeps its `DocumentContentComponent` *mounted*, so global
triggers (window resize, `documentChange` on reload) still call the emit. The panel collapses via
`flex: 0` + `overflow-x: clip`, so the inner container can still report a non-zero width (and the
vertical-only `computeVisibleTiles` would still see "visible" tiles) — measured geometry is therefore
unreliable. So the emit keys off the app's own collapse state: it is skipped when the document is
inside a `.resizable-panel.collapsed` ancestor, and also skipped when `visibleTiles` is empty (an
on-screen but empty document). A document whose pane is collapsed is never reported.

## Triggers — wired per instrumented document (no global registry)

Each instrumented `DocumentContentComponent` wires its own four sources and always reports **itself**:

| Cause | Source | Call |
|---|---|---|
| `scroll` | existing `.document-content` scroll listener (`document-content.tsx:79/213`) | `settle("scroll")` |
| `tileResize` | row-height drag commit `handleRowResizeDrop` (`:809-817`) | `settle("tileResize", { resizedRowId })` (keyboard row-resize via `tile-row.tsx` is a deferred follow-up) |
| `windowResize` | `window.addEventListener("resize", …)` on mount (removed on unmount) | `settle("windowResize")` |
| `dividerResize` | MobX `reaction` on `persistentUI.dividerPosition` | `settle("dividerResize", { dividerPosition })` |
| `documentChange` | an instrumented view first shows a document (mount) or swaps to a different one — `content.contentId` changes (open new doc / switch resource tab or section) | `componentDidMount` + `componentDidUpdate` → `settle("documentChange")` |
| `commentsToggle` | the comment/chat panel opens or closes | MobX `reaction` on `persistentUI.showChatPanel` → `settle("commentsToggle")` |
| `comparisonToggle` | the comparison panel is shown/hidden — this both reflows the **primary** document (to half width) and reveals/hides the comparison document | MobX `reaction` on `persistentUI.problemWorkspace.comparisonVisible` → `settle("comparisonToggle")` |

(Showing a comparison document already mounts an instrumented full view, so the comparison doc itself
also emits a `documentChange`; the shared per-instance settle coalesces that with `comparisonToggle`
into one event for that view. The value of `comparisonToggle` is capturing the **primary** doc's
reflow, which no other trigger covers. A **group virtual** comparison document renders via a separate,
non-instrumented component and is out of scope.)

The `documentChange` snapshot rides the same 500ms settle, so a view that mounts (or swaps documents)
emits its initial visible-tiles snapshot once layout has settled. Switching a resource tab to a
non-document view (a thumbnail browser) has no instrumented `DocumentContentComponent`, so it stays
silent, as intended.

Consequence: a **global** change (window/divider) emits one event **per mounted instrumented
full-document view**, each with its own snapshot — which is what researchers want. The divider's new
position rides only on the `dividerResize` events.

We deliberately do **not** trigger off the generic container `ResizeObserver`/`useResizeDetector`
(`canvas.tsx:440`) — divider and window reflows already come through the explicit sources above, and
using the container observer too would double-count them.

## Scoping — which documents are instrumented

An explicit opt-in boolean prop (working name `logTileVisibility`), consumed in
`DocumentContentComponent`; only when set does the component wire the listeners/reaction and emit. It
rides the render funnel that already exists (every view bottoms out at `CanvasComponent` →
`DocumentContentComponent`, which already receives a `context` prop):

- **The full-view choke point is `EditableDocumentContent` → `OneUpCanvas`** (always `context="1-up"`),
  used for the **workspace, comparison, Class Work / My Work opened docs (`document-view.tsx`), and
  Sort Work opened docs (`sort-work-document-area.tsx`)** — and **never** for thumbnails or 4-up. So
  defaulting `logTileVisibility = true` inside `EditableDocumentContent` covers all four with no
  per-caller edits.
- **The one full view outside that funnel is the resources reading doc**
  (`navigation/problem-panel.tsx`), which calls `CanvasComponent` directly (`context="left-nav"`) —
  set the prop explicitly there.
- **Thumbnails** (`thumbnail/*`) and **4-up cells** (`four-up.tsx`) also call `CanvasComponent`
  directly but never set the prop, so they stay silent. (We avoid gating on the fragile `context`
  string set, whose thumbnail values literally include `"my-work"`/`"class-work"`.)

Plumbing (pass-through only, no gating logic): add `logTileVisibility?: boolean` to `canvas.tsx`
`IProps` (it already flows to `DocumentContentComponent` via `...others`), receive it in
`document-content.tsx`, and add + forward it through `editable-document-content.tsx`.

Note: the resources doc renders curriculum `section.content` rather than a saved document, so it has
no document key — the plan pins what identifier to log for it (e.g. the section path) in the
`documentId` slot.

## Testing (jest)

- **Geometry** (`computeVisibleTiles`): mock container + tile `getBoundingClientRect` → assert
  percentages for fully-visible (100), partial-top, partial-bottom, and fully-off (excluded).
- **Settle/heuristic**: fake timers → many `scroll` calls collapse to one event after 500ms;
  `.flush()` on unmount emits a pending snapshot.
- **Payload/cause**: mock `Logger.log`; assert `visibleTiles` entries carry `{tileId, tileType,
  tileTitle, percentVisible}`; `dividerPosition` present only on `dividerResize`; `resizedRowId`
  present only on `tileResize`.
- **Trigger wiring**: dispatch `window` resize → one event `cause:"windowResize"`; change
  `persistentUI.dividerPosition` → event `cause:"dividerResize"` with the new position; a row-height
  commit → event `cause:"tileResize"` with `resizedRowId`.
- **Gating**: a `CanvasComponent` mounted without the prop (thumbnail / 4-up) wires nothing and logs
  nothing; an `EditableDocumentContent`-based full view (and the resources doc) logs.

## Verification (manual)

Open a document with several tiles in `authed` mode with `?debug=logger` (or `DEBUG_LOGGER`). Scroll →
one `TILE_VISIBILITY_CHANGE` (`cause:"scroll"`) ~½s after stopping, with the right tiles/percentages.
Resize the window, toggle the divider between half and full, and drag a row's height → confirm one
event per change with the correct `cause` (and `dividerPosition`/`resizedRowId`). Repeat for a
document opened full in **Sort Work** and **Class Work** and for a **comparison** view (all reached via
`EditableDocumentContent`). Confirm free-running (no interaction) emits nothing, and that thumbnails
and 4-up cells stay silent.

## Known minor gap

A divider change while **zero** instrumented documents are mounted (workspace collapsed **and** the
resources panel showing a non-document tab) would not record the position. Rare; if researchers need
it, add a small global `dividerPosition` reaction that logs a document-less `TILE_VISIBILITY_CHANGE`
as a fallback.

## Critical files

- `src/lib/logger-types.ts` — append `TILE_VISIBILITY_CHANGE`.
- `src/components/document/document-content.tsx` — `computeVisibleTiles`, `settle`, scroll/window/
  divider/tile-resize wiring, `logTileVisibility` gating (refactor shared geometry with
  `updateVisibleRows`).
- `src/components/document/editable-document-content.tsx` — default `logTileVisibility` true; covers
  workspace, comparison, Class Work / My Work, and Sort Work full views via `OneUpCanvas`.
- `src/components/document/canvas.tsx` — add `logTileVisibility` to `IProps` (flows to
  `DocumentContent` via `...others`).
- `src/components/navigation/problem-panel.tsx` — set `logTileVisibility` on the resources
  `CanvasComponent` (the only full view outside the `EditableDocumentContent` funnel).
- `src/components/document/document-content.tsx` — `handleRowResizeDrop` fires `settle("tileResize", { resizedRowId })`.
- Reference (do not reinvent): `src/lib/logger.ts` (`createLogMessage`, `isLoggingEnabled`),
  `src/models/tiles/log/log-tile-document-event.ts` / `log-tile-copy-event.ts` (per-tile
  `tileId`/`tileType`/`tileTitle` shape), `src/lib/logger-utils.ts` (`getTileTitleForLogging`),
  `src/models/stores/persistent-ui/persistent-ui.ts` (`dividerPosition`, `setDividerPosition`).
