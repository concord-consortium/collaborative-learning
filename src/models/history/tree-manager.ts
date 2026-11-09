import {
  types, Instance, flow, IAnyStateTreeNode, IJsonPatch, destroy, getSnapshot, toGenerator, addDisposer
} from "mobx-state-tree";
import { nanoid } from "nanoid";
import { TreeAPI } from "./tree-api";
import { IUndoManager, UndoStore } from "./undo-store";
import { TreePatchRecord, HistoryEntry, TreePatchRecordSnapshot,
  HistoryOperation, HistoryEntryType,
  ICreateHistoryEntry, HistoryEntrySnapshot, getEntryPatchesForTree} from "./history";
import { DEBUG_HISTORY } from "../../lib/debug";
import { kContentPath, kTileMapPath } from "../document/document-paths";
import { PatchApplicationError } from "./tree";
import {
  collectModelPaths, createOldModelPatchSource, defaultPatchSource, getAllPatches, hasOldValue,
  IPlaybackPatchSource, ModelReplacementError
} from "./playback-patch-source";
import { IJsonCopyMoveResult, JsonHistoryCopy } from "./json-history-copy";
import { applyJsonPatches, toJsonValue } from "./json-patch";
import { IDocumentMetadata } from "../../../shared/shared";
import { Firestore } from "../../lib/firestore";
import { UserContextProvider } from "../stores/user-context-provider";
import { getLastHistoryEntry } from "./history-firestore";
import { SessionExactness } from "./session-exactness";
import { LogEventName } from "../../lib/logger-types";

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

export function entryChangesContent(entry: HistoryEntrySnapshot) {
  return !!entry.records?.some(record =>
    record.patches?.some(patch => patch.path === kContentPath || patch.path.startsWith(`${kContentPath}/`)));
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

// The entries a move from `from` to `to` crosses, in history order.
function getEntriesBetween(history: readonly HistoryEntryType[], from: number, to: number) {
  return from < to ? history.slice(from, to) : history.slice(to, from);
}

/**
 * Moves the JSON copy toward `target` and builds the patch source for the move. A model is
 * treated as old when it is old in the copy at either end of the move, when a patch in the move
 * carries an old version of it, or when a load entry in the move changes it. The patches catch an
 * old model that is absent at both ends. The load-entry check is a backstop: a model a load entry
 * converts is old at the end of the move before that entry, or was added in the move with an old
 * value. The copy can stop short of `target`; the source covers only the entries up to where it
 * stopped.
 */
function moveJsonCopy(copy: JsonHistoryCopy, history: readonly HistoryEntryType[], treeId: string,
    target: number): { moved: IJsonCopyMoveResult; source: IPlaybackPatchSource } {
  const start = copy.position;
  const requestedPaths = collectModelPaths(getEntriesBetween(history, start, target), treeId);
  const oldAtStart = new Set([...requestedPaths].filter(path => copy.needsConversion(path)));

  const moved = copy.moveTo(history, target);

  const entries = getEntriesBetween(history, start, moved.position);
  const patches = getAllPatches(entries, treeId);
  const loadEntryPaths = collectModelPaths(entries.filter(entry => entry.isLoadEntry), treeId);
  const oldPaths = new Set([...collectModelPaths(entries, treeId)].filter(path =>
    oldAtStart.has(path) || copy.needsConversion(path) ||
    hasOldValue(patches, path) || loadEntryPaths.has(path)));
  return { moved, source: createOldModelPatchSource({ copy, treeId, oldPaths }) };
}

/**
 * Returns the JSON a new playback JSON copy starts from, given the playback document's JSON at
 * history `position`.
 *
 * The playback document is a copy of the live document, which converted its old models when it
 * loaded. The load entry that records the conversion is uploaded with the next change to the
 * content, so until then only the live document has it, and it is handed to playback as
 * `localLoadEntry`. The history from Firestore doesn't hold it, and its entries expect those
 * models as they are stored, before conversion. So the load entry is undone here, which puts them
 * back in their stored form.
 *
 * Once the history holds the load entry before `position`, the document's JSON already matches
 * the history there, and it is returned unchanged. `documentJson` is changed in place.
 */
function getJsonCopyStart(documentJson: object, treeId: string, history: readonly HistoryEntryType[],
    position: number, localLoadEntry: HistoryEntrySnapshot | undefined) {
  if (!localLoadEntry) return documentJson;
  const index = history.findIndex(entry => entry.id === localLoadEntry.id);
  if (index >= 0 && index < position) return documentJson;
  try {
    applyJsonPatches(documentJson,
      getEntryPatchesForTree(HistoryEntry.create(localLoadEntry), treeId, HistoryOperation.Undo));
  } catch (e) {
    // The copy starts converted, so playback stops at the first old entry that doesn't apply to it.
    console.error("Could not undo the local load entry in the playback JSON copy:", e);
  }
  return documentJson;
}

/**
 * Applies entries a load is missing to the document's JSON as it was stored, before the load
 * converted its old models, and returns the content they reach. The entries were recorded against
 * the stored models, and a load entry among them converts those models itself, so neither fits
 * the converted MST content. Entries are applied one at a time, each all or nothing, and
 * application stops at the first one that fails.
 */
function applyEntriesToStoredJson(documentJson: any, treeId: string,
    pendingLoadEntry: HistoryEntrySnapshot | undefined, snapshots: HistoryEntrySnapshot[]) {
  let applied = 0;
  let error: string | undefined;
  try {
    if (pendingLoadEntry) {
      applyJsonPatches(documentJson,
        getEntryPatchesForTree(HistoryEntry.create(pendingLoadEntry), treeId, HistoryOperation.Undo));
    }
    for (const snapshot of snapshots) {
      const entry = HistoryEntry.create(snapshot);
      const otherTree = entry.records.find(record => record.tree !== treeId);
      if (otherTree) throw new Error(`Unknown tree '${otherTree.tree}'`);
      applyJsonPatches(documentJson, getEntryPatchesForTree(entry, treeId, HistoryOperation.Redo));
      applied++;
    }
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  return { content: documentJson.content, applied, error };
}

export const FAKE_HISTORY_ENTRY_ID = "FAKE_HISTORY_ENTRY_ID";
export const FAKE_EXCHANGE_ID = "FAKE_EXCHANGE_ID";

// An entry whose exchanges are still open after this long is force-completed.
export const kOpenEntryTimeoutMs = 30000;

export type TreeManagerLogger = (event: LogEventName, params: Record<string, unknown>) => void;

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
  // Replaces the content with stored content, converting its old models.
  setContent(content: any): void;
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
  historyPlaybackFailures: [] as HistoryPlaybackFailure[],
  /**
   * Whether the document's lastHistoryEntryId is exact for this session. Broken when an entry
   * is force-completed after its open-entry timeout.
   */
  exactness: new SessionExactness(),
  entryCompletedListeners: new Set<(entry: HistoryEntryType) => void>(),
  logger: undefined as TreeManagerLogger | undefined,
  // One timer per entry that still has open exchanges.
  openEntryTimers: new Map<string, ReturnType<typeof setTimeout>>(),
  // Entries that were force-completed, so records that arrive for them later can be recognized.
  timedOutEntries: new Map<string, { model?: string }>(),
  /**
   * Set when the JSON copy can't get back to the trees' position after a failed move. The copy
   * and the trees then disagree, so playback makes no more moves.
   */
  jsonCopyOutOfStep: false,
  /**
   * The load entry for the content as loaded or last set, kept out of the history until it
   * is flushed (see completeHistoryEntry).
   */
  pendingLoadEntry: undefined as HistoryEntrySnapshot | undefined,
  /**
   * A load entry that the live document has not uploaded yet, handed to a playback copy. It stays
   * out of the copy's history, which comes from Firestore. The JSON copy starts with it undone (see
   * getJsonCopyStart), so it holds the stored content that the history reaches.
   */
  localLoadEntry: undefined as HistoryEntrySnapshot | undefined,
  /**
   * A JSON copy of the main document that playback keeps at the current position when
   * `needsJsonCopy` is true. It is built on the first move that needs it.
   */
  jsonHistoryCopy: undefined as JsonHistoryCopy | undefined
}))
.views((self) => {
  // The history usually only grows during playback, so the scan resumes where it stopped. A new or
  // shorter history is scanned again.
  let scannedHistory: unknown;
  let scannedLength = 0;
  let hasLoadEntry = false;
  return {
    /**
     * True when playback needs a JSON copy of the document: when the history holds a
     * load entry, or a local load entry was handed over.
     */
    get needsJsonCopy() {
      if (self.localLoadEntry) return true;
      const history = self.document.history;
      if (scannedHistory !== history || history.length < scannedLength) {
        scannedHistory = history;
        scannedLength = 0;
        hasLoadEntry = false;
      }
      for (; scannedLength < history.length && !hasLoadEntry; scannedLength++) {
        hasLoadEntry = !!history[scannedLength].isLoadEntry;
      }
      return hasLoadEntry;
    }
  };
})
.views((self) => ({
  get undoManager() : IUndoManager {
    return self.undoStore;
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
.actions((self) => {
  function clearOpenEntryTimer(entryId: string) {
    const timer = self.openEntryTimers.get(entryId);
    if (timer !== undefined) {
      clearTimeout(timer);
      self.openEntryTimers.delete(entryId);
    }
  }

  function completeHistoryEntry(activeEntry: HistoryEntryType) {
    activeEntry.state = "complete";
    clearOpenEntryTimer(activeEntry.id);

    // Copied rather than detached: detach walks every identifier in the tree, and the history
    // grows to thousands of entries. The active entry is destroyed, so code refers to active
    // entries by id only.
    const snapshot = getSnapshot(activeEntry);
    destroy(activeEntry);

    // If the history entry resulted in no changes don't add it to the real
    // history.
    //
    // TODO: we might not want to do this, it could be useful for researchers
    // and teachers to see actions the student took even if they didn't change
    // state. For example if a button was clicked even if it didn't change the
    // state we might want to show that somehow. There are lots of entries
    // that are empty though, so they are removed for the time being.
    if (snapshot.records.length === 0) {
      return;
    }

    // Content is saved only when it changes, so flushing before a metadata-only entry (a title
    // change) would pair the load entry with old content, and the next load would convert it again
    // with new ids. The entry isn't undoable, so it skips the undo store and leaves revisionId alone.
    if (self.pendingLoadEntry && entryChangesContent(snapshot)) {
      const loadEntryIndex = self.document.history.length;
      self.document.history.push(self.pendingLoadEntry);
      self.pendingLoadEntry = undefined;
      self.historyManager?.onHistoryEntryCompleted(
        self.document, self.document.history[loadEntryIndex], loadEntryIndex);
    }

    // Save the index in the local history. This is used to figure out
    // the index written into the firestore entry document
    const newLocalIndex = self.document.history.length;

    self.document.history.push(snapshot);
    const entry = self.document.history[newLocalIndex];

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

    self.entryCompletedListeners.forEach(listener => listener(entry));

    self.historyManager?.onHistoryEntryCompleted(self.document, entry, newLocalIndex);
  }

  return {
    completeHistoryEntry,

    /**
     * Complete an entry whose exchanges never closed. Records that arrive for it afterwards are
     * kept as new entries, see addTreePatchRecord.
     */
    timeOutEntry(entryId: string) {
      self.openEntryTimers.delete(entryId);
      const entry = self.findActiveHistoryEntry(entryId);
      if (!entry) return;

      const openExchanges = Array.from(entry.activeExchanges.values());
      self.logger?.(LogEventName.HISTORY_ENTRY_TIMED_OUT, {
        entryId, model: entry.model, action: entry.action, openExchanges
      });
      // eslint-disable-next-line no-console
      console.error(`History entry timed out with open exchanges ${json({
        entryId, model: entry.model, action: entry.action, openExchanges
      })}`);

      self.exactness.markNotExact("timed-out-entry");
      self.timedOutEntries.set(entryId, { model: entry.model });
      entry.activeExchanges.clear();
      entry.timedOut = true;
      completeHistoryEntry(entry);
    }
  };
})
.actions((self) => {
  return {
    /**
     * Append a history entry whose patches have already been applied by
     * the caller. Two callers today:
     *   - The Firestore listener side, after applying an incoming remote
     *     entry's patches.
     *   - The fork-rollback flow, after applying the aggregate inverse
     *     patches that revert one or more local entries (the appended
     *     entry is a revert entry — see `revert-entry.ts`).
     *
     * Does not register the entry with the undo store (the caller owns
     * that decision) and does not enqueue for upload.
     */
    addHistoryEntryAfterApplying(entry: Instance<typeof HistoryEntry>) {
      self.document.history.push(entry);
    },

    setPendingLoadEntry(entry: HistoryEntrySnapshot | undefined) {
      self.pendingLoadEntry = entry;
    },

    setLocalLoadEntry(entry: HistoryEntrySnapshot | undefined) {
      self.localLoadEntry = entry;
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

    // Undefined means the position is not known yet, which is how it is left while
    // setNumHistoryEntriesAppliedFromFirestore looks up the document's last entry.
    setNumHistoryEntriesApplied(value: number | undefined) {
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
            path: `${kTileMapPath}/NONEXISTENT_TILE/content/value`,
            value: "this patch will fail"
          }],
          inversePatches: [{
            op: "replace",
            path: `${kTileMapPath}/NONEXISTENT_TILE/content/value`,
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
        // A tree can still be working on an entry that was force-completed.
        if (self.timedOutEntries.has(historyEntryId)) return Promise.resolve();
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

    endExchange(historyEntryId: string, exchangeId: string) {
      const entry = self.findActiveHistoryEntry(historyEntryId);
      if (!entry) {
        if (self.timedOutEntries.has(historyEntryId)) return;
        throw new Error(`There isn't an active entry for ${ json({historyEntryId, exchangeId})}`);
      }

      const openExchangeValue = entry.activeExchanges.get(exchangeId);
      if (!openExchangeValue) {
        throw new Error(`There is no active exchange matching ${ json({historyEntryId, exchangeId}) }`);
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
      // Ids are unique by contract (TreeManagerAPI.addHistoryEntry), so only active entries are
      // checked; a history scan would grow with the history.
      if (self.findActiveHistoryEntry(historyEntryId)) {
        throw new Error(`The entry already exists ${ json({historyEntryId})}`);
      }
      const entry = HistoryEntry.create({
        ...entryInfo,
      });
      self.activeHistoryEntries.push(entry);

      entry.activeExchanges.set(exchangeId, `TreeManager.createHistoryEntry ${action}`);

      self.openEntryTimers.set(historyEntryId,
        setTimeout(() => self.timeOutEntry(historyEntryId), kOpenEntryTimeoutMs));
    },

    /**
     * Listeners are called synchronously when a local entry with records has been added to the
     * history, before the history manager is told about it. Returns a function that removes the
     * listener.
     */
    addEntryCompletedListener(listener: (entry: HistoryEntryType) => void) {
      self.entryCompletedListeners.add(listener);
      return () => { self.entryCompletedListeners.delete(listener); };
    },

    setLogger(logger: TreeManagerLogger | undefined) {
      self.logger = logger;
    },

    afterCreate() {
      addDisposer(self, () => {
        self.openEntryTimers.forEach(timer => clearTimeout(timer));
        self.openEntryTimers.clear();
      });
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

  };
})
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
    const timedOutEntry = self.timedOutEntries.get(historyEntryId);
    if (!entry && timedOutEntry) {
      // The entry this record belongs to was force-completed. The record is only stored, never
      // applied, so it is kept as an entry of its own in case it has changes worth recording.
      if (treePatchRecord.patches.length > 0) {
        const lateEntry = HistoryEntry.create({
          id: nanoid(),
          tree: record.tree,
          model: timedOutEntry.model,
          action: record.action,
          undoable: false,
          lateRecordForEntryId: historyEntryId,
          records: [record]
        });
        self.activeHistoryEntries.push(lateEntry);
        self.completeHistoryEntry(lateEntry);
      }
      return;
    }
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

    self.endExchange(historyEntryId, exchangeId);
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

  /**
   * Apply entries that were saved after the content was last saved, when a document loads.
   *
   * The entries are applied one at a time, and application stops at the first one that
   * fails. They aren't added to `document.history` or reported as completed: they are
   * already in Firestore.
   *
   * An entry that fails may be partly applied and isn't counted in `applied`, so a caller
   * must treat any `error` as leaving the content not exact.
   *
   * When the load converted old models, or an entry is a load entry, the entries are applied to
   * the stored JSON instead (see applyEntriesToStoredJson), and the document's content is set to
   * the result, which converts it again and rebuilds the pending load entry from it.
   */
  applyEntriesAtLoad: flow(function* applyEntriesAtLoad(snapshots: HistoryEntrySnapshot[]) {
    const { mainDocument, pendingLoadEntry } = self;
    if (mainDocument && (pendingLoadEntry || snapshots.some(snapshot => snapshot?.isLoadEntry))) {
      const documentJson = toJsonValue(getSnapshot(mainDocument as unknown as IAnyStateTreeNode));
      const stored = applyEntriesToStoredJson(documentJson, mainDocument.key, pendingLoadEntry, snapshots);
      if (stored.applied > 0) {
        mainDocument.setContent(stored.content);
      }
      return stored.error === undefined
        ? { applied: stored.applied }
        : { applied: stored.applied, error: stored.error };
    }

    const trees = Object.values(self.trees);
    // FAKE ids keep what the trees do while applying out of the history.
    yield Promise.all(trees.map(tree => {
      return tree.startApplyingPatchesFromManager(FAKE_HISTORY_ENTRY_ID, FAKE_EXCHANGE_ID);
    }));

    let applied = 0;
    let error: string | undefined;
    try {
      for (const snapshot of snapshots) {
        try {
          const treePatches: Record<string, IJsonPatch[]> = {};
          HistoryEntry.create(snapshot).records.forEach(record => {
            (treePatches[record.tree] ??= []).push(...record.getPatches(HistoryOperation.Redo));
          });
          const applyPromises = Object.entries(treePatches).map(([treeId, patches]) => {
            const tree = self.trees[treeId];
            if (!tree) throw new Error(`Unknown tree '${treeId}'`);
            return patches.length > 0
              ? tree.applyPatchesFromManager(FAKE_HISTORY_ENTRY_ID, FAKE_EXCHANGE_ID, patches)
              : undefined;
          });
          yield Promise.all(applyPromises);
        } catch (e) {
          error = e instanceof Error ? e.message : String(e);
          break;
        }
        applied++;
      }
    } finally {
      yield Promise.all(trees.map(tree => {
        return tree.finishApplyingPatchesFromManager(FAKE_HISTORY_ENTRY_ID, FAKE_EXCHANGE_ID);
      }));
    }
    return error === undefined ? { applied } : { applied, error };
  }),

  goToHistoryEntryPosition: flow(function* goToHistoryEntryPosition(
                                      newHistoryPosition: number) {
    const trees = Object.values(self.trees);

    if (newHistoryPosition === self.numHistoryEventsApplied) return;
    if (self.numHistoryEventsApplied === undefined) return;
    if (self.jsonCopyOutOfStep) return;
    // Capture the starting position so unexpected-error handling can
    // anchor its failure recording and rollback to a known-safe point.
    const initialPosition = self.numHistoryEventsApplied;
    const history = self.document.history;

    // Records one failure per (historyIndex, direction) pair. An index outside the history
    // records nothing.
    const recordFailure = (historyIndex: number, failureDirection: "undo" | "redo", errorMessage: string) => {
      const historyEntry = historyIndex >= 0 ? history.at(historyIndex) : undefined;
      if (!historyEntry) return;
      if (self.historyPlaybackFailures.some(f =>
          f.historyIndex === historyIndex && f.direction === failureDirection)) return;
      self.historyPlaybackFailures.push({ historyEntry, historyIndex, direction: failureDirection, errorMessage });
    };

    // Every patch this move applies comes from the source, along with the model replacements each
    // tree applies after its patches. The one exception is the rollback of a partly applied
    // entry, which uses the reverse patches the tree reported.
    let source: IPlaybackPatchSource = defaultPatchSource;
    // Where this move goes. A JSON copy can stop it short of the requested position.
    let targetPosition = newHistoryPosition;
    // Only a document that needs a JSON copy (see needsJsonCopy) has one. The copy moves first:
    // it finds an entry that doesn't apply, and it says which models are old.
    let copy: JsonHistoryCopy | undefined;
    if (self.needsJsonCopy && self.mainDocument) {
      copy = self.jsonHistoryCopy;
      if (!copy) {
        const { key } = self.mainDocument;
        const documentJson: object = toJsonValue(getSnapshot(self.mainDocument as unknown as IAnyStateTreeNode));
        const startJson = getJsonCopyStart(documentJson, key, history, initialPosition, self.localLoadEntry);
        copy = self.jsonHistoryCopy = new JsonHistoryCopy(key, startJson, initialPosition);
      }
      const { moved, source: oldModelSource } =
        moveJsonCopy(copy, history, self.mainDocument.key, newHistoryPosition);
      source = oldModelSource;
      targetPosition = moved.position;
      if (moved.failure) {
        const { historyIndex, direction: failureDirection, message } = moved.failure;
        recordFailure(historyIndex, failureDirection, message);
        console.warn(`History entry ${historyIndex} failed to ${failureDirection}: ${message}`);
      }
      if (targetPosition === initialPosition) return;
    }

    // Moves the copy back to where the trees are after a failure. An entry that applied one way
    // doesn't always apply the other way, so the copy can stop short. Then the copy and the trees
    // disagree, and playback stops.
    const moveCopyBack = (position: number) => {
      if (!copy) return;
      const moved = copy.moveTo(history, position);
      if (moved.position === position) return;
      self.jsonCopyOutOfStep = true;
      const message = `The playback JSON copy stopped at history position ${moved.position} instead of ` +
        `going back to ${position}, so playback has stopped: ${moved.failure?.message}`;
      if (moved.failure) recordFailure(moved.failure.historyIndex, moved.failure.direction, message);
      console.error(message);
    };

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
    const direction = targetPosition > initialPosition ? 1 : -1;
    const opType = direction === 1 ? HistoryOperation.Redo : HistoryOperation.Undo;
    const directionStr = direction === 1 ? "redo" : "undo";
    const startingIndex = direction === 1 ? initialPosition : initialPosition - 1;
    const endingIndex = direction === 1 ? targetPosition : targetPosition - 1;
    // An error that can't be placed in the batch is recorded at the first entry the batch was
    // about to touch:
    //   - Forward: initialPosition (next entry to apply)
    //   - Backward: initialPosition - 1 (first entry to undo)
    const unexpectedIndex = direction === 1 ? initialPosition : initialPosition - 1;
    // A history entry may contain multiple records for the same tree
    // (e.g. tile update + shared-model update). source.getPatches
    // aggregates them into one ordered list per tree so we can push a
    // single segment per tree per history entry — that way rollback on
    // failure covers all records in the entry, not just one.
    // Using the same helper for both the initial batching and the
    // rollback ensures the two paths produce matching orderings.
    // Every tree's model replacements are computed here too, so nothing is applied when a
    // conversion throws.
    const treeModelReplacements: Record<string, IJsonPatch[]> = {};
    // The source converts old models, and a conversion can throw. Only a copy's source converts.
    let conversionFailure: { error: unknown } | undefined;
    const fromSource = (build: () => IJsonPatch[]) => {
      if (conversionFailure) return [];
      try {
        return build();
      } catch (error) {
        if (!copy) throw error;
        conversionFailure = { error };
        return [];
      }
    };
    for (let i=startingIndex; i !== endingIndex; i=i+direction) {
      const historyEntry = history.at(i);
      if (!historyEntry) continue;
      for (const treeId of Object.keys(self.trees)) {
        const patches = treePatches[treeId];
        if (!patches) {
          throw new Error(`treePatches missing entry for known tree '${treeId}'`);
        }
        const entryPatches = fromSource(() => source.getPatches(historyEntry, treeId, opType));
        if (entryPatches.length > 0) {
          patches.push(...entryPatches);
          treePatchSegments[treeId].push({ historyIndex: i, patchCount: entryPatches.length });
        }
      }
    }
    Object.keys(treePatches).forEach(treeId => {
      treeModelReplacements[treeId] = fromSource(() => source.getModelReplacements(treeId));
    });
    if (copy && conversionFailure) {
      // A conversion of an old model threw. The move doesn't advance.
      const { error } = conversionFailure;
      moveCopyBack(initialPosition);
      const errMessage = error instanceof Error ? error.message : String(error);
      recordFailure(unexpectedIndex, directionStr, `Could not convert an old model: ${errMessage}`);
      console.error(`Could not convert an old model at history position ${targetPosition}:`, error);
      return;
    }

    // Disable shared model syncing on all of the trees. This is
    // different than when the undo store applies patches because in
    // this case we are going to apply lots of history entries all at
    // once. We use FAKE ids here so any responses from tree are
    // not recorded in the history.
    const startPromises = trees.map(tree => {
      return tree.startApplyingPatchesFromManager(FAKE_HISTORY_ENTRY_ID, FAKE_EXCHANGE_ID);
    });
    yield Promise.all(startPromises);

    // Apply the batched patches to each tree in parallel. Three kinds of
    // failure can happen during the apply phase:
    //
    // 1. PatchApplicationError — a recoverable patch-apply failure.
    //    We pick an earliest failing history index across all trees
    //    that had one:
    //      - Forward (Redo): stopPosition = min(failedIndices)
    //      - Backward (Undo): stopPosition = max(failedIndices) + 1
    //    Trees that succeeded past the stop position have those
    //    entries rolled back; trees that failed have their own partial
    //    rollback plus any entries they applied past the stop position.
    //
    // 2. ModelReplacementError — MST rejected a model replacement. A tree
    //    applies its model replacements after all of its patches, so every
    //    entry in the move was applied to it, and there is no entry to stop
    //    at. The move goes back to where it started (stopPosition =
    //    initialPosition): every entry the tree applied is undone, and the
    //    rollback's model replacements put the old models back as they were
    //    at initialPosition.
    //
    // 3. Any other error — a bug, by construction: applyPatchesFromManager
    //    wraps patch-apply failures as PatchApplicationError, and there
    //    is no IO/network path that could produce a transient failure.
    //    We refuse to advance at all (stopPosition = initialPosition),
    //    roll back any tree that succeeded in the batch, leave the
    //    failing tree alone (we don't know how far it got), record a
    //    playback-failure marker so the user sees the existing UI
    //    banner, and console.error the original stack so a developer
    //    can find the bug.
    interface TreeApplyFailure {
      error: PatchApplicationError;
      historyIndex: number;
      appliedInEntry: number;
      failingSegIdx: number;
    }
    interface TreeApplyUnexpected {
      error: unknown;
    }
    interface TreeApplyResult {
      treeId: string;
      tree: TreeAPI;
      segments: PatchSegment[];
      failure?: TreeApplyFailure;
      unexpected?: TreeApplyUnexpected;
    }
    type FailedResult = TreeApplyResult & { failure: TreeApplyFailure };
    type UnexpectedResult = TreeApplyResult & { unexpected: TreeApplyUnexpected };

    const results: TreeApplyResult[] = [];
    const failedResults: FailedResult[] = [];
    const unexpectedResults: UnexpectedResult[] = [];
    const modelReplacementFailures: { treeId: string; error: ModelReplacementError }[] = [];

    const applyPromises = Object.entries(treePatches).map(async ([treeId, patches]) => {
      const modelReplacements = treeModelReplacements[treeId];
      if ((!patches || patches.length === 0) && modelReplacements.length === 0) return;
      const tree = self.trees[treeId];
      if (!tree) return;
      const segments = treePatchSegments[treeId];
      try {
        await tree.applyPatchesFromManager(
          FAKE_HISTORY_ENTRY_ID, FAKE_EXCHANGE_ID, patches ?? [], modelReplacements);
        results.push({ treeId, tree, segments });
      } catch (e) {
        if (e instanceof PatchApplicationError) {
          const { historyIndex, appliedInEntry } = findFailedSegment(e.numApplied, segments);
          // Each segment has a unique historyIndex because
          // source.getPatches aggregates per-entry.
          const failingSegIdx = segments.findIndex(s => s.historyIndex === historyIndex);
          const failedResult: FailedResult = {
            treeId, tree, segments,
            failure: { error: e, historyIndex, appliedInEntry, failingSegIdx }
          };
          results.push(failedResult);
          failedResults.push(failedResult);
        } else if (e instanceof ModelReplacementError) {
          // Every entry was applied to the tree, so it is recorded like a tree that succeeded,
          // and the rollback to initialPosition undoes all of them.
          results.push({ treeId, tree, segments });
          modelReplacementFailures.push({ treeId, error: e });
        } else {
          // Do NOT rethrow: route this through the playback-failure
          // handling below so the user and developer both see it.
          const unexpectedResult: UnexpectedResult = {
            treeId, tree, segments, unexpected: { error: e }
          };
          results.push(unexpectedResult);
          unexpectedResults.push(unexpectedResult);
        }
      }
    });
    yield Promise.all(applyPromises);

    const hasAnyFailure =
      failedResults.length > 0 || unexpectedResults.length > 0 || modelReplacementFailures.length > 0;
    // Default to the requested target; the failure branch below may change
    // it to a previous position depending on the direction we are moving in
    // if some patches couldn't be applied.
    let stopPosition: number = targetPosition;

    if (hasAnyFailure) {
      if (unexpectedResults.length > 0 || modelReplacementFailures.length > 0) {
        // Conservative: refuse to advance. We don't know how far a tree
        // that failed unexpectedly got, so we re-anchor all trees to where
        // we started and don't touch that tree at all. A model
        // replacement failure has no history index to stop at.
        stopPosition = initialPosition;
      } else {
        const failedIndices = failedResults.map(r => r.failure.historyIndex);
        // stopPosition is the new numHistoryEventsApplied.
        // When going forward the entry at index numHistoryEventsApplied hasn't
        // been applied yet. So we can apply events until
        // numHistoryEventsApplied equals the first failing entry.
        // When going backward the entry at index numHistoryEventsApplied has
        // had its "undo" patches applied. So we have to stop just before
        // numHistoryEventsApplied equals this failing entry.
        stopPosition = direction === 1
          ? Math.min(...failedIndices)
          : Math.max(...failedIndices) + 1;
      }

      // For forward, entries with historyIndex >= stopPosition must
      // not be "applied" at the stop position. For backward, entries
      // with historyIndex < stopPosition must be "applied".
      const needsRollback = (historyIndex: number): boolean => {
        return direction === 1
          ? historyIndex >= stopPosition
          : historyIndex < stopPosition;
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
      // A partly applied entry rolls back with the reverse patches the tree
      // reported, since an entry's inverse patches don't have to pair with its
      // patches.
      //
      // Trees that failed unexpectedly are skipped entirely: we don't
      // have a trustworthy numApplied count and can't safely roll back
      // their state. We leave them as-is and rely on the recorded
      // playback-failure + console.error to surface the bug.
      //
      // Every rollback batch and its model replacements are built before any is applied. Building
      // one can throw when a conversion of an old model fails, which leaves that tree out.
      const buildRollbacks = () => {
        const built: { r: TreeApplyResult; patches: IJsonPatch[]; modelReplacements: IJsonPatch[] }[] = [];
        let failed = false;
        for (const r of results) {
          if (r.unexpected) continue;
          try {
            const rollbackPatches: IJsonPatch[] = [];

            if (r.failure) {
              // The failing entry's applied patches are the last appliedInEntry the tree applied.
              const { appliedInEntry, error } = r.failure;
              const appliedReversePatches = error.reversePatches.slice(error.numApplied - appliedInEntry);
              appliedReversePatches.reverse().forEach(patchReversePatches => {
                rollbackPatches.push(...[...patchReversePatches].reverse());
              });
            }

            // Fully-applied segments (those before the failing segment, or
            // all segments if this tree didn't fail), in reverse application
            // order. Only those "past" the stop position need rollback.
            const failingSegIdx = r.failure ? r.failure.failingSegIdx : r.segments.length;
            for (let i = failingSegIdx - 1; i >= 0; i--) {
              const seg = r.segments[i];
              if (needsRollback(seg.historyIndex)) {
                const entry = history.at(seg.historyIndex);
                if (entry) {
                  const oppositePatches = source.getPatches(entry, r.treeId, oppositeOp);
                  rollbackPatches.push(...oppositePatches);
                }
              }
            }

            built.push({
              r, patches: rollbackPatches, modelReplacements: source.getModelReplacements(r.treeId)
            });
          } catch (buildError) {
            failed = true;
            console.warn(
              `Rollback of tree '${r.treeId}' to history position ${stopPosition} could not be built: ` +
              `${(buildError as Error).message}.`
            );
          }
        }
        return { built, failed };
      };

      // The copy moves to the stop position first, so the rollback's model replacements hold the
      // old models' state there.
      moveCopyBack(stopPosition);
      let { built: rollbacks, failed: rollbackFailed } = buildRollbacks();
      if (rollbackFailed && stopPosition !== initialPosition) {
        // Stop where the move started instead, so every tree and the copy end at one position.
        // The conversions there succeeded when the trees got there.
        stopPosition = initialPosition;
        moveCopyBack(stopPosition);
        ({ built: rollbacks, failed: rollbackFailed } = buildRollbacks());
      }
      if (rollbackFailed) {
        console.warn("Trees may be in an inconsistent state.");
      }

      const rollbackPromises = rollbacks.map(async ({
        r, patches: rollbackPatches, modelReplacements: rollbackModelReplacements
      }) => {
        if (rollbackPatches.length > 0 || rollbackModelReplacements.length > 0) {
          try {
            await r.tree.applyPatchesFromManager(
              FAKE_HISTORY_ENTRY_ID, FAKE_EXCHANGE_ID, rollbackPatches, rollbackModelReplacements);
          } catch (rollbackError) {
            // Rollback itself failed — trees are now out of sync and
            // we can't recover automatically. Log and continue.
            // TODO: consider surfacing this as a distinct catastrophic
            // failure signal for the UI.
            console.warn(
              `Rollback of tree '${r.treeId}' failed: ${(rollbackError as Error).message}. ` +
              `Trees may be in an inconsistent state.`
            );
          }
        }
      });
      yield Promise.all(rollbackPromises);

      for (const r of failedResults) {
        const { historyIndex, error } = r.failure;
        if (!history.at(historyIndex)) continue;
        recordFailure(historyIndex, directionStr, error.message);
        console.warn(
          `History entry ${historyIndex} failed to ${directionStr}: ${error.message}`
        );
      }

      // Model replacement failures and unexpected errors are recorded at unexpectedIndex: a model
      // replacement failure has no history index, and an unexpected error's place in the batch is
      // unknown. If that index isn't a valid history position, recordFailure skips the marker, but
      // the error is still logged so it is visible to developers.
      for (const { treeId, error } of modelReplacementFailures) {
        recordFailure(unexpectedIndex, directionStr, error.message);
        console.warn(`Tree '${treeId}' failed to ${directionStr} to history position ${targetPosition}: ` +
          error.message);
      }
      for (const r of unexpectedResults) {
        const err = r.unexpected.error;
        const errMessage = err instanceof Error ? err.message : String(err);
        recordFailure(unexpectedIndex, directionStr, `Unexpected error during playback: ${errMessage}`);
        console.error(
          `Unexpected error playing back tree '${r.treeId}' ` +
          `at history position ${unexpectedIndex}:`,
          err
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
    self.numHistoryEventsApplied = stopPosition;
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
