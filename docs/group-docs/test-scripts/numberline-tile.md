# Numberline Tile — Test Scripts

See [README.md](README.md) for the single-person testing technique and reporting guidelines.

## 🤷 Selected point deleted **[undo-testable]**

- User B selects a point on the numberline
- User A deletes that point
- **Expected Result**: `_selectedPointId` references a deleted point. UI may show selection highlight on nothing, or error when trying to modify the selected point.
- **Actual Result**: Seems fine.
- **Undo test**: Create a numberline with 3 points. Select the middle point. Delete it. Check whether the numberline renders correctly without the point. Undo the deletion. Check whether the point reappears in the correct position and the numberline is in a consistent state.
- **Undo test**: Seems fine. Seems to lose selection when undoing a delete, which is confusing because there is no visual feedback about a point being selected :\

## 🚧 Point drag lands on wrong value **[requires active interaction]**

- User A and User B both have the same numberline tile open
- Pause User A's uploads
- User A changes the min/max bounds of the numberline
- User A clicks resume (5-second delay starts)
- **Within the 5-second window**: switch to User B and start dragging a point along the numberline, holding the drag past the 5-second mark
- User A's change arrives mid-drag
- **Expected Result**: The d3 scale changes while the drag is in progress. The point may jump to an unexpected position when the scale updates.
- **Actual Result**:
