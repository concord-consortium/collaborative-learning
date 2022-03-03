import {
    types, Instance, flow, getEnv, IJsonPatch, isAlive
} from "mobx-state-tree";
import { TreeAPI } from "./tree-api";
import { UndoStore } from "./undo-store";
import { TreePatchRecord, HistoryEntry } from "./history";
import { nanoid } from "nanoid";

interface Environment {
    getTreeFromId: (treeId: string) => TreeAPI | undefined;
}

/**
 * Helper method to print objects in template strings
 * In console statements they can be "printed", just by adding them as extra
 * parameters.  But in error messages it is useful to do the same thing.
 * 
 * @param value any object
 * @returns 
 */
const json = (value: any) => JSON.stringify(value);

export const CDocument = types
    .model("CDocument", {
        // TODO: switch to a map, so we get faster lookups in the map and MST can
        // do better at applying snapshots and patches by reusing existing
        // objects. 
        history: types.array(HistoryEntry)
    });

// TODO: since we are sharing the types with the undo store we should give them
// more generic names.

// TODO: it would be more efficient if the undo stack and this one were in the
// same tree, and then the undo stack could just contain references to the
// UndoEntries in this model. 
export const DocumentStore = types
    .model("DocumentStore", {
        document: CDocument,
        undoStore: UndoStore,
    })
    .views((self) => ({
        findHistoryEntry(historyEntryId: string) {
            return self.document.history.find(entry => entry.id === historyEntryId);
        },
    }))
    .views((self) => ({
        startHistoryEntryCall(historyEntryId: string, callId: string) {
            // Find if there is already an entry with this historyEntryId
            const entry = self.findHistoryEntry(historyEntryId);
            if (!entry) {
                throw new Error(`History Entry doesn't exist ${ json({historyEntryId})} `);
            }

            // Make sure this entry wasn't marked complete before
            if (entry.state === "complete") {
                throw new Error(`The entry was already marked complete ${ json({historyEntryId, callId})}`);
            }            
            
            // start a new open call with this callId
            // Check if there is a open call already with this id:
            const openCallValue = entry.openCalls.get(callId);
            if (openCallValue) {
                throw new Error("trying to create or update a history entry that has an existing open call");
            }
            entry.openCalls.set(callId, 1);
        }
    }))
    .actions((self) => {

        const closeHistoryEntryCall = (entry: Instance<typeof HistoryEntry>, callId: string) => {
            const openCallValue = entry.openCalls.get(callId);
            if (!openCallValue) {
                throw new Error(`The open call, doesn't exist for ${ json({historyEntryId: entry.id, callId}) }`);
            }

            entry.openCalls.delete(callId);    
            
            // TODO: We could use autorun for watching this observable map instead of
            // changing the entry state here. 
            if (entry.openCalls.size === 0) {
                entry.state = "complete";

                // If the history entry resulted in no changes delete it.
                // TODO: we might not want to do this, it could be useful for
                // researchers to see actions the student took even if they
                // didn't change state. For example if a button was clicked even
                // if it didn't change the state we might want to show that to
                // the researcher some how. There are lots of entries that are
                // empty though so they are removed for the time being.
                // TODO: we probably should store the entry in volatile until it
                // is complete and then add it to the document.history when it
                // is complete. This way it won't be incomplete in the history.
                if (entry.records.length === 0) {
                    self.document.history.remove(entry);
                }
            }
        };

        // FIXME: I was thinking of just using the historyEntryId as a call id,
        // to tie together different calls during a user action or in response
        // to a applySharedModelSnapshotFromContainer call.
        // But earlier we needed this method to also handle updating, so the
        // separate 
        // callId was added.  It is probably no longer needed and the
        // historyEntryId could be renamed to be something that is a mix of
        // both. This would make debugging a bit harder though because there
        // would no longer be a consistent id passed around to all of these calls.
        //
        const createHistoryEntry = (historyEntryId: string, callId: string, name: string, 
            treeId: string, undoable: boolean) => {
            let entry = self.findHistoryEntry(historyEntryId);
            if (entry) {
                throw new Error(`The entry already exists ${ json({historyEntryId})}`);
            } 
            entry = HistoryEntry.create({id: historyEntryId});
            self.document.history.push(entry);

            // update the entry: previously this code supported updating
            // existing entries
            entry.action = name;
            entry.tree = treeId;
            entry.undoable = undoable;

            entry.openCalls.set(callId, 1);

            return entry;
        };

        const startHistoryEntryCall = (historyEntryId: string, callId: string) => {
            // Find if there is already an entry with this historyEntryId
            const entry = self.findHistoryEntry(historyEntryId);
            if (!entry) {
                throw new Error(`History Entry doesn't exist ${ json({historyEntryId})} `);
            }

            // Make sure this entry wasn't marked complete before
            if (entry.state === "complete") {
                throw new Error(`The entry was already marked complete ${ json({historyEntryId, callId})}`);
            }            
            
            // start a new open call with this callId
            // Check if there is a open call already with this id:
            const openCallValue = entry.openCalls.get(callId);
            if (openCallValue) {
                throw new Error("trying to create or update a history entry that has an existing open call");
            }
            entry.openCalls.set(callId, 1);
        };

        const addPatchesToHistoryEntry = (historyEntryId: string, callId: string, 
            treePatchRecord: Instance<typeof TreePatchRecord>) => {
            // Find if there is already an entry with this historyEntryId
            let entry = self.findHistoryEntry(historyEntryId);
            if (!entry) {
                // FIXME: now that is synchronous, there shouldn't be the case
                // where the entry doesn't exist yet.
                //
                // This is a new user action, normally
                // createOrUpdateHistoryEntry would have been called first
                // but it is better to handle the out of order case here so
                // we don't have to deal with synchronizing the two calls.
                entry = HistoryEntry.create({id: historyEntryId});
                self.document.history.push(entry);
            }

            // Make sure this entry wasn't marked complete before
            if (entry.state === "complete") {
                throw new Error(`The entry was already marked complete ${ json({historyEntryId, callId})}`);
            }

            // The tree patch record will be sent even if there all no patches.
            // This is how the tree tells the container that this callId is closed.
            if (treePatchRecord.patches.length > 0) {
                entry.records.push(treePatchRecord);
            }

            closeHistoryEntryCall(entry, callId);

            // Add the entry to the undo stack if it is undoable. The entry is
            // shared with the document store, so when new records are added
            // they are added to the undo stack too.
            //
            // TODO: should we wait to add it until the full entry is complete?
            // It might be better to add it earlier so it has the right position
            // in the undo stack. For example if a user action caused some async
            // behavior that takes a while, should its place in the stack be at
            // the beginning or end of these changes?
            //
            // TODO: should we add it even if there are no patches?
            if (isAlive(entry) && entry.undoable && treePatchRecord.patches.length > 0) {
                self.undoStore.addHistoryEntry(entry);
            }
        };

        // This is asynchronous. We might as well use a flow so we don't have to 
        // create separate actions for each of the parts of this single action
        const replayHistoryToTrees = flow(function* replayHistoryToTrees(treeMap: Record<string, TreeAPI> ) {
            const getTreeFromId = (getEnv(self) as Environment).getTreeFromId;
            const trees = Object.values(treeMap);

            const historyEntryId = nanoid();

            const topLevelCallId = nanoid();

            // Start a non-undoable action with this id. Currently the trees do
            // not have their treeMonitors setup when replayHistoryToTrees is
            // called, so the container should not receive any patches with this
            // historyEntryId. However, it seems good to go ahead and record
            // this anyway.
            const historyEntry = 
              createHistoryEntry(historyEntryId, topLevelCallId, "replayHistoryToTrees", "container", false);

            // Disable shared model syncing on all of the trees. This is
            // different than when the undo store applies patches because in
            // this case we are going to apply lots of history entries all at
            // once. 
            const startPromises = trees.map(tree => {
                const startCallId = nanoid();
                self.startHistoryEntryCall(historyEntryId, startCallId);

                return tree.startApplyingContainerPatches(historyEntryId, startCallId);
            });
            yield Promise.all(startPromises);

            // apply the patches to all trees

            // iterate initialDocument.history This code groups all of the
            // patches for a particular tree into one array. This is done
            // instead of sending just the patches for each history entry one at
            // a time. This approach is taken, because sending the patch records
            // one at a time and waiting for confirmation that they have been
            // applied is limited by the latency of the connection to the tree.
            //
            // This single array of changes might be a problem for large
            // documents so we might have to split the array into pages, and
            // send information about the order of the pages so the tree
            // receiving them can make sure it is getting them in the right
            // order.
            //
            const treePatches: Record<string, IJsonPatch[] | undefined> = {};
            Object.keys(treeMap).forEach(treeId => treePatches[treeId] = []);

            self.document.history.forEach(entry => {
                entry.records.forEach(treeEntry => {
                    const patches = treePatches[treeEntry.tree];
                    patches?.push(...treeEntry.patches);
                });
            });

            console.log(treePatches);

            const applyPromises = Object.entries(treePatches).map(([treeId, patches]) => {
                if (patches && patches.length > 0) {
                    const callId = nanoid();
                    self.startHistoryEntryCall(historyEntryId, callId);
                    const tree = getTreeFromId(treeId);
                    return tree?.applyContainerPatches(historyEntryId, callId, patches);
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
                const finishCallId = nanoid();
                self.startHistoryEntryCall(historyEntryId, finishCallId);

                return tree.finishApplyingContainerPatches(historyEntryId, finishCallId);
            });
            // I'm using a yield because it isn't clear from the docs if an flow MST action
            // can return a promise or not.
            yield Promise.all(finishPromises);

            // TODO: we are closing this top level call after the finish
            // applying container patches is called. This way if some of those
            // finish calls result in additional changes to the tree those
            // changes should delay the completion of this history event. It
            // isn't clear if that is really necessary in this case.

            // FIXME: the history entry being generated here doesn't ever change
            // its state from "recording", but the TreeMonitor middleware hasn't
            // been installed before this function is called. So the container
            // doesn't get any updates on the callIds. 
            closeHistoryEntryCall(historyEntry, topLevelCallId);

        });



        return {
            replayHistoryToTrees,
            createHistoryEntry,
            addPatchesToHistoryEntry,
            startHistoryEntryCall,
            closeHistoryEntryCall
        };
      
    });

