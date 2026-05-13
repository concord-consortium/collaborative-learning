# Data Card Tile — Test Scripts

See [README.md](README.md) for the single-person testing technique and reporting guidelines.

Cross-scope cases involving data card + SharedDataSet (stale-snapshot tracking, etc.) live in [shared-dataset.md](shared-dataset.md).

## 🚧 Edit context for deleted attribute **[requires active interaction]**

- User A and User B both have the same data card open showing attribute X
- Pause User A's uploads
- User A deletes attribute X
- User A clicks resume (5-second delay starts)
- **Within the 5-second window**: switch to User B and click into a cell for attribute X to start editing
- User A's delete arrives while User B's editor is open
- **Expected Result**: `currEditAttrId` references the now-deleted attribute. The editing UI may close, blank, or show a stale value.
- **Actual Result**:

## ✅ Edit context for deleted attribute (single-user undo)

Single-user proxy for the case above.

- In a data card tile linked to a table, click on a field to view/edit it
- Go to the table and delete the column for that attribute. Check whether the data card shows an error or handles the missing attribute
- Then undo the column deletion. Check whether the data card recovers and shows the attribute's data again
- **Result**: Seems fine. When you switch to the table you stop editing in the data card.

## 🐛 Case navigation desync

- User B is viewing case 5 of 10
- User A deletes several cases
- **Expected Result**: `caseIndex` may now be out of bounds. The `updateAfterSharedModelChanges` implementation does handle this (clamps to range), but there may be a brief flash of invalid state.
- **Actual Result**: Selection is mostly shared between users. When A views card 1, B also sees card 1. This isn’t true for the table—if A has case 1 selected and B selects case 3, A’s table still has 1 selected, even though data cards for both users show case 3. In this way it’s possible for A to delete a case using the table, and when that happens the visible card shifts (it now shows the former 4th card which is now the 3rd card). The data card clamps to the last card if the index is illegal.
I'm not sure if sharing the data card selection across users should be considered a bug or intended behavior.

Jira story: https://concord-consortium.atlassian.net/browse/CLUE-509

This case should behave the same with a single user undoing. See below for that quicker test.

## ✅ Case navigation desync (single-user undo)

Single-user proxy for the case above.

- In a data card linked to a table with 10 rows, navigate to case 8
- Go to the table and delete the last 5 rows. Check whether the data card clamps to a valid case
- Then undo the deletion. Check whether the data card returns to showing case 8 or at least a valid case with the correct data
- **Result**: You can’t delete a case in the table without selecting it, which changes the card displayed in the data card. Undoing/redoing adding cases results in different cases being shown in the data card (undo switches to the first card, redo switches to the most recently added card). Always showed a valid card.

I didn't add a jira story for the undo/redo issue, which seems very minor.
