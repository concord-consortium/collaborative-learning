import {
  types, Instance, flow, IJsonPatch, detach, destroy, toGenerator
} from "mobx-state-tree";
import { nanoid } from "nanoid";
import { TreeAPI } from "./tree-api";
import { IUndoManager, UndoStore } from "./undo-store";
import { TreePatchRecord, HistoryEntry, TreePatchRecordSnapshot,
  HistoryOperation,
  ICreateHistoryEntry} from "./history";
import { DEBUG_HISTORY } from "../../lib/debug";
import { PatchApplicationError } from "./tree";
import { IDocumentMetadata } from "../../../shared/shared";
import { Firestore } from "../../lib/firestore";
import { UserContextProvider } from "../stores/user-context-provider";
import { getLastHistoryEntry } from "./history-firestore";

export interface HistoryPlaybackFailure {
  historyEntry: Instance<typeof HistoryEntry>;
  historyIndex: number;
  direction: "undo" | "redo";
  errorMessage: string;
}

/**
 * Tracks how patches in a batched array map back to their history entries.
 * Each segment records a history entry index and the number of patches
 * from that entry that were added to the batch.
 */
interface PatchSegment {
  historyIndex: number;
  patchCount: number;
}

/**
 * Build the list of patches for a single history entry that a tree
 * would receive in a given direction, in the same order and record
 * ordering that goToHistoryEntry uses when batching. Used to
 * reconstruct patches without needing the onPatch-collected inverses.
 */
function getEntryPatchesForTree(
  historyEntry: Instance<typeof HistoryEntry>,
  treeId: string,
  opType: HistoryOperation
): IJsonPatch[] {
  let records = [...historyEntry.records];
  if (opType === HistoryOperation.Undo) {
    records = records.reverse();
  }
  const result: IJsonPatch[] = [];
  for (const entryRecord of records) {
    if (entryRecord.tree === treeId) {
      result.push(...entryRecord.getPatches(opType));
    }
  }
  return result;
}

/**
 * Given the number of patches that were successfully applied and the
 * segment mapping, returns the history entry index that contains the
 * patch that failed, and the number of patches from that entry that
 * were successfully applied before the failure.
 */
function findFailedSegment(numApplied: number, segments: PatchSegment[]) {
  let remaining = numApplied;
  for (const segment of segments) {
    if (remaining < segment.patchCount) {
      return { historyIndex: segment.historyIndex, appliedInEntry: remaining };
    }
    remaining -= segment.patchCount;
  }
  // This shouldn't happen — numApplied should be less than total patches
  // if we're in an error path. Return the last segment as a fallback.
  const last = segments[segments.length - 1];
  return { historyIndex: last.historyIndex, appliedInEntry: last.patchCount };
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

export const FAKE_HISTORY_ENTRY_ID = "FAKE_HISTORY_ENTRY_ID";
export const FAKE_EXCHANGE_ID = "FAKE_EXCHANGE_ID";

export const CDocument = types
.model("CDocument", {
  // TODO: switch to a map, so we get faster lookups in the map and MST can
  // do better at applying snapshots and patches by reusing existing
  // objects.
  history: types.array(HistoryEntry)
});
export interface CDocumentType extends Instance<typeof CDocument> {}

interface IMainDocument extends TreeAPI {
  key: string;
  uid: string;
  metadata: IDocumentMetadata;
}

/**
 * Minimal interface for history managers that need to be notified when
 * history entries are completed. This keeps TreeManager free of
 * Firestore-specific imports while allowing it to coordinate with
 * history managers.
 */
export interface IHistoryManager {
  onHistoryEntryCompleted(
    historyContainer: CDocumentType,
    entry: Instance<typeof HistoryEntry>,
    newLocalIndex: number
  ): void;
}

export const TreeManager = types
.model("TreeManager", {
  document: CDocument,
  undoStore: UndoStore,
  // This is not volatile, so the TreeManager actions can modify it directly.
  // If it was volatile, it would be its own MST tree, and the actions in this
  // TreeManager model can not modify other MST trees.
  // When the history is serialized, we'll only serialize the CDocument, so it
  // shouldn't matter that these uncompleted history entries are part of the
  // state of the TreeManager.
  activeHistoryEntries: types.array(HistoryEntry)
})
.volatile(self => ({
  trees: {} as Record<string, TreeAPI>,
  // The number of history entries that have been applied to the document.
  // When replaying history this number can be less than the total number
  // history entries (self.document.history.length)
  numHistoryEventsApplied: 0 as number | undefined,
  mainDocument: undefined as IMainDocument | undefined,
  userContextProvider: undefined as UserContextProvider | undefined,
  /**
   * The most recent historyEntryId of the document. If the document is restored
   * from a system that stores the revisionId, the revisionId can be restored.
   * However in that case, there might not be a corresponding history entry.
   */
  revisionId: "",
  /**
   * History manager to be notified when new history entries are completed.
   * Consumers can check for specific types (e.g., FirestoreHistoryManagerConcurrent).
   */
  historyManager: undefined as IHistoryManager | undefined,
  /**
   * History entries whose patches could not be applied. A patch may fail
   * in one direction but not the other, so entries include the direction.
   */
  historyPlaybackFailures: [] as HistoryPlaybackFailure[]
}))
.views((self) => ({
  get undoManager() : IUndoManager {
    return self.undoStore;
  },

  findHistoryEntry(historyEntryId: string) {
    return self.document.history.find(entry => entry.id === historyEntryId);
  },

  findHistoryEntryIndex(historyEntryId: string) {
    return self.document.history.findIndex(entry => entry.id === historyEntryId);
  },

  get latestDocumentHistoryEntry() {
    const history = self.document.history;
    return history ? history[history.length - 1] : undefined;
  },

  findActiveHistoryEntry(historyEntryId: string) {
    return self.activeHistoryEntries.find(entry => entry.id === historyEntryId);
  },
}))
.actions(self => {
  return {
    completeHistoryEntry(entry: Instance<typeof HistoryEntry>) {
      entry.state = "complete";

      // Remove the entry from the activeHistoryEntries
      detach(entry);

      // If the history entry resulted in no changes don't add it to the real
      // history.
      //
      // TODO: we might not want to do this, it could be useful for researchers
      // and teachers to see actions the student took even if they didn't change
      // state. For example if a button was clicked even if it didn't change the
      // state we might want to show that somehow. There are lots of entries
      // that are empty though, so they are removed for the time being.
      if (entry.records.length === 0) {
        destroy(entry);
        return;
      }

      // Save the index in the local history. This is used to figure out
      // the index written into the firestore entry document
      const newLocalIndex = self.document.history.length;

      // Re-attach the entry to the actual history
      self.document.history.push(entry);

      // Add the entry to the undo stack if it is undoable.
      //
      // TODO: Is it best to wait until the entry is complete like this? It
      // might be better to add it earlier so it has the right position in the
      // undo stack. For example if a user action caused some async behavior
      // that takes a while, should its place in the stack be at the beginning
      // or end of these changes? As a downside, if we add it earlier the undo
      // stack will have incomplete entries in sometimes.
      if (entry.undoable) {
        self.undoStore.addHistoryEntry(entry);

        // Store the most recent undo-able history id.
        self.revisionId = entry.id;
      }

      self.historyManager?.onHistoryEntryCompleted(self.document, entry, newLocalIndex);
    }
  };
})
.actions((self) => ({
  /**
   * This is used when applying a remote history entry that was loaded
   */
  addHistoryEntryAfterApplying(entry: Instance<typeof HistoryEntry>) {
    self.document.history.push(entry);
  },

  setChangeDocument(cDoc: CDocumentType) {
    self.document = cDoc;
  },

  setRevisionId(revisionId: string) {
    self.revisionId = revisionId;
  },

  setHistoryManager(manager: IHistoryManager) {
    self.historyManager = manager;
  },

  setNumHistoryEntriesApplied(value: number) {
    self.numHistoryEventsApplied = value;
  },

  /**
   * Inject a synthetic history entry with a patch that will always fail
   * when replayed (references a non-existent tile). Useful for testing
   * playback failure handling.
   */
  injectFailingHistoryEntry() {
    if (!self.mainDocument) {
      console.warn("Cannot inject failing entry: no main document");
      return;
    }
    const entryId = nanoid();
    const treeId = self.mainDocument.key;
    const entry = HistoryEntry.create({
      id: entryId,
      tree: treeId,
      model: "TestFailure",
      action: "/injectFailingHistoryEntry",
      undoable: true,
      state: "complete",
      records: [{
        tree: treeId,
        action: "/injectFailingHistoryEntry",
        patches: [{
          op: "replace",
          path: "/content/tileMap/NONEXISTENT_TILE/content/value",
          value: "this patch will fail"
        }],
        inversePatches: [{
          op: "replace",
          path: "/content/tileMap/NONEXISTENT_TILE/content/value",
          value: "original"
        }]
      }]
    });
    const newLocalIndex = self.document.history.length;
    self.document.history.push(entry);
    self.numHistoryEventsApplied = self.document.history.length;
    self.revisionId = entryId;
    self.undoStore.addHistoryEntry(entry);
    self.historyManager?.onHistoryEntryCompleted(self.document, entry, newLocalIndex);
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
    const entry = self.findActiveHistoryEntry(historyEntryId);
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
      self.completeHistoryEntry(entry);
    }
  },

  createHistoryEntry(entryInfo: ICreateHistoryEntry) {
    const {id: historyEntryId, exchangeId, action} = entryInfo;
    if (self.findHistoryEntry(historyEntryId) || self.findActiveHistoryEntry(historyEntryId)) {
      throw new Error(`The entry already exists ${ json({historyEntryId})}`);
    }
    const entry = HistoryEntry.create({
      ...entryInfo,
    });
    self.activeHistoryEntries.push(entry);

    entry.activeExchanges.set(exchangeId, `TreeManager.createHistoryEntry ${action}`);

    return entry;
  },

  setNumHistoryEntriesAppliedFromFirestore: flow(
    function *setNumHistoryEntriesAppliedFromFirestore(firestore: Firestore, docPath: string) {
      // clear the numHistoryEventsApplied so it is obvious when it is filled in
      self.numHistoryEventsApplied = undefined;

      const lastHistoryEntry = yield* toGenerator(getLastHistoryEntry(firestore, docPath));
      if (lastHistoryEntry) {
        self.numHistoryEventsApplied = lastHistoryEntry.index + 1;
      } else {
        // If there is no entry then we have an empty document
        self.numHistoryEventsApplied = 0;
      }
    }
  ),

}))
.actions((self) => ({
  setMainDocument(document: IMainDocument) {
    self.mainDocument = document;
    self.putTree(document.key, document);
  },

  updateSharedModel(historyEntryId: string, exchangeId: string, sourceTreeId: string, snapshot: any): Promise<void> {
    // Right now this can be called in 2 cases:
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
    return Promise.all(applyPromises).then();
  },

  addHistoryEntry(entryInfo: ICreateHistoryEntry) {
    self.createHistoryEntry(entryInfo);
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
    const entry = self.findActiveHistoryEntry(historyEntryId);
    if (!entry) {
      throw new Error(`There isn't an active entry for ${ json({historyEntryId, exchangeId})}`);
    }

    // Make sure this entry wasn't marked complete before
    if (entry.state === "complete") {
      throw new Error(`The entry was already marked complete ${ json({historyEntryId, exchangeId})}`);
    }

    // The tree patch record will be sent even if there are no patches.
    // This is how the tree tells the manager that this exchangeId is closed.
    if (treePatchRecord.patches.length > 0) {
      entry.records.push(treePatchRecord);
    }

    if (DEBUG_HISTORY) {
      // eslint-disable-next-line no-console
      console.log("addTreePatchRecord",
        { action: record.action, historyEntryId, exchangeId,
          exchangeName: entry.activeExchanges.get(exchangeId)});
    }

    self.endExchange(entry, exchangeId);
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
    // particular tree into one array. This batching is done
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
  }),

  goToHistoryEntry: flow(function* goToHistoryEntry(
                                      newHistoryPosition: number) {
    const trees = Object.values(self.trees);

    if (newHistoryPosition === self.numHistoryEventsApplied) return;
    if (self.numHistoryEventsApplied === undefined) return;
    // Disable shared model syncing on all of the trees. This is
    // different than when the undo store applies patches because in
    // this case we are going to apply lots of history entries all at
    // once. We use FAKE ids here so any responses from tree are
    // not recorded in the history.
    const startPromises = trees.map(tree => {
      return tree.startApplyingPatchesFromManager(FAKE_HISTORY_ENTRY_ID, FAKE_EXCHANGE_ID);
    });
    yield Promise.all(startPromises);

    const treePatches: Record<string, IJsonPatch[] | undefined> = {};
    // Track which history entry each patch came from, per tree.
    const treePatchSegments: Record<string, PatchSegment[]> = {};
    Object.keys(self.trees).forEach(treeId => {
      treePatches[treeId] = [];
      treePatchSegments[treeId] = [];
    });

    // direction tells us which direction to go
    // startingIndex and endingIndex are so we don't add the currentHistoryEvent into patches
    // because we are going to assume that it has already been played, and we don't want to play it
    // again if we are going forward.
    const direction = newHistoryPosition > self.numHistoryEventsApplied ? 1 : -1;
    const opType = direction === 1 ? HistoryOperation.Redo : HistoryOperation.Undo;
    const startingIndex = direction === 1 ? self.numHistoryEventsApplied : self.numHistoryEventsApplied - 1;
    const endingIndex = direction === 1 ? newHistoryPosition : newHistoryPosition - 1;
    // A history entry may contain multiple records for the same tree
    // (e.g. tile update + shared-model update). getEntryPatchesForTree
    // aggregates them into one ordered list per tree so we can push a
    // single segment per tree per history entry — that way rollback on
    // failure covers all records in the entry, not just one.
    // Using the same helper for both the initial batching and the
    // rollback ensures the two paths produce matching orderings.
    for (let i=startingIndex; i !== endingIndex; i=i+direction) {
      const historyEntry = self.document.history.at(i);
      if (!historyEntry) continue;
      for (const treeId of Object.keys(self.trees)) {
        const entryPatches = getEntryPatchesForTree(historyEntry, treeId, opType);
        if (entryPatches.length > 0) {
          treePatches[treeId]!.push(...entryPatches);
          treePatchSegments[treeId].push({ historyIndex: i, patchCount: entryPatches.length });
        }
      }
    }

    // Apply the batched patches to each tree in parallel. If any tree
    // fails, we pick an "earliest" failing history index across all
    // trees and roll every tree back so their state is consistent with
    // that stop position:
    //   - Forward (Redo): stopPosition = min(failedIndices)
    //   - Backward (Undo): stopPosition = max(failedIndices) + 1
    // Trees that succeeded past the stop position have those entries
    // rolled back; trees that failed have their own partial rollback
    // plus any entries they applied past the stop position.
    interface TreeApplyFailure {
      error: PatchApplicationError;
      historyIndex: number;
      appliedInEntry: number;
      failingSegIdx: number;
    }
    interface TreeApplyResult {
      treeId: string;
      tree: TreeAPI;
      segments: PatchSegment[];
      failure?: TreeApplyFailure;
    }
    const results: TreeApplyResult[] = [];

    const applyPromises = Object.entries(treePatches).map(async ([treeId, patches]) => {
      if (!patches || patches.length === 0) return;
      const tree = self.trees[treeId];
      if (!tree) return;
      const segments = treePatchSegments[treeId];
      try {
        await tree.applyPatchesFromManager(FAKE_HISTORY_ENTRY_ID, FAKE_EXCHANGE_ID, patches);
        results.push({ treeId, tree, segments });
      } catch (e) {
        if (e instanceof PatchApplicationError) {
          const { historyIndex, appliedInEntry } = findFailedSegment(e.numApplied, segments);
          // Each segment has a unique historyIndex because
          // getEntryPatchesForTree aggregates per-entry.
          const failingSegIdx = segments.findIndex(s => s.historyIndex === historyIndex);
          results.push({
            treeId, tree, segments,
            failure: { error: e, historyIndex, appliedInEntry, failingSegIdx }
          });
        } else {
          throw e;
        }
      }
    });
    yield Promise.all(applyPromises);

    const failedResults = results.filter(r => r.failure);
    let stopPosition: number | undefined;
    if (failedResults.length > 0) {
      const failedIndices = failedResults.map(r => r.failure!.historyIndex);
      const earliestFailedIndex = direction === 1
        ? Math.min(...failedIndices)
        : Math.max(...failedIndices);
      stopPosition = direction === 1
        ? earliestFailedIndex
        : earliestFailedIndex + 1;

      // For forward, entries with historyIndex >= stopPosition must
      // not be "applied" at the stop position. For backward, entries
      // with historyIndex < stopPosition must be "applied".
      const needsRollback = (historyIndex: number): boolean => {
        return direction === 1
          ? historyIndex >= stopPosition!
          : historyIndex < stopPosition!;
      };

      const oppositeOp = opType === HistoryOperation.Redo
        ? HistoryOperation.Undo
        : HistoryOperation.Redo;

      // Build and apply per-tree rollback batches.
      //
      // Rollback ordering: patches need to be applied in reverse of the
      // order they were applied in the forward batch. The failing
      // entry's partial was applied last, so it rolls back first; then
      // fully-applied segments roll back in reverse segment order.
      //
      // Partial slice derivation: in the opposite direction, an
      // entry's batched patches list is the reverse of the forward
      // direction's list. The first `appliedInEntry` patches of the
      // forward list correspond to the last `appliedInEntry` patches
      // of the opposite list — so .slice(length - appliedInEntry)
      // gives us the patches we need (already in the correct order
      // to undo the partial application).
      const rollbackPromises = results.map(async (r) => {
        const rollbackPatches: IJsonPatch[] = [];

        if (r.failure) {
          const { historyIndex, appliedInEntry } = r.failure;
          if (appliedInEntry > 0) {
            const failedEntry = self.document.history.at(historyIndex);
            if (failedEntry) {
              const oppositePatches = getEntryPatchesForTree(failedEntry, r.treeId, oppositeOp);
              rollbackPatches.push(
                ...oppositePatches.slice(oppositePatches.length - appliedInEntry)
              );
            }
          }
        }

        // Fully-applied segments (those before the failing segment, or
        // all segments if this tree didn't fail), in reverse application
        // order. Only those "past" the stop position need rollback.
        const failingSegIdx = r.failure ? r.failure.failingSegIdx : r.segments.length;
        for (let i = failingSegIdx - 1; i >= 0; i--) {
          const seg = r.segments[i];
          if (needsRollback(seg.historyIndex)) {
            const entry = self.document.history.at(seg.historyIndex);
            if (entry) {
              const oppositePatches = getEntryPatchesForTree(entry, r.treeId, oppositeOp);
              rollbackPatches.push(...oppositePatches);
            }
          }
        }

        if (rollbackPatches.length > 0) {
          try {
            await r.tree.applyPatchesFromManager(
              FAKE_HISTORY_ENTRY_ID, FAKE_EXCHANGE_ID, rollbackPatches);
          } catch (rollbackError) {
            // Rollback itself failed — trees are now out of sync and
            // we can't recover automatically. Log and continue.
            // TODO: consider surfacing this as a distinct catastrophic
            // failure signal for the UI.
            // eslint-disable-next-line no-console
            console.warn(
              `Rollback of tree '${r.treeId}' failed: ${(rollbackError as Error).message}. ` +
              `Trees may be in an inconsistent state.`
            );
          }
        }
      });
      yield Promise.all(rollbackPromises);

      // Record one failure per (historyIndex, direction) pair, deduped.
      const directionStr = direction === 1 ? "redo" : "undo";
      for (const r of failedResults) {
        const { historyIndex, error } = r.failure!;
        const historyEntry = self.document.history.at(historyIndex);
        if (!historyEntry) continue;
        const alreadyRecorded = self.historyPlaybackFailures.some(
          f => f.historyIndex === historyIndex && f.direction === directionStr
        );
        if (!alreadyRecorded) {
          self.historyPlaybackFailures.push({
            historyEntry,
            historyIndex,
            direction: directionStr,
            errorMessage: error.message
          });
        }
        // eslint-disable-next-line no-console
        console.warn(
          `History entry ${historyIndex} failed to ${directionStr}: ${error.message}`
        );
      }
    }

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
    if (stopPosition !== undefined) {
      self.numHistoryEventsApplied = stopPosition;
    } else {
      self.numHistoryEventsApplied = newHistoryPosition;
    }
  }),
}))
.views(self => ({
  getHistoryEntry: (historyIndex: number) => {
    return self.document.history.at(historyIndex);
  }
}))
.views(self => ({
  get currentHistoryEntry() {
    const index = self.numHistoryEventsApplied ?? 0;
    return index > 0 ? self.getHistoryEntry(index - 1) : undefined;
  }
}));

export interface TreeManagerType extends Instance<typeof TreeManager> {}
