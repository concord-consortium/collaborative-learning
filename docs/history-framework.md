# History Framework

The history framework in CLUE is used for recording changes to documents to support undo/redo and time traveling.

The framework is based on MobX State Tree (MST). It is intended to support iframe based tile implementations. With iframe based tiles there will be multiple MST trees that need to coordinate with each other. However, we do not currently have any iframe tiles, so this capability of the system hasn't been tested yet.

The main parts of the system are:
- `TreeAPI`: this is the interface used by the TreeManager to work with the trees. It is intended to work over postMessage. Its methods are well documented.
- `TreeManagerAPI`: this is the interface used by trees to work with the TreeManager. It is intended to work over postMessage so trees in iframes can communicate with the TreeManager in the host page. Its methods are well documented.

- `TreePatchRecord`(MST): This is set of patches for a single tree. It represents what the MST action tracking middleware returns (action, patches, inversePatches)
- `HistoryEntry`(MST): This is a container of TreePatchRecords. It represents the full action which could be modifying multiple trees. It also keeps track of whether there are outstanding tree patch records that haven't been recorded yet.
- `CDocument`(MST): (change document) This has the list of history entries. It can be serialized independently to record the history of changes to the document.
- `UndoStore`(MST): This has a list of references to history entries as well as the index of the current entry that has been undone.  It would normally not be serialized itself. It uses references so we aren't keeping 2 copies of each history entry. It has actions to apply the undo and redo by applying patches to the affected trees.
- `TreeManager`(MST): This contains a CDocument and an UndoStore. It also tracks the set of trees. It implements the TreeManagerAPI.

- `Document`(MST): this creates the TreeManager in afterCreate, and stores it in its volatile prop.  It sets up the tree monitor with the Document, and TreeManagerAPI. It also adds itself as the main document of the TreeManager. The main document is added as a tree to the TreeManager's array of trees. This is the main entry point to the history system. `Document` is also the MST object that is serialized as the CLUE user document. It is not great that the Document is a tree and also initializes the TreeManager which is managing trees.
- `Tree`(MST): a MST model that Document extends. It provides actions that Trees need. It is providing the implementation of the TreeAPI. It is intended to be generic and usable by any MST model that wants to be a tree. However currently it has references to DocumentContentModel, Tiles, and SharedModel. The worst of this is the DocumentContentModel. The idea would be that a iframe based tile would have a different root instead of DocumentContentModel and this root would include the Tree. So if the Tree had some view to get the sharedModelMap this would then be implemented by each root.
- `TreeMonitor`: a class which adds a MST middleware for recording actions.

## MST Models to store History and Undo
```mermaid
classDiagram
title hello
direction LR
class TreePatchRecord {
  <<MST>>
  tree
  action
  IJsonPatch[] patches
  IJsonPatch[] inversePatches
}
class HistoryEntry {
  <<MST>>
  id
  initialTree
  state
}
class CDocument {
  <<MST>>
}
class UndoStore {
  <<MST>>
}
class TreeManager {
  <<MST>>
}
HistoryEntry --* TreePatchRecord
CDocument --* HistoryEntry
UndoStore --o HistoryEntry
TreeManager --* "1" CDocument
TreeManager --* "1" UndoStore
TreeManager --|> TreeManagerAPI : implements
```

## Connection of History to CLUE Document
```mermaid
classDiagram
direction LR
class TreeManager {
  <<MST>>
  trees
}
Document --> TreeManager : volatile

class Document {
  <<MST>>
  ...
}
class Tree {
  <<MST>>
}
Document --|> Tree : extends
TreeManager --o "*" Tree
Tree --|> TreeAPI : implements

```

## Undo, Redo, Replay History

### From the tree's point of view
```mermaid
sequenceDiagram
  participant TreeManager
  participant Tree
  participant TreeMonitor
  TreeManager->>Tree: startApplyingPatchesFromManager
  activate TreeManager
  Note right of TreeManager: same exchangeId
  Tree->>TreeMonitor: onStart
  activate Tree
  Note right of Tree: shared model<br/>update disabled
  Tree->>TreeMonitor: onFinish
  TreeMonitor->>TreeManager: addTreePatchRecord
  deactivate TreeManager
  TreeManager->>Tree: applyPatchesFromManager
  activate TreeManager
  Note right of TreeManager: same exchangeId
  Tree->>TreeMonitor: onStart, onFinish
  TreeMonitor->>TreeManager: addTreePatchRecord
  deactivate TreeManager
  TreeManager->>Tree: finishApplyingPatchesFromManager
  activate TreeManager
  Note right of TreeManager: same exchangeId
  Tree->>TreeMonitor: onStart
  Note right of Tree: shared model<br/>update enabled
  deactivate Tree
  Tree->>Tree: updateTreeAfterSharedModelChanges
  Tree->>TreeMonitor: onFinish
  TreeMonitor->>TreeManager: addTreePatchRecord
  deactivate TreeManager
```

### From the TreeManager point of view

```mermaid
sequenceDiagram
  participant UndoStore
  participant TreeManager
  participant Tree
  UndoStore->> TreeManager: createHistoryEntry
  activate TreeManager
  loop each tree
    UndoStore->>TreeManager: startExchange
    activate TreeManager
    UndoStore->>Tree: startApplyingPatchesFromManager
    activate Tree
    Note left of Tree: shared model<br/>update disabled
    Tree->>TreeManager: addTreePatchRecord
    deactivate TreeManager
  end
  loop each tree
    UndoStore->>TreeManager: startExchange
    activate TreeManager
    UndoStore->>Tree: applyPatchesFromManager
    Tree->>TreeManager: addTreePatchRecord
    deactivate TreeManager
  end
  loop each tree
    UndoStore->>TreeManager: startExchange
    activate TreeManager
    UndoStore->>Tree: finishApplyingPatchesFromManager
    Note left of Tree: shared model<br/>update enabled
    deactivate Tree
    Tree->>TreeManager: addTreePatchRecord
    deactivate TreeManager
  end
  UndoStore->> TreeManager: endExchange
  deactivate TreeManager
```

## Recording a change to a tile and shared model

### From the Tree's point of view
This is usually triggered when an action is called on a tile.
```mermaid
sequenceDiagram
  participant Tile
  participant TreeMonitor
  participant Tree
  participant TreeManager
  Note over Tile: some action
  Tile->>TreeMonitor: onStart
  Note over TreeMonitor: record all changes
  Tile->>TreeMonitor: onFinish
  TreeMonitor->>TreeManager: addHistoryEntry
  activate TreeManager
  Note right of TreeManager: same exchangeId
  TreeMonitor->>Tree: handleSharedModelChanges
  Tree->>TreeManager: updateSharedModel
  TreeMonitor->>TreeManager: addTreePatchRecord
  deactivate TreeManager
```

### From the TreeManager's point of view
```mermaid
sequenceDiagram
  participant SourceTree
  participant TreeManager
  SourceTree->>TreeManager: addHistoryEntry
  activate TreeManager
  Note right of TreeManager: same exchangeId
  SourceTree->>TreeManager: updateSharedModel
  loop other trees
    TreeManager->>TreeManager: startExchange
    activate TreeManager
    Note right of TreeManager: same exchangeId
    TreeManager->>OtherTree: applySharedModelSnapshotFromManager
    OtherTree->>TreeManager: addTreePatchRecord (not implemented)
    deactivate TreeManager
  end
  SourceTree->>TreeManager: addTreePatchRecord
  deactivate TreeManager
```

## Serialization
We store the history of changes to a document in Firestore. Each history entry is stored in a separate Firestore document. These history entry documents are stored in the same way that comments are stored. There is a parent Firestore document that has metadata about the actual CLUE document and then under this parent Firestore document is a collection for the comments and a collection for the history entries.

The history entries are written by the TreeManager which is an MST model. In other places we interact with Firestore through react components and use React hooks. Since the TreeManager is a model it works directly with Firestore.

The history events are downloaded only when needed for replaying the history. This happens when `TreeManager#mirrorHistoryFromFirestore` is called.

The history loading currently doesn't do any batching/paging during the load, so if the history gets large enough this might cause problems. There is a FIXME in the code for this. Once `mirrorHistoryFromFirestore` is called, any changes in the firestore collection will be reflected in the TreeManager's history. When new data shows up, it completely replaces the history in the TreeManager with the new data. In other words the entries aren't really loaded incrementally. We'll probably need to improve this to handle documents with large histories.

There is a little flakiness in this setup. The flakiness comes from the tracking of the `numHistoryEntriesApplied`. This property is intended to reflect the last history entry that was applied to the document associated with the TreeManager. Right now when the history controls are opened the current document is copied into a temporary document, and then `mirrorHistoryFromFirestore` is called on that temporary document's treeManager. The current code doesn't have a way to know what history entry actually matches the state of the document that was copied. So it sets `numHistoryEntriesApplied` from the last history entry that Firestore knows about at the time of the copy. If a change was just made to the current document before the copy, it is possible this change hasn't made it to Firestore yet, so then the `numHistoryEntriesApplied` can be behind the actual document.

To create the parent document which contains the history entries in Firestore the TreeManager is using our Firebase function `createFirestoreMetadataDocument`. This can create either a document associated with a networked teacher or a generic user document. This function allows teachers or students to create these documents. The history entries are downloaded using a Firestore query. The user is authorized to download these history entries by the context in the JWT provided by the portal compared with the properties in the parent document.

When a document is being edited it does not load all of the previous history entries from Firestore. The new history entries are stored locally and sent up to Firestore.  In other words, if the user is editing a document that was worked on before, the local history will only contain their new history entries.

### Ordering of history entries

Locally the history entries are ordered in the `TreeManager.document.history`.  When a user wants to replay the history all of the history entries are downloaded from Firestore ordered by an `index` field on the history entry. These downloaded history entries are set as the `TreeManager.document.history`.

In addition to the `index` field the history entries in Firestore include a `previousEntryId`, which could help if entries get out of order and we need to figure out what happened. The Firestore entries also include a `created` server timestamp which would be useful for debugging issues.

Because the `index` and `previousEntryId` fields need to know the last entry stored in Firestore, this last entry is downloaded before any new entries are written up to Firestore. Additionally, before this last entry is download the parent document is created. The async scheduling of this is done using a common promise that all history entry writes wait for. Any history entries that are created before this promise is resolved are still saved in `TreeManager.document.history`. The `index` of an entry is computed by adding its position in `TreeManager.document.history` to the index of the "last entry" saved in Firestore. Note that is not really the last entry, it is the last entry that existed in Firestore when the first new entry was generated by the user during this session with the document.

**Other history entry ordering options**

Before settling on the `index` approach for history entries I considered a few different options. Here is a list and why I didn't choose them.

**Linked List**

Store the previous entry's id in the current entry (`previousEntryId`). The first entry will have an undefined previous entry. Also store a server timestamp. The query from Firestore can order by the server timestamp so the entries are roughly in the right order. To build the correct order efficiently we can do two passes through the results.

##### Storing requirements
On the start of recording each session we need to know the entry id of the last history entry. So to be safe we have to download all the history entries to find the last one. We could cheat and reverse order the events by the server timestamp and then just look at the last X events. This assumes any out of order entries would be close to each other in time so we don't need to look far back in time to figure this out.

##### Problems
As described above, to be safe we have to look at every entry at the beginning of a new session with the document in order to figure out what the previousEntryId should be for the first entry of that session.

Possibly this lookup could be done asynchronously. Just the first entry of the session needs to know this, any future entries can refer to this first entry. But still to be safe all of the entries of the last session need to be downloaded. And this could be a large amount of data.

**Session start id plus index**

Create a CLUE document session record (Firestore document) at the beginning of working with each CLUE document. Store the history entries under this documentSession document with an index for the session.
The documentSession document would have a server timestamp that can be used to order them.

We load all of the documentSession documents ordered by the serverTimestamp and their children history entries.

If the id of the documentSession is generated client side then the history entries don't need to wait.

##### Problems
We don't really know about overlapping entries here. 2 sessions could be active at the same time. The entries could include a server timestamp so we'd have a sense of this. We might be able to update the sessionDocument with an ending timestamp when the user closes the document, but that probably won't be reliable, since a network failure can break it.

If one session is started, closed and other started very quickly the sessionDocument timestamps might be out of order.

##### Benefits
No waiting at the beginning of a session for a round trip to Firestore.
Order of entries is in firestore

**Other Notes**

We could use local computer timestamps to avoid the problem out of order events, but these are not accurate and in some schools can be years off.

There might be an approach that does the "Session start id plus index" without using extra documents by putting this start time or id in each of the history entry documents.

We could also put some session info the parent document itself, like a `numberOfSessions` to the document. So then a session index could be added to each history entry document. Then the history entry events could be ordered by the combination of this session index and a history entry index.

An alternative to querying the entries for the last index would be to store the last history entry in the parent document, but this means that document have to be updated with each new entry. And there is a limit of 1 sec per update. If you want to look into that approach more see:
https://firebase.google.com/docs/firestore/solutions/aggregation

### Serialization TODO:
- [ ] See if we can remove this use of cloud functions to do the network document writes, I think the only reason to use them is for permissions, I'd guess we can create rules that would allow them to be written without the functions. We probably are going to have either do this or change the cloud function so it can support students creating parent documents.
- [ ] update the logic for enabling the history button, so it checks the document's history index. This way it will only enable when the document has a history
- [ ] handle case when a teacher is viewing a history and new events are added. Previously we just didn't show the new entries until the history slider was opened and closed again. With the new serialized history, the new entries are being added in realtime. I think this breaks the slider code.
- [ ] refactor history hook code so it isn't located inside of the comment hooks file
- [ ] refactor mock firebase functions that is duplicated in 3 tests. If we switch to directly writing files then we'll probably have to mock that instead
- [ ] refactor history serialization code out of the tree-manager it is adding 100 lines to an already large file
- [ ] refactor history serialization's access to the user info which it uses to know where to write the history. This user info is set statically and not updated. Everywhere else in the code this info is dynamically updated, which makes it possible for the user to be switched (or logged out) without refreshing the page.
- [ ] How do we handle the caching of this data? Each time we open the time travel slider we are currently copying the document and all of the history events. We could just load all of these history events from the database each time it is opened. I would guess that Firestore does some caching of these queries so it won't be too slow as long as we share the firestore connection object.
- [ ] Handle published documents. We either need to copy and modify all of the history entries, or we need to change clue so the copies do not change the tile ids. In either case there are more details to fill out here.

## General TODO:
- [ ] UndoStore.redo and UndoStore.undo do not handle async well, they are changing the undo index before all of the patches have been applied to the trees.
- [ ] review how exchangeId is handled when an undo triggers a call to updateSharedModel, should a new exchangeId be generated here or should it be re-using an existing exchangeId?
- [ ] try to unify Document.afterCreate with createDocument
- [ ] move some of the large comments in the code into this document and put references in the code.
