# Summary

CLUE has some work in progress support for group documents that can be edited by multiple users at the same time. While this works in some cases when changes do not overlap, there are several cases that can break it. Below is a list of a few.

## How It Works

Group documents use `FirestoreHistoryManagerConcurrent` (in `src/models/history/firestore-history-manager-concurrent.ts`) which extends `FirestoreHistoryManager`. The key differences are:

1. **Concurrent uploads**: Uses a queue (`completedHistoryEntryQueue`) to batch history entries and uploads them using Firestore transactions to safely manage `lastHistoryEntry` metadata when multiple users write simultaneously.

2. **Remote sync**: Listens for remote history entries and applies them to the local document via `syncRemoteFirestoreHistory()` and `applyHistoryEntries()`.

3. **Pause/resume**: Supports pausing uploads temporarily (used for testing concurrent scenarios).

The system stores `lastHistoryEntry` (index and id) in the document metadata to track the most recent history entry, allowing safe concurrent writes without querying the history collection.

# Model Inconsistency Issues

## History Entry Ordering

Location: `firestore-history-manager-concurrent.ts:syncRemoteFirestoreHistory()`

When applying remote history entries, the code adds new entries that aren't in local history. However, this means history entries on different clients may be in different orders - other clients won't have local entries that haven't been uploaded yet. The code comment notes "This problem is being punted for now."

This could cause issues when replaying history or comparing document states across clients.

## Tile Deletion

- start with a document that has a text tile
- pause user A's uploads
- user A updates the text of the tile
- user B deletes the tile
- resume user A's uploads

The result of this actually looks OK. There is an error in the console about MST not allowing a entry to be applied. But the document seems like it is in a good enough state.

The current problem with this case is that the recorded history is now broken. So it cannot be replayed correctly. This shows up as the initial text tile never being visible when scrubbing back and forth in the history view.

## Drawing Object Property Change

- start with a drawing that has 3 objects
- pause user A's uploads
- user A sets fill color of the 2nd object
- user B deletes the first object
- resume user A's uploads

The result of this is that user B will see different object colors than user B.

This behavior should happen for any common drawing object properties: fill color, stroke width, position, rotation, flipping. If there is a property like "text" of a text object that doesn't exist on other objects, this seems to just be ignored. It doesn't show an error in the console.

This issue happens because the drawing objects are stored in an array, so updates to them come in with a path using the index in that array. When an object is deleted the index of each object after the deletion changes. A fix for this is to store the objects in a map instead. If the object ordering is needed (perhaps to determine which object is on top) then a fractional position can be put in the object so reordering is tolerant to concurrent changes.

## Table Column Deletion

- start with a table that has 3 columns
- pause user A's uploads
- user A sets the value in a cell in the 2nd column
- user B deletes the 2nd column
- resume user A's uploads

The result of this is that user B will see the value in new 2nd column which used to be 3rd column.

This issue happens because the values are stored in attributes which are stored in an array, so updates to values come with identifiers of the attribute index. When an attribute is deleted the index of each attribute after the deletion changes. A fix for this is to store the attributes in a map instead. If the attribute ordering is needed (perhaps to determine the order of the attributes in the table) then a fractional position can be put in the object so reordering is tolerant to concurrent changes.

# Untested Potential Model Inconsistency Issues

## Shared variables

Chips in the text tile and nodes in the diagram tile point at variables. I'm not sure we can delete a variable, but if so that might break things.

## Data Types

Perhaps in the table or somewhere else there might be a dependency on the datatype of a field, if that is changed by someone else perhaps that can crash the document.

## Graph annotation types

If I remember right graph annotations have types which determine their shape. Perhaps if we change the annotation type and at the same time change a property of the old type, this might make it possible to create broken document state.

# Model Conflicts that seem to work

## Sparrow pointing at deletion

- start with a document containing two drawing tiles each with an object
- pause User A's updates
- User A draws a sparrow between the two tile's drawing objects
- User B deletes the second tile
- resume User A's updates

The result seems to be same as if the tile is deleted by a single user after they made the sparrow connection. The sparrow shows up as a loop pointing to the same object.


# Global Fix

So far all the issues that have been explored above, could be addressed by a global change. When a change in the remote history is downloaded by a client, it can check if it has a local fork from this history. That would be a history entry that has the same previousEntryId as a different remote history entry. In this case the client should reverse its history until this fork point and then apply the remote history.

This approach will mean any conflicting changes will be lost by one of the users. If the users do not edit the same tile at the same time this conflicting changes should be minimal.

This approach should guarantee that the document state and history state are valid, and that all use documents show the same thing.

In the future we can add special handling for certain cases so we can accept some changes even when there is a local fork. These would be changes that we know will not conflict with each other.

# UI Issues

## Table Cell Editing

- start with a document with a table
- pause User A's updates
- User A edits a cell
- resume User A's updates (with a delay)
- User B starts editing a different cell, but doesn't hit enter or tab. This has to happen before User A's updates are applied to User B's document

In this case User B's edits will be lost. This happens even though they are in a different cell. The cursor and focus of User B is lost when the table is updated to show User A's changes.

## Table Attribute Editing

- start with a document with a table
- User A changes the name of an attribute

In this case User B will not see the new attribute name.

This is probably due to the table component not paying attention to this kind of model change. We should test if the same problem happens when a single user tries to undo an attribute name change. And also test what happens when playing back history, whether attribute name changes show up in the playback.

If a new column is added then User B sees the new attribute name.

# Other issues

## Table with graph

I don't know the exact steps yet, but I found that when a graph is connected to a table only one of the documents actually shows the points on the graph.

# Implementation TODOs

These are unfinished items identified in the code:

## Race Condition in Initial History Load

Location: `firestore-history-manager-concurrent.ts` constructor

When loading a group document, the system fetches the `lastHistoryEntry` to determine which history entries to skip (since they're already applied to the initially loaded document content). This approach is error-prone because:
- A new history entry might be added after fetching the document content but before fetching the last history entry
- Network delays might cause the document fetch to happen after the history entry fetch

**Proposed fix**: Include all applied history entry IDs in the document content written to Firebase Realtime Database, then only apply history entries not in this list.

## Local history doesn't include previous remote entries

Location: `firestore-history-manager-concurrent.ts:applyHistoryEntries()`

When the document is first opened, remote history entries that have already been applied to the loaded document, are not re-applied. When this is skipped, we also skip putting these remote entries in the local history. So the local history does not contain the full history of the document. This is the same behavior as non group documents, and it seems to work fine. However it is confusing that the full history isn't available locally.

## Error Handling for Metadata Document

Location: `firestore-history-manager-concurrent.ts:uploadQueuedHistoryEntries()`

The code awaits `environmentAndMetadataDocReadyPromise` inside a try/finally that resets `uploadInProgress`. This prevents the upload queue from stalling on errors, but creates a different problem: if the promise rejects, it will throw on every subsequent call (rejected promises throw each time they're awaited). This creates an endless cycle of silent failures as new history entries keep getting queued.

**Needed improvements**:
1. Track when this has permanently failed and stop retrying
2. Show the user that sync is broken

## Migration for Existing Documents

Location: `firestore-history-manager-concurrent.ts:uploadQueuedHistoryEntries()`

If there's no `lastHistoryEntry` in the metadata (for documents created before this feature), the code would need to scan existing history entries to find the last one. This can't be done in a Firestore transaction, so it would need to happen before starting the transaction. This migration wouldn't be safe if multiple clients are writing history simultaneously.

Current plan: Only use this for new group documents; some lost history for existing group documents is acceptable.

## Unhandled Promise in Recursive Upload Call

Location: `firestore-history-manager-concurrent.ts:uploadQueuedHistoryEntries()` (line 217)

The recursive call to `this.uploadQueuedHistoryEntries()` at the end of the function is not awaited or error-handled. If this async call throws, it will result in an unhandled promise rejection. Consider adding `.catch()` for error logging, though `await` would change the fire-and-forget behavior which is intentional.

## Timer Not Tracked in resumeUploadsAfterDelay

Location: `firestore-history-manager-concurrent.ts:resumeUploadsAfterDelay()` (lines 63-70)

The `setTimeout` call doesn't store or cancel previous timers. Multiple calls could schedule multiple timeouts, potentially resuming uploads at unexpected times. This is low priority since it's primarily used for debugging/testing, but storing the timeout ID and clearing it before scheduling a new one would make it more robust.

## Test Coverage Gaps

Primarily in:
- `firestore-history-manager.ts`
- `firestore-history-manager-concurrent.ts`
- `document-metadata-model.ts`
