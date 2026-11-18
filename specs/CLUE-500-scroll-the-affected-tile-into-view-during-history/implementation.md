# Implementation Plan: Scroll the Affected Tile Into View During History Playback

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-500
**Requirements Spec**: [requirements.md](requirements.md)
**Status**: **In Development**

## Implementation Plan

The work splits into a model half and a view half that meet at one observable value: `TreeManager.playbackRevealRequest`, the tile the last reader-started playback move changed. The TreeManager of the history copy sets it after a move; `CanvasComponent` passes it to the history view's `DocumentContentComponent`, which scrolls its own container. Nothing is added to the document's MST tree, so the request never reaches the history the document records, and the live document's TreeManager never sets it because it never makes playback moves.

The plan builds on CLUE-760 (background history entries, PR #3074, now merged to master), which changes the playback model's seek queue and how links seek. The code below was built as throwaway code and checked: the tile choice against ten moves over recorded entries on master, then on CLUE-760's branch the background-entry cases, the seek-queue option, and the whole chain in jsdom through the real `CanvasComponent` (see Verification).

---

### Give the history view room below its last tile

**Summary**: The history view's last tile cannot scroll above the playback bar in a read-only view today, because nothing passes `showPlaybackSpacer` (R6). Pass it, and size the spacer from one shared bar height. This stands alone: it fixes the last tile being stuck under the bar when a reader scrolls by hand, too.

**Files affected**:
- `src/components/vars.scss`: add `$playback-bar-height`.
- `src/components/playback/playback.scss`: the bar's height uses it.
- `src/components/document/document-content.scss`: both spacer heights use it.
- `src/components/document/canvas.tsx`: pass `showPlaybackSpacer`.
- `src/components/document/canvas.test.tsx`: spacer test.

**Estimated diff size**: ~40 lines

`vars.scss`, after `$playback-alert-height`:

```scss
// The playback bar covers this much of the bottom of the document it plays back.
$playback-bar-height: 49px;
```

`playback.scss`, in `.playback-component`: `height: 49px;` becomes `height: $playback-bar-height;`.

`document-content.scss`:

```scss
  .spacer {
    height: 300px;

    &.playback-spacer {
      height: calc(300px + #{$playback-bar-height});
    }
    ...
  }

  .playback-spacer {
    height: $playback-bar-height;
  }
```

`canvas.tsx`, `renderContent`, on the `DocumentContentComponent`:

```tsx
            showPlaybackSpacer={showPlayback && showPlaybackControls}
```

**Test** (`canvas.test.tsx`): render a document with `showPlaybackControls` on and `showPlayback`, and assert the `document-content` pane contains a `.playback-spacer`; render it with playback controls off and assert it does not. With playback on, the canvas builds a `FirestoreHistoryManager` for the history copy, which fails with "No Firebase App" under jsdom, so the test spies `subscribeToFirestoreHistory` and `waitUntilEnvironmentAndMetadataDocReady` the way the neighboring playback tests do. Mutation caught: dropping the new prop.

---

### Find the tile a playback move changed

**Summary**: A pure function that reads the history entries a move crossed and names the tile to reveal (R2 to R4, R8). It has no caller yet, so it lands with its tests alone.

**Files affected**:
- `src/models/document/document-paths.ts`: add `kRowMapPath` and `kRowSubtreeRegex`.
- `src/models/history/playback-reveal.ts`: new.
- `src/models/history/playback-reveal.test.ts`: new.

**Estimated diff size**: ~200 lines

`document-paths.ts`:

```ts
export const kRowMapPath = `${kContentPath}/rowMap`;
...
/** A top-level row or anything inside it. Group 1 is the row id. */
export const kRowSubtreeRegex = new RegExp(`^${kRowMapPath}/([^/]+)(/|$)`);
```

`playback-reveal.ts`:

```ts
import { IJsonPatch } from "mobx-state-tree";
import { DocumentContentModelType } from "../document/document-content";
import {
  kRowSubtreeRegex, kSharedModelEntrySubtreeRegex, kTileSubtreePartsRegex
} from "../document/document-paths";
import { isBackgroundEntry } from "./background-entries";
import { getEntryPatchesForTree, HistoryEntryType, HistoryOperation } from "./history";

// Every tile linked to a shared model gets this patch when the shared model changes, whatever
// changed, so it does not mark the tile itself as changed.
const kUpdatedHashSubpath = "/updatedHash";

/**
 * The tile a set of patches changed that exists in `content`, for history playback to bring on
 * screen. A tile the patches changed comes first, then a tile linked to a shared model they
 * changed, then a tile in a row they changed. Within each, the first in patch order wins.
 */
export function getChangedTileId(patches: readonly IJsonPatch[], content: DocumentContentModelType) {
  const tileIds: string[] = [];
  const sharedModelIds: string[] = [];
  const rowIds: string[] = [];
  patches.forEach(({ path }) => {
    const tileMatch = kTileSubtreePartsRegex.exec(path);
    if (tileMatch) {
      if (tileMatch[2] !== kUpdatedHashSubpath) tileIds.push(tileMatch[1]);
      return;
    }
    const sharedMatch = kSharedModelEntrySubtreeRegex.exec(path);
    if (sharedMatch) {
      sharedModelIds.push(sharedMatch[1]);
      return;
    }
    const rowMatch = kRowSubtreeRegex.exec(path);
    if (rowMatch) rowIds.push(rowMatch[1]);
  });
  const linkedTileIds = sharedModelIds.flatMap(id => content.sharedModelMap.get(id)?.tiles.map(tile => tile.id) ?? []);
  const rowTileIds = rowIds.flatMap(id => content.getRow(id)?.tileIds ?? []);
  return [...tileIds, ...linkedTileIds, ...rowTileIds].find(id => content.getTile(id));
}

/**
 * The tile a playback move from history position `from` to `to` changed, as `getChangedTileId`
 * picks it from the entry nearest the move's end: the last one applied going forward, the last
 * one undone going backward. Background entries (program ticks, load entries) are passed over,
 * since the slider shows only the changes people made. `content` is the document after the move.
 */
export function getPlaybackRevealTileId(args: {
  history: { at(index: number): HistoryEntryType | undefined };
  treeId: string;
  from: number;
  to: number;
  content: DocumentContentModelType;
}) {
  const { history, treeId, from, to, content } = args;
  const forward = to > from;
  const opType = forward ? HistoryOperation.Redo : HistoryOperation.Undo;
  const step = forward ? -1 : 1;
  for (let index = forward ? to - 1 : to; forward ? index >= from : index < from; index += step) {
    const entry = history.at(index);
    if (entry && !isBackgroundEntry(entry)) {
      return getChangedTileId(getEntryPatchesForTree(entry, treeId, opType), content);
    }
  }
  return undefined;
}
```

Notes:
- The three tiers are concatenated and the first id that exists wins, so a tier whose tiles are all gone falls through to the next (a deleted tile's row that still holds another tile, R3 tier 3).
- `sharedModelMap` entries hold `safeReference`s with `acceptsUndefined: false`, so a deleted linked tile is already gone from `tiles`; `getTile` still guards the id.
- Tiles inside a Question tile live in the same flat `tileMap`, so tier 1 finds them (R8). The Question tile's own embedded rows are under `/content/tileMap/<questionId>/content/rowMap`, so a move inside a Question tile names the Question tile.

**Tests** (`playback-reveal.test.ts`). A `recordHistory()` helper builds a document with Text and Table tiles registered, enables its tree monitor, and records six entries with `expectEntryToBeComplete` after each: 0 add Text, 1 add Table, 2 set the Text tile's text, 3 add a case to the Table's data set (`addCanonicalCasesWithIDs`), 4 move the Table's row above the Text row (`userMoveTiles` with `rowDropLocation: "top"`), 5 delete the Text tile. It then sets `setNumHistoryEntriesApplied(6)` and moves the real TreeManager with `goToHistoryEntryPosition` before each check, so `content` is the document after that move. Firebase is mocked as in the other history tests. Each case and the result the throwaway run produced:

| Move | Entry | Expected |
|---|---|---|
| 6 to 5 | undo delete | the Text tile (tier 1, tile re-added) |
| 5 to 4 | undo row move | the Table (tier 3) |
| 4 to 3 | undo data set edit | the Table (tier 2; its `updatedHash` patch is skipped) |
| 3 to 2 | undo text edit | the Text tile |
| 2 to 1 | undo add Table | undefined (R4) |
| 1 to 0 | undo add Text | undefined (R4) |
| 0 to 3 | three entries forward | the Text tile (entry 2, nearest the end) |
| 3 to 4 | data set edit | the Table |
| 4 to 6 | move then delete | undefined (entry 5 deleted the only tile in its row) |
| 6 to 1 | five entries back | undefined (entry 1, nearest the end, removed the Table) |

Plus cases on hand-built entries against the same content (both tiles present, at position 4):
- a load entry (`isLoadEntry: true`, `background: true`, a patch on the Text tile) at the end of a forward move is passed over for the entry before it, which names the Table;
- a move across only a load entry gives undefined;
- with entries user on the Text tile, tick on the Table (`background: true`), tick, user on the Text tile, tick (user stops at 1 and 4, latest at 5): 4 to 1 names the Text tile (the user entry 3, not the tick at 1); 1 to 4 and 0 to 5 name the Text tile; 4 to 5 and 5 to 4 give undefined;
- an entry with no `background` field whose action ends in `/tickAndProcess`, at the end of a backward move, is passed over (the legacy rule);
- `getChangedTileId` on `[replace .../<Table>/updatedHash, replace .../<Text>/content/text]` names the Text tile: the bookkeeping patch comes first but does not count;
- `getChangedTileId` on a shared-model patch for the Table's data set followed by a patch on the Text tile's content names the Text tile (tier 1 over tier 2).

Mutations caught: dropping the `updatedHash` filter (the bookkeeping case); iterating from `from` instead of the end (the 0 to 3 row); checking `isLoadEntry` or `entry.background` instead of `isBackgroundEntry` (the 4 to 1 tick case, and the legacy tick case); dropping tier 3 (the row move row); concatenating tier 2 before tier 1 (the tier case); dropping the `getTile` existence check (the undo-add rows).

---

### Ask for a reveal after moves the reader starts

**Summary**: `goToHistoryEntryPosition` takes `revealChange`, and when set, records the tile the move changed in a new observable `playbackRevealRequest`. The playback model's seek queue passes it for the slider, Play, comments and links; following the end does not, and nor does the history manager's catch-up when playback opens, which passes no option (R1, R5, R13). The value has no reader until the next step, so behavior does not change.

**Files affected**:
- `src/models/history/tree-manager.ts`: `IMainDocument.content`, `playbackRevealRequest`, the option.
- `src/components/playback/playback-control-model.ts`: `goToSliderStop` and `seekToStop` option, the seek loop passes it on.
- `src/models/history/tree-manager.test.ts`, `src/components/playback/playback-control-model.test.ts`, `src/components/playback/playback-control.test.tsx`: tests.

**Estimated diff size**: ~170 lines

`tree-manager.ts`:

```ts
import type { DocumentContentModelType } from "../document/document-content";
import { getPlaybackRevealTileId } from "./playback-reveal";
...
interface IMainDocument extends TreeAPI {
  ...
  content?: DocumentContentModelType;
}
```

In the volatile block, after `seekBoundaryPosition`:

```ts
  /**
   * The tile the last playback move the reader started changed, for the history view to bring on
   * screen. A new object each time, so a move that changes the same tile again still reaches the
   * view.
   */
  playbackRevealRequest: undefined as { tileId: string } | undefined,
```

The action:

```ts
  /**
   * Moves the trees to a history position. With `revealChange`, a move that changes the position
   * sets `playbackRevealRequest` to the tile it changed, if any.
   */
  goToHistoryEntryPosition: flow(function* goToHistoryEntryPosition(
                                      newHistoryPosition: number, options: { revealChange?: boolean } = {}) {
```

and at its end, after `self.numHistoryEventsApplied = stopPosition;`:

```ts
    const { mainDocument } = self;
    const content = mainDocument?.content;
    if (options.revealChange && mainDocument && content) {
      const tileId = getPlaybackRevealTileId({
        history, treeId: mainDocument.key, from: initialPosition, to: stopPosition, content
      });
      if (tileId) self.playbackRevealRequest = { tileId };
    }
```

Every early return in the action (no move, `jsonCopyOutOfStep`, a JSON copy that cannot move, a conversion failure) returns before this. A move that rolls back to where it started has `stopPosition === initialPosition`, an empty range in which `getPlaybackRevealTileId` finds no entry, so R5 holds without a guard here. A move stopped short by a failing entry uses `stopPosition`, so only the entries applied count (R2). `DocumentModel` already satisfies the widened `IMainDocument`, since its `content` is a `DocumentContentModel`; the import is type-only, so it adds no runtime dependency from the history model on the document model.

`playback-control-model.ts`. Every seek, the slider's, Play's, a comment's and a link's (`followLink` then `goToLink`), goes through `seekToStop`, so the option rides on it and defaults to true:

```ts
  private requestCount = 0;
  // Whether the queued seek should bring the tile it changes on screen.
  private queuedRevealChange = true;
```

Add `"queuedRevealChange"` to the private-name list of `makeAutoObservable` (wrapping the list, which would pass 120 characters) and `queuedRevealChange: false` to its overrides, beside `requestCount: false`. The follow-the-end reaction:

```ts
        // The reader did not make this move, so it leaves their view where it is, as the live
        // document does when a collaborator's change arrives.
        if (this.requestedStop === "end") void this.goToSliderStop(lastStopIndex, { revealChange: false });
```

`goToSliderStop` and `seekToStop`:

```ts
  /**
   * @param options.revealChange false for a move the reader did not make, which leaves the
   * history view's scroll position alone.
   */
  async goToSliderStop(requestedIndex: number, options: { revealChange?: boolean } = {}) {
    const stopIndex = this.reachableStopIndex(requestedIndex);
    ...
    await this.seekToStop(stopIndex, stopIndex >= this.lastStopIndex ? "end" : stopIndex,
      options.revealChange ?? true);
  }
  ...
  private async seekToStop(stopIndex: number, request: StopRequest, revealChange = true) {
    this.requestedStop = request;
    this.queuedStopIndex = stopIndex;
    this.queuedRevealChange = revealChange;
    this.requestCount++;
```

`runSeekLoop` reads `const revealChange = this.queuedRevealChange;` beside `requestCount` at the top of each turn and calls `this.treeManager.goToHistoryEntryPosition(position, { revealChange })`. The loop seeks only the latest request, and a request that arrives during its wait for paint sends it round again, so the latest request's option is the one that applies: a reader's drag or a link that lands while a follow-the-end move is queued still reveals.

`firestore-history-manager.ts` needs nothing: `checkHistoryEntryAfterLoad` no longer seeks, and `moveContentToNewestEntry` passes no option, so the catch-up when playback opens does not reveal (R13).

**Tests**:
- `tree-manager.test.ts`, a new `describe("playback reveal")` using the existing `setupDocument()` (one `TestTile` `t1` linked to shared model `sm1`): record `tileContent.setActionText("a")` and wait for `expectEntryToBeComplete(manager, 1)`, then `manager.setNumHistoryEntriesApplied(1)` (recording an entry does not move the applied position). Then `goToHistoryEntryPosition(0, { revealChange: true })` sets `playbackRevealRequest` to `{ tileId: "t1" }`; the same move without the option leaves it undefined; moving back to 1 and to 0 again with the option gives a second object, not the first.
- R2's stopped-short case needs two tiles, or the mutation it guards (using `newHistoryPosition` for `to`) names the same tile. Call `setupDocument()` with content holding `TestTile`s `t1` and `t2`, and seed it with the existing `seedHistory` helper: `[setActionText on t2, failingEntry, setActionText on t1]` (the first and last built like `action1`, with the tile id in the paths, through `makeRealHistoryEntry`), at position 0. `goToHistoryEntryPosition(3, { revealChange: true })` stops at 1, as the existing failure tests show, and the request names `t2` from entry 0; with the mutation it would name `t1` from entry 2. Going backward from 3 to 0 stops at 2, and the request names `t1` from entry 2, the one it undid.
- `playback-control-model.test.ts`: spy on `treeManager.goToHistoryEntryPosition`. `goToSliderStop(1)` calls it with `{ revealChange: true }`; Play's first step does too; `followLink` to a tick's entry calls it with `{ revealChange: true }`; in "following the end of the history", a user entry and then two background entries arriving while at the end call it three times, each with `{ revealChange: false }`; a reader request queued behind a follow request is sought with `{ revealChange: true }`.
- Existing assertions on the seek's arguments gain the option: `toHaveBeenCalledWith(n)` becomes `toHaveBeenCalledWith(n, { revealChange: true })` in `playback-control-model.test.ts` ("reports a long seek and lets the browser paint before the seek starts", "starts a shorter seek at once without reporting it as long", "reports a link's seek across many entries as long", "keeps the slider off the stops before the earliest available one") and `playback-control.test.tsx` ("shows the progress indicator at once for a seek across many entries, and paints it first", "shows the progress indicator for a link's seek across many entries"). These six are the only existing tests the option breaks. Two `not.toHaveBeenCalledWith(0)` assertions in `playback-control-model.test.ts` ("sends a seek still waiting for the browser to paint to a link that arrives", "keeps the slider off the stops before the earliest available one") would pass vacuously once every call carries the option, so they become `not.toHaveBeenCalledWith(0, expect.anything())`.

Mutations caught: dropping the `revealChange` check (the no-option test); using `newHistoryPosition` for `to` (the stopped-short tests); passing `true` from the follow reaction (the follow test); reading the option once before the loop rather than per turn (the queued reader request).

---

### Scroll the history view to the requested tile

**Summary**: The canvas passes the history copy's `playbackRevealRequest` to its `DocumentContentComponent`, which scrolls its own container so the tile is above the playback bar (R6 to R12). The geometry is a pure module with its own tests. `prefersReducedMotion` moves from the table hook to `dom-utils.ts` so both callers share it.

**Files affected**:
- `src/utilities/dom-utils.ts`: `prefersReducedMotion`, moved here.
- `src/components/tiles/table/use-follow-new-rows.ts`: imports it, drops its copy.
- `src/components/playback/playback.tsx`: export `kPlaybackComponentClass`, used for the bar's class.
- `src/components/document/playback-reveal-scroll.ts`: new.
- `src/components/document/playback-reveal-scroll.test.ts`: new.
- `src/components/document/document-content.tsx`: the prop and `revealTile`.
- `src/components/document/canvas.tsx`: pass the prop.
- `src/components/document/canvas.test.tsx`: the component test.

**Estimated diff size**: ~260 lines

`dom-utils.ts` gets the function exactly as it is in `use-follow-new-rows.ts` today, exported:

```ts
/** Honors the OS setting. matchMedia is absent under jsdom, hence the optional call. */
export function prefersReducedMotion() {
  return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
```

`playback.tsx`:

```ts
// The bar sits over the bottom of the document, which the history view allows for when it scrolls.
export const kPlaybackComponentClass = "playback-component";
...
  const playbackComponentClass = classNames(kPlaybackComponentClass, "show-control", activeNavTab,
                                            {"disabled" : disablePlayback});
```

`playback-reveal-scroll.ts`:

```ts
// Space left between a revealed tile and the edge of the visible area.
export const kRevealMarginPx = 8;

/**
 * The container's scrollTop, and vertical positions in client coordinates, as
 * getBoundingClientRect gives them.
 */
export interface IRevealGeometry {
  scrollTop: number;
  // The top and bottom of the part of the container that is not covered.
  visibleTop: number;
  visibleBottom: number;
  tileTop: number;
  tileBottom: number;
}

/**
 * The scrollTop that brings a tile into the visible area, or undefined when it is already there.
 * A tile that fits is scrolled the shortest way until it is fully visible, with a margin where
 * there is room. A tile taller than the area is scrolled the shortest way until it fills the area,
 * so a reader who has scrolled within it is left where they are.
 */
export function getRevealScrollTop(g: IRevealGeometry) {
  const { scrollTop, visibleTop, visibleBottom, tileTop, tileBottom } = g;
  if (tileTop >= visibleTop && tileBottom <= visibleBottom) return undefined;
  const spare = visibleBottom - visibleTop - (tileBottom - tileTop);
  let delta: number;
  if (spare >= 0) {
    const margin = Math.min(kRevealMarginPx, spare / 2);
    delta = tileTop < visibleTop ? tileTop - visibleTop - margin : tileBottom - visibleBottom + margin;
  } else {
    if (tileTop <= visibleTop && tileBottom >= visibleBottom) return undefined;
    delta = tileTop > visibleTop ? tileTop - visibleTop : tileBottom - visibleBottom;
  }
  return Math.max(0, scrollTop + delta);
}

/**
 * Smooth within one visible height, where the motion shows which way the change is; farther, a
 * smooth scroll crawls, so it jumps. Always jumps for a reader who asked for reduced motion.
 * "instant" rather than "auto", which defers to the container's CSS `scroll-behavior`.
 */
export function getRevealScrollBehavior(distance: number, visibleHeight: number, reducedMotion: boolean):
    ScrollBehavior {
  return !reducedMotion && Math.abs(distance) <= visibleHeight ? "smooth" : "instant";
}
```

`document-content.tsx`, imports `kPlaybackComponentClass`, `prefersReducedMotion`, `getRevealScrollBehavior` and `getRevealScrollTop`, and:

```ts
// How many frames a playback reveal waits for its tile to render.
const kRevealFrames = 5;
...
interface IProps extends IBaseProps {
  ...
  // A tile history playback changed, to bring on screen. Each new object is a new request.
  playbackRevealRequest?: { tileId: string };
```

At the top of `componentDidUpdate`:

```ts
    const { playbackRevealRequest } = this.props;
    if (playbackRevealRequest && playbackRevealRequest !== prevProps.playbackRevealRequest) {
      this.revealTile(playbackRevealRequest.tileId);
    }
```

and the method:

```ts
  // A tile the move added renders after this request arrives, so the lookup waits a frame and
  // tries a few more before giving up.
  private revealTile(tileId: string, framesLeft = kRevealFrames) {
    requestAnimationFrame(() => {
      const container = this.domElement;
      const tileNode = container && getTileNode(container, tileId);
      if (!container || !tileNode) {
        if (container && framesLeft > 1) this.revealTile(tileId, framesLeft - 1);
        return;
      }
      const containerRect = container.getBoundingClientRect();
      const visibleTop = containerRect.top;
      let visibleBottom = containerRect.top + container.clientHeight;
      const bar = container.parentElement?.querySelector(`.${kPlaybackComponentClass}`);
      if (bar) visibleBottom = Math.min(visibleBottom, bar.getBoundingClientRect().top);
      const tileRect = tileNode.getBoundingClientRect();
      const top = getRevealScrollTop({
        scrollTop: container.scrollTop, visibleTop, visibleBottom, tileTop: tileRect.top, tileBottom: tileRect.bottom
      });
      if (top === undefined) return;
      const behavior = getRevealScrollBehavior(top - container.scrollTop, visibleBottom - visibleTop,
        prefersReducedMotion());
      container.scrollTo({ top, behavior });
    });
  }
```

`container.scrollTo` moves only this pane (R12); `scrollIntoView` is avoided because it also scrolls every scrollable ancestor and the page. Nothing selects or focuses the tile (R11). The bar is the canvas's child, beside this component's root, so `parentElement` finds the bar of the same canvas and no other.

`canvas.tsx`, `renderContent`:

```tsx
    const documentToShow = this.getDocumentToShow();
    const playbackTreeManager = documentToShow?.treeManagerAPI as TreeManagerType | undefined;
    ...
          <DocumentContentComponent
            ...
            playbackRevealRequest={showPlaybackControls ? playbackTreeManager?.playbackRevealRequest : undefined}
```

`CanvasComponent` is an observer, so reading the request in render re-renders the canvas when a move sets it, and `componentDidUpdate` sees a new object.

**Tests**:
- `playback-reveal-scroll.test.ts`: a visible tile gives undefined; a tile below aligns its bottom 8 px above the visible bottom; a tile above aligns its top 8 px below the visible top; a tile within 16 px of the area's height gets a smaller margin and ends fully visible; a tile taller than the area that covers it gives undefined, one whose top is inside the area aligns its top with the visible top, and one whose bottom is inside aligns its bottom with the visible bottom; the result is never negative; a lowered `visibleBottom` (the bar) moves a tile that would otherwise count as visible. `getRevealScrollBehavior`: smooth at and under one visible height in both directions, instant beyond it, instant under reduced motion.
- `canvas.test.tsx`, "scrolls the history view to the tile a playback move changed". The harness is the throwaway that passed: register Text; mock `../playback/playback-control` (`PlaybackControlComponent: () => null`), since the real control needs a `NavTabPanelInfoProvider` the canvas tests do not set up; spy `subscribeToFirestoreHistory` to capture the copy's TreeManager, as the existing tests do. Record three entries on the live document with its tree monitor enabled (add Text A, add Text B, set B's text), render the canvas with playback on, then give the copy that history (`setChangeDocument(CDocument.create({ history }))`, `setNumHistoryEntriesApplied(3)`). Stub the pane: `clientHeight` 300, `getBoundingClientRect` 0 to 300, `scrollTo` a mock; the `playback-component` element's rect starts at 251; B's tile node's rect is 1000 to 1100. Then:
  - `goToHistoryEntryPosition(2, { revealChange: true })` calls the pane's `scrollTo` with `{ top: 857, behavior: "instant" }` (1100 - 251 + 8; farther than one visible height, so instant). The throwaway run produced exactly this.
  - with B's rect moved inside the visible area (150 to 240), redoing B's text (`goToHistoryEntryPosition(3, { revealChange: true })`) does not call it (R7, R15);
  - with B's rect back at 1000 to 1100, a following move without the option (`goToHistoryEntryPosition(2)`) does not call it, so a TreeManager that ignored the option would fail here;
  - undoing B's creation (`goToHistoryEntryPosition(1, { revealChange: true })`) does not call it;
  - `document.activeElement` is unchanged throughout, and `Element.prototype.scrollIntoView` is never called.

  jsdom implements neither `Element.prototype.scrollTo` nor `scrollIntoView`. The test assigns the pane's `scrollTo`, and defines `Element.prototype.scrollIntoView` as a `jest.fn()` for the test and deletes it afterwards, so the "never called" assertion has something to observe.

  Mutations caught: in the pure tests, a fixed 8 px margin (the near-fit tile), dropping the fills-the-area check (the covering tile), and aligning every tall tile by its top (the tall tile whose bottom is inside); in the canvas test, not subtracting the bar (top would be 808); calling `scrollIntoView`; dropping the prop from the canvas; dropping the already-visible check in `getRevealScrollTop` (the visible-tile move).

These tests print MST "no longer part of a state tree" warnings when a playback move removes a Text tile. They come from the Text tile component under jsdom and appear the same with `revealChange` off, so they are not from this change.

---

### Label playback scrolls in tile-visibility logs

**Summary**: A scroll this feature makes logs `TILE_VISIBILITY_CHANGE` with cause `"historyPlayback"` instead of `"scroll"` (R16).

**Files affected**:
- `src/components/document/tile-visibility.ts`: add the cause.
- `src/components/document/tile-visibility.test.ts`: test.
- `src/components/document/document-content.tsx`: queue it before scrolling.

**Estimated diff size**: ~20 lines

```ts
export type VisibilityCause =
  "scroll" | "windowResize" | "dividerResize" | "tileResize" | "documentChange"
  | "commentsToggle" | "comparisonToggle" | "historyPlayback";
```

In `revealTile`, just before `container.scrollTo(...)`:

```ts
      if (this.props.logTileVisibility) this.queueVisibilityLog("historyPlayback");
```

`nextVisibilityCause` already keeps a pending non-scroll cause when `"scroll"` arrives, so the scroll events this scroll fires (one for an instant scroll, several for a smooth one) settle into a single event with this cause. `buildVisibilityLogParams` attaches no cause-specific field for it.

**Tests**:
- `canvas.test.tsx`, extending the previous step's test: render the canvas with `logTileVisibility={true}`, mock `logDocumentOrCurriculumEvent` in `../../models/document/log-document-event` (keeping the module's other exports), and stub tile A's rect inside the pane (10 to 100) so the event has a visible tile to report; `emitTileVisibility` logs nothing when no tile is in view. Wait out the 500 ms settle of the `documentChange` event logged at mount and clear the mock, then after the reveal of B expect a call whose params include `cause: "historyPlayback"` (allow about 1.5 s for the debounce).
- `tile-visibility.test.ts`, in "keeps a pending layout cause when a scroll follows it": `nextVisibilityCause("historyPlayback", "scroll")` is `"historyPlayback"`. This documents the merge rule for the new cause; it passes on master's function unchanged, so it is the canvas test that catches this step being dropped.

Mutation caught: deleting the `queueVisibilityLog("historyPlayback")` line (the canvas test).

## Verification

- Every step: `npm run lint:build`, `npm run check:types`, and `npm test` for the touched folders (`src/models/history`, `src/components/playback`, `src/components/document`, `src/components/tiles/table`, `src/utilities`). Re-measure the totals on the final head; before the third step updates them, the six seek-argument assertions it names are the only existing tests that fail.
- In a browser: open a document long enough to scroll with tiles near the top and bottom, open history, and step with the slider keys and with auto-play. Each step that changes an off-screen tile brings it above the bar; a step on a visible tile does not move the view; the slider keeps focus. Repeat in the 4-up focused pane (read-only) to check the last tile clears the bar. Drag the slider quickly across several stops and check the view ends on the last change rather than finishing an earlier scroll first (R10's retargeting, which jsdom cannot show). Turn on reduced motion in the OS and check the scroll jumps.

## Open Questions

<!-- Implementation-focused questions only. Requirements questions go in requirements.md. -->

### RESOLVED: Judgment call: where the reveal request lives
**Options considered**:
- A) A volatile on the history copy's `TreeManager`, passed down by `CanvasComponent`.
- B) A volatile on the document content, set by an action, as the prior art did.
- C) The global `ui.setScrollTo`.

**Decision**: A. The TreeManager already owns playback state the view reads (`numHistoryEventsApplied`, `earliestReachablePosition`). B calls an action on the monitored document tree, which the tree monitor sees, for state that has nothing to do with the document. C reaches every pane with the same document key, and the copy shares the live document's key (R12).

### RESOLVED: Judgment call: how the view tells the bar's coverage
**Options considered**:
- A) Measure the canvas's `.playback-component` sibling at scroll time.
- B) Subtract `$playback-bar-height` as a TypeScript constant.

**Decision**: A. B would be a second copy of the height, and it would miss the bar's real position at any zoom. The class name comes from one exported constant used by both the bar and the lookup.

### RESOLVED: Judgment call: wait for a tile the move added
**Options considered**:
- A) Look the tile up in an animation frame, retrying for up to five frames.
- B) Look it up once in `componentDidUpdate`.

**Decision**: A. The canvas re-renders for the request, but the new tile's row is a separate observer and is not guaranteed to have committed in the same pass (R9). Five frames is ample for a render with no data to fetch; a tile that never appears is not scrolled to, which is the R4 outcome.

## Self-Review

### Round 1

Roles: test writer (can each named test be written against the harness, and does it fail under its mutation), commit reviewer (does each step compile and pass alone), operator, QA.

- **RESOLVED (test writer): the stopped-short test could not fail.** As first written it named `seedManager` (the helper is `seedHistory`) and used one tile, so moving `to` from `stopPosition` to `newHistoryPosition` would still name `t1`. Checked against the existing failure fixture: from position 1 the forward move stops where it started, so it reveals nothing. The test now uses two tiles and starts at 0.
- **RESOLVED (test writer): jsdom has no scroll APIs.** A throwaway check showed `Element.prototype.scrollTo` and `scrollIntoView` are both undefined under this Jest setup. The component test now says to stub both.
- **RESOLVED (test writer): the spacer test needs the Firebase spies.** Rendering the canvas with playback on and no spies failed with "No Firebase App '[DEFAULT]' has been created". The step now names the spies.
- **RESOLVED (test writer): recording does not move the applied position.** `numHistoryEventsApplied` changes only through `setNumHistoryEntriesApplied`, loading, a move, or the debug failing-entry injection, so the TreeManager test sets it after recording.
- **RESOLVED (QA): R10's retargeting had no check.** It is browser behavior jsdom cannot show; the manual check now covers it.
- Checked and dropped: each step compiles and lints with only the steps before it (the full throwaway build passed `tsc` with no errors and ESLint with only a warning already on master in `firestore-history-manager.ts`); the widened `IMainDocument` accepts `DocumentModel`; the `makeAutoObservable` override list compiles with the new private field; the follow-then-reader queue test is writable with a deferred spy.

### Self-review round 1 (after squash)

Roles: implementer (built every step exactly as quoted, in order, with the tests each step names, and ran its mutations), education researcher (R16), maintainer (other files whose prose describes the changed contracts), spec-consistency reader (requirements against plan).

- **RESOLVED (implementer): the `stopPosition !== initialPosition` guard could never change the result.** With the guard deleted the full TreeManager suites still passed: a same-position request returns early, and a rolled-back move gives `getPlaybackRevealTileId` an empty range. The guard and the test and mutation claimed for it are gone; R5 is explained by the empty range.
- **RESOLVED (implementer): step 5's test could not fail.** `nextVisibilityCause("historyPlayback", "scroll")` already returns the pending cause on master. A canvas-level test that mocks `logDocumentOrCurriculumEvent` and expects `cause: "historyPlayback"` was written and fails when the queue call is deleted; the step now names it.
- **RESOLVED (spec consistency): R15's visible-tile case had no component test.** The canvas test now redoes B's text with B inside the visible area and expects no scroll; deleting the already-visible check fails it.
- **RESOLVED (implementer): the Verification test count was stale.** It had been measured with `src/utilities/dom-utils` only and before the plan's tests existed; Verification now asks for the totals to be measured on the final head.
- Checked and dropped: every quoted file (`playback-reveal.ts`, `playback-reveal-scroll.ts`) matches what was built byte for byte; `check:types` is clean and the build ESLint config reports only warnings already on master; all fourteen named mutations in steps 1 to 4 fail a test; both edited SCSS files compile (49 px and `calc(300px + 49px)`); importing `playback.tsx` into `document-content.tsx` adds no bundle weight, since `canvas.tsx` is its only importer and already imports it; `docs/history-framework.md` describes `goToHistoryEntryPosition` positions and patch sources, none of which change; no living doc lists the visibility causes (only the archived CLUE-629 design).

### Self-review round 2

Roles: browser-behavior skeptic (scroll calls checked in headless Chrome), WCAG reviewer (keyboard stepping, reduced motion), performance reviewer (canvas re-render, per-move entry scan), MST/MobX specialist (the new volatile and the canvas to `componentDidUpdate` path), comment auditor (quoted comments against the user's comment rules).

- **RESOLVED (browser-behavior skeptic, WCAG): `behavior: "auto"` does not jump in the teacher dashboard.** `"auto"` means "use the container's CSS `scroll-behavior`", and the history pane gets `document-content-smooth-scroll` (`scroll-behavior: smooth`) when `viaTeacherDashboard` is set, which the teacher dashboard's focused 4-up pane passes along with `showPlayback`. In headless Chrome, `scrollTo({ top: 2000, behavior: "auto" })` on such a container left `scrollTop` at 0 (animating), while `"instant"` landed at 2000. So reduced motion and long jumps would still animate there. `getRevealScrollBehavior` now returns `"instant"`, which TypeScript's `ScrollBehavior` already includes, and the tests expect it.
- Checked and dropped: no ancestor `transform: scale` sits over a playback pane (the 4-up scaler is `scale(1)` when a user is focused, and only the focused pane shows playback), so client-rect deltas and `scrollTop` share units; the 49 px read-only spacer lets the last tile reach the bar's top edge, which meets R6 though the 8 px margin is clamped away there; `playbackRevealRequest` is set inside the flow, so it is an action, and the observer canvas re-renders on it (the round 1 build showed the scroll arrive); only the history copy's manager makes playback moves, so the live document never gets a request; every quoted comment states what the code does and nothing about how it came to be.

### Self-review round 3 (on CLUE-760's branch)

Roles: history-framework reviewer (background entries, `docs/history-framework.md` and CLUE-760's design doc), commit reviewer (the overlapping files: `tree-manager.ts`, `firestore-history-manager.ts`, `playback-control-model.ts`, `playback.tsx`, `playback.scss`, their tests, `canvas.test.tsx`), test writer.

- **RESOLVED (history framework): the tile choice now skips background entries**, not only load entries (requirements, round 3). The scan can now pass over many ticks, but `isBackgroundEntry` caches its answer per entry and the move itself applied every one of them, so it adds nothing measurable.
- **RESOLVED (commit reviewer): the link seek moved.** CLUE-760 replaced `moveToHistoryEntryAfterLoad` with `checkHistoryEntryAfterLoad`, which doesn't seek, and sends the link through the playback model's queue (`followLink`). The option now rides on `seekToStop`, `firestore-history-manager.ts` drops out of the step, and the six seek-argument assertions CLUE-760 added replace the two old ones.
- **RESOLVED (commit reviewer): anchors moved.** `IMainDocument` gained `setContent`, so the snippet shows only the added field; the volatile goes after `seekBoundaryPosition` (`oldestReachablePosition` was renamed); the model's private-name list needs wrapping for `max-len`.
- Checked and still holding: tsc clean and ESLint clean apart from that wrap with every step built; the canvas chain test still gives `{ top: 857, behavior: "instant" }`, leaves a visible tile and focus alone, and never calls `scrollIntoView`; `playback.tsx` still builds its class from `"playback-component show-control"`, `playback.scss` still has `height: 49px`, and the `document-content.scss` spacers are unchanged; `canvas.tsx`, `document-content.tsx` and the tile-visibility code are untouched by CLUE-760; load entries have carried `background: true` since they were introduced, so stored ones are skipped.

### Scott Cytacki's review

- **RESOLVED: tall tiles fill the view.** `getRevealScrollTop` scrolls a tile taller than the visible area the shortest way until it fills it, and not at all when it already does (R7). A tile that fits gets a margin of at most half the spare height, so one within 16 px of the area's height still ends fully visible and does not move on the next step. A throwaway run over eight geometries gave the expected scrollTop for each, and applying each result left the tile needing no further scroll.

### Self-review round 4

Roles: release reviewer (the plan against master now that CLUE-760 has merged), test writer (the tall-tile tests), maintainer (numbers in the spec).

- **RESOLVED (release reviewer): the base merged.** Since the plan was checked, CLUE-760 merged with three more commits, touching `playback-control.tsx`, its SCSS and test, and `link-marker.tsx`. None is a file the plan changes except the test, where both named tests are unchanged; `seekToStop`, `goToSliderStop`, the follow-end reaction, `seekBoundaryPosition` and the end of `goToHistoryEntryPosition` read as quoted on master.
- **RESOLVED (test writer): the tall-tile tests named no mutations.** `getRevealScrollTop` as quoted, with the listed tests, passed 11 of 11 and lint-clean; a fixed margin, no fills-the-area check, top-aligning every tall tile and no already-visible check each failed at least one. The mutation list now names the first three.
- **RESOLVED (maintainer): a stale test count.** Round 1's note still gave totals measured before the rebase onto CLUE-760; it now points at Verification's measure-on-the-final-head rule.
