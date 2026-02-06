# STT (Voice Typing) in CLUE Text Tiles

**Jira**: https://concord-consortium.atlassian.net/browse/CLUE-383
**Status**: **Closed**

## Overview

Add a voice typing button to the CLUE text tile toolbar that lets students dictate text via the browser's Web Speech API. When active, the button enters a selected state, the tile background changes to teal, and spoken words appear in real time at the cursor position. The feature includes keyboard focus styling for all text tile toolbar buttons, an `aria-live` region for screen reader announcements, and `prefers-reduced-motion` support. The reusable module accepts abstract callbacks so it can integrate with text tiles, sketch tile comments, and future text input contexts. Voice typing deactivates on click-away, Escape, Tab, toolbar interaction, or after 60 seconds of inactivity.

## Requirements

### Toolbar Button
- A new "Voice Typing" button added to the text tile toolbar, positioned last (right-most) in all toolbar config arrays
- Included in the default text tile toolbar tools in `app-config.json`; follows the standard toolbar configuration system (units with custom overrides that omit it will not show the button)
- Visual states: Default (`$workspace-teal-light-9`), Hover (`$workspace-teal-light-6`), Selected/Active (`$workspace-teal-light-4`), Keyboard focus (2px blue inside border + 3px white gap via `box-shadow`), Disabled (25% opacity)
- Keyboard focus styling applied to all text tile toolbar buttons (not just voice typing) — visual focus only, not tab-order work (that's CLUE-384)
- Dynamic tooltip: "Voice Typing: Off" / "Voice Typing: On"
- `aria-pressed`, `aria-label`, and an `aria-live="polite"` region for screen reader announcements
- Uses microphone icon from `src/assets/icons/text/voice-typing-text-icon.svg`
- Hidden entirely on browsers that don't support the Web Speech API
- Activatable via keyboard (in addition to click)

### Activation & Microphone Access
- Clicking the button requests microphone permission if not already granted (browser-native dialog)
- Uses browser/system STT via Web Speech API
- Speech recognition language defaults to browser/document locale (no explicit `lang` setting)
- If microphone permission is denied or previously blocked, voice typing deactivates and returns to default state (no custom error UI)

### Active State Visual Feedback
- Toolbar icon pulses to indicate listening; respects `prefers-reduced-motion` (static visual indicator as alternative)
- Text tile background changes from white to `$workspace-teal-light-4` (`#b7e2ec`)
- Keyboard text insertion prevented (keyboard, IME, composition, paste blocked); navigation keys, Tab, Escape, select all, copy, undo/redo remain functional

### Text Entry Behavior
- Text updates visually on each `onresult` event; only final recognition results committed to document model and persisted
- If voice typing deactivates while interim text is displayed, last interim result is committed
- Cursor position/selection captured once at activation; dictated text always inserted at captured position regardless of subsequent caret movement
- Selected text at activation is replaced by dictated text; if no cursor exists, text appended to end
- Spoken punctuation handled by browser's speech recognition engine (no custom parsing)
- Proper spacing ensured at insertion point (no double spaces, no space before punctuation)

### Error Handling
- If Web Speech API encounters an error during active session, voice typing deactivates and returns to default state

### Deactivation
- Deactivation triggers: click voice typing button again, click another toolbar button, click outside tile (`pointerdown`), Tab out, Escape, 60-second inactivity timeout (any `onresult` resets timer)
- Only one text tile can have voice typing active at a time
- Cleanup on tile unmount

### Logging
- Uses existing `TEXT_TOOL_CHANGE` event pattern for activation, deactivation, and text entry
- Transcribed text content included in log payloads (consistent with existing typed text logging) *(Note: stakeholder confirmation required before merging — see TODO in implementation)*
- Only final recognition results logged

### Reusability
- Built as a reusable module (`src/utilities/voice-typing.ts`) with abstract callbacks (`onTranscript`, `onStateChange`, `onError`)
- No Slate dependency in the module; consumers provide `insertText`-style callbacks
- Works in text tiles and drawing tile text objects; extensible to other text input contexts

## Technical Notes

### Key Files
- **Toolbar registration**: `src/components/tiles/text/toolbar/text-toolbar-registration.tsx`
- **Text tile component**: `src/components/tiles/text/text-tile.tsx`
- **Text content model**: `src/models/tiles/text/text-content.ts`
- **Toolbar button base**: `src/components/toolbar/tile-toolbar-button.tsx`
- **Logger types**: `src/lib/logger-types.ts` (`TEXT_TOOL_CHANGE`)

### Web Speech API
- `SpeechRecognition` / `webkitSpeechRecognition` with `continuous = true`, `interimResults = true`
- Requires HTTPS in Chrome; the "hide button if unsupported" check covers HTTP origins
- `onend` auto-restart when voice typing still active (guarded by `disableRequested` flag)

### Implementation Architecture (6 Steps)
1. **Reusable VoiceTyping module** (`src/utilities/voice-typing.ts`) — framework-agnostic class with SpeechRecognition lifecycle, inactivity timer, single-active-instance enforcement
2. **Toolbar button registration** — new `voice-typing-button.tsx` registered in text tile toolbar and added to default config
3. **State management & text insertion** — Slate `PointRef`/`RangeRef` approach for stable position tracking across interim/final results
4. **Keyboard input blocking** — Slate editor method overrides (`insertText`, `insertData`, `insertBreak`, `deleteBackward`, `deleteForward`) gated on `isVoiceTypingInsert` flag, plus `keydown` handler for defense in depth
5. **Visual feedback & accessibility** — pulse animation, tile background color via React context, `:focus-visible` styling, deactivation triggers, `aria-live` region
6. **Drawing tile text object integration** — adapted for plain `<textarea>` (no Slate), using `readOnly` for keyboard blocking and `model.setText()` for persistence

## Out of Scope

- Text-to-Speech (TTS) / read-aloud functionality (likely a separate story)
- Voice typing in non-text tiles (beyond reusability considerations)
- Support for browsers that don't implement the Web Speech API (graceful degradation only)
- Custom speech recognition models or server-side STT
- Voice typing in read-only tiles or published documents
- Real-time teacher visibility of which students are using voice typing (logging provides an audit trail)

## Decisions

### Where should dictated text be inserted — always at end, or at cursor position?
**Context**: The Jira ticket says "if there is previously typed text, add to end of existing text." However, many voice typing implementations insert at the current cursor position, which is more natural if the user has placed their cursor mid-text.
**Options considered**:
- A) Always append to end of text (as stated in ticket)
- B) Insert at current cursor position (more standard UX)
- C) Insert at cursor position if there is one, otherwise append to end

**Decision**: C (revised from A) — Insert at cursor position, matching the Activity Player's question-interactives implementation. If no cursor is placed, append to end. Selected text is replaced by dictated text.

---

### How should the button appear in per-unit toolbar configurations?
**Context**: Toolbar buttons are configured per-unit in JSON content files. The default tools are defined in `src/clue/app-config.json`. Per-unit configs can override this array entirely — if a unit specifies its own `"tools"` list, only those buttons appear. There is no existing "always include" mechanism.
**Options considered**:
- A) Auto-append the voice typing button to every toolbar config, even when not explicitly listed
- B) Require curriculum authors to add "voice-typing" to their configs; only include it in default config in `app-config.json`
- C) Auto-append by default, but allow curriculum authors to explicitly exclude it

**Decision**: B (revised from A) — Include voice typing in the default tools in `app-config.json`. No auto-append logic. Units with custom toolbar configs that omit voice typing will not show the button. This follows the standard toolbar configuration pattern.

---

### What should happen when the browser doesn't support the Web Speech API?
**Context**: Web Speech API support is good in Chrome/Edge/Safari but limited in Firefox. The button needs a strategy for unsupported browsers.
**Options considered**:
- A) Hide the button entirely on unsupported browsers
- B) Show the button but disable it, with a tooltip explaining the limitation
- C) Show the button, and display an error dialog when clicked on unsupported browsers

**Decision**: A — Hide the button entirely on unsupported browsers.

---

### What specific "light teal" color should be used for the active background?
**Context**: The ticket says the text tile background changes from white to light teal when voice typing is active.
**Options considered**:
- A) Match the Activity Player's voice typing background color exactly
- B) Use an existing CLUE theme color (if a suitable teal exists)
- C) Define a new color — need specific hex/RGB value from design

**Decision**: B — Use `$workspace-teal-light-4` (`#b7e2ec` / `rgb(183, 226, 236)`) from `src/components/vars.scss`.

---

### Should voice typing work in sketch tile comments for this story?
**Context**: The ticket mentions "if there are ways to make this work for sketch comments as well or make it easier to reuse, we should."
**Options considered**:
- A) Build reusable and integrate into sketch comments in this story
- B) Build reusable but defer sketch comment integration to a follow-up story
- C) Build directly in text tile; refactor for reuse later if needed

**Decision**: A — Build reusable and integrate into drawing tile text objects in this story. Also reusable for other future text inputs.

---

### What should the voice typing icon look like?
**Context**: The Jira ticket includes an attachment image showing what appears to be a toolbar mockup.
**Options considered**:
- A) Use a standard microphone icon (matching the attachment)
- B) Use a custom icon from a design spec (need Zeplin link or SVG asset)

**Decision**: B — Microphone SVG asset downloaded from Zeplin design spec to `src/assets/icons/text/voice-typing-text-icon.svg`. 36x34px, black fill on transparent background.

---

### What language should the speech recognition default to?
**Context**: Web Speech API requires a `lang` property. CLUE is used in US English classrooms but may expand.
**Options considered**:
- A) Default to `en-US`, no configuration
- B) Default to `en-US`, make configurable per-unit or per-user in the future
- C) Auto-detect from browser locale
- D) Don't set `lang` — let the browser default apply

**Decision**: D — Don't set `lang` explicitly. The Web Speech API defaults to the document's `<html lang="en">` or the browser's locale.

---

### What happens if SpeechRecognition errors mid-session?
**Context**: The Web Speech API can fire `onerror` events (e.g., `network`, `not-allowed`, `audio-capture`). If recognition fails mid-session, the behavior needed to be specified.

**Decision**: Voice typing deactivates and returns to default state on any error. No custom error notification — the button reverting to "Off" state provides sufficient feedback.

---

### What does "keyboard typing disabled" mean for screen reader users?
**Context**: Blocking all keyboard input could interfere with screen reader navigation.

**Decision**: Block text insertion at the Slate editor operation layer (not raw key events), allowing navigation keys (arrows), Tab/Escape, select all, copy, undo/redo. A programmatic insert flag (`isVoiceTypingInsert`) bypasses the block for voice typing's own inserts.

---

### What does "clicking another button in the toolbar" mean for non-toggle buttons?
**Context**: If voice typing is active and a user clicks Bold, should the click be consumed or should both actions execute?

**Decision**: Voice typing deactivates AND the other button's action executes normally. The click is not consumed.

---

### How should interim (partial) results be displayed?
**Context**: The Web Speech API with `interimResults = true` sends tentative transcriptions. The spec needed to define whether users see live feedback.

**Decision**: Interim results update the display visually in real time. Only final results are committed to the document model and persisted. The Slate `PointRef`/`RangeRef` approach handles interim replacement cleanly.

---

### No acceptance criteria for the 60-second inactivity timeout — what counts as "inactivity"?
**Context**: "Automatically shut off after 60 seconds of inactivity" needed clarification.

**Decision**: 60 seconds since the last `onresult` event (interim or final). Any `onresult` resets the timer. `onend`/restart cycles alone do not reset it.

---

### What happens if microphone permission is denied?
**Context**: User could deny the browser permission dialog, or permission could be previously blocked.

**Decision**: Voice typing deactivates and returns to default state. No custom error UI — the browser's own permission indicators and the button reverting to "Off" provide sufficient feedback.

---

### Can voice typing be active in more than one tile simultaneously?
**Context**: Multiple text tiles exist in a document; behavior when activating voice typing in a second tile was unspecified.

**Decision**: Only one tile can have voice typing active at a time. Activating in a new tile automatically deactivates the previous one. Enforced at the module level by the `VoiceTyping` class (single-active-instance constraint).

---

### No ARIA live region for voice typing status changes
**Context**: Screen reader users need to be informed when voice typing activates/deactivates. Visual indicators (pulsing icon, teal background) are insufficient.

**Decision**: Both `aria-pressed` on the button and an `aria-live="polite"` region are required, ensuring screen reader users receive clear state change announcements.

---

### Pulse animation may be problematic for vestibular/motion sensitivity
**Context**: Continuous pulsing can be uncomfortable for users with vestibular disorders. WCAG 2.3.3 recommends respecting `prefers-reduced-motion`.

**Decision**: The pulse animation respects `prefers-reduced-motion`. When reduced motion is preferred, a static visual indicator (dimmed opacity) is used instead of animation.

---

### Can teachers see which students are using voice typing?
**Context**: Teachers monitor student work in collaborative classrooms.

**Decision**: Out of scope for this story. Logging provides an audit trail of voice typing usage, but real-time teacher visibility is not included.
