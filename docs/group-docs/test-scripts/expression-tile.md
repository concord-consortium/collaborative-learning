# Expression Tile (MathLive) — Test Scripts

See [README.md](README.md) for the single-person testing technique and reporting guidelines.

## 🐛 Cursor jumps during remote edit **[requires active interaction]**

- User A and User B both have the same expression tile open
- Pause User A's uploads
- User A modifies the expression (e.g., from a shared context)
- User A clicks resume (5-second delay starts)
- **Within the 5-second window**: switch to User B, focus the expression, and place the cursor in the middle
- User A's change arrives, the `onSnapshot` watcher fires, and the MathLive field value updates
- Cursor is restored to `trackedCursorPos.current - 1`
- **Expected Result**: If the expression length changed, the cursor position is now wrong — it may jump to an unexpected location in the expression.
- **Actual Result**: Yes the cursor jumps to a different location.

## 🐛 Keystroke lost during snapshot sync **[requires active interaction]**

- User A and User B both have the same expression tile open
- Pause User A's uploads
- User A modifies the expression
- User A clicks resume (5-second delay starts)
- **Within the 5-second window**: switch to User B and type a character in the MathLive editor (before MathLive commits it to MST)
- User A's change arrives, the `onSnapshot` watcher fires, and calls `mf.current.setValue(content.latexStr)` which overwrites the MathLive editor
- **Expected Result**: User B's keystroke is lost because the editor was reset to the model state before the keystroke was committed.
- **Actual Result**: Yes User B's changes are lost.
