# TTS (Read Aloud) for Curriculum and Workspace/Document

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-390

**Status**: **Closed**

## Overview

Add a Read Aloud (text-to-speech) feature to CLUE that enables low-vision and English language learner students to have tile content read aloud to them, with controls on both the curriculum (left) and workspace/document (right) pane toolbars sharing a single global Read Aloud state. When activated, the browser's Web Speech API reads tile content aloud — either the currently selected tile(s) or all tiles sequentially from top to bottom. Read Aloud is a global singleton: only one pane reads at a time, and activating it on one pane deactivates the other.

## Requirements

### Read Aloud Button

- Read Aloud buttons exist on both the curriculum (left) toolbar and the document/workspace (right) toolbar
- Buttons have tooltips describing their function
- Buttons have default, hover, and selected/active states with pointer cursor on hover
- Read Aloud is a global singleton — only one pane can be reading at a time; activating on one pane deactivates the other
- If the browser does not support the Web Speech API, hide the Read Aloud button entirely
- Icon: `src/clue/assets/icons/read-aloud-tool.svg` (speaker with sound waves, `#707070`, 36x34px)
- Button uses `aria-pressed` to communicate toggle state and `aria-label="Read Aloud"`

### Read Aloud Behavior

- When clicked/enabled, Read Aloud commences using the browser's Web Speech API (`speechSynthesis`)
- **Single tile selected**: reads that tile only, then stops automatically
- **Multiple tiles selected**: reads selected tiles in document order, then stops automatically
- **No tile selected**: reads from the first tile in document order within the currently visible tab/section, proceeding sequentially until the last tile, then stops automatically
- Read Aloud stays within its pane — does not cross to the other side
- When Read Aloud stops, the last tile being read remains selected; DOM focus stays on the toolbar button
- Currently-being-read tile is visually indicated using the existing tile selection highlight
- Read tile title first if one exists, then tile content; if no title, skip directly to content
- For tiles with no readable text content: announce tile type and title, then move to next tile

### Read Aloud Controls

- Toggle off at any point by clicking the toolbar button again, including while paused
- While paused, button remains active and current tile remains selected; Spacebar is the only resume mechanism
- Selecting another tile in the same pane while reading switches to that tile; while paused, updates target tile but stays paused
- Selecting a tile in the other pane stops Read Aloud
- Switching tabs/sections stops Read Aloud
- **Keyboard**: Enter toggles when button is focused; Spacebar (global) toggles pause/resume; Escape (global) cancels. Global listeners suppressed in editable elements, modal dialogs, menus, and dropdowns

### Readable Content (Initial Implementation)

- Tile titles (read first when present)
- Text tile content (via `asPlainText()`)

### Logging

- Log activation, deactivation, and tile transitions via existing Logger system
- Events include: pane (left/right), document id, tile id, and trigger reason
- Do not log spoken text content

## Technical Notes

- **Text extraction**: `TextContentModel.asPlainText()` for text tiles; `TileModel.computedTitle` for tile titles
- **Web Speech API**: Use `window.speechSynthesis` and `SpeechSynthesisUtterance` with `onend`/`onerror` callbacks
- **Text chunking**: Split speech text at sentence boundaries (~200 char max) to work around Chrome's ~15-second utterance cutoff
- **Stale callback guard**: Generation counter (`readGeneration`) prevents cancelled utterance callbacks from interfering with new reads
- **Tile traversal**: `DocumentContentModel.getAllTileIds()` provides row-based reading order (top-to-bottom, left-to-right)
- **Screen reader coexistence**: Simultaneous use with a screen reader may produce overlapping speech — known limitation; feature targets ELL students and non-screen-reader users

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

## Not Yet Implemented

- **Keyboard accessibility on ReadAloudButton**: The button is rendered as a `<div role="button">` without `tabIndex` or `onKeyDown` handler, so keyboard users cannot focus or activate it. Deferred to future accessibility work across all toolbar buttons.
- **`hiddenTitle` tile metadata**: The `hiddenTitle` property was added to tile component info and marked on Text, Table, AI, and Starter tiles, but the check is disabled in `prepareTile()` (commented out with TODO). Currently all tile titles are read regardless of `hiddenTitle`.

## Decisions

### What specific keyboard shortcuts should control Read Aloud?
**Context**: The ticket mentions keyboard control but doesn't specify which shortcuts.
**Options considered**:
- A) Simple toggle shortcut (e.g., `Alt+R` or `Ctrl+Shift+R`) for start/stop only
- B) Full keyboard controls: toggle, skip next/previous tile, pause/resume
- C) Defer keyboard shortcuts to a follow-up story

**Decision**: No dedicated shortcut keys. When the Read Aloud button is focused, Enter toggles Read Aloud. When running, Spacebar (global listener) toggles pause/resume and Escape (global listener) cancels Read Aloud.

---

### Should Read Aloud read tile titles before tile content?
**Context**: Reading titles helps orientation but adds verbosity.
**Options considered**:
- A) Always read tile title first, then content
- B) Only read tile title if user-set
- C) Never read tile title
- D) Read tile type label + title if set

**Decision**: A — Always read tile title first, then content.

---

### How should Read Aloud handle tiles with no readable text?
**Context**: Some tiles (geometry, graph, image) have no meaningful text.
**Options considered**:
- A) Skip silently
- B) Announce tile type and title, then move on
- C) Only skip truly empty tiles; read title if available

**Decision**: B — Announce tile type and title, then move to the next tile.

---

### Which tile types should support readable text beyond the minimum?
**Context**: The ticket ideally wants "any readable text in any tile" but per-tile-type extraction varies in complexity.
**Options considered**:
- A) Minimum only (tile titles + text tile content) for initial implementation
- B) Minimum plus table and data card tiles
- C) All tile types with any text content
- D) Define a `getReadableText()` interface per tile plugin

**Decision**: A — Minimum only (tile titles + text tile content) for initial implementation.

---

### Should there be visual indication of which tile is currently being read?
**Context**: Full text highlighting is out of scope, but showing which tile is being read has value.
**Options considered**:
- A) Use existing tile selection highlight
- B) Add a distinct "reading" visual state
- C) No additional visual indication

**Decision**: A — Use existing tile selection highlight.

---

### What should happen if the browser does not support the Web Speech API?
**Context**: Modern browsers broadly support `speechSynthesis`, but older browsers may not.
**Options considered**:
- A) Hide the Read Aloud button entirely
- B) Show button but disable with tooltip
- C) Show button and display error on click

**Decision**: A — Hide the Read Aloud button entirely.

---

### Are there Zeplin designs for the Read Aloud button states and placement?
**Context**: Detailed design specs may exist in Zeplin beyond the Jira mockups.
**Options considered**:
- A) Use Zeplin designs
- B) Use Jira mockups and match existing patterns
- C) Designs pending

**Decision**: Zeplin designs exist but the screen data is too large to process in full. The icon SVG was exported. Used Jira mockups and existing toolbar button patterns for styling.

---

### Spacebar global listener may conflict with text input
**Context**: Global Spacebar/Escape listeners could intercept keypresses meant for editing.

**Decision**: Listeners are suppressed when focus is inside an editable element (input, textarea, contenteditable) or inside a modal dialog, menu, or dropdown.

---

### Multiple tile selection behavior
**Context**: What happens when multiple tiles are selected?

**Decision**: Multiple selected tiles are read in document order.

---

### Pause/resume state
**Context**: What happens to the UI when Read Aloud is paused?

**Decision**: While paused, the button remains in active state and the current tile remains selected.

---

### ARIA attributes for the Read Aloud button
**Context**: Accessibility requirements for the toggle button.

**Decision**: Button uses `aria-pressed` for toggle state and `aria-label="Read Aloud"`.

---

### speechSynthesis is a global singleton — concurrent pane conflict
**Context**: `speechSynthesis` can only speak one utterance at a time, so independent per-pane operation would conflict.

**Decision**: Changed to global singleton. Activating on one pane deactivates the other.

---

### Tile with no title
**Context**: How to handle tiles that have no title set.

**Decision**: If a tile has no title, skip directly to content rather than announcing the tile type prefix.

---

### Screen reader and Read Aloud conflict
**Context**: Users running a screen reader simultaneously with Read Aloud would hear overlapping speech.

**Decision**: Accepted as a known limitation. Read Aloud targets ELL students and non-screen-reader users. Added note in Technical Notes.

---

### Cross-pane tile selection while reading
**Context**: What happens when the user selects a tile in the opposite pane during Read Aloud?

**Decision**: Selecting a tile in the other pane stops Read Aloud. Same-pane selection switches to the new tile.

---

### Speech API error handling
**Context**: How to handle `onerror` from `SpeechSynthesisUtterance`.

**Decision**: On `onerror`, Read Aloud stops and the button resets silently.

---

### Button click while paused — stop or resume?
**Context**: When the user clicks the Read Aloud button while paused, should it resume or stop?

**Decision**: Clicking the button while paused stops Read Aloud. Spacebar is the only resume mechanism.

---

### Scope of "no tile selected" — which tab?
**Context**: When no tile is selected, which tiles are read?

**Decision**: Only tiles in the currently visible/active tab or section are read.

---

### Tile selection while paused
**Context**: What happens when the user selects a different tile while Read Aloud is paused?

**Decision**: Selecting a different tile while paused updates the target tile but stays paused.

---

### Auto-scroll when advancing tiles
**Context**: Should the view auto-scroll to keep the currently-being-read tile visible?

**Decision**: No auto-scroll — it could introduce out-of-scope complexity. Added to Out of Scope.

---

### No readable tiles in the pane
**Context**: What happens when Read Aloud is activated on a pane with no tiles?

**Decision**: Read Aloud immediately stops and resets the button.

---

### Tab/section switch while Read Aloud is running
**Context**: What happens when the user switches tabs or sections during active reading?

**Decision**: Switching tabs/sections stops Read Aloud and resets the button.
