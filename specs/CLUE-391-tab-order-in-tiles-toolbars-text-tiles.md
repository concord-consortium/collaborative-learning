# Tab Order in Tiles Toolbars - Text Tiles

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-391

**Status**: **Closed**

## Overview

Enable keyboard-only and screen reader users to navigate into text tile toolbars and content using Tab/Shift-Tab, with a focus trap that cycles through the tile title, toolbar buttons, and editor content. This builds on the page-level keyboard navigation infrastructure established in CLUE-384 (landmarks, skip links, main toolbar roving tabindex) and introduces tile-level focus traps as new work.

Low vision and low mobility students currently cannot access text tile toolbar features (bold, italic, lists, etc.) via keyboard alone. This story adds keyboard tab order within text tiles so that once a user enters a tile's focus trap, they can Tab through the tile title, toolbar, and text editor content. The toolbar buttons are custom and vary by curriculum unit, so the implementation handles different button configurations. This story also introduces the generic tile-level focus trap infrastructure (not delivered in CLUE-384, which focused on page-level navigation).

## Requirements

- When focus-trapped in a text tile, Tab cycles through focusable elements in this order: tile title (if visible) -> toolbar (single Tab stop, landing on the active button) -> text editor content
- Shift-Tab reverses the cycle order
- Tab wraps: from the last focusable element, Tab returns to the first; from the first, Shift-Tab goes to the last
- Arrow keys (Left/Right) navigate between toolbar buttons without wrapping (roving tabindex pattern within the toolbar)
- Enter/Space on a toolbar button activates that button's action (bold, italic, etc.)
- After toolbar button activation (Enter/Space), focus stays on the activated button so the user can activate additional tools and the screen reader can announce the updated state (e.g., "Bold, pressed")
- Activating a toggle button (bold, italic, underline, subscript, superscript) updates its visual selected/pressed state
- The link toolbar button opens a dialog; focus moves to the dialog and returns to the link button on close
- When focus is in the Slate text editor, standard text editing keyboard shortcuts work normally; Tab inside the editor is handled by the focus trap (advances to next element), not by the editor
- Escape from anywhere within the focus trap exits back to the tile container (gridcell level)
- Toolbar dividers/separators are skipped in keyboard navigation (not focusable)
- ArrowUp from a non-editable element within the focus trap exits the trap
- Toolbar buttons have appropriate ARIA attributes: `role="toolbar"` on toolbar container, `aria-label` on buttons, `aria-pressed` on toggle buttons
- Conditionally disabled toolbar buttons use `aria-disabled="true"` (not HTML `disabled`) so they remain focusable; activating an aria-disabled button announces "Select something to enable this action" via screen reader
- Common formatting keyboard shortcuts provided by Slate (Ctrl+B for bold, Ctrl+I for italic, etc.) continue to work; toolbar button tooltips show the corresponding keyboard shortcut where one exists
- Arrow keys (Left/Right) navigate toolbar buttons as a flat sequence regardless of visual row layout (multi-row wrapping is ignored)
- The tab order works correctly regardless of which toolbar buttons are configured for the current unit
- Focus is visible on all interactive elements (`:focus-visible` pattern)
- The tile container has `role="group"` and an `aria-label` identifying the tile type and title (e.g., "Text tile: Introduction")
- The toolbar `aria-label` identifies the tile type (e.g., "Text tile toolbar")
- Screen reader announcements are provided when entering the focus trap ("Editing tile. Press Escape to exit.") and when exiting via Escape ("Exited tile. Tab to next tile, Shift+Tab to previous.")
- When Escape→Tab navigates to a sibling tile, the destination tile allows one pass-through Tab/Shift+Tab for continued inter-tile navigation. After that single pass-through, the next tile entered will capture focus in its focus trap. Clicking a tile resets all navigation flags.
- Enter on the tile container enters the focus trap (direction-aware: enters at first element)
- Focus trap cycling is defensive: `preventDefault` is always called when focus is inside the trap, even if the target element is null, to prevent focus from accidentally escaping via browser default Tab behavior
- Tiles without `getFocusableElements()` have Tab/Shift+Tab caught by a generic fallback that exits to the tile container, preventing focus leakage

## Technical Notes

**Key files**:
- `src/components/tiles/tile-component.tsx` — Generic tile wrapper with focus trap logic (capture-phase Tab/Shift+Tab listeners, Enter to enter trap, Escape to exit, ArrowUp exit from non-editable elements, inter-tile navigation)
- `src/components/toolbar/tile-toolbar.tsx` — Generic tile toolbar (FloatingPortal, roving tabindex, Tab/Escape keyboard handling, `RegisterToolbarContext` for cross-portal communication)
- `src/components/toolbar/tile-toolbar-button.tsx` — Generic toolbar button (aria-label, aria-pressed, aria-disabled, disabled button SR announcement)
- `src/hooks/use-roving-tabindex.ts` — Roving tabindex hook (arrow keys, Home/End, tabindex management)
- `src/components/tiles/tile-api.tsx` — `ITileApi.getFocusableElements()` interface for tile-type-agnostic focus navigation

**Architecture**:
- Native capture-phase DOM listeners (`addEventListener('keydown', handler, true)`) are required for Tab/Shift+Tab because React 17's delegated events fire too late to prevent browser default focus movement
- The toolbar renders outside the tile DOM via `FloatingPortal`; `RegisterToolbarContext` (callback ref pattern) enables tile↔toolbar communication without `document.querySelector`
- `ITileApi.getFocusableElements()` returns `{ contentElement, titleElement }` — each tile type implements this for tile-type-agnostic focus navigation
- Fallback toolbar button selector `button:not([tabindex="-1"]) || button` handles roving tabindex stale state
- ArrowUp and Escape both exit the focus trap but have intentionally different post-exit behavior: Escape sets `escapedFocusTrap = true` (next Tab goes to sibling tile), ArrowUp does not (next Tab re-enters the trap)
- Two separate navigation flags prevent infinite inter-tile loops: `escapedFocusTrap` (set by Escape, propagates `tile-navigation-focus` to destination) and `justArrivedViaNav` (set by `tile-navigation-focus`, allows one pass-through but does NOT propagate). This ensures that after Escape→Tab→Shift+Tab back, Tab re-enters the focus trap instead of looping

## Out of Scope

- Tab order within non-text tile types (CLUE-392 covers table tiles; other tile types are separate stories)
- Voice typing keyboard interaction
- Screen reader announcement of text content changes
- Drag-and-drop accessibility for tiles
- Toolbar button reordering or configuration changes
- Modifying Slate.js internal keyboard handling
- Read-only text tile keyboard behavior (no toolbar renders)
- Keyboard shortcut discoverability/onboarding

## Not Yet Implemented

- **3-element title focus cycle testing** — The code path for title → toolbar → content cycling exists, but text tiles do not render a visible title (`EditableTileTitle`). This cycle cannot be tested until `getFocusableElements()` is extended to tile types that render titles (e.g., image, drawing, graph tiles).

## Decisions

### What is the desired tab order when the tile has a visible title?
**Context**: Some text tiles have editable titles shown as an input above the content. Not all text tiles show titles — it depends on tile configuration.
**Options considered**:
- A) Title (if visible) -> Toolbar buttons -> Editor content
- B) Toolbar buttons -> Title (if visible) -> Editor content
- C) Title (if visible) -> Editor content -> Toolbar buttons

**Decision**: **A** — Title (if visible) -> Toolbar buttons -> Editor content.

---

### Should ArrowUp from toolbar buttons exit the focus trap or move focus to the tile title?
**Context**: CLUE-384 established that ArrowUp from non-editable elements exits the focus trap. If a user is on a toolbar button and presses ArrowUp, should it exit the trap entirely, or move to the title first?
**Options considered**:
- A) ArrowUp always exits the focus trap (consistent with CLUE-384 pattern)
- B) ArrowUp from toolbar moves to title first, then another ArrowUp exits
- C) ArrowUp only exits from the first focusable element; otherwise it moves backward

**Decision**: **A** — ArrowUp always exits the focus trap. For low vision users the layout of the title is mostly irrelevant, and consistency is key.

---

### How should focus behave after activating a toolbar button?
**Context**: When Enter/Space is pressed on a toggle button (e.g., Bold), should focus return to the editor or stay on the button?
**Options considered**:
- A) Focus returns to the text editor after every toolbar button activation
- B) Focus stays on the toolbar button so the user can activate another tool (screen reader announces updated state)
- C) Focus returns to editor for toggle buttons, but stays on toolbar for dialog buttons

**Decision**: **B** — Focus stays on the toolbar button so the user can activate another tool and the screen reader can announce the updated state (e.g., "Bold, pressed").

---

### How should disabled toolbar buttons behave for keyboard users?
**Context**: The highlight button is disabled when no text is selected. If the button uses HTML `disabled`, it can't receive focus or keyboard events.
**Options considered**:
- A) No special handling — disabled state and tooltip are sufficient
- B) Announce via screen reader when user tries to activate a disabled button
- C) Skip disabled buttons in the tab order entirely

**Decision**: **B** — Use `aria-disabled="true"` instead of HTML `disabled` so buttons remain focusable; announce a generic reusable message ("Select something to enable this action") when activated. This pattern applies to all disabled-unless-selected buttons across tile types.

---

### Should this story include ARIA attributes on the tile toolbar?
**Context**: The existing tile toolbar had no ARIA `role`, `aria-label`, or `aria-pressed` attributes.
**Options considered**:
- A) Full ARIA — `role="toolbar"`, `aria-label` on toolbar, `aria-label` on each button, `aria-pressed` on toggles
- B) Minimal — only add what's needed for keyboard navigation
- C) Partial — add `role="toolbar"` and `aria-label` but defer state attributes

**Decision**: Developer's choice on scope to keep commits manageable. Full ARIA (option A) was implemented.

---

### Must text selection be visually preserved when Tabbing from editor to toolbar?
**Context**: The primary workflow is: select text → Tab to toolbar → activate formatting. When focus leaves a contenteditable, the browser may hide the selection highlight.
**Options considered**:
- A) Text selection must remain visually highlighted when focus is on toolbar buttons
- B) Programmatic preservation is sufficient
- C) Best-effort visual preservation

**Decision**: Rather than requiring visual selection preservation, ensure common formatting shortcuts are available directly in the editor (Ctrl+B, Ctrl+I, Ctrl+U). Toolbar button tooltips show corresponding keyboard shortcuts.

---

### How should arrow keys work in a multi-row toolbar layout?
**Context**: The toolbar splits buttons across two rows when they don't fit the available width.
**Options considered**:
- A) ArrowRight at end of row 1 wraps to start of row 2 (continuous sequence)
- B) ArrowDown/ArrowUp move between rows; ArrowLeft/ArrowRight stop at row boundaries
- C) Ignore rows entirely — treat all buttons as a flat left-to-right sequence

**Decision**: **C** — Ignore rows entirely; treat all buttons as a flat left-to-right sequence regardless of visual layout.

---

### Tab-through-all-buttons vs roving tabindex
**Context**: "Tab cycles through toolbar buttons" could mean Tab visits each button individually, or the toolbar is a single Tab stop with arrow keys for internal navigation. These are different interaction models.
**Options considered**:
- A) All toolbar buttons individually in Tab order
- B) True roving tabindex (Tab enters/exits toolbar as single stop; arrow keys navigate between buttons)

**Decision**: **B** — True roving tabindex (WAI-ARIA toolbar pattern). Tab enters/exits the toolbar as a single stop; Left/Right arrow keys navigate between buttons.

---

### ArrowUp from inside the Slate editor
**Context**: ArrowUp exits the trap from non-editable elements. The Slate editor is editable — what happens when the cursor is at the top of content and ArrowUp is pressed?
**Options considered**:
- A) ArrowUp exits the trap when cursor is at the top
- B) ArrowUp stays in the editor (does nothing at top of content)

**Decision**: **B** — ArrowUp stays in the editor and does not exit the focus trap from an editable element. Detecting "cursor is at top" in Slate is fragile. Escape is the reliable exit mechanism.

---

### Tab key behavior inside the Slate editor
**Context**: Tab inside a contenteditable is ambiguous — some editors use Tab for indentation. If Tab always advances to the next focusable element, users lose the ability to indent list items.
**Options considered**:
- A) Tab inside editor always advances to next focusable element (focus trap cycling)
- B) Tab indents; modifier key (Ctrl+Tab) exits the editor

**Decision**: **A** — Tab inside the editor advances to the next focusable element. Prioritizing keyboard shortcuts (Ctrl+B, etc.) for formatting reduces the need to Tab to the toolbar in common workflows.

---

### What counts as "standard shortcuts" for the Slate editor?
**Context**: The requirement says "if any standard shortcuts are missing, add them." The scope of "standard" is unbounded.
**Options considered**:
- A) Enumerate specific shortcuts to add
- B) Whatever Slate already provides is sufficient; just add tooltip annotations

**Decision**: **B** — Whatever Slate already provides is sufficient. The `defaultHotkeyMap` defines Ctrl+B, Ctrl+I, Ctrl+U, and Ctrl+\. Add tooltip annotations for these; do not implement new shortcuts.

---

### Link dialog focus return location
**Context**: The requirement says focus must "return to the toolbar/editor on close" which is ambiguous.

**Decision**: Focus returns to the link button that opened the dialog (standard ARIA dialog pattern). This is already handled by react-modal's built-in focus restoration.
