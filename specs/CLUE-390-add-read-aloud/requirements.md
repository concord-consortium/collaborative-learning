# TTS (Read Aloud) for Curriculum and Workspace/Document

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-390
**Repo**: https://github.com/concord-consortium/collaborative-learning
**Status**: **Ready for Implementation**

## Overview

Add a Read Aloud (text-to-speech) feature to CLUE that enables low-vision and English language learner students to have tile content read aloud to them, with controls on both the curriculum (left) and workspace/document (right) pane toolbars sharing a single global Read Aloud state.

## Project Owner Overview

CLUE currently lacks text-to-speech accessibility support, which limits usability for low-vision students and English language learners. This feature adds Read Aloud buttons to both the curriculum (left pane) and workspace/document (right pane) toolbars. When activated, the browser's Web Speech API reads tile content aloud — either the currently selected tile or all tiles sequentially from top to bottom. Read Aloud is a global singleton: only one pane reads at a time, and activating it on one pane deactivates the other. This is part of the broader CLUE-382 Accessibility epic (TTS/STT and tabbing hierarchy).

## Background

This story is part of the **CLUE-382 "Accessibility - TTS/STT and tabbing hierarchy"** epic, funded by the 371 MODS grant (GRANT-10). The ticket was created by Kiley Brown and reported by Leslie Bondaryk.

CLUE's document model organizes content as tiles arranged in rows within documents. Each pane (left = curriculum, right = workspace/document) has its own toolbar and document. The existing tile system provides:

- **Text extraction**: `TextContentModel.asPlainText()` for text tiles; `TileModel.computedTitle` for tile titles
- **Tile selection**: `UIModel.selectedTileIds` in the MobX State Tree UI store
- **Toolbar system**: Both pane-level toolbars (`src/components/toolbar.tsx`, `src/components/document/document-toolbar.tsx`) and per-tile floating toolbars (`src/components/toolbar/tile-toolbar.tsx`)
- **Logging**: Centralized `Logger.log()` with typed event names

There is no existing TTS or speech synthesis usage in the codebase. The Web Speech API (`window.speechSynthesis`) is well-supported in modern browsers (Chrome, Edge, Safari; limited in Firefox).

The ticket notes: *"This description is written with the assumption that it is 'easy' to grab any readable text in any tile. If it is hard, we can simplify to read only text tiles for this implementation."*

Two UI mockup images are attached to the ticket showing button placement on both toolbars. A Zeplin screen exists at `https://app.zeplin.io/project/5d62a554d64a9e02dcad80de/screen/697ad4c5cf6ad475046c9461` with the full design. The Read Aloud Tool icon SVG has been exported to `src/clue/assets/icons/read-aloud-tool.svg`.

## Requirements

### Read Aloud Button

- Read Aloud buttons exist on both the curriculum (left) toolbar and the document/workspace (right) toolbar
- Buttons have tooltips describing their function
- Buttons have default, hover, and selected/active states
- Cursor changes to pointer (hand) on hover/rollover
- Read Aloud is a global singleton — only one pane can be reading at a time. Activating Read Aloud on one pane automatically deactivates it on the other pane (returning that button to default state)
- If the browser does not support the Web Speech API, hide the Read Aloud button entirely
- Icon: `src/clue/assets/icons/read-aloud-tool.svg` (speaker with sound waves, `#707070`, 36x34px)
- Button must use `aria-pressed` to communicate toggle state and `aria-label="Read Aloud"`

### Read Aloud Behavior

- When clicked/enabled, Read Aloud commences using the browser's Web Speech API (`speechSynthesis`)
- **If a single tile is selected**: reads the readable text in that selected tile only, then stops automatically and returns the button to default state
- **If multiple tiles are selected**: reads the selected tiles in document order, then stops automatically
- **If no tile is selected**: reads from the first tile in document order within the currently visible tab/section in the pane, proceeding sequentially until the last tile, then stops automatically. Only tiles in the active tab/section are read. If there are no tiles, Read Aloud immediately stops and resets the button
- Read Aloud stays within its pane — if enabled on the left side, it does not continue to the right side
- When Read Aloud stops (either naturally or manually), the last tile being read should remain selected (visual highlight via `selectedTileIds`). DOM focus stays on the toolbar button
- The currently-being-read tile is visually indicated using the existing tile selection highlight (tile becomes selected)
- Read tile title first if one exists, then tile content (e.g., "Introduction. [content...]"). If the tile has no title, skip directly to the content
- For tiles with no readable text content (e.g., geometry, graph, image): announce tile type and title, then move to the next tile (e.g., "Graph tile: Population Growth")

### Read Aloud Controls

- The Read Aloud feature can be turned off at any point by clicking the toolbar button again (toggle behavior), returning the button to default state. This includes while paused — clicking the button while paused stops Read Aloud rather than resuming it
- While paused, the button remains in "active" state and the current tile remains selected. Spacebar is the only resume mechanism
- When Read Aloud is actively reading and the user selects another tile in the same pane (via click or keyboard), Read Aloud switches to the newly selected tile and starts reading its content. If Read Aloud is paused, selecting a different tile updates the target tile but stays paused
- When Read Aloud is active and the user selects a tile in the other pane, Read Aloud stops and the button resets to default state
- When Read Aloud is active and the user switches tabs/sections, Read Aloud stops and the button resets to default state
- **Keyboard controls**:
  - When the Read Aloud button is focused, `Enter` toggles Read Aloud on/off
  - When Read Aloud is running, `Spacebar` toggles pause/resume (global listener, not on the button)
  - When Read Aloud is running, `Escape` cancels Read Aloud (global listener, not on the button)
  - Global `Spacebar` and `Escape` listeners must be suppressed when focus is inside an editable element (input, textarea, contenteditable) or inside a modal dialog, menu, or dropdown

### Readable Content (Initial Implementation)

- Tile titles (read first when present)
- Text tile content (via `asPlainText()`)
- Future iterations may add support for additional tile types (tables, data cards, etc.)

### Logging

- Read Aloud activation, deactivation, and tile transitions should be logged via the existing Logger system
- Log events should include: pane (left/right), document id, tile id, and trigger reason (e.g., user-initiated, natural completion, error)
- Do not log the spoken text content itself

## Technical Notes

### Relevant Files

| Component | Path | Relevance |
|-----------|------|-----------|
| Main Toolbar | `src/components/toolbar.tsx` | Left pane toolbar — add Read Aloud button here |
| Document Toolbar | `src/components/document/document-toolbar.tsx` | Right pane toolbar wrapper |
| Tile Toolbar | `src/components/toolbar/tile-toolbar.tsx` | Per-tile floating toolbar (may not need modification) |
| Button Manager | `src/components/toolbar/toolbar-button-manager.tsx` | Button registry for tile toolbars |
| Canvas | `src/components/document/canvas.tsx` | Main document rendering, keyboard shortcuts |
| Document Content | `src/components/document/document-content.tsx` | Scroll container for tile rows |
| Tile Model | `src/models/tiles/tile-model.ts` | `computedTitle`, tile metadata |
| Text Content | `src/models/tiles/text/text-content.ts` | `asPlainText()` for text extraction |
| UI Store | `src/models/stores/ui.ts` | `selectedTileIds`, selection management |
| Logger | `src/lib/logger.ts` | Event logging |
| Logger Types | `src/lib/logger-types.ts` | Log event name enum |
| Hot Keys | `src/utilities/hot-keys.ts` | Keyboard shortcut system |
| Tile Comments | `src/components/tiles/tile-comments.tsx` | Comment rendering and model |
| Read Aloud Icon | `src/clue/assets/icons/read-aloud-tool.svg` | Toolbar button icon |

### Text Extraction Strategy

- **Text tiles**: Use `TextContentModel.asPlainText()` — handles plain text, HTML, markdown, and Slate JSON formats
- **Tile titles**: Use `TileModel.computedTitle` (falls back from user-set title to content-derived title)
- **Other tile types**: For initial implementation, only read title. Future work may add per-tile-type `getReadableText()` methods.

### Web Speech API

- Use `window.speechSynthesis` and `SpeechSynthesisUtterance`
- Supports `onend`, `onpause`, `onresume`, `onerror` events for state management
- **Error handling**: On `onerror`, stop Read Aloud and reset the button to default state silently
- Feature detection: check `'speechSynthesis' in window` — hide button entirely if unsupported
- Browser support: Chrome, Edge, Safari (good), Firefox (limited voice selection)
- **Screen reader coexistence**: Read Aloud is primarily targeted at ELL students and users who don't use a full screen reader. Simultaneous use with a screen reader (JAWS, NVDA, VoiceOver) may produce overlapping speech — this is a known limitation

### Tile Traversal

- Document content model (`DocumentContentModel`) provides `getAllTileIds()` and `getTile(tileId)` for sequential traversal
- Row-based ordering determines reading order (top-to-bottom, left-to-right within rows)

### Design

- Zeplin screen: `https://app.zeplin.io/project/5d62a554d64a9e02dcad80de/screen/697ad4c5cf6ad475046c9461`
- Icon exported: `src/clue/assets/icons/read-aloud-tool.svg`
- Match existing toolbar button patterns for styling (hover, active states)

## Out of Scope

- Speech-to-text (voice typing) — covered by sibling story CLUE-383
- Read Aloud for non-tile UI elements (navigation, menus, dialogs)
- Voice/language selection UI (use browser defaults)
- Read Aloud speed controls
- Highlighting/visual tracking of individual words/sentences as they are read
- Read Aloud for teacher/admin views
- Readable text extraction for non-text tile types beyond titles (tables, data cards, expressions, etc.) — deferred to future iteration
- Sketch tile comments — deferred from initial implementation per decision to start with minimum scope
- Auto-scrolling to keep the currently-being-read tile visible

## Open Questions

### RESOLVED: What specific keyboard shortcuts should control Read Aloud?
**Context**: The ticket mentions "Read aloud can be controlled via keyboard (see spec)" but the spec is not linked. We need to define which keyboard shortcuts activate/deactivate Read Aloud and navigate between tiles during reading.
**Options considered**:
- A) Use a simple toggle shortcut (e.g., `Alt+R` or `Ctrl+Shift+R`) for start/stop only
- B) Full keyboard controls: toggle (start/stop), skip to next tile, skip to previous tile, pause/resume
- C) Defer keyboard shortcuts to a follow-up story

**Decision**: No dedicated shortcut keys. When the Read Aloud button is focused, `Enter` toggles Read Aloud. When running, `Spacebar` (global listener) toggles pause/resume and `Escape` (global listener) cancels Read Aloud.

### RESOLVED: Should Read Aloud read tile titles before tile content?
**Context**: When reading a tile, should it announce the tile title first (e.g., "Text tile: Introduction. [content...]") or just read the content directly? Reading titles helps orientation but adds verbosity.
**Options considered**:
- A) Always read tile title first, then content
- B) Only read tile title if the tile has a user-set title
- C) Never read tile title, just content
- D) Read tile type label + title if set (e.g., "Text: My Notes. [content]")

**Decision**: A — Always read tile title first, then content.

### RESOLVED: How should Read Aloud handle tiles with no readable text?
**Context**: Some tiles (e.g., geometry, graph, image) may have no meaningful text to read. When reading sequentially, should these tiles be skipped silently, announced, or skipped with an indication?
**Options considered**:
- A) Skip silently — move to the next tile with readable text
- B) Announce tile type and title, then move on (e.g., "Graph tile: Population Growth")
- C) Only skip truly empty tiles; read title if available

**Decision**: B — Announce tile type and title, then move to the next tile.

### RESOLVED: Which tile types should support readable text beyond the minimum?
**Context**: The ticket says "at minimum: tile titles, text tile content, and comments on sketch tiles" and ideally "any readable text in any tile." Implementing per-tile-type text extraction varies in complexity.
**Options considered**:
- A) Minimum only (tile titles + text tile content) for initial implementation
- B) Minimum plus table and data card tiles
- C) All tile types that have any text content
- D) Define a `getReadableText()` interface that each tile plugin can optionally implement

**Decision**: A — Minimum only (tile titles + text tile content) for initial implementation.

### RESOLVED: Should there be visual indication of which tile is currently being read?
**Context**: While full text highlighting is out of scope, there may be value in showing which tile is currently being read.
**Options considered**:
- A) Use existing tile selection highlight — select the tile being read
- B) Add a distinct "reading" visual state (e.g., colored border) separate from selection
- C) No additional visual indication beyond the button's active state

**Decision**: A — Use existing tile selection highlight.

### RESOLVED: What should happen if the browser does not support the Web Speech API?
**Context**: While modern browsers broadly support `speechSynthesis`, older browsers or certain configurations may not.
**Options considered**:
- A) Hide the Read Aloud button entirely if API is not available
- B) Show the button but disable it with a tooltip explaining the requirement
- C) Show the button and display an error message when clicked

**Decision**: A — Hide the Read Aloud button entirely.

### RESOLVED: Are there Zeplin designs for the Read Aloud button states and placement?
**Context**: The Jira ticket has two attached mockup images showing button placement, but detailed design specs may exist in Zeplin.
**Options considered**:
- A) Yes — provide the Zeplin URL so design specs can be fetched
- B) No — use the Jira mockups and match existing toolbar button patterns
- C) Designs are pending — flag as a dependency

**Decision**: A — Zeplin designs exist but the screen data is too large to process in full. The icon SVG has been exported. Use Jira mockups and existing toolbar button patterns for styling. Zeplin URL for reference: `https://app.zeplin.io/project/5d62a554d64a9e02dcad80de/screen/697ad4c5cf6ad475046c9461`

## Self-Review

### Senior Engineer

#### RESOLVED: Spacebar global listener may conflict with text input
Global Spacebar/Escape listeners could intercept keypresses meant for editing. Added requirement that listeners are suppressed when focus is inside an editable element.

#### RESOLVED: Multiple tile selection behavior underspecified
Clarified that when multiple tiles are selected, they are read in document order.

---

### QA Engineer

#### RESOLVED: Pause/resume state unspecified
Clarified that while paused, the button remains active and the current tile remains selected.

---

### WCAG Accessibility Expert

#### RESOLVED: ARIA attributes for the Read Aloud button
Added requirement for `aria-pressed` toggle state and `aria-label="Read Aloud"`.

---

### Student

No issues found.

### Self-Review (Round 2)

### Senior Engineer

#### RESOLVED: speechSynthesis is a global singleton — concurrent pane conflict
Changed from independent per-pane operation to a global singleton. Activating on one pane deactivates the other.

#### RESOLVED: Tile with no title
Clarified that if a tile has no title, skip directly to content rather than announcing the tile type.

---

### WCAG Accessibility Expert

#### RESOLVED: Screen reader and Read Aloud conflict
Added note under Technical Notes that simultaneous use with a screen reader may produce overlapping speech, and that Read Aloud targets ELL students and non-screen-reader users.

### Self-Review (Round 3)

### Senior Engineer

#### RESOLVED: Cross-pane tile selection while reading
Clarified that selecting a tile in the other pane stops Read Aloud. Same-pane selection switches to the new tile.

#### RESOLVED: Speech API error handling
Added that on `onerror`, Read Aloud stops and the button resets silently.

---

### QA Engineer

#### RESOLVED: Overview and Project Owner Overview were stale
Updated both sections to reflect the global singleton decision instead of "independent controls."

### Self-Review (Round 4)

### Senior Engineer

#### RESOLVED: Button click while paused — stop or resume?
Clarified that clicking the button while paused stops Read Aloud. Spacebar is the only resume mechanism.

#### RESOLVED: Scope of "no tile selected" — which tab?
Clarified that Read Aloud only reads tiles in the currently visible/active tab or section.

### Self-Review (Round 5)

### Senior Engineer

#### RESOLVED: Tile selection while paused
Clarified that selecting a different tile while paused updates the target tile but stays paused.

#### RESOLVED: Auto-scroll when advancing tiles
Decided not to add auto-scroll — it could introduce out-of-scope complexity. Added to Out of Scope.

### Self-Review (Round 6)

### Senior Engineer

#### RESOLVED: No readable tiles in the pane
Clarified that if there are no tiles, Read Aloud immediately stops and resets the button.

### Self-Review (Round 7)

### Senior Engineer

#### RESOLVED: Tab/section switch while Read Aloud is running
Clarified that switching tabs/sections stops Read Aloud and resets the button.

## External Review (Copilot)

19 points reviewed, 4 changes applied:

1. Changed "top" to "first tile in document order" for clarity in no-selection behavior
2. Clarified that the last tile remains selected via `selectedTileIds` and DOM focus stays on the toolbar button when Read Aloud stops
3. Broadened global Spacebar/Escape listener suppression to include modal dialogs, menus, and dropdowns (not just editable elements)
4. Expanded logging requirements with specific event data (pane, document id, tile id, trigger reason) and a privacy note (do not log spoken text)

Remaining points (Web Speech API chunking quirks, deterministic ordering function, active section subscription, tile type string mapping, `<button>` element, `aria-describedby`, screen reader selection announcements, state machine diagram, browser voice list edge case, title-but-empty-text edge case, rapid user actions, pause/resume logging) were assessed as implementation details or already covered by existing requirements — no changes needed.
