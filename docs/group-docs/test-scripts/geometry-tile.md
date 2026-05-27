# Geometry Tile (JSXGraph) — Test Scripts

See [README.md](README.md) for the single-person testing technique and reporting guidelines.

## ✅💻 Selected object becomes stale **[undo-testable]**

- User B selects a geometry object (point, segment, polygon) to label or modify it
- User A deletes that object
- **Expected Result**: User B's `selectedComment` or `selectedLine` reference points to a deleted JSXGraph board object. Attempting to modify it may error or silently fail.
- **Actual Result**: This seems to work fine.
- **Undo test**: Create a geometry tile with several points and a segment. Select a point. Delete the segment (or another point). Undo the deletion. Check whether the geometry board renders correctly and the previously selected point is still usable. Then try: create two points, select point A, delete point A, undo. Does point A reappear and is the board in a consistent state?
- **Undo Result**: Seems to work fine.

## ❌ Dialog input lost **[requires active interaction]**

- User A and User B both have the same geometry tile open
- Pause User A's uploads
- User A makes any change to the geometry
- User A clicks resume (5-second delay starts)
- **Within the 5-second window**: switch to User B, open a label dialog for a point/segment/polygon, and start typing
- User A's change arrives before User B submits the dialog
- **Expected Result**: If the geometry component re-renders, the dialog may close or its input state may be reset, losing User B's uncommitted label text.
- **Actual Result**: Yes the dialog closes out from underneath User B.

## 🐛 Point drag interrupted **[requires active interaction]**

- User A and User B both have the same geometry tile open
- Pause User A's uploads
- User A adds or deletes any geometry object
- User A clicks resume (5-second delay starts)
- **Within the 5-second window**: switch to User B and start dragging a geometry point, holding the drag past the 5-second mark
- User A's change arrives mid-drag
- **Expected Result**: The `forceSharedModelUpdate()` call (used in `updateAfterSharedModelChanges`) does a hard reset of the board, which would interrupt User B's drag operation and reset the board state.
- **Actual Result**: Yes the drag gets canceled and the shape being dragged snaps back to where it was.

## 🐛👥↩️ Redo stack becomes invalid **[undo-testable]**

- User B has some undo history and performs an undo
- User A makes a change
- **Expected Result**: User B's `redoStack` contains references to board states that no longer match the current document. Performing a redo could produce unexpected or broken geometry.
- **Actual Result**: Vague instructions.
I was able to get into a weird state by adding a point as B, deleting that point as A, then undoing/redoing as B.
- **Undo test**: In a geometry tile, create point A, then create point B, then create a segment between them. Undo (removes segment). Now make a different change — e.g., move point A. Redo (tries to restore the segment). Check whether the segment is drawn correctly between the points in their current positions, or whether it references stale coordinates/objects.
- **Undo Result**: You can’t redo after making another action. The test doesn't make sense.

Jira story: https://concord-consortium.atlassian.net/browse/CLUE-508
