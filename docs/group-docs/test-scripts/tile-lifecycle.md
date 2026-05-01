# Tile Lifecycle — Test Scripts

Cross-cutting cases involving tile add/delete and document-level layout changes that affect any tile.

See [README.md](README.md) for the single-person testing technique and reporting guidelines.

## ✅ Tile-scope conflict (text edit vs tile delete)

**Setup:** Group document with a text tile.

**Script:**
1. Pause user A's uploads.
2. User A: edit the text in the text tile.
3. User B: delete the text tile.
4. Resume user A's uploads.

**Expected outcome (rollback):** User A's edit and user B's delete both touch `tile:<text-id>`; scopes overlap. User A's pending entry is reverted at resume; user B's delete survives on both clients. Recorded history is coherent — no orphaned text-edit entry pointing at a deleted tile.

**Bad-state signal:** The deleted tile reappears on either client, the document state diverges between clients, or the console shows a patch-application error.

**Observed results (2026-04-30):**

Handled by GD-9. User A's pending text edit is reverted on resume because it touches the same tile scope as user B's delete. Both clients converge on the deleted-tile state.

Earlier observation (pre-GD-9, captured in `group-docs-current-state.md` before the move): the document state was OK from the user's perspective, but the recorded history was broken — the initial text tile was never visible when scrubbing through history. That recording issue is no longer reproducible after GD-9.

## ❌👥↩️ Tile deletion while editing **[undo-testable]**

- User B is actively editing any tile
- User A deletes that tile from the document
- **Expected Result**: User B's tile disappears. Any uncommitted work in progress is lost. After GD-5 rollback is implemented, User B's recent changes to the tile would also be rolled back.
- **Actual Result**: When a tile is deleted, its content is gone for both users. Testing this I found another bug (at least for the text and drawing tiles, probably most tiles):
B adds a tile, then adds some content to the tile
A deletes the tile
B presses undo
Result: Console errors like: `Uncaught (in promise) PatchApplicationError: Patch application failed after 0 patches: [mobx-state-tree] Not a child MrGcYrikGP3EsusG`
- **Undo test**: For each tile type: create the tile, add some content to it, then delete the tile. Undo the deletion. Check whether the tile reappears with all its content intact. This tests basic tile lifecycle through the patch/undo path. Try with tiles that have shared model connections (e.g., a table linked to a graph) to verify the shared model link is restored.
- **Undo Result**: Works fine for all tiles tested:
Text
Table
Data Card
Drawing
Diagram
Equation
Graph
Geometry
Number Line
Dataflow

I haven't created a Jira story for the multi-user issues. The issue described in the doc seems like expected behavior to me--I don't know what else should happen when one user deletes a tile being edited by another user. For the undo-after-delete issue, this seems like a pretty fundamental problem, and I'm not sure if some planned infrastructure change will fix it?

## 🚧 Layout change during interaction **[requires active interaction]**

- User A and User B both have the same group document open with multiple tiles
- Pause User A's uploads
- User A changes the document layout (moves tiles, adds a row)
- User A clicks resume (5-second delay starts)
- **Within the 5-second window**: switch to User B and start interacting with a tile (dragging, typing, selecting, etc.)
- User A's change arrives mid-interaction
- **Expected Result**: Tiles may resize or reposition during User B's interaction. This could interrupt drag operations, change coordinate systems for drawing/geometry tiles, or cause focus loss.
- **Actual Result**:
