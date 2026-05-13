# Dataflow Tile (Rete node editor) — Test Scripts

See [README.md](README.md) for the single-person testing technique and reporting guidelines.

## 🚧 Node drag interrupted **[requires active interaction]**

- User A and User B both have the same dataflow tile open with some nodes
- Pause User A's uploads
- User A makes any change to the dataflow program
- User A clicks resume (5-second delay starts)
- **Within the 5-second window**: switch to User B and start dragging a dataflow node to reposition it, holding the drag past the 5-second mark
- User A's change arrives mid-drag
- **Expected Result**: If the Rete editor re-renders, the drag operation may be interrupted and the node may snap back to its pre-drag position.
- **Actual Result**:

## ❌ Playback index becomes invalid **[undo-testable]**

- User B is playing back recorded data at index N
- User A modifies the program (adds/removes nodes) which changes what data was recorded
- **Expected Result**: `playBackIndex` may now be out of bounds for the new data, or point to a different moment in the recording than intended.
- **Actual Result**: You can’t delete a node when a dataflow tile has recorded data, so the test is invalid.
However, this showed another problem: A can’t see nodes added by B without some other refresh. There seem to be other more serious issues with dataflow tiles sharing data, too.
- **Undo test**: In a dataflow tile, create a program with a few nodes. Record some data. Start playback and navigate to a specific index. Then undo a node addition (which changes the program structure). Check whether the playback UI handles the changed program gracefully — does it show an error, reset to index 0, or display incorrect data?
- **Undo Result**: Undoing after recording undoes the addition of cases to the dataset, so you have to undo the entire recording before you can undo adding a node. Definitely bad behavior, but very different from what is suggested here.

I'm not making a Jira story for this one. Since the Dataflow tile is likely to face a major refactor very soon, it seems worth revisiting this afterwards.

## 🚧 Connection being drawn is lost **[requires active interaction]**

- User A and User B both have the same dataflow tile open with multiple nodes
- Pause User A's uploads
- User A makes any change
- User A clicks resume (5-second delay starts)
- **Within the 5-second window**: switch to User B and start drawing a connection between two nodes, holding the in-progress draw past the 5-second mark
- User A's change arrives mid-draw
- **Expected Result**: The in-progress connection (which exists only in Rete's internal state) may be lost on re-render.
- **Actual Result**:
