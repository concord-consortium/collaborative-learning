# History Framework

The history framework in CLUE is used for recording changes to documents to support undo/redo and time traveling.

The framework is based on MobX State Tree (MST). It is intended to support iframe based tile implementations. We do not currently have any iframe tiles, but the key feature is that there has to be multiple MST trees that coordinate with each other.

The main parts of the system are:
- `TreeAPI`: this is the interface used by the container to work with the trees. It is intended to work over postMessage. Its methods are well documented.
- `ContainerAPI`: this is the interface used by trees to work with the container. It is intended to work over postMessage so trees in iframes can communicate with the container in the host page. Its methods are well documented.

- `TreePatchRecord`(MST): This is set of patches for a single tree. It represents what the MST action tracking middleware returns (action, patches, inversePatches)
- `HistoryEntry`(MST): This is a container of TreePatchRecords. It represents the full user or async action which could be modifying multiple trees. It also keeps track of whether there are outstanding tree patch records that haven't been recorded yet.
- `CDocument`(MST): (change document) This has the list of history entries. It can be serialized independently to record the history of changes to the document.
- `UndoStore`(MST): This has a list of references to history entries as well as the index of the current entry that has been undone.  It would normally not be serialized itself. It uses references so we aren't keeping 2 copies of each history entry. It has actions to apply the undo and redo by applying patches to the affected trees.
- `DocumentStore`(MST): This has a CDocument and a UndoStore.
- `Container`: the singleton that manages the multiple trees. It has one documentStore, undoStore, containerAPI, and array of trees. Because it isn't a MST model it can't own the undoStore otherwise it could.
FIXME: it sees like this could be simplified. Some merge of the DocumentStore and the Container seems worth while. The problem I can see is that the Container needs to implement or provide the containerAPI. Perhaps it could just implement it, and have the extra stuff of trees. This way we could get rid of the DocumentStore. Most of the methods just proxy to the document store anyhow.

- `Document`(MST): this creates the Container in afterCreate, and stores it in its volatile prop. It also separately stores the containerAPI. It setups up the tree monitor with the Document, and containerAPI. It also adds itself as a tree to the container's array of trees. This is the main entry point to the history system. It is also the MST object that is serialized as the CLUE user document. It is strange that the Document is a tree and also initializes the container. 
FIXME: I don't know why it needs both container and containerAPI. 
- `Tree`(MST): a MST model that Document extends. It provides actions that Trees need. It is providing the implementation of the TreeAPI. It is intended to be generic and usable by any MST model that wants to be a tree. However currently it has references to DocumentContentModel, Tiles, and SharedModel. The worst of this is the DocumentContentModel. The idea would be that a iframe based tile would have a different root instead of DocumentContentModel and this root would include the Tree. So if the Tree had some view to get the sharedModelMap this would then be implemented by each root.
- "tree monitor": a MST middleware which records the actions.

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
class DocumentStore {
  <<MST>>
}
HistoryEntry --* TreePatchRecord
CDocument --* HistoryEntry
UndoStore --o HistoryEntry
DocumentStore --* "1" CDocument
DocumentStore --* "1" UndoStore
DocumentStore --|> ContainerAPI : implements
```

## Connection of History to CLUE Document
```mermaid
classDiagram
direction LR
class DocumentStore {
  <<MST>>
  trees
}
Document --> DocumentStore : volatile

class Document {
  <<MST>>
  ...  
}
class Tree {
  <<MST>>
}
Document --|> Tree : extends
DocumentStore --o "*" Tree
Tree --|> TreeAPI : implements

```

## Undo, Redo, Replay History

### From the tree's point of view
```mermaid
sequenceDiagram
  participant Container
  participant Tree
  participant TreeMonitor
  Container->>Tree: startApplyingContainerPatches
  activate Container
  Note right of Container: same exchangeId
  Tree->>TreeMonitor: onStart
  activate Tree
  Note right of Tree: shared model<br/>update disabled 
  Tree->>TreeMonitor: onFinish
  TreeMonitor->>Container: addTreePatchRecord
  deactivate Container
  Container->>Tree: applyContainerPatches
  activate Container
  Note right of Container: same exchangeId
  Tree->>TreeMonitor: onStart, onFinish
  TreeMonitor->>Container: addTreePatchRecord
  deactivate Container
  Container->>Tree: finishApplyingContainerPatches
  activate Container
  Note right of Container: same exchangeId
  Tree->>TreeMonitor: onStart
  Note right of Tree: shared model<br/>update enabled 
  deactivate Tree
  Tree->>Tree: updateTreeAfterSharedModelChanges
  Tree->>TreeMonitor: onFinish
  TreeMonitor->>Container: addTreePatchRecord
  deactivate Container
```

### From the container point of view

```mermaid
sequenceDiagram
  participant UndoStore
  participant DocStore
  participant Container
  participant Tree
  UndoStore->> DocStore: createHistoryEntry
  activate DocStore
  loop each tree
    UndoStore->>DocStore: startExchange
    activate DocStore
    UndoStore->>Tree: startApplyingContainerPatches
    activate Tree
    Note left of Tree: shared model<br/>update disabled 
    Tree->>Container: addTreePatchRecord
    Container->>DocStore: addPatchesToHistoryEntry
    deactivate DocStore
  end
  loop each tree
    UndoStore->>DocStore: startExchange
    activate DocStore
    UndoStore->>Tree: applyContainerPatches
    Tree->>Container: addTreePatchRecord
    Container->>DocStore: addPatchesToHistoryEntry
    deactivate DocStore
  end
  loop each tree
    UndoStore->>DocStore: startExchange
    activate DocStore
    UndoStore->>Tree: finishApplyingContainerPatches
    Note left of Tree: shared model<br/>update enabled 
    deactivate Tree
    Tree->>Container: addTreePatchRecord
    Container->>DocStore: addPatchesToHistoryEntry
    deactivate DocStore
  end
  UndoStore->> DocStore: endExchange
  deactivate DocStore
```

## Recording a change to a tile and shared model

### From the Tree's point of view
This is usually triggered when an action is called on a tile.
```mermaid
sequenceDiagram
  participant TreeMonitor
  participant Tree
  participant Container
  TreeMonitor->>Container: addHistoryEntry
  activate Container
  Note right of Container: same exchangeId 
  TreeMonitor->>Tree: handleSharedModelChanges
  Tree->>Container: updateSharedModel
  TreeMonitor->>Container: addTreePatchRecord
  deactivate Container
```

### From the Container's point of view
```mermaid
sequenceDiagram
  participant SourceTree
  participant Container
  SourceTree->>Container: addHistoryEntry  
  activate Container
  Container->>DocStore: createHistoryEntry
  Note right of Container: same exchangeId 
  SourceTree->>Container: updateSharedModel
  loop other trees
    Container->>DocStore: startExchange
    activate Container
    Note right of Container: same exchangeId
    Container->>OtherTree: applySharedModelSnapshotFromContainer
    OtherTree->>Container: addTreePatchRecord (not implemented)
    Container->>DocStore: addPatchesToHistoryEntry
    deactivate Container
  end
  SourceTree->>Container: addTreePatchRecord
  Container->>DocStore: addPatchesToHistoryEntry
  deactivate Container
```


## TODO:
- [x] document history models
- [x] find or make tests of the existing code so we can address the FIXMEs without manually testing each one. These tests can be based on the shared-model-document-manager tests. We can start with testing undo and redo. We don't have time to test that it works with multiple trees through, so we'll start with the single tree. That should be enough to do the refactoring.
- [x] can the historyEntryId be used as the exchangeId? I think not, but it should be reviewed and documented.  I think the best way to evaluate this is with a sequence diagram or some other diagram that shows the calls between the different components. To identify for what things the exchangeId is being used. Because we are short on time, I just going to keep the call id. I'm still going to make the diagram because it is a key part of the system.
- [x] figure out if the same exchangeId is used in 2 responses. This is described in container-api in addHistoryEntry, so we should track that down and if so make a sequence diagram of that case.
- [x] rename callId and methods describing call: probably should be patchRecordId and startPatchRecord and endPatchRecord. Review the use of startExchange in undo-store. I don't know if startPatchRecord works for this. The weird thing with applyPatchesToTrees is that a exchangeId is created for startApplyingContainerPatches and this is different than the exchangeId when applyContainerPatches is called. A more generic name could be exchangeId, or requestId. A confusing thing with requestId is that the response to the request is technically a request it is just coming from the tree going back to the container. The other naming confusion is the use of addTreePatchRecord to close out this exchangeId
- [ ] try to combine Container and DocumentStore
- [ ] make a diagram of how call ids are used for tracking the status of the historyEntry. Doing this after the renaming seems best.
- [ ] try to unify Document.afterCreate with createDocument
- [ ] review how exchangeId is handled when an undo triggers a call to updateSharedModel, should a new exchangeId be generated here or should it be re-using an existing exchangeId?
- [ ] see if we can remove the code which creates a history entry when addPatchesToHistoryEntry is called
- [ ] look at the history entry generated when the history is replayed. The fixme is in the endExchange. In the case of time travel we don't want to generate new history entries when they time travel. And we aren't currently planning to replay the history from scratch. So if it is easy we should get rid of any history entry generation when replaying. The test for replaying does have the tree monitor installed when the history is replayed so it is a way to test whether we can skip this.
- [ ] add a test where a new shared model is added to the document and see what history entries are generated and whether the updateSharedModel methods are called correctly. I haven't really thought about what should happen here. fixmes are in tree-monitor recordPatches
- [ ] Tree.handleSharedModelChanges is an async action that ins't a flow. There might also be a way to simplify it now that it is an action.
- [ ] Tree.handleSharedModelChanges calls updateTreeAfterSharedModelChangesInternal but since it is async and not a flow this call becomes a new top level action. If we switch it to a flow then we'll probably have to ignore the handleSharedModelChanges in the tree-monitor
- [ ] UndoStore.redo and UndoStore.undo do not handle async well, they are changing the undo index before all of the patches have been applied to the trees.
- [ ] review call to updateAfterSharedModelChanges in shared-model-document-manager.addTileSharedModel. Is it necessary?
