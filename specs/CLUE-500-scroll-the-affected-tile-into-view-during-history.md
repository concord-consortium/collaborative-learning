# Scroll the Affected Tile Into View During History Playback

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-500

**Status**: **Closed**

## Overview

When someone replays a document's history, the change at each step can be in a tile that is scrolled out of view, so nothing visible happens as the slider moves. History playback scrolls the changed tile into view so the reader can see what was added, removed or modified at each step.

## Requirements

### What scrolls, and when

- **R1.** After a playback move that changes the history document, if the move changed a tile that exists in the document after the move, and that tile is not fully visible in the history view, the history view scrolls so that the tile is visible. This applies to every move the reader starts: clicking or dragging the slider, the slider's keyboard, auto-play, and opening a link to a history entry. It applies wherever playback is offered (the 1-up workspace, the focused 4-up pane, the resources panel's document view and the sort-work area), each history view scrolling on its own.
- **R2.** The tile is chosen from the history entry nearest the move's end: going forward, the last entry applied; going backward, the last entry undone. When a move stops short of its target (a failing entry, or the earliest reachable position), only the entries the move actually applied count. Background entries (program ticks, recorded cases, load entries) are skipped: the tile comes from the nearest entry in the move that a person made, and a move that crossed only background entries does not scroll.
- **R3.** Within that entry, the tile is chosen in this order, taking the first candidate in the entry's patch order at the first tier that has one that exists after the move:
  1. a tile the entry added, removed or changed;
  2. a tile linked, in the document after the move, to a shared model the entry changed;
  3. a tile in a row the entry added or changed (a tile move, or a tile deleted from a row that still has others).
- **R4.** When no tier names a tile that exists after the move (for example, undoing the step that created a tile, or deleting the only tile in a row), the view does not scroll.
- **R5.** A move that does not change the document's position does not scroll: a comment stop at the same position as the entry before it, a move refused because playback has stopped, or a move that rolls back to where it started.

### How it scrolls

- **R6.** "Visible" means the tile lies within the part of the scroll area not covered by the playback bar. A scrolled tile is never left behind the bar, including the last tile in the document, so the history view has room below its last tile at least as tall as the bar.
- **R7.** A tile already fully visible is not scrolled. A tile taller than the visible area is scrolled only as far as it takes to fill the visible area, and not at all when it already fills it, so a reader who has scrolled within a tall tile is not jumped back to its top.
- **R8.** Tiles inside a container tile (for example, a Question tile) are found and scrolled into view the same way as top-level tiles.
- **R9.** A tile that the move itself added is scrolled into view once it has rendered.
- **R10.** The scroll is smooth when the distance is at most the height of the history view's visible area, and instant when it is farther or when the reader's system asks for reduced motion. A new move's scroll replaces one still animating.
- **R11.** Scrolling does not select the tile and does not move keyboard focus, so keyboard stepping on the slider keeps working.

### What does not scroll

- **R12.** Only the history view's own scroll area moves. The live document, other panes or thumbnails showing the same document, and the page itself do not scroll.
- **R13.** Changes the reader did not start never trigger this scroll: undo and redo, remote changes from collaborators, the rollback of a failed playback move, the move the history view makes on its own when the reader is at the end of the slider and new entries arrive, and the move that brings the history copy up to the newest entry when playback opens.

### Logging

- **R16.** A scroll this feature makes logs `TILE_VISIBILITY_CHANGE` with cause `"historyPlayback"` rather than `"scroll"`, so researchers can tell it from a reader's own scroll. A reader's scroll that settles together with a playback scroll is reported in the same event.

### Tests

- **R14.** Unit tests cover the tile choice (R2 to R5) against real history entries, including load entries, program ticks around a user change, an unflagged legacy tick, a move stopped short by a failing entry, and R13's follow-the-end case.
- **R15.** A component test covers the scroll itself (R6, R7, R11, R12): the history view scrolls for an off-screen tile, leaves a visible tile alone, and leaves focus where it was.

## Technical Notes

- **Where the pieces are.** `getPlaybackRevealTileId` and `getChangedTileId` (`src/models/history/playback-reveal.ts`) pick the tile. `TreeManager.goToHistoryEntryPosition(pos, { revealChange })` sets the volatile `playbackRevealRequest` after a move, using `stopPosition` so a move that stops short counts only what it applied. `PlaybackControlModel` passes `revealChange` through its seek queue; the follow-the-end reaction passes false, and `moveContentToNewestEntry` passes nothing. `CanvasComponent` hands the history copy's request to its `DocumentContentComponent`, whose `revealTile` scrolls with the geometry in `src/components/document/playback-reveal-scroll.ts`.
- **The reveal flag is sticky in the seek queue.** The loop seeks only the latest request, so a reader's request keeps the flag set until a seek uses it; a follow-the-end request that takes over the queue cannot cancel it.
- **What history records.** A tile edit has paths under `/content/tileMap/<tileId>` plus an `updatedHash` patch. A shared data set edit has paths under `/content/sharedModelMap/<id>/sharedModel`, then an `updatedHash` patch on every linked tile whatever changed, which is why `updatedHash` does not count as a tile change. A tile move touches only `/content/rowMap` and `/content/rowOrder`, which is why tier 3 exists. Embedded tiles live in the same flat `tileMap`.
- **Measuring the bar.** The view measures the canvas's `.playback-component` (from the exported `kPlaybackComponentClass`) at scroll time rather than subtracting a constant. The spacer below the last tile is `$playback-bar-height` in `vars.scss`, shared with the bar's own height, and `showPlaybackSpacer` is now passed from the canvas.
- **Retry and takeover.** The tile lookup retries for up to five animation frames, since a tile the move added may not have rendered yet; a newer request makes an older one still waiting give up.
- **Browser behavior.** `"instant"` rather than `"auto"`: the teacher dashboard's history pane has `scroll-behavior: smooth`, under which `"auto"` animates. A second `scrollTo` mid-way through a smooth one goes straight to the new target in Chrome, so R10's retargeting needs no cancel. `container.scrollTo` is used rather than `scrollIntoView`, which also scrolls ancestors and the page.
- **Logging.** `revealTile` queues `"historyPlayback"` before scrolling; `nextVisibilityCause` keeps a pending non-scroll cause when `"scroll"` events follow, so the whole settle is labeled.
- **Prior art.** Leslie Bondaryk's commit on `CLUE-102-misalignment-in-history-slider` set the scroll target inside `Tree.applyPatchesFromManager`; its tile-choice rule (direct tile, then linked shared model) carried over, with tier 3 added for row moves.

## Out of Scope

- A view-state record so researchers can replay what the student saw (CLUE-638).
- Highlighting or otherwise marking the changed tile, or the changed part of a tile.
- Scrolling inside a tile to the changed part (a table row, a drawing object, a text paragraph).
- Horizontal scrolling.
- Announcing the changed tile to screen readers.
- Scrolling the live document after undo, redo or a collaborator's change.
- Any change to what history records.
- Deferring to a reader's own scroll. Apart from R7, the next step scrolls to its change even if the reader has scrolled elsewhere; to be revisited once people use it.
- Telling the left and right sides apart in tile-visibility logs. `TILE_VISIBILITY_CHANGE` carries the document's identity but not its side, so with the same document open on both sides the two sides' events cannot be told apart. This predates this story; the `pane` prop `EditableDocumentContent` already receives would be the way to add it, as a separate story.

## Decisions

### Requirements

### How should tile-visibility logging record a playback scroll?
**Context**: Playback scrolls fire scroll events, so without a change researchers would see `"scroll"` events the reader never made, in students' logs too.
**Options considered**:
- A) Leave it: a playback scroll logs as `"scroll"`.
- B) Add a cause, `"historyPlayback"`, for scrolls this feature makes.
- C) Suppress visibility logging for these scrolls.

**Decision**: B (Doug). The event still reports what is on screen, and the cause says the reader did not scroll. C would drop a real change in what is visible.

---

### Which entry names the tile when a move crosses many entries?
**Options considered**:
- A) The entry nearest the move's end.
- B) The entry the slider's readout labels.
- C) Every tile the move changed, scrolling to the first.

**Decision**: A. It is the change the reader just caused to appear or disappear. Going backward, B names an entry the move did not touch; C has no single answer for a long drag.

---

### What happens when the chosen entry's tile no longer exists?
**Options considered**:
- A) Do not scroll, unless the tile's row still exists (tier 3).
- B) Scroll to where the tile was, using a neighboring row.
- C) Fall back to an earlier entry that changed a tile that still exists.

**Decision**: A. There is nothing to show when a tile's creation is undone; a surviving row shows where it went. B needs a removed row's old position; C scrolls to a change other than the one just made.

---

### Scope the scroll to playback moves, not every patch application
**Options considered**:
- A) Set the target from `goToHistoryEntryPosition`.
- B) Set it inside `Tree.applyPatchesFromManager`, as the prior art did.

**Decision**: A. `applyPatchesFromManager` also runs for undo/redo, collaborators' changes and playback rollback, so B would scroll the live document on every collaborator's change.

---

### Does smooth scrolling keep up with auto-play?
**Options considered**:
- A) Always smooth (except reduced motion).
- B) Smooth up to one visible height, instant beyond.
- C) Instant during auto-play, smooth for slider moves.

**Decision**: B. It follows the rule `use-follow-new-rows.ts` already uses for tables, since a long smooth scroll crawls. A new `scrollTo` retargets an unfinished one, so auto-play needs no special case.

---

### Should load entries and program ticks name a tile?
**Context**: A load entry touches every tile converted on load, and between two user stops a DataFlow document holds many ticks, so going backward the last entry undone is usually a tick.
**Options considered**:
- A) Skip only load entries (`isLoadEntry`).
- B) Skip every background entry (`isBackgroundEntry`, which also covers unflagged legacy ticks).

**Decision**: B. A throwaway test over user, tick, tick, user, tick entries showed A naming the tick's tile on a backward move and B naming the user's tile.

---

### Should a move across only background entries scroll?
**Context**: With background entries skipped, moves such as last user stop to latest stop scroll nothing, though a running DataFlow tile's values change, possibly off screen.
**Options considered**:
- A) No scroll.
- B) Scroll to the tile the nearest background entry changed, only when the move crossed no user entry.

**Decision**: A (Doug). CLUE-760 treats runtime ticks as noise rather than changes; Scott can revisit it in review.

---

### Should following the end of the slider scroll?
**Context**: When the reader sits at the end, the history view follows new entries on its own; a teacher watching a student's work would be pulled to every tile the student touched.
**Decision**: No (R13). The live document does not scroll for a collaborator's change, and the follow move is not one the reader started.

---

### Scope after Scott Cytacki's review
**Decision**: Kept as specced: the scroll is to be tried and judged in use. Deferring to a reader's own scroll is out of scope. A tall tile scrolls only until it fills the view (Scott's suggestion, R7), rather than aligning its top on every step. Left/right sides in the visibility log are a separate story.

---

### Implementation

### Where the reveal request lives
**Options considered**:
- A) A volatile on the history copy's `TreeManager`, passed down by `CanvasComponent`.
- B) A volatile on the document content, set by an action.
- C) The global `ui.setScrollTo`.

**Decision**: A. The TreeManager already owns playback state the view reads. B runs an action the tree monitor sees for state unrelated to the document; C reaches every pane with the same document key, and the history copy shares the live document's key.

---

### How the view tells the bar's coverage
**Options considered**:
- A) Measure the canvas's `.playback-component` at scroll time.
- B) Subtract `$playback-bar-height` as a TypeScript constant.

**Decision**: A. B would be a second copy of the height and would miss the bar's real position at any zoom.

---

### Waiting for a tile the move added
**Options considered**:
- A) Look the tile up in an animation frame, retrying up to five frames.
- B) Look it up once in `componentDidUpdate`.

**Decision**: A. The new tile's row is a separate observer and may not have committed in the same pass. A tile that never appears is not scrolled to, the R4 outcome.

---

### Instant scrolls use `"instant"`, not `"auto"`
**Decision**: In the teacher dashboard the history pane has `scroll-behavior: smooth`, and a headless Chrome check showed `"auto"` animating there, so reduced motion and long jumps would still have animated.

---

### Keeping a reader's reveal when other requests follow it
**Context**: The final review found that a follow-the-end request arriving while a reader's seek waited for paint overwrote its reveal flag, and that a stale lookup retry could scroll after a newer request.
**Decision**: The queued flag is sticky (set by any request that asks for it, reset only when a seek uses it), and `revealTile` gives up when the current request is no longer the one it is serving. Both have tests.
