# Tab Order in Tiles Toolbars - Text Tiles

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-391

**Status**: **Closed**

## Overview

Enable keyboard-only and screen reader users to navigate into text tile toolbars and content using Tab/Shift-Tab, with a focus trap that cycles through the tile title, toolbar buttons, and editor content. This builds on the page-level keyboard navigation infrastructure established in CLUE-384 (landmarks, skip links, main toolbar roving tabindex) and introduces tile-level focus traps as new work.

Low vision and low mobility students currently cannot access text tile toolbar features (bold, italic, lists, etc.) via keyboard alone. This story adds keyboard tab order within text tiles so that once a user enters a tile's focus trap, they can Tab through the tile title, toolbar, and text editor content. The toolbar buttons are custom and vary by curriculum unit, so the implementation handles different button configurations. This story also introduces the generic tile-level focus trap infrastructure (not delivered in CLUE-384, which focused on page-level navigation).

## Requirements

- When focus-trapped in a tile, Tab cycles through focusable elements in this order: tile title (if visible) -> toolbar (single Tab stop, landing on the active button) -> tile's editable content
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
- When Escape→Tab navigates to a sibling tile, the destination tile auto-enters its focus trap (via `handleFocus`). Clicking a tile resets the escaped state.
- Tab on the tile container auto-enters the focus trap (via `handleFocus` on the `tabIndex={0}` container); Enter also enters the focus trap (direction-aware: enters at first element)
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
- `ITileApi.getFocusableElements()` returns `{ contentElement, titleElement, focusContent }` — each tile type implements this for tile-type-agnostic focus navigation. The optional `focusContent` callback allows tiles with custom editors (e.g., Slate) to use their own focus API instead of native `.focus()`
- Fallback toolbar button selector `button:not([tabindex="-1"]) || button` handles roving tabindex stale state
- ArrowUp and Escape both exit the focus trap but have intentionally different post-exit behavior: Escape sets `escapedFocusTrap = true` (next Tab goes to sibling tile), ArrowUp does not (next Tab re-enters the trap)
- `escapedFocusTrap` flag (set by Escape, cleared on use or click) ensures the next Tab does inter-tile navigation instead of re-entering the focus trap
- Tile containers use `tabIndex={0}` so they are reachable via native Tab navigation from the workspace toolbar. The `handleFocus` handler auto-enters the focus trap when the container receives direct focus from outside the tile (guarded by `escapedFocusTrap` to avoid re-entering after Escape, and by `relatedTarget` to distinguish external focus from internal focus moves)
- Slate editors require `ReactEditor.focus()` instead of native `.focus()` to properly activate. Additionally, `ReactEditor.focus()` does not create a selection if the editor has never been focused before — the `focusContent` callback must set a default selection (cursor at end of document) so keyboard input has an insertion point

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
**Context**: Some tiles have editable titles shown as an input above the content. Not all tiles show titles — it depends on tile configuration.
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

---

## Amendment: Tab Focuses Tile Without Selecting or Entering Focus Trap

**Date**: 2026-03-03

**Trigger**: PM feedback after testing the built branch. The auto-entry behavior (Tab immediately focusing the text editor or other tile content) was not the desired interaction. Additionally, auto-focusing the text editor did not show the toolbar until the user typed, creating a confusing UX.

### Superseded Requirements

The following original requirements are replaced by this amendment:

- **Line 35** (SR announcements): The single "Editing tile" announcement on Tab entry is replaced by two distinct announcements — one for focusing, one for editing.
- **Line 36** ("When Escape→Tab navigates to a sibling tile, the destination tile auto-enters its focus trap"): Tab no longer auto-enters the focus trap on any tile.
- **Line 37** ("Tab on the tile container auto-enters the focus trap via handleFocus"): Tab now focuses the tile without selecting it or entering the focus trap. Enter is the only entry mechanism.
- **Lines 55-57** (architecture notes describing `escapedFocusTrap` mechanics and `handleFocus` auto-entry): Both are superseded by the Technical Changes section below — `escapedFocusTrap` is removed with no replacement, and `handleFocus` no longer auto-enters the trap.
- **Implementation note**: The `tileHandlesOwnSelection` guard in `handleFocus` (line 604) previously prevented auto-selection and auto-entry. After this amendment, `handleFocus` only announces — the guard now prevents the SR announcement for tiles like placeholders. This is acceptable (they don't need "Press Enter to edit").

### Updated Requirements

- Tab on a tile container shows a **focus ring** (`:focus-visible`) on the tile but does **not** select it in the UI store — the toolbar does not appear, and no selected border is shown
- Tab/Shift+Tab on a tile container navigates to the next/previous sibling tile, showing the focus ring on the destination (the destination tile is NOT selected)
- Enter on a focused tile container **always selects** the tile unconditionally (toolbar becomes visible, selected border appears) and then attempts to enter the focus trap. Focus goes to the first available content element (title if present, or Slate editor). For tiles with no content to focus (e.g., drawing tiles), Enter selects the tile (toolbar appears) but focus stays on the container — the user can then Tab to enter the focus trap and reach the toolbar.
- Escape from within the focus trap **always unselects** the tile (toolbar hides, selected border removed) and returns focus to the tile container with a focus ring
- Tiles with no focusable elements: Tab still stops on them and shows a focus ring. Enter selects the tile (toolbar appears) but focus remains on the container since there is no content to focus. Tab then enters the focus trap to reach the toolbar.
- A `:focus-visible` style must be added to `.tool-tile` since the existing `outline: none` on `:focus` removes the browser default. The style should be consistent with the existing `:focus-visible` pattern used on toolbar buttons (box-shadow inset). When a tile is both selected (teal border) and container-focused (e.g., after Enter → ArrowUp), both visual indicators show simultaneously — the selected border indicates "toolbar visible / editing context" while the focus ring indicates "keyboard focus is here"
- Tile toolbar buttons using `aria-disabled="true"` must be visually styled as disabled. The existing `button:disabled` rule in `src/components/toolbar/toolbar.scss` (opacity 25%, cursor default) only targets the HTML `disabled` attribute and does not apply to `aria-disabled`. The selector must be updated to also match `&[aria-disabled="true"]`, using 35% opacity to match the main toolbar's pattern in `src/components/toolbar.scss`
- Screen reader announcements:
  - On Tab focusing a tile: "Tile focused. Press Enter to edit." (Note: the browser will also announce the tile's `aria-label`, e.g. "Text tile: Introduction, group" — the live region instruction supplements this.)
  - On Enter entering the focus trap (content focused): "Editing tile. Press Escape to exit."
  - On Enter when no content to focus (e.g., drawing tile): "Tile selected. Press Tab to access toolbar, Escape to exit."
  - On Escape exiting the focus trap: "Exited tile. Tab to next tile, Shift+Tab to previous." (unchanged)

### Keyboard Navigation Summary

| State | Key | Result |
|---|---|---|
| Tile focused (not selected) | Tab | Navigate to next sibling tile |
| Tile focused (not selected) | Shift+Tab | Navigate to previous sibling tile |
| Tile focused (not selected) | Enter | Select tile + enter focus trap (or stay on container if no content) |
| Tile selected, focus on container | Tab | Enter focus trap (toolbar/content reachable) |
| Tile selected, focus on container | Shift+Tab | Enter focus trap backward (content first) |
| Tile selected, focus on container | Enter | Re-enter focus trap |
| Inside focus trap | Tab/Shift+Tab | Cycle within trap (title ↔ toolbar ↔ content) |
| Inside focus trap | Escape | Unselect tile, focus container (focus ring only) |
| Inside focus trap | ArrowUp (non-editable) | Exit to container, tile stays selected |

### Decisions

#### Should Escape unselect a mouse-clicked tile?

**Context**: When a user clicks a tile, `handlePointerDown` selects it (toolbar appears). If the user then presses Escape from inside the content, should the tile be unselected (toolbar hides)? Mouse users expect their click-selection to persist. But keyboard-only users who Enter a tile and then Escape expect to return to the focus-ring-only browsing state.

**Options considered**:
- A) Escape always unselects — simple, consistent, but surprising for mouse users
- B) Escape only unselects keyboard-entered tiles — requires tracking entry method, but matches user expectations for both input modes

**Decision**: **A** — Escape always unselects, regardless of entry method. Option B was initially chosen but review #4 identified a **WCAG 2.1.2 keyboard trap**: after mouse click → Escape (keeps selection) → Tab (re-enters trap because tile is still selected) → Escape → Tab → infinite loop with no keyboard exit. Option A avoids this entirely with no additional flags. Mouse users who want to re-enter can simply click again. The `enteredViaKeyboard` flag is not needed.

---

#### Should Enter select the tile before or after entering the focus trap?

**Context**: The toolbar renders via MobX observer and is gated on `ui.selectedTileIds.includes(id)`. MobX + React 17 batches observer re-renders — the toolbar does NOT render synchronously when `setSelectedTileId()` is called. If Enter calls `setSelectedTileId()` then immediately calls `enterFocusTrap()`, the toolbar DOM doesn't exist yet and `getFocusTrapElements()` returns null for the toolbar button.

**Options considered**:
- A) Select first, then enter trap — toolbar not yet in DOM, so initial focus skips toolbar and goes to content. Toolbar becomes reachable via Tab cycling on the next frame. Simple, no async complexity.
- B) Enter trap first, only select on success — toolbar never exists to focus, and tiles without `getFocusableElements()` (drawing, diagram) can never be keyboard-entered since `enterFocusTrap` always fails.
- C) Select first, defer `enterFocusTrap` to `requestAnimationFrame` — toolbar renders first, initial focus can land on toolbar. Adds async complexity and race conditions.

**Decision**: **A** — Select unconditionally, then enter trap best-effort. Initial focus goes to content (title or Slate editor) since toolbar hasn't rendered yet. This is acceptable because: (1) the toolbar appears on the next render frame and becomes reachable via Tab, (2) tiles without content (drawing, diagram) are still keyboard-accessible — Enter selects them and Tab reaches the toolbar, (3) no async complexity.

### Technical Changes

- The `escapedFocusTrap` flag has been **removed entirely** with **no replacement flag**. The selection state (`ui.isSelectedTile(model)`) now provides all the routing information that `escapedFocusTrap` formerly tracked: selected tiles get Tab-into-trap behavior, unselected tiles get Tab-to-sibling behavior. Since Escape always deselects, this naturally prevents the re-entry loop that `escapedFocusTrap` was designed to prevent. This simplifies the focus management logic by removing a stateful flag and all its setters/clearers.
- `handleFocus` does **not** call `ui.setSelectedTileId()`. It only announces "Tile focused. Press Enter to edit." when focus arrives from outside the tile. The `relatedTarget` guards remain to distinguish external focus from internal focus moves.
- `handleKeyDown` Enter handler: calls `ui.setSelectedTileId()` unconditionally, then calls `enterFocusTrap()` best-effort. If `enterFocusTrap` finds content, focus moves there. If not (e.g., drawing tile), focus stays on the container — the tile is still selected, the toolbar becomes reachable via Tab on the next frame, and the handler announces "Tile selected. Press Tab to access toolbar, Escape to exit."
- `handleKeyDown` Escape handler: always deselects this tile (removes it from `ui.selectedTileIds` — use the appropriate store API to avoid clearing other tiles' multi-select state) so the toolbar hides, then focuses the tile container.
- `handleToolbarEscape`: same deselect logic — always deselects the tile, then focuses the tile container (new — current code only sets the flag and announces; focusing must be added, unless the toolbar's own Escape handler already manages it).
- `navigateToSiblingTile`: remove the existing `ui.setSelectedTileId(nextTileId)` call — Tab should NOT select the destination tile. Also update the comment on line 490 ("The destination tile's handleFocus will auto-enter its focus trap") since that is no longer true.
- `handleTabKeyDown` when tile container is focused: checks `ui.isSelectedTile(model)`. If the tile is **selected** (entered via Enter or mouse click), Tab/Shift+Tab attempts `enterFocusTrap()` (forward or backward respectively) — the toolbar should now be in the DOM (rendered on the previous frame) and reachable. If `enterFocusTrap` fails, falls through to `navigateToSiblingTile`. If the tile is **not selected** (just focused via Tab, no toolbar), Tab/Shift+Tab navigates to sibling tile directly.
- `handleTabKeyDown` catch-all (inside tile, no cycling match): deselects this tile (same targeted deselect as Escape) before exiting to container, preventing a selected-but-unfocusable state.
- A new `:focus-visible` CSS rule is added to `.tool-tile` in `tile-component.scss` for the keyboard focus ring.
- `handlePointerDown`: remove `this.escapedFocusTrap = false` (no replacement — flag is gone).
- `enterFocusTrap`: remove `this.escapedFocusTrap = false` (no replacement — flag is gone).
- ArrowUp exit from non-editable elements: exits to tile container but does NOT deselect (ArrowUp is a soft exit, not Escape). Tile stays selected with toolbar visible.
- All normal focus trap cycling paths within an entered tile (Tab between title/toolbar/content) remain unchanged. Only the catch-all fallback and entry/exit behavior change.

### Test Plan

#### Unit tests to rewrite (`tile-component.test.tsx`)

The "focus trap entry (Tab on tile container)" describe block (7 tests) currently asserts that Tab auto-enters the focus trap. All must be rewritten to assert focus stays on the tile container:

- "Tab enters at title when title exists" → "Tab does not enter focus trap (focus stays on container)"
- "Tab enters at toolbar button when no title" → same
- "Tab enters at content when only content exists" → same
- "entering announces 'Editing tile...'" → "Tab announces 'Tile focused. Press Enter to edit.'"
- "Shift+Tab enters at last element (content)" → "Shift+Tab does not enter focus trap"
- "Shift+Tab enters at toolbar when no content" → same
- "Tab skips non-focusable title and enters at toolbar" → remove (irrelevant when Tab doesn't enter trap)

#### Unit tests to simplify

The "inter-tile navigation (Escape + Tab)" tests currently require an Escape before Tab to navigate between tiles. With the new behavior Tab always navigates:

- "after Escape, Tab navigates to next sibling tile" → "Tab navigates to next sibling tile" (remove Escape step)
- "after Escape, Shift+Tab navigates to previous sibling tile" → "Shift+Tab navigates to previous sibling tile" (remove Escape step)
- "clicking a tile resets escapedFocusTrap" → remove entirely (flag no longer exists)

The "custom events" tests track `escapedFocusTrap` state:

- "toolbar-escape event sets escapedFocusTrap" → rewrite to test SR exit announcement and deselect behavior (toolbar-escape always deselects)
- "after Escape→Tab→Escape→Shift+Tab, returns to original tile" → simplify to "Tab→Shift+Tab navigates between tiles"

The "Enter enters focus trap" tests:

- "Enter enters focus trap even when escapedFocusTrap is true" → remove (duplicate once flag is gone)

#### New unit tests to add

- "Tab does not select tile (ui.selectedTileIds unchanged)"
- "Enter selects tile unconditionally (ui.selectedTileIds includes tile)"
- "Enter on tile with content focuses content (toolbar not yet in DOM)"
- "Enter on tile without getFocusableElements selects tile, focus stays on container, announces 'Tile selected. Press Tab to access toolbar, Escape to exit.'"
- "Tab on selected tile (after Enter) enters focus trap (toolbar reachable)"
- "Tab on selected drawing tile (after Enter, no content) enters focus trap and reaches toolbar"
- "Escape after Enter unselects tile and returns to focus ring"
- "Escape after mouse click unselects tile and returns to focus ring"
- "After mouse click → Escape → Tab, navigates to sibling (no keyboard trap)"
- "Tab announces 'Tile focused. Press Enter to edit.'"
- "Enter announces 'Editing tile. Press Escape to exit.'"
- "navigateToSiblingTile does not select destination tile"
- "Enter→Escape→Enter round-trip: selection toggles correctly"

#### Tests to update

- Escape exit from focus trap: add assertion that deselect is always called (tile is unselected after Escape)
- ArrowUp exit from non-editable elements: add assertion that tile stays selected (ArrowUp is a soft exit, not Escape — it doesn't deselect)

#### Tests to keep as-is

- ARIA attributes (role, aria-label, tabIndex=0)
- Focus trap cycling (Tab/Shift+Tab within trap between title/toolbar/content)
- Screen reader live region infrastructure
- All toolbar tests (`tile-toolbar.test.tsx`)
- All roving tabindex tests (`use-roving-tabindex.test.tsx`)

#### Cypress tests — no changes needed

All Cypress changes on this branch are `aria-disabled` attribute checks (not `disabled` HTML attribute). These are unrelated to focus trap entry and should be kept as-is. No Cypress tests currently assert auto-focus behavior on tile Tab navigation.
