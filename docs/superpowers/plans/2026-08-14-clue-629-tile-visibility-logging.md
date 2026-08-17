# CLUE-629 Tile Visibility Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Log which tiles are on screen and what percent of each is vertically visible, emitting one `TILE_VISIBILITY_CHANGE` event (with a `cause`) after the student stops scrolling and on window-resize, divider-position-change, and row-resize reflows — for full-document views only.

**Architecture:** A pure, unit-tested helper module (`tile-visibility.ts`) does the vertical-% math and log-params assembly. `DocumentContentComponent` (which owns the scroll container) gathers tile geometry from the DOM, feeds the helper, and emits via `Logger.log`, debounced 500ms. An opt-in `logTileVisibility` prop, defaulted on in the `"1-up"` full-view canvas and the resources panel, keeps thumbnails/4-up silent.

**Tech Stack:** TypeScript, React (class components), MobX / mobx-react, lodash (`debounce`), jest.

**Spec:** `docs/superpowers/specs/2026-08-14-clue-629-tile-visibility-logging-design.md`

---

## File structure

- **Create** `src/components/document/tile-visibility.ts` — pure types, `computeVisibleTiles`, `buildVisibilityLogParams`. No React/DOM/MobX imports.
- **Create** `src/components/document/tile-visibility.test.ts` — unit tests for the two pure functions.
- **Modify** `src/lib/logger-types.ts` — append `TILE_VISIBILITY_CHANGE` to the `LogEventName` enum.
- **Modify** `src/components/document/document-content.tsx` — consume `logTileVisibility`; gather geometry; debounced emit; scroll / window / divider / row-resize triggers; unmount cleanup.
- **Modify** `src/components/document/canvas.tsx` — add `logTileVisibility?: boolean` to `IProps` (auto-forwards via `...others`).
- **Modify** `src/components/document/editable-document-content.tsx` — set `logTileVisibility={true}` on the `"1-up"` `CanvasComponent`.
- **Modify** `src/components/navigation/problem-panel.tsx` — set `logTileVisibility={true}` on the resources `CanvasComponent`.

---

## Task 1: Pure vertical-visibility math

**Files:**
- Create: `src/components/document/tile-visibility.ts`
- Test: `src/components/document/tile-visibility.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/components/document/tile-visibility.test.ts`:

```ts
import { computeVisibleTiles } from "./tile-visibility";
import type { ITileExtent, IViewportBounds } from "./tile-visibility";

const viewport: IViewportBounds = { top: 0, bottom: 100 };
const extent = (over: Partial<ITileExtent>): ITileExtent => ({
  tileId: "t", tileType: "Text", tileTitle: "T", top: 0, bottom: 50, height: 50, ...over
});

describe("computeVisibleTiles", () => {
  it("reports 100% for a fully-visible tile", () => {
    const result = computeVisibleTiles(viewport, [extent({ top: 10, bottom: 60, height: 50 })]);
    expect(result).toEqual([{ tileId: "t", tileType: "Text", tileTitle: "T", percentVisible: 100 }]);
  });

  it("reports a partial percent when the bottom is clipped", () => {
    // tile 80..180 (height 100); viewport bottom 100 => 20 of 100 visible
    const result = computeVisibleTiles(viewport, [extent({ top: 80, bottom: 180, height: 100 })]);
    expect(result[0].percentVisible).toBe(20);
  });

  it("reports a partial percent when the top is clipped", () => {
    // tile -40..60 (height 100); viewport top 0 => 60 of 100 visible
    const result = computeVisibleTiles(viewport, [extent({ top: -40, bottom: 60, height: 100 })]);
    expect(result[0].percentVisible).toBe(60);
  });

  it("rounds to a whole percent", () => {
    // tile 99..102 (height 3); viewport bottom 100 => 1 of 3 => 33
    const result = computeVisibleTiles(viewport, [extent({ top: 99, bottom: 102, height: 3 })]);
    expect(result[0].percentVisible).toBe(33);
  });

  it("omits tiles scrolled fully above or below, and zero-height tiles", () => {
    const result = computeVisibleTiles(viewport, [
      extent({ tileId: "above", top: -100, bottom: -10, height: 90 }),
      extent({ tileId: "below", top: 120, bottom: 210, height: 90 }),
      extent({ tileId: "zero", top: 10, bottom: 10, height: 0 })
    ]);
    expect(result).toEqual([]);
  });

  it("preserves input order among visible tiles", () => {
    const result = computeVisibleTiles(viewport, [
      extent({ tileId: "a", top: 0, bottom: 40, height: 40 }),
      extent({ tileId: "gone", top: 200, bottom: 240, height: 40 }),
      extent({ tileId: "b", top: 50, bottom: 90, height: 40 })
    ]);
    expect(result.map(t => t.tileId)).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/components/document/tile-visibility.test.ts`
Expected: FAIL — `Cannot find module './tile-visibility'`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/components/document/tile-visibility.ts`:

```ts
// Pure helpers for CLUE-629 tile-visibility logging. Deliberately free of React / DOM / MobX so the
// vertical-% math and the log-params assembly can be unit-tested without mounting DocumentContent.

export type VisibilityCause = "scroll" | "windowResize" | "dividerResize" | "tileResize";

export interface IVisibleTile {
  tileId: string;
  tileType: string;
  tileTitle: string;
  percentVisible: number; // whole percent, 1..100 (tiles at 0 are dropped)
}

/** A tile's vertical extent, in the same coordinate space as the viewport bounds. */
export interface ITileExtent {
  tileId: string;
  tileType: string;
  tileTitle: string;
  top: number;
  bottom: number;
  height: number;
}

export interface IViewportBounds {
  top: number;
  bottom: number;
}

/**
 * For each tile, the fraction of its height inside the viewport, rounded to a whole percent. Tiles
 * with 0% visible (scrolled off, or zero height) are omitted. Input order is preserved.
 */
export function computeVisibleTiles(viewport: IViewportBounds, tiles: ITileExtent[]): IVisibleTile[] {
  const visible: IVisibleTile[] = [];
  for (const tile of tiles) {
    if (tile.height <= 0) continue;
    const overlap = Math.min(tile.bottom, viewport.bottom) - Math.max(tile.top, viewport.top);
    const percentVisible = Math.round((Math.max(0, overlap) / tile.height) * 100);
    if (percentVisible > 0) {
      visible.push({
        tileId: tile.tileId,
        tileType: tile.tileType,
        tileTitle: tile.tileTitle,
        percentVisible
      });
    }
  }
  return visible;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/components/document/tile-visibility.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/document/tile-visibility.ts src/components/document/tile-visibility.test.ts
git commit -m "feat(CLUE-629): pure vertical tile-visibility computation"
```

---

## Task 2: Pure log-params assembly

**Files:**
- Modify: `src/components/document/tile-visibility.ts`
- Test: `src/components/document/tile-visibility.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `src/components/document/tile-visibility.test.ts`:

```ts
import { buildVisibilityLogParams } from "./tile-visibility";

describe("buildVisibilityLogParams", () => {
  const tiles = [{ tileId: "t1", tileType: "Text", tileTitle: "A", percentVisible: 100 }];

  it("includes the core fields and no cause-specific fields for scroll", () => {
    const p = buildVisibilityLogParams("scroll", "doc1", 640, 3, tiles);
    expect(p).toEqual({
      cause: "scroll", documentId: "doc1", viewportHeight: 640, tileCount: 3, visibleTiles: tiles
    });
  });

  it("adds dividerPosition only for dividerResize", () => {
    const p = buildVisibilityLogParams("dividerResize", "doc1", 640, 3, tiles, { dividerPosition: 100 });
    expect(p.dividerPosition).toBe(100);
    expect(p.resizedRowId).toBeUndefined();
  });

  it("adds resizedRowId only for tileResize", () => {
    const p = buildVisibilityLogParams("tileResize", "doc1", 640, 3, tiles, { resizedRowId: "row9" });
    expect(p.resizedRowId).toBe("row9");
    expect(p.dividerPosition).toBeUndefined();
  });

  it("ignores cause-specific extras that do not match the cause", () => {
    const p = buildVisibilityLogParams("scroll", "doc1", 640, 3, tiles, { dividerPosition: 50, resizedRowId: "r" });
    expect(p.dividerPosition).toBeUndefined();
    expect(p.resizedRowId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/components/document/tile-visibility.test.ts -t buildVisibilityLogParams`
Expected: FAIL — `buildVisibilityLogParams is not a function` / not exported.

- [ ] **Step 3: Implement**

Append to `src/components/document/tile-visibility.ts`:

```ts
export interface IVisibilityLogExtra {
  dividerPosition?: number;
  resizedRowId?: string;
}

/** Assembles TILE_VISIBILITY_CHANGE params, attaching each cause-specific field only for its cause. */
export function buildVisibilityLogParams(
  cause: VisibilityCause,
  documentId: string | undefined,
  viewportHeight: number,
  tileCount: number,
  visibleTiles: IVisibleTile[],
  extra: IVisibilityLogExtra = {}
): Record<string, any> {
  const params: Record<string, any> = { cause, documentId, viewportHeight, tileCount, visibleTiles };
  if (cause === "dividerResize" && extra.dividerPosition != null) {
    params.dividerPosition = extra.dividerPosition;
  }
  if (cause === "tileResize" && extra.resizedRowId != null) {
    params.resizedRowId = extra.resizedRowId;
  }
  return params;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/components/document/tile-visibility.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/document/tile-visibility.ts src/components/document/tile-visibility.test.ts
git commit -m "feat(CLUE-629): assemble tile-visibility log params by cause"
```

---

## Task 3: Add the `TILE_VISIBILITY_CHANGE` event name

**Files:**
- Modify: `src/lib/logger-types.ts` (the tail of the `LogEventName` enum)

- [ ] **Step 1: Append the enum member**

The enum is positional/unvalued, so it MUST be appended at the very end (never inserted mid-list). Find the last members:

```ts
  CREATE_CUSTOM_COMMENT_TAG,
}
```

Change to:

```ts
  CREATE_CUSTOM_COMMENT_TAG,

  TILE_VISIBILITY_CHANGE,
}
```

- [ ] **Step 2: Verify it compiles / is referenceable**

Run: `npx jest src/components/document/tile-visibility.test.ts`
Expected: PASS (unchanged — this task only adds a constant; it is consumed in Task 5).

- [ ] **Step 3: Commit**

```bash
git add src/lib/logger-types.ts
git commit -m "feat(CLUE-629): add TILE_VISIBILITY_CHANGE log event name"
```

---

## Task 4: Thread the `logTileVisibility` opt-in prop and turn it on

**Files:**
- Modify: `src/components/document/canvas.tsx:33` (add to `IProps`)
- Modify: `src/components/document/document-content.tsx:25-36` (add to `IProps`)
- Modify: `src/components/document/editable-document-content.tsx:28-39` (set on `"1-up"` canvas)
- Modify: `src/components/navigation/problem-panel.tsx:53-56` (set on resources canvas)

- [ ] **Step 1: Add the prop to `CanvasComponent`'s `IProps`**

In `src/components/document/canvas.tsx`, inside `interface IProps { … }` (starts at line 33), add:

```ts
  logTileVisibility?: boolean;
```

No other change is needed in canvas.tsx: `renderContent()` destructures `const {content, document, showPlayback, viaTeacherDashboard, ...others} = this.props;` and spreads `...others` into `DocumentContentComponent`, so `logTileVisibility` forwards automatically.

- [ ] **Step 2: Add the prop to `DocumentContentComponent`'s `IProps`**

In `src/components/document/document-content.tsx`, inside `interface IProps extends IBaseProps { … }` (lines 25-36), add:

```ts
  logTileVisibility?: boolean;
```

- [ ] **Step 3: Turn it on for the `"1-up"` full-view canvas**

In `src/components/document/editable-document-content.tsx`, the `OneUpCanvas` component (lines 28-39) renders the `"1-up"` canvas used by the workspace, comparison, Class Work / My Work, and Sort Work full views. Change:

```tsx
    <CanvasComponent
      context="1-up"
      document={document}
      {...others}
    />
```

to:

```tsx
    <CanvasComponent
      context="1-up"
      logTileVisibility={true}
      document={document}
      {...others}
    />
```

- [ ] **Step 4: Turn it on for the resources reading panel**

In `src/components/navigation/problem-panel.tsx`, the `CanvasComponent` (lines 53-56) renders the resources doc. Change:

```tsx
            <CanvasComponent
              content={content}
              context="left-nav"
              readOnly={true}
```

to add the prop:

```tsx
            <CanvasComponent
              content={content}
              context="left-nav"
              logTileVisibility={true}
              readOnly={true}
```

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no new errors. (If the project's `tsc` isn't configured for a bare `--noEmit`, run `npm run lint:build:src` instead.)

Run: `npm run lint -- src/components/document/canvas.tsx src/components/document/document-content.tsx src/components/document/editable-document-content.tsx src/components/navigation/problem-panel.tsx`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/document/canvas.tsx src/components/document/document-content.tsx src/components/document/editable-document-content.tsx src/components/navigation/problem-panel.tsx
git commit -m "feat(CLUE-629): thread logTileVisibility opt-in to full-document views"
```

---

## Task 5: Emit `TILE_VISIBILITY_CHANGE` on scroll

**Files:**
- Modify: `src/components/document/document-content.tsx` (imports, private fields, gather+emit, scroll trigger)

This task has no unit test: `DocumentContentComponent` is a MobX-injected class component with no existing test harness, and the emit reads live DOM geometry. Its logic is already covered by the Task 1–2 unit tests; the wiring is verified by typecheck/lint here and the manual checklist in Task 8.

- [ ] **Step 1: Add imports**

In `src/components/document/document-content.tsx`, update the lodash import (line 4) from:

```ts
import { throttle } from "lodash";
```

to:

```ts
import { debounce, throttle } from "lodash";
```

Then add these imports below the existing import block (after line 21, before the `import "./document-content.scss";` line):

```ts
import { Logger } from "../../lib/logger";
import { LogEventName } from "../../lib/logger-types";
import { buildVisibilityLogParams, computeVisibleTiles } from "./tile-visibility";
import type { ITileExtent, IVisibilityLogExtra, VisibilityCause } from "./tile-visibility";
```

- [ ] **Step 2: Add the debounced emit and geometry gather as class members**

In `src/components/document/document-content.tsx`, add these members to the `DocumentContentComponent` class (place them just before `private updateVisibleRows = () => {` at line 231):

```ts
  // CLUE-629: gather each rendered tile's vertical extent + type/title, then log the visible ones.
  private emitTileVisibility = (cause: VisibilityCause, extra: IVisibilityLogExtra = {}) => {
    const { content } = this.props;
    if (!this.domElement || !content) return;
    const containerRect = this.domElement.getBoundingClientRect();
    const nodes = this.domElement.querySelectorAll<HTMLElement>(".tool-tile[data-tool-id]");
    const tiles: ITileExtent[] = [];
    nodes.forEach((node) => {
      const tileId = node.dataset.toolId;
      if (!tileId) return;
      const rect = node.getBoundingClientRect();
      const tile = content.getTile(tileId);
      tiles.push({
        tileId,
        tileType: tile?.content.type ?? "unknown",
        tileTitle: tile?.computedTitle ?? "<no title>",
        top: rect.top,
        bottom: rect.bottom,
        height: rect.height
      });
    });
    const visibleTiles = computeVisibleTiles({ top: containerRect.top, bottom: containerRect.bottom }, tiles);
    const documentId = this.props.documentId ?? getDocumentIdentifier(content);
    const params = buildVisibilityLogParams(
      cause, documentId, containerRect.height, tiles.length, visibleTiles, extra
    );
    Logger.log(LogEventName.TILE_VISIBILITY_CHANGE, params);
  };

  // Trailing debounce = "the student stopped scrolling / dragging"; one event ~500ms after motion ends.
  private settleVisibilityLog = debounce((cause: VisibilityCause, extra?: IVisibilityLogExtra) => {
    this.emitTileVisibility(cause, extra);
  }, 500);
```

- [ ] **Step 3: Fire it on scroll**

In `src/components/document/document-content.tsx`, the `handleScroll` handler (lines 299-305) currently ends:

```ts
  private handleScroll = throttle((e: React.UIEvent<HTMLDivElement>) => {
    const tileApiInterface = this.context;
    const xScroll = this.domElement?.scrollLeft || 0;
    const yScroll = this.domElement?.scrollTop || 0;
    tileApiInterface?.forEach(api => api.handleDocumentScroll?.(xScroll, yScroll));
    this.props.onScroll?.(xScroll, yScroll);
  }, 50);
```

Add the visibility call before the closing `}, 50);`:

```ts
  private handleScroll = throttle((e: React.UIEvent<HTMLDivElement>) => {
    const tileApiInterface = this.context;
    const xScroll = this.domElement?.scrollLeft || 0;
    const yScroll = this.domElement?.scrollTop || 0;
    tileApiInterface?.forEach(api => api.handleDocumentScroll?.(xScroll, yScroll));
    this.props.onScroll?.(xScroll, yScroll);
    if (this.props.logTileVisibility) this.settleVisibilityLog("scroll");
  }, 50);
```

- [ ] **Step 4: Typecheck, lint, and run the unit suite**

Run: `npx tsc --noEmit`  (fallback: `npm run lint:build:src`)
Expected: no new errors.

Run: `npm run lint -- src/components/document/document-content.tsx`
Expected: clean.

Run: `npx jest src/components/document/tile-visibility.test.ts`
Expected: PASS (still 10 — unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/components/document/document-content.tsx
git commit -m "feat(CLUE-629): emit TILE_VISIBILITY_CHANGE on scroll settle"
```

---

## Task 6: Window-resize and divider-change triggers + unmount cleanup

**Files:**
- Modify: `src/components/document/document-content.tsx` (private disposer + window handler, `componentDidMount`, `componentWillUnmount`)

- [ ] **Step 1: Add a disposer field and a window-resize handler**

In `src/components/document/document-content.tsx`, add a field alongside the other private disposers (after `private pickUpReactionDisposer: IReactionDisposer;` at line 65):

```ts
  private visibilityDividerDisposer?: IReactionDisposer;
```

Add the window handler next to `emitTileVisibility` / `logTileVisibility` (from Task 5):

```ts
  private handleWindowResizeForVisibility = () => this.settleVisibilityLog("windowResize");
```

- [ ] **Step 2: Wire the triggers in `componentDidMount`**

In `componentDidMount` (inside the `if (this.domElement) { … }` block), add this at the end of the block, immediately before its closing `}` (i.e., after the `this.scrollDisposer = reaction( … );` assignment that ends at line 147):

```ts
      if (this.props.logTileVisibility) {
        window.addEventListener("resize", this.handleWindowResizeForVisibility);
        this.visibilityDividerDisposer = reaction(
          () => this.stores.persistentUI.dividerPosition,
          (dividerPosition) => this.settleVisibilityLog("dividerResize", { dividerPosition })
        );
      }
```

- [ ] **Step 3: Clean up in `componentWillUnmount`**

The current `componentWillUnmount` (lines 151-157):

```ts
  public componentWillUnmount() {
    this.scrollDisposer?.();
    this.pickUpReactionDisposer?.();
    document.removeEventListener("keydown", this.handlePickUpKeyDown);
    this.domElement?.removeEventListener("mousemove", this.handlePickUpMouseMove);
    this.domElement?.removeEventListener("mouseleave", this.handlePickUpMouseLeave);
  }
```

Change to:

```ts
  public componentWillUnmount() {
    this.scrollDisposer?.();
    this.pickUpReactionDisposer?.();
    document.removeEventListener("keydown", this.handlePickUpKeyDown);
    this.domElement?.removeEventListener("mousemove", this.handlePickUpMouseMove);
    this.domElement?.removeEventListener("mouseleave", this.handlePickUpMouseLeave);
    // CLUE-629: stop visibility triggers and flush any pending snapshot (DOM is still mounted here).
    window.removeEventListener("resize", this.handleWindowResizeForVisibility);
    this.visibilityDividerDisposer?.();
    this.settleVisibilityLog.flush();
  }
```

- [ ] **Step 4: Typecheck, lint, unit suite**

Run: `npx tsc --noEmit`  (fallback: `npm run lint:build:src`)
Expected: no new errors.

Run: `npm run lint -- src/components/document/document-content.tsx`
Expected: clean.

Run: `npx jest src/components/document/tile-visibility.test.ts`
Expected: PASS (10).

- [ ] **Step 5: Commit**

```bash
git add src/components/document/document-content.tsx
git commit -m "feat(CLUE-629): log visibility on window resize and divider change"
```

---

## Task 7: Row-resize (tile-resize) trigger

**Files:**
- Modify: `src/components/document/document-content.tsx` (`handleRowResizeDrop`, lines 809-817)

- [ ] **Step 1: Fire on the row-height drag commit**

The current `handleRowResizeDrop` (lines 809-817):

```ts
  private handleRowResizeDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const { content } = this.props;
    const dragResizeRow = this.getDragResizeRowInfo(e);
    if (content && dragResizeRow?.id && dragResizeRow.newHeight != null) {
      const row = content.getRowRecursive(dragResizeRow.id);
      row?.setRowHeight(dragResizeRow.newHeight);
      this.setState({ dragResizeRow: undefined });
    }
  };
```

Change to add the visibility call after the height is set:

```ts
  private handleRowResizeDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const { content } = this.props;
    const dragResizeRow = this.getDragResizeRowInfo(e);
    if (content && dragResizeRow?.id && dragResizeRow.newHeight != null) {
      const row = content.getRowRecursive(dragResizeRow.id);
      row?.setRowHeight(dragResizeRow.newHeight);
      this.setState({ dragResizeRow: undefined });
      if (this.props.logTileVisibility) {
        this.settleVisibilityLog("tileResize", { resizedRowId: dragResizeRow.id });
      }
    }
  };
```

(Keyboard-driven row resize via `tile-row.tsx` is a deliberate deferred follow-up, per the spec.)

- [ ] **Step 2: Typecheck, lint, unit suite**

Run: `npx tsc --noEmit`  (fallback: `npm run lint:build:src`)
Expected: no new errors.

Run: `npm run lint -- src/components/document/document-content.tsx`
Expected: clean.

Run: `npx jest src/components/document/tile-visibility.test.ts`
Expected: PASS (10).

- [ ] **Step 3: Commit**

```bash
git add src/components/document/document-content.tsx
git commit -m "feat(CLUE-629): log visibility on row-resize"
```

---

## Task 8: Full verification and manual QA

**Files:** none (verification only)

- [ ] **Step 1: Run the full lint and the visibility unit tests**

Run: `npm run lint`
Expected: clean.

Run: `npx jest src/components/document/tile-visibility.test.ts`
Expected: PASS (10).

- [ ] **Step 2: Run the broader document/logger test suites to catch regressions**

Run: `npx jest src/components/document src/lib/logger`
Expected: PASS (no regressions from the `document-content.tsx` edits).

- [ ] **Step 3: Manual QA in the running app**

Start the app (`npm start`) in an `authed`-logging context (or set `DEBUG_LOGGER`), open the browser console / `?debug=logger`, open a document with several tiles, and confirm:

1. **Scroll** the workspace, then stop → exactly one `TILE_VISIBILITY_CHANGE` with `cause:"scroll"` ~½s later, listing the on-screen tiles with sane `percentVisible`, each entry carrying `tileId`/`tileType`/`tileTitle`, plus `tileCount`.
2. **Resize the window** → one event `cause:"windowResize"` per instrumented panel.
3. **Toggle the divider** between half and full → event(s) `cause:"dividerResize"` carrying the new `dividerPosition` (50 vs 100).
4. **Drag a row's height** → one event `cause:"tileResize"` with `resizedRowId`.
5. Open a document **full in Sort Work** and in **Class Work**, and a **comparison** view → scrolling each emits events (all reach the `"1-up"` canvas).
6. **No interaction** (idle) → no events.
7. **Thumbnails** and **4-up** cells → no events while scrolling/hovering them.

- [ ] **Step 4: Final commit (if any doc/QA notes were added)**

```bash
git add -A
git commit -m "chore(CLUE-629): verification notes" --allow-empty
```

---

## Notes for the implementer

- **Why a pure module?** `DocumentContentComponent` is MobX-injected and reads live DOM geometry; there's no existing harness to mount it in jest. Keeping the math and the params-shape in `tile-visibility.ts` gives real TDD coverage of the logic; the component is thin glue verified by typecheck + manual QA.
- **`documentId` for the resources doc:** the resources panel passes `content` (curriculum section content) rather than a saved document, so `this.props.documentId` is undefined there; `getDocumentIdentifier(content)` supplies the fallback identifier.
- **Do not** add a `ResizeObserver`/`useResizeDetector` trigger — window and divider reflows already come through the explicit handlers, and the container observer would double-count them.
- **Known minor gap (accepted):** a divider change while zero instrumented documents are mounted won't record the position. Out of scope; add a global fallback later only if researchers need it.
