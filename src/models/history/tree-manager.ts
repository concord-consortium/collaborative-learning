import {
  types, Instance, flow, IJsonPatch, isAlive
} from "mobx-state-tree";
import { nanoid } from "nanoid";
import { TreeAPI } from "./tree-api";
import { IUndoManager, UndoStore } from "./undo-store";
import { TreePatchRecord, HistoryEntry, TreePatchRecordSnapshot } from "./history";
import { DEBUG_HISTORY } from "../../lib/debug";

/**
 * Helper method to print objects in template strings
 * In console statements they can be "printed", just by adding them as extra
 * parameters.  But in error messages it is useful to do the same thing.
 * 
 * @param value any object
 * @returns 
 */
const json = (value: any) => JSON.stringify(value);

const FAKE_HISTORY_ENTRY_ID = "FAKE_HISTORY_ENTRY_ID";
const FAKE_EXCHANGE_ID = "FAKE_EXCHANGE_ID";

export const CDocument = types
.model("CDocument", {
  // TODO: switch to a map, so we get faster lookups in the map and MST can
  // do better at applying snapshots and patches by reusing existing
  // objects. 
  history: types.array(HistoryEntry)
});
export interface CDocumentType extends Instance<typeof CDocument> {}


export const TreeManager = types
.model("TreeManager", {
  document: CDocument,
  undoStore: UndoStore,
})
.volatile(self => ({
  trees: {} as Record<string, TreeAPI>
}))
.views((self) => ({
  get undoManager() : IUndoManager {
    return self.undoStore;
  },

  findHistoryEntry(historyEntryId: string) {
    return self.document.history.find(entry => entry.id === historyEntryId);
  },
}))
.actions((self) => ({
  // This is only currently used for tests
  setChangeDocument(cDoc: CDocumentType) {
    self.document = cDoc;
  },

  putTree(treeId: string, tree: TreeAPI) {
    self.trees[treeId] = tree;
  },

  startExchange(historyEntryId: string, exchangeId: string, name: string) {
    // Ignore fake history entries these are used when replaying history
    // to the tree
    if (historyEntryId === FAKE_HISTORY_ENTRY_ID) {
      return Promise.resolve();
    }

    // Find if there is already an entry with this historyEntryId
    const entry = self.findHistoryEntry(historyEntryId);
    if (!entry) {
      throw new Error(`History Entry doesn't exist ${ json({historyEntryId})} `);
    }

    // Make sure this entry wasn't marked complete before
    if (entry.state === "complete") {
      throw new Error(`The entry was already marked complete ${ json({historyEntryId, exchangeId})}`);
    }            
    
    // start a new open exchange with this exchangeId
    // Check if there is a open exchange already with this id:
    const activeExchangeValue = entry.activeExchanges.get(exchangeId);
    if (activeExchangeValue) {
      throw new Error("trying to create or update a history entry that has an existing open call");
    }
    entry.activeExchanges.set(exchangeId, name);
    return Promise.resolve();
  },

  endExchange(entry: Instance<typeof HistoryEntry>, exchangeId: string) {
    const openExchangeValue = entry.activeExchanges.get(exchangeId);
    if (!openExchangeValue) {
      throw new Error(`There is no active exchange matching ${ json({historyEntryId: entry.id, exchangeId}) }`);
    }

    entry.activeExchanges.delete(exchangeId);    
    
    // TODO: We could use autorun for watching this observable map instead of
    // changing the entry state here. 
    if (entry.activeExchanges.size === 0) {
      entry.state = "complete";

      // If the history entry resulted in no changes delete it.
      // TODO: we might not want to do this, it could be useful for
      // researchers to see actions the student took even if they
      // didn't change state. For example if a button was clicked even
      // if it didn't change the state we might want to show that to
      // the researcher somehow. There are lots of entries that are
      // empty though so they are removed for the time being.
      // TODO: we probably should store the entry in volatile until it
      // is complete and then add it to the document.history when it
      // is complete. This way it won't be incomplete in the history.
      if (entry.records.length === 0) {
        self.document.history.remove(entry);
      }
    }
  },

  createHistoryEntry(historyEntryId: string, exchangeId: string, name: string, 
    treeId: string, undoable: boolean) {
    let entry = self.findHistoryEntry(historyEntryId);
    if (entry) {
      throw new Error(`The entry already exists ${ json({historyEntryId})}`);
    } 
    entry = HistoryEntry.create({
      id: historyEntryId,
      action: name,
      tree: treeId,
      undoable
    });
    self.document.history.push(entry);

    entry.activeExchanges.set(exchangeId, `TreeManager.createHistoryEntry ${name}`);

    return entry;
  }
}))
.actions((self) => ({
  updateSharedModel(historyEntryId: string, exchangeId: string, sourceTreeId: string, snapshot: any) {
    // Right now this is can be called in 2 cases:
    // 1. when a user changes something in a tree which then updates the
    //    tree's view of the shared model, so the tree wants all copies of
    //    this shared model to be updated.
    // 2. when a user undoes or redoes an action that affects the shared model.
    //    In this case the tree owning the shared model calls updateSharedModel to send
    //    these changes to all of the other trees.
    //
    // If we support trees/tiles having customized views of shared models then this
    // will need to become more complex.
    const applyPromises = Object.entries(self.trees).map(([treeId, tree]) => {
      if (treeId === sourceTreeId) {
        return;
      }

      // In case #1 the passed in exchangeId comes from the action that updated
      // the shared model view in the tree. This exchangeId will be closed by the
      // tree after updateSharedModel is called. updateSharedModel will be
      // waited for, so it should not be possible for the historyEntry to be
      // closed before this new exchangeId is setup. So really we don't need the
      // exchangeId to be passed, but it can be useful for debugging. 
      // 
      // TODO: how is exchangeId handled in case #2?
      const applyExchangeId = nanoid();
      self.startExchange(historyEntryId, applyExchangeId, "updateSharedModel.apply");
      return tree.applySharedModelSnapshotFromManager(historyEntryId, applyExchangeId, snapshot);
    });
    // The contract for this method is to return a Promise<void> so we cast the result here.
    return Promise.all(applyPromises).then() as Promise<void>;
  },

  addHistoryEntry(historyEntryId: string, exchangeId: string, treeId: string, actionName: string, 
    undoable: boolean) {
    self.createHistoryEntry(historyEntryId, exchangeId, actionName, treeId, undoable);
    return Promise.resolve();
  },

  addTreePatchRecord(historyEntryId: string, exchangeId: string, 
    record: TreePatchRecordSnapshot) {

    if (historyEntryId === FAKE_HISTORY_ENTRY_ID) {
      // In this case we don't want to save anything. This is currently used when
      // replaying the history to the tree
      return;
    }

    const treePatchRecord = TreePatchRecord.create(record);

    // Find if there is already an entry with this historyEntryId
    const entry = self.findHistoryEntry(historyEntryId);
    if (!entry) {
      throw new Error(`There isn't an entry for ${ json({historyEntryId, exchangeId})}`);
    }

    // Make sure this entry wasn't marked complete before
    if (entry.state === "complete") {
      throw new Error(`The entry was already marked complete ${ json({historyEntryId, exchangeId})}`);
    }

    // The tree patch record will be sent even if there all no patches.
    // This is how the tree tells the manager that this exchangeId is closed.
    if (treePatchRecord.patches.length > 0) {
      entry.records.push(treePatchRecord);
    }

    if (DEBUG_HISTORY) {
      console.log("addTreePatchRecord", 
        { action: record.action, historyEntryId, exchangeId, 
          exchangeName: entry.activeExchanges.get(exchangeId)});
    }

    self.endExchange(entry, exchangeId);

    // Add the entry to the undo stack if it is undoable. 
    //
    // TODO: should we wait to add it until the full entry is complete?
    // It might be better to add it earlier so it has the right position
    // in the undo stack. For example if a user action caused some async
    // behavior that takes a while, should its place in the stack be at
    // the beginning or end of these changes?
    //
    // If this this is ending the last exchange and there are no patches, 
    // endExchange will remove this entry from the document.history. 
    // This should make the entry not alive, so it won't be added to the 
    // undoStore.
    // TODO: add a test to confirm this
    if (isAlive(entry) && entry.undoable && treePatchRecord.patches.length > 0) {
      self.undoStore.addHistoryEntry(entry);
    }
  },

  /**
   * Replay the whole history to the trees.
   * 
   * This should not record this "replay" into the history again
   */
  replayHistoryToTrees: flow(function* replayHistoryToTrees() {
    const trees = Object.values(self.trees);

    // Disable shared model syncing on all of the trees. This is
    // different than when the undo store applies patches because in
    // this case we are going to apply lots of history entries all at
    // once. We use FAKE ids here so any responses from tree are
    // not recorded in the history.
    const startPromises = trees.map(tree => {
      return tree.startApplyingPatchesFromManager(FAKE_HISTORY_ENTRY_ID, FAKE_EXCHANGE_ID);
    });
    yield Promise.all(startPromises);

    // apply the patches to all trees

    // iterate document.history This code groups all of the patches for a
    // particular tree into one array. This is batching is done
    // for performance.
    //
    // However, this single array of changes might be a problem for large
    // documents so we might have to split the array into pages, and send
    // information about the order of the pages so the tree receiving them can
    // make sure it is getting them in the right order.
    //
    const treePatches: Record<string, IJsonPatch[] | undefined> = {};
    Object.keys(self.trees).forEach(treeId => treePatches[treeId] = []);

    self.document.history.forEach(entry => {
      entry.records.forEach(treeEntry => {
        const patches = treePatches[treeEntry.tree];
        patches?.push(...treeEntry.patches);
      });
    });

    const applyPromises = Object.entries(treePatches).map(([treeId, patches]) => {
      if (patches && patches.length > 0) {
        const tree = self.trees[treeId];
        return tree?.applyPatchesFromManager(FAKE_HISTORY_ENTRY_ID, FAKE_EXCHANGE_ID, patches);
      } 
    });
    yield Promise.all(applyPromises);

    // finish the patch application
    // Need to tell all of the tiles to re-enable the sync and run the sync
    // to resync their tile models with any changes applied to the shared models
    // For this final step, we still use promises so we can wait for everything to complete. 
    // This can be used in the future to make sure multiple applyPatchesToTrees are not 
    // running at the same time.
    const finishPromises = trees.map(tree => {
      return tree.finishApplyingPatchesFromManager(FAKE_HISTORY_ENTRY_ID, FAKE_EXCHANGE_ID);
    });
    yield Promise.all(finishPromises);

    // TODO: if the tree/tile is written wrong, there might be some changes 
    // that come in with a fake entry after finishApplyingPatchesFromManager.
    // This is because the changes might trigger updateTreeAfterSharedModelChanges 
    // and that will happen async. With some work we should be able to identify this
    // and print a warning to the console.
    // One way might be using unique history_entry_ids that we mark as closed 
    // after the finish call.
  })
}));
