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

- **Scope: two document views** — the main **editable workspace** document and the **resources
  reading panel** document. Exclude thumbnails, 4-up cells, doc-editor, and comparison views.
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
  cause: "scroll" | "windowResize" | "dividerResize" | "tileResize",
  documentId,        // the document whose visibility is reported
  tileCount,         // total tiles in the document (denominator: "how many of N are visible")
  viewportHeight,    // scroll container clientHeight, for context
  visibleTiles: [    // only tiles with percentVisible > 0, in document order
    { tileId, tileType, tileTitle, percentVisible }   // percentVisible: integer 0–100
  ],
  dividerPosition,   // present ONLY when cause === "dividerResize" (0 | 50 | 100)
  resizedTileId      // present ONLY when cause === "tileResize"
}
```

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

## Triggers — wired per instrumented document (no global registry)

Each instrumented `DocumentContentComponent` wires its own four sources and always reports **itself**:

| Cause | Source | Call |
|---|---|---|
| `scroll` | existing `.document-content` scroll listener (`document-content.tsx:79/213`) | `settle("scroll")` |
| `tileResize` | row-height commit paths `handleRowResizeDrop` (`:809-817`), `handleRequestRowHeight` (`tile-row.tsx:151-159`) | `settle("tileResize", { resizedTileId })` |
| `windowResize` | `window.addEventListener("resize", …)` on mount (removed on unmount) | `settle("windowResize")` |
| `dividerResize` | MobX `reaction` on `persistentUI.dividerPosition` | `settle("dividerResize", { dividerPosition })` |

Consequence: a **global** change (window/divider) with both panels mounted emits one event **per
panel** (workspace + resources), each with its own snapshot — which is what researchers want. The
divider's new position rides only on the `dividerResize` events.

We deliberately do **not** trigger off the generic container `ResizeObserver`/`useResizeDetector`
(`canvas.tsx:440`) — divider and window reflows already come through the explicit sources above, and
using the container observer too would double-count them.

## Scoping — which documents are instrumented

An explicit opt-in boolean prop (working name `logTileVisibility`) threaded to
`DocumentContentComponent` from exactly two mount sites:

- **Workspace**: `EditableDocumentContent` → `OneUpCanvas` → `CanvasComponent` → `DocumentContent`
  (`src/components/document/editable-document-content.tsx`).
- **Resources reading doc**: `src/components/navigation/problem-panel.tsx`.

Only when the prop is set does the component wire the listeners/reaction and emit. This avoids fragile
`readOnly`/document-type heuristics and keeps thumbnails, 4-up, doc-editor, and comparison views
silent. Pinning the exact prop-threading path through the `Canvas`/`DocumentContent` layers is the
first task of the implementation plan.

## Testing (jest)

- **Geometry** (`computeVisibleTiles`): mock container + tile `getBoundingClientRect` → assert
  percentages for fully-visible (100), partial-top, partial-bottom, and fully-off (excluded).
- **Settle/heuristic**: fake timers → many `scroll` calls collapse to one event after 500ms;
  `.flush()` on unmount emits a pending snapshot.
- **Payload/cause**: mock `Logger.log`; assert `visibleTiles` entries carry `{tileId, tileType,
  tileTitle, percentVisible}`; `dividerPosition` present only on `dividerResize`; `resizedTileId`
  present only on `tileResize`.
- **Trigger wiring**: dispatch `window` resize → one event `cause:"windowResize"`; change
  `persistentUI.dividerPosition` → event `cause:"dividerResize"` with the new position; a row-height
  commit → event `cause:"tileResize"` with `resizedTileId`.
- **Gating**: a document mounted without `logTileVisibility` wires nothing and logs nothing.

## Verification (manual)

Open a document with several tiles in `authed` mode with `?debug=logger` (or `DEBUG_LOGGER`). Scroll →
one `TILE_VISIBILITY_CHANGE` (`cause:"scroll"`) ~½s after stopping, with the right tiles/percentages.
Resize the window, toggle the divider between half and full, and drag a row's height → confirm one
event per change with the correct `cause` (and `dividerPosition`/`resizedTileId`). Confirm free-running
(no interaction) emits nothing, and that thumbnails/4-up stay silent.

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
- `src/components/document/editable-document-content.tsx`, `canvas.tsx` — thread `logTileVisibility`
  to the workspace document.
- `src/components/navigation/problem-panel.tsx` — thread `logTileVisibility` to the resources doc.
- `src/components/document/tile-row.tsx` — `resizedTileId` on row-height commit.
- Reference (do not reinvent): `src/lib/logger.ts` (`createLogMessage`, `isLoggingEnabled`),
  `src/models/tiles/log/log-tile-document-event.ts` / `log-tile-copy-event.ts` (per-tile
  `tileId`/`tileType`/`tileTitle` shape), `src/lib/logger-utils.ts` (`getTileTitleForLogging`),
  `src/models/stores/persistent-ui/persistent-ui.ts` (`dividerPosition`, `setDividerPosition`).
