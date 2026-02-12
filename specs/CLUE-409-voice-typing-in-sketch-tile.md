# Voice Typing in Sketch Tile

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-409

**Status**: **Closed**

## Overview

Extend the existing Drawing (Sketch) tile voice typing to support dictating into the tile's title bar, in addition to the already-supported text objects (comment boxes). The voice typing button should be enabled whenever either a text object or the title bar is actively being edited.

## Requirements

- Voice typing button in the Sketch tile toolbar must be enabled when a **text object** (comment box) is being edited (existing behavior, preserved)
- Voice typing button in the Sketch tile toolbar must be enabled when the **title bar** is being edited/focused
- Voice typing button must be disabled when neither a text object nor the title bar is being edited
- Users can dictate text into comment boxes in Sketches via voice typing (existing behavior, preserved)
- Users can dictate text into the title field of the Sketch tile via voice typing
- The interim text overlay must display when voice typing into the title bar, anchored below the drawing canvas (same position as when targeting text objects)
- Voice typing must deactivate when the title bar editing ends (blur, Enter, Tab, Escape)
- When title editing ends while voice typing is active, any pending interim text must be committed to the title before the edit is saved
- Voice typing must deactivate when switching between title bar and text object editing (or vice versa) — only one target at a time. Sequence: commit pending interim text → save/close the old target → deactivate voice typing. The user must re-enable voice typing for the new target.
- Smart spacing (adding spaces around inserted text as needed) must work for title bar insertion
- Voice typing inserts text at the cursor position (`selectionStart`), not replacing any selected text — consistent with existing text object behavior
- The title input must display a visual indicator (teal background via `voice-typing-active` class) when voice typing is actively targeting it, consistent with the text object visual feedback
- The voice typing button must prevent stealing focus from the title input when clicked (same pattern as existing textarea focus protection)
- Voice typing deactivation (timeout, error, or user toggle) must not cause the title bar to exit editing mode — the user can continue typing manually after voice typing ends
- No keyboard blocking during voice typing in the drawing tile (consistent with existing text object behavior — users may type and dictate simultaneously)
- The feature must only be available in browsers that support the Web Speech API (existing `VoiceTyping.supported` check)
- Logging: voice typing start/stop/insert events should be logged with a `target` field distinguishing `"title"` from `"text-object"` in the log change data (extends existing drawing voice typing logging)

## Technical Notes

**Key files**:
- `src/plugins/drawing/toolbar-buttons/voice-typing-button.tsx` — Voice typing button for drawing; supports both text objects and title bar
- `src/plugins/drawing/components/drawing-tile.tsx` — Main drawing tile component; renders `BasicEditableTileTitle` and provides `DrawingToolbarContext`
- `src/plugins/drawing/components/drawing-toolbar-context.ts` — Toolbar context for voice typing state including title-editing state
- `src/components/tiles/editable-tile-title.tsx` — Title editing component; uses `<input>` via `TileLabelInput`
- `src/components/tiles/basic-editable-tile-title.tsx` — Wrapper that renders `EditableTileTitle`
- `src/utilities/voice-typing-utils.ts` — Shared utility with `spliceWithSpacing` and `TitleTextInserter` type
- `src/utilities/voice-typing.ts` — Core VoiceTyping class (unchanged)
- `src/utilities/voice-typing-overlay.tsx` — Overlay for interim text (unchanged)

**Architecture considerations**:
- The title bar uses an `<input>` element (single-line), while text objects use `<textarea>` (multi-line). The voice typing button uses `getFocusedTextInput()` which handles both `HTMLTextAreaElement` and `HTMLInputElement`.
- The title `<input>` is a React controlled component. The implementation updates React state via a `TitleTextInserter` callback registered through context, unlike the text object path which calls `obj.setText()` on the MST model directly.
- `EditableTileTitle` uses a ref alongside state (`editingTitleRef`) so `handleClose` reads the latest value synchronously after voice typing commits interim text (React 17 batches state updates).
- **Shared component constraint**: `BasicEditableTileTitle`, `EditableTileTitle`, and `TileLabelInput` are shared across ~10 tile types. All new props are optional with no effect when not provided.
- **Known quirk**: `EditableTileTitle.handleClose()` unconditionally writes the edited title to the model, even on Escape. This is pre-existing behavior, not introduced by this ticket.

## Out of Scope

- Voice typing for other tile types beyond the Drawing (Sketch) tile (already handled by other tickets)
- Text-to-speech (TTS) / read-aloud functionality
- Voice typing in the Sketch tile's object list labels
- Changes to the core `VoiceTyping` class or `VoiceTypingOverlay` component
- Browser compatibility beyond what Web Speech API already provides
- Keyboard shortcut for toggling voice typing (applies across all tile types — consider as a follow-up accessibility improvement)

## Decisions

### Title length during continuous dictation
**Context**: The title `<input>` is single-line with no enforced max length. During extended dictation, the title could become very long.

**Decision**: Accept as-is — no character limit. Consistent with existing behavior for both the title field and voice typing in other contexts.

---

### Tile deselection during active voice typing
**Context**: The requirements cover deactivation on blur/Enter/Tab/Escape and on switching targets, but don't explicitly address tile deselection.

**Decision**: No requirement change needed. The existing cleanup-on-unmount pattern handles this automatically. Added as a test case.

---

### Distinguishing voice typing target in logs
**Context**: Should logs distinguish between title bar vs. text object as the voice typing target?

**Decision**: Yes — logging requirement includes a `target: "title" | "text-object"` field in log change data.

---

### Keyboard shortcut for toggling voice typing
**Context**: No keyboard shortcut exists to toggle voice typing. This limitation applies across all tile types.

**Decision**: Out of scope for this ticket. Listed as a follow-up accessibility improvement.

---

### Keyboard blocking during voice typing
**Context**: The existing drawing voice typing for text objects does NOT block keyboard input. Adding blocking only for the title bar would be inconsistent.

**Decision**: No keyboard blocking in the drawing tile for either target — consistent behavior. Users may type and dictate simultaneously.

---

### Interim text commitment when title editing ends
**Context**: When title editing ends while voice typing is active, what happens to pending interim text?

**Decision**: Pending interim text must be committed before the title is saved. Implemented via `onBeforeClose` callback in `EditableTileTitle.handleClose`.

---

### Voice typing deactivation should not end title editing
**Context**: When voice typing deactivates (timeout, error, user toggle), should the title bar remain in editing mode?

**Decision**: Yes — voice typing deactivation must not cause the title bar to exit editing mode. The user can continue typing manually.

---

### Escape in title discards or saves dictated text?
**Context**: `EditableTileTitle.handleClose()` unconditionally saves the title, even on Escape.

**Decision**: Pre-existing behavior, not introduced by this ticket. Documented as a known quirk in Technical Notes. No requirement change.

---

### Title input is a React controlled component
**Context**: The `TileLabelInput` is a React controlled component. Direct DOM manipulation won't work for text insertion.

**Decision**: Flagged as a hard architectural constraint. Implementation uses a `TitleTextInserter` callback that updates React state, with a ref alongside state to handle React 17 batched updates.

---

### Overlay positioning when dictating into the title bar
**Context**: The overlay always appears at the bottom of the canvas, even when dictating into the title bar above it.

**Decision**: Accept as-is — consistent position for all targets. Changing it would require modifying the shared `VoiceTypingOverlay` component (out of scope).

---

### Auto-select-all on title edit start and cursor position for voice typing
**Context**: `TileLabelInput` auto-selects all text on mount. If the user clicks mic immediately, what happens to the selection?

**Decision**: Accept as-is — users can click to place cursor first. Matches existing text object behavior.

---

### Visual feedback on title input during active voice typing
**Context**: Text objects get a `voice-typing-active` CSS class with teal background during voice typing. The title input had no equivalent.

**Decision**: Added `voice-typing-active` styling on the title input, consistent with text object behavior.

---

### Shared component backward-compatibility
**Context**: `BasicEditableTileTitle` doesn't forward `onBeginEdit`/`onEndEdit` and is shared across ~10 tiles. Changes must be backward-compatible.

**Decision**: Extended `BasicEditableTileTitle` to accept and forward optional `className`, `onBeginEdit`, `onEndEdit`, `onBeforeClose`, and `onRegisterTextInserter` props. All optional with no effect when not provided.

---

### Should `spliceWithSpacing` live in the voice typing button or a shared utility?
**Context**: The function was local to the drawing voice typing button. Both text object and title insertion need it.
- A) Extract to `src/utilities/voice-typing-utils.ts`
- B) Have `EditableTileTitle` accept a raw `setText` callback and let the voice typing button handle spacing externally

**Decision**: A — Extract to shared utility. The voice typing button imports it from there, keeping a single source of truth.

---

### Should the `TitleTextInserter` callback include `spliceWithSpacing` logic internally?
**Context**: If the inserter includes spacing logic, `EditableTileTitle` needs to import `spliceWithSpacing`. If the button handles it, the inserter is simpler.
- A) Inserter includes spacing (cleaner for the button, but shared component imports voice typing utility)
- B) Inserter is a plain `setText`; button handles spacing for both targets (keeps shared component simpler)

**Decision**: B — The inserter is a plain `setText(text, cursorPos)` callback. The voice typing button calls `spliceWithSpacing` itself before calling the inserter, keeping `EditableTileTitle` free of voice typing concerns.

---

### React `useState` with function values — lazy initializer pitfall
**Context**: Using `useState` to store function values like `commitInterimText` and `titleTextInserter` causes `setState(fn)` to call `fn()` as a lazy initializer instead of storing it.

**Decision**: Used `useRef` for `commitInterimText`. For `titleTextInserter`, wrapped the setter: `setTitleTextInserter(inserter ? () => inserter : null)`.

---

### Batched state update makes `editingTitle` stale in `handleClose`
**Context**: The `commitInterimText` → `insertIntoTitle` → `inserter` → `setEditingTitle(newText)` chain is batched by React 17. `handleClose` reads stale `editingTitle`.

**Decision**: Used `editingTitleRef` alongside state. The inserter updates both ref and state. `handleClose` reads from the ref to get the latest value.

---

### `targetRef` updated during render causes wrong-target commit on switch
**Context**: When switching targets while voice typing is active, `targetRef.current = target` assigned during render meant the deactivation `useEffect` would commit pending text to the NEW target instead of the old one.

**Decision**: Moved `targetRef.current = target` into the `useEffect` AFTER the deactivation call, so `commitInterimText` commits to the correct (previous) target.
