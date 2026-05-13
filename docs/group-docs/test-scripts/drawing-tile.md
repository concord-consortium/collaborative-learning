# Drawing Tile — Test Scripts

See [README.md](README.md) for the single-person testing technique and reporting guidelines.

Cross-scope cases involving drawing + SharedVariables (variable-chip dangling reference, etc.) live in [shared-variables.md](shared-variables.md).

## ✅💻 Object selection lost **[requires active interaction]**

- User A and User B both have the same drawing tile open with some existing objects
- Pause User A's uploads
- User A adds, deletes, or modifies any object
- User A clicks resume (5-second delay starts)
- **Within the 5-second window**: switch to User B and select one or more drawing objects (to move, resize, or change color)
- User A's change arrives and triggers a re-render
- **Expected Result**: User B's selection state may be cleared by the re-render. They would need to re-select objects.
- **Actual Result**: Selection seems to work fine, I can't break it.

## 🐛⚠️ Mid-drag interrupted **[requires active interaction]**

- User A and User B both have the same drawing tile open with some existing objects
- Pause User A's uploads
- User A makes any change to the drawing
- User A clicks resume (5-second delay starts)
- **Within the 5-second window**: switch to User B and start dragging a drawing object to move it, holding the drag past the 5-second mark
- User A's change arrives mid-drag
- **Expected Result**: The drawing re-renders, potentially resetting the object's position mid-drag or ending the drag operation.
- **Actual Result**: Just changing the properties of an object being dragged works fine. Or changing the properties of other objects. If the object being dragged is deleted then it actually deletes underneath the cursor. Lots of warnings are printed in the console but it doesn't seem to break.

## ❌ Color applied to wrong object **[undo-testable]**

- Start with a drawing with 3 objects
- Pause User A's uploads
- User A changes the fill color of object 2
- User B deletes object 1
- Resume User A's uploads
- **Expected Result**: User A's color change patch targets object index 1 (previously object 2). It gets applied to what is now object 2 (previously object 3). Users see different colors on objects.
- **Actual Result**: As expected, it colors the wrong object for user B. Additionally, the undo stack gets messed up.
- **Undo test**: Create a drawing with 3 objects, each with a different fill color. Delete the first object. Change the fill color of one of the remaining objects. Undo the color change. Check whether the correct object reverts to its original color. Then undo the deletion. Check whether the restored object has the right color and the other objects haven't changed. This tests whether array-index-based patches correctly handle object insertion/deletion.
- **Undo Result**: Works fine.
- **Generalization**: this happens for any common drawing object property (fill color, stroke width, position, rotation, flipping). Properties unique to one object kind (e.g., a text object's `text`) are silently ignored when the index lands on an object of a different kind, with no console error.
- **Proposed fix**: store drawing objects in a map keyed by id rather than an array. If z-order matters, add a fractional position field on each object so reordering is tolerant to concurrent changes.

Jira story: https://concord-consortium.atlassian.net/browse/CLUE-507

## 🚧 Voice typing text lost **[requires active interaction]**

- User A and User B both have the same drawing tile open
- Pause User A's uploads
- User A makes any change to the drawing
- User A clicks resume (5-second delay starts)
- **Within the 5-second window**: switch to User B, activate voice typing, and speak so interim text accumulates
- User A's change arrives before the transcription is committed
- **Expected Result**: The interim voice transcription is held in local React state (`interimText`). A re-render from a remote change could reset this state, losing the transcription before it's committed.
- **Actual Result**:
