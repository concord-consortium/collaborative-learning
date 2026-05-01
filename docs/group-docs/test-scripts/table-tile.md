# Table Tile — Test Scripts

See [README.md](README.md) for the single-person testing technique and reporting guidelines.

Cross-scope cases involving table + SharedDataSet (cell value lands in wrong column when remote attribute is deleted, etc.) live in [shared-dataset.md](shared-dataset.md).

## ❌ Cell focus lost on remote update **[requires active interaction]**

- User A and User B open the same group document with a table
- Pause User A's uploads
- User A types a value in a cell and presses Tab/Enter to commit
- User A clicks resume (5-second delay starts)
- **Within the 5-second window**: switch to User B, click into a different cell, and start typing (but do not press Tab/Enter)
- User A's change arrives and updates the table on User B's screen
- **Expected Result**: User B's cell focus and uncommitted text are lost. The re-render triggered by the remote change resets the grid's editing state.
- **Actual Result**: Confirmed. User B's uncommitted edits are lost — focus and cursor reset when the table re-renders to show User A's change, even though the two users were editing different cells.

## ❌ Attribute name change not visible

- User A and User B open the same group document with a table
- User A renames a column header (attribute name)
- **Expected Result**: User B does not see the renamed column.
- **Actual Result**: As expected.

The root cause is that the table's column definitions are cached in a `useMemo` whose dependencies don't include attribute names. The `onSnapshot` handler calls `triggerRowChange()` instead of `triggerColumnChange()`, so attribute name changes never rebuild the columns. This affects all views (edit and read-only) equally — the apparent update in same-instance read-only testing was a coincidence caused by shared selection state invalidating the memo.

Jira story: https://concord-consortium.atlassian.net/browse/CLUE-505 (in code review)

This case should behave the same with a single user undoing. See below for that quicker test.

## ❌ Attribute name change not visible (single-user undo)

Single-user proxy for the case above.

- Rename a column
- Undo.
- The column header should revert to the old name but doesn't.
- **Result**: As expected (header doesn't revert).

Jira story: https://concord-consortium.atlassian.net/browse/CLUE-505 (in code review)

## ❌ Column width lost on remote column deletion

- Start with a table with 3+ columns where User B has resized some columns
- User A changes a column width
- **Expected Result**: The same column should resize in User B's document.
- **Actual Result**: User B does not see that change in the column, only in the table title bar width.

Jira story: https://concord-consortium.atlassian.net/browse/CLUE-510

This case should behave the same with a single user undoing. See below for that quicker test.

## 🐛 Column width change not reverted by undo (single-user undo)

- Resize a column.
- Undo the resize.
- **Expected Result**: The column width reverts to the previous size.
- **Actual Result**: The column width does not revert in the column itself. The table title bar width does change correctly.

Jira story: https://concord-consortium.atlassian.net/browse/CLUE-510

## 🚧 Column width lost on remote column deletion

- Start with a table with 3+ columns
- Pause User A's uploads and downloads
- User B resizes a column
- User A deletes a column
- Resume User A's uploads
- **Expected Result**: User B's change will store a columnWidth for the column with an attribute id. User A's change will delete the attribute but might not change the table state. So now the `columnWidths` map will refer to missing attribute.
- **Actual Result**:

Note: currently when a attribute is deleted from the table the "updateHash" property on the table is recorded as a change. So it is likely this won't cause a problem, because the user A's change will be considered a conflict and will be reverted. However if we remove the "updateHash" properties this could become a problem, so it is good to keep this test in case it regresses.

## ✅ Column width lost on redo (single-user undo)

Single-user proxy for the case above.

- Create a table with 3 columns.
- Resize column 2 to be noticeably wider.
- Delete column 2.
- Undo the deletion.
- Check whether column 2 comes back with its custom width or reverts to default width.
- **Result**: The column comes back the correct size.

## ✅💻 Row drag interrupted **[requires active interaction]**

- User A and User B open the same group document with a table of several rows
- Pause User A's uploads
- User A adds or deletes a row (change stays local)
- User A clicks resume (5-second delay before the change is uploaded)
- **Within the 5-second window**: switch to User B and start dragging a row to reorder it, holding the drag past the 5-second mark
- User A's change flushes to Firebase and arrives at User B's session mid-drag
- **Expected Result**: The table re-renders during User B's drag operation, potentially breaking the drag state or causing the row to snap to a wrong position.
- **Actual Result**:
  - when the row being dragged is the one that was deleted then when it is dropped it just disappears.
  - when it is a different row it seems to work fine.

## ❌ Cell editing in deleted column

- Pause User A's uploads
- User A types a value into a cell in column 2
- User B deletes column 2
- Resume User A's uploads
- **Expected Result**: User A's patch targets column 2 by array index. Since column 2 was deleted, the value may land in what is now column 2 (previously column 3). Both users see different data.
- **Actual Result**: As expected, A's change goes to the wrong column for B.
- **Proposed fix**: store attributes in a map keyed by id rather than an array. If column ordering matters, add a fractional position field on each attribute so reordering is tolerant to concurrent changes.

Jira story: https://concord-consortium.atlassian.net/browse/CLUE-506



## ✅ Cell editing in deleted column (single-user undo)

Single-user proxy for the case above. Tests whether array-index-based patches correctly handle column insertion/deletion.

- Create a table with 3 columns (A, B, C) with data in each.
- Delete column A.
- Check whether the data in columns B and C is still correct and in the right columns.
- Then undo the deletion.
- Check whether all three columns have their original data.
- **Result**: Working correctly.
