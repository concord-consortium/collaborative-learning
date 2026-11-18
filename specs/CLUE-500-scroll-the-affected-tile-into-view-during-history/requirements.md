# Scroll the Affected Tile Into View During History Playback

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-500
**Repo**: https://github.com/concord-consortium/collaborative-learning
**Implementation Spec**: [implementation.md](implementation.md)
**Status**: **In Development**
**Depends on**: CLUE-760 (PR #3074, background history entries), merged to master; this branch is based on master.

## Overview

When someone replays a document's history, the change at each step can be in a tile that is scrolled out of view, so nothing visible happens as the slider moves. History playback should scroll the changed tile into view so the reader can see what was added, removed or modified at each step.

## Project Owner Overview

Teachers and researchers use history playback to watch how a student's document was built. In a long document, most steps change a tile that is above or below the visible part of the canvas, so the reader moves the slider, sees nothing change, and loses the link between the slider and the work. They have to hunt for the change by scrolling by hand at every step, which defeats auto-play entirely.

After this story, each playback step brings the tile it changed into view when it is not already visible. Leslie Bondaryk built a version of this on the `CLUE-102-misalignment-in-history-slider` branch, which was later split into scoped stories (CLUE-494, CLUE-495, CLUE-496) that did not carry this piece forward. This story brings the behavior back on top of the playback code as it is now.

## Background

### How playback works today

- The history view is a separate copy of the document. `CanvasComponent.createHistoryDocumentCopy` (`src/components/document/canvas.tsx`) builds it from a snapshot of the live document, with its own `TreeManager`, and renders it in its own `DocumentContentComponent` (keyed `"history"`) with the `PlaybackComponent` bar on top of it.
- `PlaybackControlModel` (`src/components/playback/playback-control-model.ts`) owns the slider. Clicking or dragging the slider, auto-play (one stop every `kPlaybackStepMs` = 500 ms) and the slider's keyboard all go through `goToSliderStop`, whose seek loop calls `TreeManager.goToHistoryEntryPosition(position)`. A link into a document's history seeks through the same queue, with `followLink`; `FirestoreHistoryManager.checkHistoryEntryAfterLoad` only reports a link's problems.
- Since CLUE-760, entries produced by code rather than by a person are background entries: DataFlow ticks and recomputes, Simulator steps, recorded cases, and load entries. `isBackgroundEntry` (`src/models/history/background-entries.ts`) reads the stored `background` flag, or for entries written before the flag existed, a rule over the action and patches. Background entries make no slider stops, but a move between two user stops applies every one between them, and the latest, comment and link stops can sit right after one. When playback opens on content older than the newest entry, `moveContentToNewestEntry` moves the copy forward with `goToHistoryEntryPosition` too.
- `goToHistoryEntryPosition` (`src/models/history/tree-manager.ts`) applies every entry between the current position and the target as one batch, going forward with each entry's patches and backward with its inverse patches. Since CLUE-494 it can stop short of the target: a failing entry stops the move at `stopPosition`, and a JSON copy (old-format documents) can stop it at the earliest reachable position (`earliestReachablePosition`). `numHistoryEventsApplied` ends at the position the move really reached. A drag across many stops seeks only to the last of them, so one move can cross many entries.
- A history entry's `records` hold the patches for each tree. In a CLUE document, a change to a tile has paths under `/content/tileMap/<tileId>`, and a change to a shared model (a data set shared by a table and a graph, for example) has paths under `/content/sharedModelMap/<sharedModelId>/sharedModel`. The map entry for a shared model lists the tiles linked to it. `src/models/document/document-paths.ts` defines regexes for both kinds of path.
- `Tree.applyPatchesFromManager` is not only used by playback: undo/redo (`undo-store.ts`), remote entries from collaborators (`firestore-history-manager-concurrent.ts`) and playback's own rollback all call it. Leslie's prior art set the scroll target inside it, so it would also have scrolled the live document whenever a collaborator's change arrived. This story ties the scroll to playback moves only.

### What already scrolls tiles

- `ui.setScrollTo(tileId, docKey)` (`src/models/stores/ui.ts`) with a reaction in `DocumentContentComponent` scrolls the row holding a tile into view in every `DocumentContentComponent` whose document key matches. The history copy has the same key as the live document, so that mechanism would scroll every pane showing the document, not just the history view. It also finds tiles through `rowRefs`, which holds top-level rows only, so it cannot find a tile inside a Question tile.
- `src/components/tiles/tile-dom.ts` finds any rendered tile, nested ones included, with `getTileNode(root, tileId)`.

### Layout constraints

- The playback bar (`.playback-component`, 49 px) is absolutely positioned over the bottom of the canvas, on top of the document's scroll area. A tile scrolled to the bottom edge of the scroll area with `block: "nearest"` ends up behind the bar. `DocumentContentComponent` has a `showPlaybackSpacer` prop for exactly this, with CSS for it (a 50 px spacer in a read-only view, 350 px in place of the 300 px one in an editable view), but nothing has passed the prop since the playback bar moved into `CanvasComponent` in 2022. A read-only history view (the 4-up pane, the resources panel, the sort-work area) has no spacer at all, so its last tile cannot scroll above the bar.
- The history view's `DocumentContentComponent` gets `logTileVisibility` from the 1-up canvas, so it logs `TILE_VISIBILITY_CHANGE` on every scroll, including scrolls during playback.

## Requirements

### What scrolls, and when

- **R1.** After a playback move that changes the history document, if the move changed a tile that exists in the document after the move, and that tile is not fully visible in the history view, the history view scrolls so that the tile is visible. This applies to every move the reader starts: clicking or dragging the slider, the slider's keyboard, auto-play, and opening a link to a history entry. It applies wherever playback is offered (the 1-up workspace, the focused 4-up pane, the resources panel's document view and the sort-work area), each history view scrolling on its own.
- **R2.** The tile is chosen from the history entry nearest the move's end: going forward, the last entry applied; going backward, the last entry undone. When a move stops short of its target (a failing entry, or the earliest reachable position), only the entries the move actually applied count. Background entries (see Background; load entries are among them) are skipped: the tile comes from the nearest entry in the move that a person made, and a move that crossed only background entries does not scroll.
- **R3.** Within that entry, the tile is chosen in this order, taking the first candidate in the entry's patch order at the first tier that has one that exists after the move:
  1. a tile the entry added, removed or changed;
  2. a tile linked, in the document after the move, to a shared model the entry changed;
  3. a tile in a row the entry added or changed (a tile move, or a tile deleted from a row that still has others).
- **R4.** When no tier names a tile that exists after the move (for example, undoing the step that created a tile, or deleting the only tile in a row), the view does not scroll.
- **R5.** A move that does not change the document's position does not scroll: a comment stop at the same position as the entry before it, a move refused because playback has stopped, or a move that rolls back to where it started.

### How it scrolls

- **R6.** "Visible" means the tile lies within the part of the scroll area not covered by the playback bar. A scrolled tile is never left behind the bar, including the last tile in the document, so the history view has room below its last tile at least as tall as the bar.
- **R7.** A tile already fully visible is not scrolled. A tile taller than the visible area is scrolled only as far as it takes to fill the visible area, with nothing showing above or below it, and not at all when it already fills it. A reader who has scrolled down within a tall tile is not jumped back to its top on the next step.
- **R8.** Tiles inside a container tile (for example, a Question tile) are found and scrolled into view the same way as top-level tiles.
- **R9.** A tile that the move itself added is scrolled into view once it has rendered.
- **R10.** The scroll is smooth when the distance is at most the height of the history view's visible area, and instant when it is farther or when the reader's system asks for reduced motion (`prefers-reduced-motion: reduce`). A new move's scroll replaces one still animating.
- **R11.** Scrolling does not select the tile and does not move keyboard focus. Focus stays where the reader left it (normally the slider), so keyboard stepping keeps working.

### What does not scroll

- **R12.** Only the history view's own scroll area moves. The live document, other panes or thumbnails showing the same document, and the page itself do not scroll.
- **R13.** Changes the reader did not start never trigger this scroll: undo and redo, remote changes from collaborators, the rollback of a failed playback move, the move the history view makes on its own when the reader is at the end of the slider and new entries arrive (background ones included, which arrive many times a second while a program runs), and the move that brings the history copy up to the newest entry when playback opens. The live document does not scroll when a collaborator's change arrives, and a history view that is following the end behaves the same way.

### Logging

- **R16.** A scroll this feature makes logs `TILE_VISIBILITY_CHANGE` with cause `"historyPlayback"` rather than `"scroll"`, so researchers can tell it from a reader's own scroll. The event otherwise reports what is on screen as any other does. A reader's scroll that settles together with a playback scroll is reported in the same event, as already happens with the other non-scroll causes.

### Tests

- **R14.** Unit tests cover the tile choice (R2 to R5) against real history entries: a tile edit, a shared-model edit, a tile move, a tile added and the same entry undone, a multi-entry move in both directions, a move ending on a load entry, a move back across a user change and the ticks before it, a move across only ticks, an unflagged legacy tick, and a move stopped short by a failing entry. A test also covers R13's follow-the-end case.
- **R15.** A component test covers the scroll itself (R6, R7, R11, R12): the history view scrolls for an off-screen tile, leaves a visible tile alone, and leaves focus where it was.

## Technical Notes

- History entries are rich enough to name the changed tile without new recording: the patch paths, the shared model map's tile lists and the rows in the document after the move are all that R2 to R4 need. No change to what history records.
- What real entries record, checked with a throwaway Jest test that recorded entries on a document with Text and Table tiles:
  - Adding a tile: `add` patches at `/content/rowMap/<rowId>`, `/content/rowOrder/<i>`, `/content/tileMap/<tileId>` and the row's `tiles`. A Table also adds its shared data set under `/content/sharedModelMap`.
  - Editing a tile: patches under `/content/tileMap/<tileId>/content`, plus `/content/tileMap/<tileId>/updatedHash`.
  - Editing a shared data set: patches under `/content/sharedModelMap/<id>/sharedModel`, then a second record with a `replace` of `updatedHash` on every linked tile. That bookkeeping patch is written for every tile linked to the shared model, whatever changed, so it does not mark a tile as changed in tier 1 of R3; tier 2 covers those tiles.
  - Moving a tile: only `remove`/`add` patches at `/content/rowMap/<rowId>` and `/content/rowOrder/<i>`. No tile path appears, which is why R3 has tier 3.
  - Deleting a tile: a `replace` of the row's `tiles`, then removal of the row (when it was the row's only tile) and of `/content/tileMap/<tileId>`.
- A throwaway render of `CanvasComponent` with playback on (the harness `canvas.test.tsx` already uses) showed one `document-content` pane rendering the history copy's content, not the live document's, with a Question tile and its two embedded tiles each found by `getTileNode`. Embedded tiles live in the same flat `tileMap`, so their patches have `/content/tileMap/<tileId>` paths like any other tile (R8).
- R10's retargeting needs no cancel or wait: in headless Chrome 152, a second `element.scrollTo` (smooth or instant, with or without CSS `scroll-behavior: smooth`) issued mid-way through a smooth one went straight to the new target, in either direction, and never finished the first.
- The scroll target belongs to the history document copy, not to the global `ui` store, so that R12 holds even though the copy shares the live document's key.
- Relevant files: `src/models/history/tree-manager.ts` (`goToHistoryEntryPosition`), `src/models/history/history.ts` (`getEntryPatchesForTree`), `src/models/document/document-paths.ts`, `src/components/document/document-content.tsx`, `src/components/document/canvas.tsx`, `src/components/tiles/tile-dom.ts`, `src/components/playback/playback.scss`.
- Prior art: Leslie Bondaryk's scroll-into-view commit on the `CLUE-102-misalignment-in-history-slider` branch. Its tile-choice rule (direct tile patch first, then the first tile linked to a changed shared model) carries over, with a third tier for row moves, which it missed. Its batch-apply-with-snapshot-rollback change does not: CLUE-494 replaced that code.

## Out of Scope

- A view-state record so researchers can replay what the student saw (CLUE-638).
- Highlighting or otherwise marking the changed tile, or the changed part of a tile.
- Scrolling inside a tile to the changed part (a table row, a drawing object, a text paragraph).
- Horizontal scrolling.
- Announcing the changed tile to screen readers. Scrolling helps sighted readers find the change; telling a screen-reader user which tile changed is a separate feature.
- Scrolling the live document after undo, redo or a collaborator's change.
- Any change to what history records.
- Deferring to a reader's own scroll. Apart from R7, the next step scrolls to its change even if the reader has scrolled elsewhere; this is to be revisited once people use it.
- Telling the left and right sides apart in tile-visibility logs. `TILE_VISIBILITY_CHANGE` carries the document's identity but not which side it came from, so with the same document open on both sides (playback on one, editing on the other) the two sides' events cannot be told apart. This predates this story; the `pane` prop `EditableDocumentContent` already receives would be the way to add it, as a separate story.

## Open Questions

<!-- Requirements-focused questions only (scope, acceptance criteria, business rules).
     Implementation questions go in implementation.md. -->

### RESOLVED: How should tile-visibility logging record a playback scroll?
**Context**: The history view logs `TILE_VISIBILITY_CHANGE` with cause `"scroll"` whenever its scroll area scrolls (`handleScroll` in `document-content.tsx`, debounced to one event 500 ms after motion stops). After this story, playback scrolls the history view itself, so researchers would see `"scroll"` events the reader never made. CLUE-629's design describes the log as what is on screen "as the student interacts". Students can open playback on their own work, so their logs carry these events too. Neither the live view nor the history view marks its events as playback today, so this question is only about the scrolls this story adds. B is cheap because of an existing rule: `nextVisibilityCause` keeps a pending non-scroll cause when `"scroll"` events arrive, so queuing the new cause just before scrolling labels the whole settle.
**Options considered**:
- A) Leave it: a playback scroll logs as `"scroll"`, the same as a reader's scroll. No log contract change.
- B) Add a cause, `"historyPlayback"`, for scrolls this feature makes, so researchers can tell them apart. A one-value addition to `VisibilityCause`.
- C) Suppress visibility logging for scrolls this feature makes.

Recommendation: B. The event still reports what is on screen, which is true, and the cause tells researchers the reader did not scroll. C drops a real change in what is visible.

**Decision**: B (Doug). A scroll this feature makes logs with cause `"historyPlayback"` (R16).

### RESOLVED: Judgment call: which entry names the tile when a move crosses many entries?
**Options considered**:
- A) The entry nearest the move's end (the last applied going forward, the last undone going backward).
- B) The entry the slider's readout labels (the entry before the thumb's position), in both directions.
- C) Every tile the move changed, scrolling to the first.

**Decision**: A. It is the change the reader just caused to appear or disappear. Going forward A and B are the same entry; going backward B names an entry the move did not touch, so the view would scroll to a tile that did not change. C has no single answer for a long drag.

### RESOLVED: Judgment call: what happens when the chosen entry's tile no longer exists?
**Options considered**:
- A) Do not scroll, unless the row the tile was in still exists (R3 tier 3, R4).
- B) Scroll to where the tile was, using a neighboring row, even when its row is gone.
- C) Fall back to an earlier entry in the move that changed a tile that still exists.

**Decision**: A. Undoing a tile's creation removes it, and there is nothing to show. When the tile shared a row, the row is still there, and showing it shows where the tile went. B needs the removed row's old position, which the document no longer has. C would scroll to a change other than the one the reader just caused.

### RESOLVED: Judgment call: scope the scroll to playback moves, not to every patch application
**Options considered**:
- A) Set the scroll target from `goToHistoryEntryPosition`.
- B) Set it inside `Tree.applyPatchesFromManager`, as the prior art did.

**Decision**: A. `applyPatchesFromManager` also runs for undo/redo, remote collaborators' changes and playback rollback, so B would scroll the live document on every collaborator's change (R13).

### RESOLVED: Low confidence: does smooth scrolling keep up with auto-play?
**Context**: Auto-play steps every 500 ms after each seek settles. A smooth scroll across a long document can take about as long, and a long animation reads as a crawl rather than as motion.
**Options considered**:
- A) Always smooth (except reduced motion).
- B) Smooth for distances up to one visible height, instant beyond (R10).
- C) Instant during auto-play, smooth for slider moves.

**Decision**: B. The repo already settled this for tables: `use-follow-new-rows.ts` scrolls smoothly only within `kSmoothMaxDistancePx` and jumps beyond it, because a long smooth scroll "crawls rather than reading as motion". A smooth scroll within one screen shows the reader which way the change is; a farther target is a jump either way. Auto-play and slider moves get the same rule, so C's extra case is not needed: a new `scrollTo` retargets an unfinished smooth scroll rather than queuing behind it.

## Self-Review

### Senior Engineer

#### RESOLVED: Load entries would name a tile for a change nobody can see
A load entry (`buildLoadEntry` in `schema-conversion.ts`, flagged `isLoadEntry` and `background`) records the format conversions CLUE made while loading, and its patches touch every converted tile, so R2 as first written would have scrolled to the first converted tile, though nothing visible changed. R2 skips it as a background entry, and R14 tests it.

#### RESOLVED: Following the end of the slider is a move the reader did not start
`PlaybackControlModel`'s `followEndDisposer` reaction calls `goToSliderStop(lastStopIndex)` whenever a new stop appears while the reader is at the end, so a teacher watching a student's work in the history view would have been scrolled to each tile the student touched, away from whatever they were reading. The live view does not scroll on a collaborator's change (R13), so R13 now lists this move too, and R1 says "every move the reader starts".

### Teacher

#### RESOLVED: R1 did not say where playback is offered
Playback is offered in four places (`document-view.tsx`, `four-up.tsx` for the focused pane, `sort-work-document-area.tsx`, and the 1-up workspace through `editable-document-content.tsx`), and each builds its own history copy in `CanvasComponent`. R1 now names them and says each history view scrolls on its own, which R12 already required.

### WCAG Accessibility Expert

#### RESOLVED: Out of Scope did not say whether the change is announced
R11 keeps focus on the slider, which keeps keyboard stepping working, but the scroll gives a screen-reader user nothing. Announcing the changed tile is a separate feature; Out of Scope now says so.

### Self-review round 1 (after squash)

- **RESOLVED (spec consistency): R15's visible-tile case was not in the plan's component test.** Fixed in implementation.md; R15 itself is unchanged.
- Checked and dropped (education researcher): R16 matches the code path. A playback scroll queues the new cause before scrolling, the scroll events it fires merge into it under `nextVisibilityCause`, and a reader's scroll inside the same 500 ms settle is reported in that event, as R16 says.

### Self-review round 2

- **RESOLVED (WCAG, browser behavior): R10's instant scroll must not defer to CSS.** In the teacher dashboard the history pane has `scroll-behavior: smooth`, under which a `scrollTo` with `behavior: "auto"` animates (checked in headless Chrome), so the plan now asks for `"instant"`. R10's wording already says instant, so it is unchanged.

### Self-review round 3 (on CLUE-760's branch)

- **RESOLVED (history framework): a backward move would name a tick, not the user's change.** Between two user stops at positions p and q, a DataFlow document holds ticks p to q-2 and the user's entry q-1. Going back from q to p, the last entry undone is the tick at p, so R2 as written scrolled to the DataFlow tile instead of the tile whose change the reader just undid. R2 now skips background entries, using `isBackgroundEntry` so unflagged legacy ticks are skipped too; load entries already carry `background`, so this replaces the `isLoadEntry` check. A throwaway test over five entries (user, tick, tick, user, tick) showed the backward move naming the tick's tile with `isLoadEntry` and the user's tile with `isBackgroundEntry`.
- **RESOLVED (playback): new moves the reader does not start.** The follow-the-end reaction now also fires on every background entry, and `moveContentToNewestEntry` moves the copy when playback opens. R13 lists both; neither asks for a reveal.

#### RESOLVED: Should a move across only background entries scroll?
**Context**: With background entries skipped, a move that crosses nothing else does not scroll: from the last user stop to the latest stop, back from the latest stop, or onto a comment or link stop that sits between ticks right after the user stop before it. The values in a running DataFlow tile change on those moves, possibly off screen.
**Options considered**:
- A) No scroll (as R2 now says). The slider hides background entries, so the reader never picks a tick; following the end never scrolls for them either.
- B) Scroll to the tile the nearest background entry changed (a tick names its DataFlow tile through its patches, or `producerTileId`), only when the move crossed no user entry.

**Decision**: A (Doug). CLUE-760 treats runtime ticks as noise rather than changes to the program, so they aren't the steps this story reveals. The Jira story doesn't cover the case; Scott can revisit it in review.

### Scott Cytacki's review

- **RESOLVED: scope.** Kept as specced; scrolling to the changed tile is to be tried and judged in use, not engineered against every case. Deferring to a reader's own scroll is out of scope for now.
- **RESOLVED: a tall tile jumped back to its top.** R7 aligned a tile taller than the view by its top on every step, undoing a reader's scroll within it. R7 now scrolls such a tile only until it fills the view (Scott's suggestion), which also moves the view less.
- **RESOLVED: left and right sides share one log stream.** Checked: `OneUpCanvas` logs `TILE_VISIBILITY_CHANGE` on both sides with no side field. Out of Scope records it as a separate story; R16's cause still marks the scrolls this story makes.

### Self-review round 4

- **RESOLVED (release reviewer): CLUE-760 has merged.** PR #3074 is on master, with three later commits that touch only the playback control's markup, styles and one existing test, none of which the plan changes. The branch is now based on master.
