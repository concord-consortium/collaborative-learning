import {
    types, Instance, getSnapshot, getEnv, flow, getParent
} from "mobx-state-tree";
import { DocumentStore } from "./document-store";

import { TreeAPI } from "./tree-api";
import { HistoryEntry, HistoryOperation } from "./history";
import { nanoid } from "nanoid";

interface Environment {
    getTreeFromId: (treeId: string) => TreeAPI;
}

export const UndoStore = types
    .model("UndoStore", {
        history: types.array(types.reference(HistoryEntry)),
        undoIdx: 0
    })
    .views((self) => ({
        get undoLevels() {
            return self.undoIdx;
        },
        get redoLevels() {
            return self.history.length - self.undoIdx;
        },
        get canUndo() {
            return this.undoLevels > 0;
        },
        get canRedo() {
            return this.redoLevels > 0;
        },
        findHistoryEntry(historyEntryId: string) {
            return self.history.find(entry => entry.id === historyEntryId);
        }
    }))
    .actions((self) => {
        // This is asynchronous. We might as well use a flow so we don't have to 
        // create separate actions for each of the parts of this single action
        const applyPatchesToTrees = 
          flow(function* applyPatchesToTrees(entryToUndo: Instance<typeof HistoryEntry>, opType: HistoryOperation ) {
            const getTreeFromId = (getEnv(self) as Environment).getTreeFromId;
            const treeEntries = entryToUndo.records;

            const historyEntryId = nanoid();
            const callId = nanoid();

            // Start a non-undoable action with this id
            const docStore = getParent(self) as Instance<typeof DocumentStore>;
            const historyEntry = 
              docStore.createHistoryEntry(historyEntryId, callId, opType, "container", false);

            // first disable shared model syncing in the tree
            const startPromises = treeEntries.map(treeEntry => {
                const startCallId = nanoid();
                docStore.startHistoryEntryCall(historyEntryId, startCallId);

                return getTreeFromId(treeEntry.tree).startApplyingContainerPatches(historyEntryId, startCallId);
            });
            yield Promise.all(startPromises);

            // apply the patches to all trees
            const applyPromises = treeEntries.map(treeEntry => {
                // console.log(`send tile entry to ${opType} to the tree`, getSnapshot(treeEntry));

                // When a patch is applied to shared model, it will send its updated
                // state to all tiles. If this is working properly the promise returned by
                // the shared model's applyContainerPatches will not resolve until all tiles
                // using it have updated their view of the shared model.

                // We need a new callId for each apply call here, so each
                // tree can finish the call when it calls addTreeRecordPatches.
                // This new callId is added to the history entries volatile
                // storage using startHistoryEntryCall. So now the history entry
                // knows it needs to wait for this call to complete before
                // marking the full entry as complete.
                const applyCallId = nanoid();
                docStore.startHistoryEntryCall(historyEntryId, applyCallId);

                const tree = getTreeFromId(treeEntry.tree);
                return tree.applyContainerPatches(historyEntryId,  applyCallId, treeEntry.getPatches(opType));
            });
            yield Promise.all(applyPromises);

            // finish the patch application
            // Need to tell all of the tiles to re-enable the sync and run the sync
            // to resync their tile models with any changes applied to the shared models
            // For this final step, we still use promises so we can wait for everything to complete. 
            // This can be used in the future to make sure multiple applyPatchesToTrees are not 
            // running at the same time.
            const finishPromises = treeEntries.map(treeEntry => {
                const finishCallId = nanoid();
                docStore.startHistoryEntryCall(historyEntryId, finishCallId);

                return getTreeFromId(treeEntry.tree).finishApplyingContainerPatches(historyEntryId, finishCallId);
            });
            yield Promise.all(finishPromises);

            // TODO I'm closing the top level call after the finish Promises is
            // called. This way the tree has a chance to add a new call to the
            // history entry which will keep it being marked complete until that
            // new call is also finished. It isn't clear if this is really
            // needed though.
            docStore.closeHistoryEntryCall(historyEntry, callId);
        });

        return {
            addHistoryEntry(entry: Instance<typeof HistoryEntry>) {
                // Find if there is already an HistoryEntry with this
                // historyEntryId. This action is called each time a new
                // TreePatchRecord is added to the HistoryEntry. If the
                // HistoryEntry has already been added then we don't modify it,
                // but we do always reset the undoIdx to the end of the history.
                
                const existingEntry = self.findHistoryEntry(entry.id);
                if (!existingEntry) {
                    // This is a new user action, so if they had undone some amount already
                    // we delete the part of the history that was past this undone point
                    self.history.splice(self.undoIdx);
                    self.history.push(entry);
                }
    
                // Reset the undoIdx to the end of the history, this is because it is a 
                // user action so if the user had been undoing things, once they
                // start doing new things they can no longer 'redo' what was
                // undone before.
                // 
                // The fact that the undoIdx is reset in all cases even
                // with an existing entry is confusing. This currently happens
                // because the system might add additional patches to a previous
                // entry, and might mean that a redo won't work as expected.
                self.undoIdx = self.history.length;
            },
    
            // TODO: The MST undo manager used atomic operations for this
            // that way if the was an error applying the patch then the whole set of 
            // changes would be aborted.
            // If we want this behavior we'd need to have each tile function that way
            // and notify the container when it succeeded or failed. And then 
            // if it failed the container would have to tell any tiles that successfully
            // applied the patches to revert them. 
            undo() {
                if (!self.canUndo) {
                    throw new Error("undo not possible, nothing to undo");
                }
    
                const entryToUndo = self.history[self.undoIdx -1];
                // TODO: If there is an applyPatchesToTrees currently running we
                // should wait for it.
                //
                // FIXME: we aren't actually calling this as an action and we
                // aren't waiting for it finish before returning
                applyPatchesToTrees(entryToUndo, HistoryOperation.Undo);

                self.undoIdx--;
            },
            redo() {
                if (!self.canRedo) {
                    throw new Error("redo not possible, nothing to redo");
                }
    
                const entryToRedo = self.history[self.undoIdx];
                // TODO: If there is an applyPatchesToTrees currently running we
                // should wait for it.
                //
                // FIXME: we aren't actually calling this as an action and we
                // aren't waiting for it finish before returning
                applyPatchesToTrees(entryToRedo, HistoryOperation.Redo);
    
                self.undoIdx++;
            },        
        };
});
