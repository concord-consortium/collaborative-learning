# Text Tile (Slate editor) — Test Scripts

See [README.md](README.md) for the single-person testing technique and reporting guidelines.

## ❌ Cursor position reset **[requires active interaction]**

- User A and User B both have the same text tile open
- Pause User A's uploads
- User A makes any change to the text (adds a word, deletes text, etc.)
- User A clicks resume (5-second delay starts)
- **Within the 5-second window**: switch to User B and place the cursor in the middle of a paragraph
- User A's change arrives and triggers a Slate re-sync
- **Expected Result**: User B's cursor position may be reset or become invalid when the Slate editor re-syncs with the model. The `normalizeSelection` call may move the cursor.
- **Actual Result**: If the text is added before User B's cursor then the user B cursor jumps back the number of characters that were added. If the cursor is before the text being added, then it looks fine.

## ❌ Text typed during remote update lost **[requires active interaction]**

- User A and User B both have the same text tile open
- Pause User A's uploads
- User A makes a change that triggers a model update
- User A clicks resume (5-second delay starts)
- **Within the 5-second window**: switch to User B and start typing in the text tile (text accumulates locally before being committed to MST)
- User A's change arrives and the Slate editor re-syncs from the model: `this.editor.children = textContent.asSlate()`
- **Expected Result**: User B's uncommitted keystrokes are overwritten by the model sync. The `isHandlingUserChange` flag may prevent this in some cases, but timing matters.
- **Actual Result**: Yes User B's text is lost when User A's change comes in.

## ❌ Selection highlight lost **[requires active interaction]**

- User A and User B both have the same text tile open
- Pause User A's uploads
- User A makes any change
- User A clicks resume (5-second delay starts)
- **Within the 5-second window**: switch to User B and select a range of text (for bolding, etc.)
- User A's change arrives and triggers a Slate re-render
- **Expected Result**: The selection range may be lost or shifted when Slate re-renders. User B would need to re-select before applying formatting.
- **Actual Result**: If the selection is before the edit, it is fine. If the selection is after an "addition", the selection jumps back the number of chars added (just like cursor)
