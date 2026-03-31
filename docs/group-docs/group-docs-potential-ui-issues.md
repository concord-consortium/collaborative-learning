# Potential UI Issues with Group Documents

This document lists concrete UI issues that could occur when multiple users edit the same group document simultaneously. Each issue includes steps to reproduce using the pause/resume upload debug tools (GD-3).

## Important context

All CLUE tiles render model changes regardless of whether they are in edit or read-only mode. This is because tiles use MobX `observer()` and react to MST model changes in both modes. The `readOnly` prop only controls whether interactive controls (buttons, inputs, drag handles) are enabled — it does not stop the tile from rendering model updates.

This means remote changes from other users **will generally be rendered** in edit mode. However, some tiles have bugs where certain model changes don't trigger UI updates in any mode — for example, the table's column header names are cached in a `useMemo` that doesn't invalidate when attribute names change (see `group-docs-current-state.md` for details). These bugs affect group documents and single-user undo equally. No cases of special read-only-only handling have been found.

Most issues below are about transient UI state (focus, cursor, selection, drag) being disrupted by re-renders, but some may be about changes not being rendered due to caching bugs like the one above.

Steps below use "User A" and "User B" to describe two users editing the same group document. "Pause/resume" refers to using the pause/resume upload buttons in the history view panel.

Issues marked with **[undo-testable]** can be partially or fully tested with single-user undo, without needing a multi-user setup. Issues marked with **[requires active interaction]** can only be triggered when the user is actively interacting with the tile during the model change, which undo doesn't exercise.

---

## Table

### Cell focus lost on remote update **[requires active interaction]**

- User A and User B open the same group document with a table
- Pause User A's uploads
- User A types a value in a cell and presses Tab/Enter to commit
- Resume User A's uploads
- **Before User A's change arrives**: User B clicks into a different cell and starts typing (but does not press Tab/Enter)
- User A's change arrives and updates the table on User B's screen
- **Result**: User B's cell focus and uncommitted text are lost. The re-render triggered by the remote change resets the grid's editing state.

*Already documented in group-docs-current-state.md.*

### Attribute name change not visible **[undo-testable]**

- User A and User B open the same group document with a table
- User A renames a column header (attribute name)
- **Result**: User B does not see the renamed column.
- **Undo test**: Rename a column, then undo. The column header should revert to the old name but doesn't.

This has been confirmed in the current group document. The root cause is that the table's column definitions are cached in a `useMemo` whose dependencies don't include attribute names. The `onSnapshot` handler calls `triggerRowChange()` instead of `triggerColumnChange()`, so attribute name changes never rebuild the columns. This affects all views (edit and read-only) equally — the apparent update in same-instance read-only testing was a coincidence caused by shared selection state invalidating the memo. Undoing an attribute rename in single-user mode has the same problem.

*Root cause documented in group-docs-current-state.md.*

### Column width lost on remote column deletion **[undo-testable]**

- Start with a table with 3+ columns where User B has resized some columns
- Pause User A's uploads
- User A deletes a column
- Resume User A's uploads
- **Result**: User B's `columnWidths` map retains an entry keyed by the deleted attribute's ID (orphaned data). If a new column is later added and happens to reuse an ID, it could inherit the wrong width. Minor issue.
- **Undo test**: Create a table with 3 columns. Resize column 2 to be noticeably wider. Delete column 2. Undo the deletion. Check whether column 2 comes back with its custom width or reverts to default width.

### Row drag interrupted **[requires active interaction]**

- User B starts dragging a row to reorder it
- User A adds or deletes a row
- **Result**: The table re-renders during User B's drag operation, potentially breaking the drag state or causing the row to snap to a wrong position.

### Cell editing in deleted column **[undo-testable]**

- Pause User A's uploads
- User A types a value into a cell in column 2
- User B deletes column 2
- Resume User A's uploads
- **Result**: User A's patch targets column 2 by array index. Since column 2 was deleted, the value may land in what is now column 2 (previously column 3). Both users see different data.
- **Undo test**: Create a table with 3 columns (A, B, C) with data in each. Delete column A. Check whether the data in columns B and C is still correct and in the right columns. Then undo the deletion. Check whether all three columns have their original data. This tests whether array-index-based patches correctly handle column insertion/deletion.

*This is the array-index problem documented in group-docs-current-state.md.*

---

## Text (Slate editor)

### Cursor position reset **[requires active interaction]**

- User A and User B both have the same text tile open
- User B places their cursor in the middle of a paragraph
- User A makes any change to the text (adds a word, deletes text, etc.)
- **Result**: User B's cursor position may be reset or become invalid when the Slate editor re-syncs with the model. The `normalizeSelection` call may move the cursor.

### Text typed during remote update lost **[requires active interaction]**

- User B is typing in the text tile (text is accumulated locally before being committed to MST)
- User A makes a change that triggers a model update
- The Slate editor re-syncs from the model: `this.editor.children = textContent.asSlate()`
- **Result**: User B's uncommitted keystrokes are overwritten by the model sync. The `isHandlingUserChange` flag may prevent this in some cases, but timing matters.

### Selection highlight lost **[requires active interaction]**

- User B selects a range of text (for bolding, etc.)
- User A makes any change
- **Result**: The selection range may be lost or shifted when Slate re-renders. User B would need to re-select before applying formatting.

---

## Drawing

### Object selection lost **[requires active interaction]**

- User B selects one or more drawing objects (to move, resize, or change color)
- User A adds, deletes, or modifies any object
- **Result**: User B's selection state may be cleared by the re-render. They would need to re-select objects.

### Mid-drag interrupted **[requires active interaction]**

- User B is dragging a drawing object to move it
- User A makes any change to the drawing
- **Result**: The drawing re-renders, potentially resetting the object's position mid-drag or ending the drag operation.

### Color applied to wrong object **[undo-testable]**

- Start with a drawing with 3 objects
- Pause User A's uploads
- User A changes the fill color of object 2
- User B deletes object 1
- Resume User A's uploads
- **Result**: User A's color change patch targets object index 1 (previously object 2). It gets applied to what is now object 2 (previously object 3). Users see different colors on objects.
- **Undo test**: Create a drawing with 3 objects, each with a different fill color. Delete the first object. Change the fill color of one of the remaining objects. Undo the color change. Check whether the correct object reverts to its original color. Then undo the deletion. Check whether the restored object has the right color and the other objects haven't changed. This tests whether array-index-based patches correctly handle object insertion/deletion.

*Documented in group-docs-current-state.md. Root cause is array-indexed storage of objects.*

### Voice typing text lost **[requires active interaction]**

- User B activates voice typing and speaks
- User A makes any change to the drawing
- **Result**: The interim voice transcription is held in local React state (`interimText`). A re-render from a remote change could reset this state, losing the transcription before it's committed.

---

## Geometry (JSXGraph)

### Selected object becomes stale **[undo-testable]**

- User B selects a geometry object (point, segment, polygon) to label or modify it
- User A deletes that object
- **Result**: User B's `selectedComment` or `selectedLine` reference points to a deleted JSXGraph board object. Attempting to modify it may error or silently fail.
- **Undo test**: Create a geometry tile with several points and a segment. Select a point. Delete the segment (or another point). Undo the deletion. Check whether the geometry board renders correctly and the previously selected point is still usable. Then try: create two points, select point A, delete point A, undo. Does point A reappear and is the board in a consistent state?

### Dialog input lost **[requires active interaction]**

- User B opens a label dialog for a point/segment/polygon and starts typing
- User A makes any change to the geometry
- **Result**: If the geometry component re-renders, the dialog may close or its input state may be reset, losing User B's uncommitted label text.

### Point drag interrupted **[requires active interaction]**

- User B is dragging a geometry point
- User A adds or deletes any geometry object
- **Result**: The `forceSharedModelUpdate()` call (used in `updateAfterSharedModelChanges`) does a hard reset of the board, which would interrupt User B's drag operation and reset the board state.

### Redo stack becomes invalid **[undo-testable]**

- User B has some undo history and performs an undo
- User A makes a change
- **Result**: User B's `redoStack` contains references to board states that no longer match the current document. Performing a redo could produce unexpected or broken geometry.
- **Undo test**: In a geometry tile, create point A, then create point B, then create a segment between them. Undo (removes segment). Now make a different change — e.g., move point A. Redo (tries to restore the segment). Check whether the segment is drawn correctly between the points in their current positions, or whether it references stale coordinates/objects.

---

## Expression (MathLive)

### Cursor jumps during remote edit **[requires active interaction]**

- User B is editing a math expression, cursor in the middle
- User A modifies the same expression tile (e.g., from a shared context)
- The `onSnapshot` watcher fires, updating the MathLive field value
- Cursor is restored to `trackedCursorPos.current - 1`
- **Result**: If the expression length changed, the cursor position is now wrong — it may jump to an unexpected location in the expression.

### Keystroke lost during snapshot sync **[requires active interaction]**

- User B types a character in the MathLive editor
- Before User B's change is committed to MST, a remote model change triggers the `onSnapshot` watcher
- The watcher calls `mf.current.setValue(content.latexStr)` which overwrites the MathLive editor
- **Result**: User B's keystroke is lost because the editor was reset to the model state before the keystroke was committed.

---

## Dataflow (Rete node editor)

### Node drag interrupted **[requires active interaction]**

- User B is dragging a dataflow node to reposition it
- User A makes any change to the dataflow program
- **Result**: If the Rete editor re-renders, the drag operation may be interrupted and the node may snap back to its pre-drag position.

### Playback index becomes invalid **[undo-testable]**

- User B is playing back recorded data at index N
- User A modifies the program (adds/removes nodes) which changes what data was recorded
- **Result**: `playBackIndex` may now be out of bounds for the new data, or point to a different moment in the recording than intended.
- **Undo test**: In a dataflow tile, create a program with a few nodes. Record some data. Start playback and navigate to a specific index. Then undo a node addition (which changes the program structure). Check whether the playback UI handles the changed program gracefully — does it show an error, reset to index 0, or display incorrect data?

### Connection being drawn is lost **[requires active interaction]**

- User B is in the middle of drawing a connection between two nodes
- User A makes any change
- **Result**: The in-progress connection (which exists only in Rete's internal state) may be lost on re-render.

---

## Data Card

### Edit context for deleted attribute **[undo-testable]**

- User B is editing a cell for attribute X
- User A deletes attribute X
- **Result**: `currEditAttrId` still references the deleted attribute's ID. The editing UI may show a blank or error state.
- **Undo test**: In a data card tile linked to a table, click on a field to view/edit it. Then go to the table and delete the column for that attribute. Check whether the data card shows an error or handles the missing attribute. Then undo the column deletion. Check whether the data card recovers and shows the attribute's data again.

### Case navigation desync **[undo-testable]**

- User B is viewing case 5 of 10
- User A deletes several cases
- **Result**: `caseIndex` may now be out of bounds. The `updateAfterSharedModelChanges` implementation does handle this (clamps to range), but there may be a brief flash of invalid state.
- **Undo test**: In a data card linked to a table with 10 rows, navigate to case 8. Go to the table and delete the last 5 rows. Check whether the data card clamps to a valid case. Then undo the deletion. Check whether the data card returns to showing case 8 or at least a valid case with the correct data.

---

## Numberline

### Selected point deleted **[undo-testable]**

- User B selects a point on the numberline
- User A deletes that point
- **Result**: `_selectedPointId` references a deleted point. UI may show selection highlight on nothing, or error when trying to modify the selected point.
- **Undo test**: Create a numberline with 3 points. Select the middle point. Delete it. Check whether the numberline renders correctly without the point. Undo the deletion. Check whether the point reappears in the correct position and the numberline is in a consistent state.

### Point drag lands on wrong value **[requires active interaction]**

- User B is dragging a point along the numberline
- User A changes the min/max bounds of the numberline
- **Result**: The d3 scale changes while the drag is in progress. The point may jump to an unexpected position when the scale updates.

---

## Simulator

### Simulation state diverges **[requires multi-user]**

- User A and User B both have a simulator tile open
- Both simulators are running on their independent intervals
- **Result**: Each simulator generates its own state updates independently. When these are synced, the simulation state flip-flops between the two users' states, creating erratic behavior.

*This is related to the DataFlow simulation issue discussed in group-docs-plan.md.*

---

## AI

### Prompt overwritten during typing **[requires active interaction]**

- User B is typing a prompt in the AI tile's textarea
- User A submits a prompt (which updates the model)
- **Result**: Since the textarea is bound to `content.prompt`, a remote change to the prompt would overwrite User B's in-progress text.

---

## iframe Interactive

### State update lost due to debounce **[requires active interaction]**

- User B interacts with the iframe content (which debounces state updates at 500ms)
- Within that 500ms window, User A makes a change that updates the model
- **Result**: User B's debounced state update may overwrite User A's change, or User A's change may overwrite User B's pending state. The `currentInteractiveState` ref comparison may not detect the conflict.

---

## General issues (all tiles)

### Tile deletion while editing **[undo-testable]**

- User B is actively editing any tile
- User A deletes that tile from the document
- **Result**: User B's tile disappears. Any uncommitted work in progress is lost. After GD-5 rollback is implemented, User B's recent changes to the tile would also be rolled back.
- **Undo test**: For each tile type: create the tile, add some content to it, then delete the tile. Undo the deletion. Check whether the tile reappears with all its content intact. This tests basic tile lifecycle through the patch/undo path. Try with tiles that have shared model connections (e.g., a table linked to a graph) to verify the shared model link is restored.

### Layout change during interaction **[requires active interaction]**

- User B is interacting with a tile
- User A changes the document layout (moves tiles, adds a row)
- **Result**: Tiles may resize or reposition during User B's interaction. This could interrupt drag operations, change coordinate systems for drawing/geometry tiles, or cause focus loss.
