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
export interface CDocumentType extends Instance<typeof CDocument> {}


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
    .actions((self) => ({
        // This is only currently used for tests
        setChangeDocument(cDoc: CDocumentType) {
            self.document = cDoc;
        },

        startExchange(historyEntryId: string, exchangeId: string) {
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
            entry.activeExchanges.set(exchangeId, 1);
        }
    }))
    .actions((self) => {

        const endExchange = (entry: Instance<typeof HistoryEntry>, exchangeId: string) => {
            const openCallValue = entry.activeExchanges.get(exchangeId);
            if (!openCallValue) {
                throw new Error(`The open call, doesn't exist for ${ json({historyEntryId: entry.id, exchangeId}) }`);
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
        };

        const createHistoryEntry = (historyEntryId: string, exchangeId: string, name: string, 
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

            entry.activeExchanges.set(exchangeId, 1);

            return entry;
        };

        const addPatchesToHistoryEntry = (historyEntryId: string, exchangeId: string, 
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
                throw new Error(`The entry was already marked complete ${ json({historyEntryId, exchangeId})}`);
            }

            // The tree patch record will be sent even if there all no patches.
            // This is how the tree tells the container that this exchangeId is closed.
            if (treePatchRecord.patches.length > 0) {
                entry.records.push(treePatchRecord);
            }

            endExchange(entry, exchangeId);

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
        // TODO: the treeMap and getTreeFromId duplicate functionality,
        // the treeMap is needed so we can get a list of all of the trees. getTreeFromId
        // is 
        const replayHistoryToTrees = flow(function* replayHistoryToTrees(treeMap: Record<string, TreeAPI>) {
            const getTreeFromId = (getEnv(self) as Environment).getTreeFromId;
            const trees = Object.values(treeMap);

            const historyEntryId = nanoid();

            const topLevelExchangeId = nanoid();

            // Start a non-undoable action with this id. Currently the trees do
            // not have their treeMonitors setup when replayHistoryToTrees is
            // called, so the container should not receive any patches with this
            // historyEntryId. However, it seems good to go ahead and record
            // this anyway.
            const historyEntry = 
              createHistoryEntry(historyEntryId, topLevelExchangeId, "replayHistoryToTrees", "container", false);

            // Disable shared model syncing on all of the trees. This is
            // different than when the undo store applies patches because in
            // this case we are going to apply lots of history entries all at
            // once. 
            const startPromises = trees.map(tree => {
                const startExchangeId = nanoid();
                self.startExchange(historyEntryId, startExchangeId);

                return tree.startApplyingContainerPatches(historyEntryId, startExchangeId);
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

            // console.log(treePatches);

            const applyPromises = Object.entries(treePatches).map(([treeId, patches]) => {
                if (patches && patches.length > 0) {
                    const applyExchangeId = nanoid();
                    self.startExchange(historyEntryId, applyExchangeId);
                    const tree = getTreeFromId(treeId);
                    return tree?.applyContainerPatches(historyEntryId, applyExchangeId, patches);
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
                const finishExchangeId = nanoid();
                self.startExchange(historyEntryId, finishExchangeId);

                return tree.finishApplyingContainerPatches(historyEntryId, finishExchangeId);
            });
            yield Promise.all(finishPromises);

            // TODO: we are closing this top level exchange after the finish
            // applying container patches is called. This way if some of those
            // finish calls result in additional changes to the tree those
            // changes should delay the completion of this history event. It
            // isn't clear if that is really necessary in this case.

            // FIXME: We don't actually want to record this as a history entry.
            // This `replayHistoryToTrees` will not actually be called by the
            // current system. A variation of it will be needed when a user moves 
            // a scrubber to scroll around in the history of the document. 
            // So `replayHistoryToTrees` is kept as a model for that new function.
            // In the current implementation a history entry is added when `replayHistoryToTrees`
            // but from what I saw before it never leaves the "recording" state.
            endExchange(historyEntry, topLevelExchangeId);
        });

        return {
            replayHistoryToTrees,
            createHistoryEntry,
            addPatchesToHistoryEntry,
            endExchange
        };
      
    });

