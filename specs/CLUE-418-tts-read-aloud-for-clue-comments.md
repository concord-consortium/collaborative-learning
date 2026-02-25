# TTS (Read Aloud) for CLUE Comments

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-418

**Status**: **Closed**

## Overview

This story extends CLUE's Read Aloud feature to include comments and refactors the service to a content-agnostic architecture with a unified item queue. When the comments panel is open, Read Aloud reads all tiles first, announces "Comments," then reads each comment thread in panel order — headers followed by each comment as "{author name} said: {content}." When a tile is selected, Read Aloud reads the tile content then its comment thread, then stops. Mid-read interactions are fully specified: clicking a comment thread during tile reading jumps to that thread; clicking a workspace tile during comment reading reads that tile and its thread then stops; closing the panel stops reading; opening the panel mid-read triggers a reactive queue rebuild that appends comments. The reading queue is reactively rebuilt when the document or comments change mid-session (debounced at 800ms), with position reconciliation by stable key so the current utterance is not interrupted. Architecturally, the service becomes content-agnostic: a standalone builder function composes queue items with pre-built speech text, the service reads them uniformly via a single `readItem()` method, and UI components observe the current item via type guards for highlighting. Strongly-typed item interfaces use an `extends` pattern so new item types (CLUE-417: sketch annotations, table cells) require only builder and UI changes — `readItem()` needs no modification, though `replaceQueue()` matching may need a small extension per new kind.

## Requirements

### Read Aloud Comments Integration

- When the comments panel is open on the left pane and Read Aloud is activated with a tile selected, Read Aloud reads the selected tile's content first, then that tile's comment thread (if one exists), then stops. When no tile is selected, Comments-Only Mode applies (see below).
- Before reading comments, Read Aloud announces "Comments" as a section header (only when at least one non-empty comment item exists to read)
- Comments are read in the same order they appear in the comments panel (document-level comments first, then tile comments in document order)
- For each comment thread, Read Aloud reads the thread header (tile type and title, or document title for document-level comments), then each comment as "{author name} said: {content}"
- Deleted tile comment threads are read with the "Deleted Tile" header
- If no comment thread exists for the selected tile, Read Aloud reads only the tile content
- If the comments panel is closed (or in Documents View mode), Read Aloud behavior is unchanged from CLUE-390 (reads tiles only)
- Right pane Read Aloud is unaffected by comments panel state
- Empty or whitespace-only comments are skipped silently; existing text chunking and newline handling from tile reading is reused
- Read Aloud reads all comment threads regardless of their expanded/collapsed UI state

### Comments-Only Mode

- When the comments sidebar is focused (chat panel open, no tiles selected, left pane, not Documents View), Read Aloud reads only comments — tiles are skipped entirely. The "Comments" section header is still announced before the first comment thread.

### Comment Selection and Read Aloud

- Clicking a comment thread during tile reading jumps to that thread's comments then continues with subsequent threads
- Clicking a workspace tile during comment reading switches to that tile's content, then its thread, then stops
- Closing the comments panel while Read Aloud is active stops reading entirely
- Opening the comments panel mid-read triggers a reactive queue rebuild that includes comments
- Toggling to Documents View while reading comments stops Read Aloud

### Visual Indication

- **Thread-level highlighting**: The comment thread being read is visually highlighted using the existing `chat-thread-focused` CSS class. For document-level and deleted-tile threads, the service's `currentItem.originTileId` is matched against `thread.tileId` to drive highlighting.
- **Per-comment highlighting**: Individual comments highlight one at a time as they are being read aloud, using a `.reading` CSS class with `$comment-select-background` (pale yellow) background.
- **Click-to-jump on individual comments**: Clicking an individual comment during active read-aloud jumps to that comment and begins reading from it, using `service.jumpToItem()` keyed by `commentId` (Firestore document ID).
- **Comment selection indicator**: Clicking a comment when Read Aloud is not active sets a `pendingCommentId` on the service, highlighted with an `outline: 2px solid $charcoal-light-2` (gray, matching tile selection). Clicking a tile clears the pending highlight. If Read Aloud starts while a pending comment is set, it jumps to that comment.
- **Scroll-into-view**: The currently-reading comment automatically scrolls into view using `scrollIntoView({ behavior: "smooth", block: "nearest" })`.
- Highlighting does not use programmatic focus changes on comment card elements (avoiding the existing ARIA violation).

### Logging

- Comment reading events are logged via the existing Logger system
- Events distinguish comment reading from tile reading
- Comment transition events include tileId (or "document" for document-level), commentId, threadIndex, commentIndex, and trigger (auto vs user-click)
- Start event distinguishes comment read mode: "sequential" vs "targeted"
- Logging does not include comment text, author names, or other PII

## Technical Notes

### Content-Agnostic Service with Unified Item Queue

The service was refactored to be content-agnostic: it reads a sequence of pre-built `ReadAloudQueueItem`s without knowing how to build them or what content they represent. Queue items carry their own `speechText`. The service speaks items in order, exposes the current item for UI highlighting, and handles user interactions. A strongly-typed item hierarchy uses an `extends` pattern with type guards for UI narrowing.

Queue items implemented:
- `TileReadAloudItem` (kind: "tile") — one per tile
- `SectionHeaderReadAloudItem` (kind: "section-header") — the "Comments" announcement
- `CommentReadAloudItem` (kind: "comment") — one per individual comment (not per thread). The first comment in each thread has the thread header prepended to its `speechText`.

The queue is built by a standalone pure function `buildReadAloudQueue()` in `read-aloud-queue-items.ts`, called from the component layer (ReadAloudButton). The service receives pre-built items via `start(pane, items, toolbarProps, allPaneTileIds)`.

### Reactive Queue Rebuilding

A MobX `reaction` in `ReadAloudButton` observes document tile list, comment count, panel state, and Documents View toggle (debounced at 800ms, with `comparer.structural`). When changes are detected, the queue is rebuilt using the original selection state and passed to `service.replaceQueue()` for position-aware replacement. Position reconciliation matches by stable key (`associatedTileId` for tiles, `commentId` for individual comments). The current utterance is not interrupted.

### Pane Prop Threading

The `ToolbarComponent` originally derived `pane` from `section ? "left" : "right"`, which was incorrect for Class Work/My Work document previews. An explicit `pane` prop was threaded through `EditableDocumentContent` → `DocumentToolbar` → `ToolbarComponent`, with callers passing `pane="left"`.

### Documents View State

`isDocumentView` was moved from local `useState` in ChatPanel to a `volatile` property on `persistentUI` (in-memory MobX observable, not persisted to Firebase), so `ReadAloudButton` can read it for initial queue building and the reactive rebuild can observe it.

### Key Integration Points

- `ReadAloudButton` calls `buildReadAloudQueue()` and passes results to `service.start()`
- `jumpToItem(index)` is a content-agnostic service method for click-to-jump behavior
- Comment card click handlers find the queue index by `commentId` lookup and call `jumpToItem`
- `buildTargetedSubQueue` handles workspace tile clicks during comment reading, setting `isTargetedOverride` to prevent reactive rebuilds from re-expanding the queue

## Out of Scope

- Reading comment timestamps aloud
- Read Aloud for the right pane comments
- Reading comment tags or "agree with AI" metadata aloud
- New Read Aloud button or separate controls for comments
- Fixing the comment-card ARIA role issue
- Keyboard navigation between comment threads during Read Aloud
- Skipping forward within a comment thread
- Targeted start from a document-level thread (clicking a document-level thread clears tile selection, so Read Aloud starts the full sequential flow)

## Not Yet Implemented

- **Reactive queue rebuild logging** — Adding a `TOOLBAR_READ_ALOUD_QUEUE_REBUILD` log event with trigger/count/position metadata was identified as valuable for research but deferred to a future story to limit scope. Existing START/STOP/TRANSITION events provide sufficient correlation via timestamps.
- **Read Aloud session correlation ID** — Adding a `readAloudSessionId` to log events for easier research correlation was deferred. This is a pre-existing limitation from CLUE-390, not introduced by CLUE-418. Researchers can correlate events via START/STOP timestamp pairs per user.

## Decisions

### How should comments be read when a tile is selected?
**Context**: When tiles are selected, Read Aloud reads only those tiles. If a tile is selected and the comments panel is open, should Read Aloud also read the associated comments?
**Options considered**:
- A) Selected tile reads tile content only (ignore comments even if panel is open)
- B) Selected tile reads tile content, then reads that tile's comment thread if comments panel is open
- C) Selected tile reads only the comment thread for that tile (not the tile content)

**Decision**: B — Selected tile reads tile content, then reads that tile's comment thread if comments panel is open.

---

### Can a specific comment thread be "selected" independently of tile selection?
**Context**: Clicking a comment card calls `ui.setSelectedTileId(threadId)` which selects the associated tile. There's no independent "comment selection."
**Options considered**:
- A) "Selected comment" means the comment thread associated with the currently selected tile — no new selection mechanism needed
- B) Add a new selection mechanism so individual comment threads can be focused independently
- C) Use the expanded/collapsed state of comment threads

**Decision**: A — Comment selection is derived from tile selection. Clicking a comment thread and clicking a tile are two paths to the same selection state.

---

### What should be spoken for each comment?
**Context**: Each comment has author name, timestamp, content text, and optional tags.
**Options considered**:
- A) Thread header + each comment as: "{author name} said: {content}"
- B) Thread header + each comment as just: "{content}" (no author attribution)
- C) Thread header + each comment as: "{author name}: {content}" (shorter format)

**Decision**: A — "{author name} said: {content}" for each comment.

---

### How should Read Aloud handle the transition from tiles to comments?
**Context**: When reading all content, there needs to be an audible transition between tile content and comments content.
**Options considered**:
- A) Announce "Comments" as a section header before reading comment threads
- B) No announcement — continue seamlessly from last tile
- C) Brief pause then start reading comment threads

**Decision**: A — Announce "Comments" as a section header (only when there is at least one comment thread to read).

---

### Should Read Aloud react to the comments panel opening/closing mid-read?
**Context**: If Read Aloud is reading tiles and the user opens the comments panel, should comments be appended?
**Options considered**:
- A) Only check comments panel state at start — no mid-read effect
- B) Closing the panel mid-read stops reading; opening mid-read appends comments
- C) Closing stops comment reading but continues with tiles; opening has no effect

**Decision**: B — Closing the panel mid-read stops reading entirely; opening mid-read appends comments to the queue (via reactive queue rebuild).

---

### What should happen when a workspace tile is clicked while comments are being read?
**Context**: The workspace tiles and comments panel are both visible on the left pane.
**Options considered**:
- A) Switch back to reading that tile's content (jump from comment queue back to tile queue)
- B) Switch to reading that tile's comment thread
- C) Stop reading

**Decision**: A — Switch back to reading that tile's content, then its comment thread, then stop (`buildTargetedSubQueue`).

---

### What should happen when the chat panel is in "Documents View" mode?
**Context**: Documents View shows a list of documents with comments, not comment threads.
**Options considered**:
- A) Treat Documents View the same as the comments panel being closed
- B) Read the list of document titles
- C) Automatically switch back to Comments View

**Decision**: A — Treat Documents View the same as the comments panel being closed.

---

### Documents View state bridging approach
**Context**: `isDocumentView` is local React `useState` in ChatPanel, inaccessible to the ReadAloudService for initial queue building.
**Options considered**:
- A) Keep as `useState`, have ChatPanel call `service.stop()` directly when toggling
- B) Move to `persistentUI` as volatile property so the service and builder can read it

**Decision**: Hybrid — volatile `persistentUI.isDocumentsView` for read access by ReadAloudButton and reactive rebuild, plus component-driven side effects in ChatPanel for the Documents View toggle stop.

---

### Comment sorting — replicate vs extract
**Context**: ChatPanel sorts comments in document order. The builder needs the same sorting.
**Options considered**:
- A) Replicate the sorting logic in the builder
- B) Extract to a shared utility
- C) Use the already-sorted threads from ChatPanel

**Decision**: B — Extract `sortCommentsInDocumentOrder()` into `src/components/chat/chat-comment-thread.ts` alongside `makeChatThreads` (both pure data utilities). The builder imports from there.

---

### Queue append API design
**Context**: Mid-read append behavior originally required `appendItems()` on the service.

**Decision**: Superseded by reactive queue rebuild. Instead of appending items, ReadAloudButton's MobX reaction rebuilds the full queue and calls `service.replaceQueue()` for position-aware replacement. Simpler (one reactive path) and handles content changes mid-read.

---

### Initial queue building — service vs caller
**Context**: Should the service build the queue internally or receive pre-built items?
**Options considered**:
- A) Service builds the queue — `start(pane, content, selectedTileIds, toolbarProps)`
- B) Caller builds the queue — `start(pane, items: ReadAloudQueueItem[], toolbarProps)`

**Decision**: B — Caller builds the queue using `buildReadAloudQueue()`. The service is fully content-agnostic.

---

### `jumpToItem` behavior when paused
**Context**: Should clicking a comment thread during paused Read Aloud resume reading or stay paused?

**Decision**: `jumpToItem` always resumes reading — clicking a comment thread is an explicit "play this" action. Tile selection while paused stays paused because tile clicks are ambiguous (user may be inspecting visually). The asymmetry is justified by the difference in intent signals.

---

### `null` vs `undefined` for document-level thread identity
**Context**: `ChatCommentThread.tileId` is `string | null`. Queue item fields need consistent typing for matching.

**Decision**: `originTileId` is typed as `string | null` (matching `ChatCommentThread.tileId`), so `null === null` works for document-level thread matching. `associatedTileId` remains `string | undefined` (base interface), with the builder converting `null` → `undefined`.

---

### Thread-level vs per-comment queue items
**Context**: Originally implemented as one `CommentThreadReadAloudItem` per thread. This meant the entire thread highlighted at once.

**Decision**: Replaced with one `CommentReadAloudItem` per individual comment. The first comment in each thread gets the thread header prepended to its `speechText`. This enables per-comment highlighting and click-to-jump on individual comments.

---

### Reactive rebuild protection for targeted sub-queues
**Context**: When `buildTargetedSubQueue` narrows the queue to [tile, thread?], a debounced reactive rebuild could re-expand it.

**Decision**: Added `isTargetedOverride` flag — set by `buildTargetedSubQueue`, cleared by `stop()`. `replaceQueue` early-returns when the flag is set.

---

### `replaceQueue` position reconciliation for removed items
**Context**: When the current item is removed from a rebuilt queue, the service needs to advance to the correct next item.

**Decision**: `queueIndex = Math.max(-1, Math.min(this.queueIndex, newItems.length) - 1)`. Can be -1 when the removed item was at index 0, so `advanceToNextItem` (`queueIndex + 1`) correctly picks up the new first item. Clamped to -1 (not lower) to handle repeated rebuilds before `onend` fires.
