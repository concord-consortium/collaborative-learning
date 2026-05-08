import { types, IJsonPatch, SnapshotIn, Instance } from "mobx-state-tree";
import { observable } from "mobx";

export const TreePatchRecord = types.model("TreePatchRecord", {
  tree: types.string,
  action: types.string,
  patches: types.frozen<ReadonlyArray<IJsonPatch>>(),
  inversePatches: types.frozen<ReadonlyArray<IJsonPatch>>()
})
.views(self => ({
  getPatches(opType: HistoryOperation) {
    switch (opType) {
      case HistoryOperation.Undo:
        return self.inversePatches.slice().reverse();
      case HistoryOperation.Redo:
        return self.patches;
    }
  }
}));
export interface TreePatchRecordSnapshot extends SnapshotIn<typeof TreePatchRecord> {}

export interface ICreateHistoryEntry {
  id: string;
  exchangeId: string;
  tree: string;
  model: string;
  action: string;
  undoable: boolean;
}

export type HistoryEntrySource = "local" | "remote" | "revert";

export const HistoryEntry = types.model("HistoryEntry", {
  id: types.identifier,
  tree: types.maybe(types.string),
  model: types.maybe(types.string),   // name of model
  action: types.maybe(types.string),  // name of action
  // This doesn't need to be recorded in the state, but putting it here is
  // the easiest place for now.
  undoable: types.maybe(types.boolean),
  created: types.optional(types.Date, () => new Date()),
  records: types.array(TreePatchRecord),
  // History entries are marked as recording, until all records have been added
  state: types.optional(types.enumeration("HistoryEntryState", ["recording", "complete"]), "recording"),
  // Revert-entry metadata. `isRevert` and `revertsEntryId` are absent on
  // non-revert entries and set on entries created by rollbackLocalEntries.
  // `triggeringBatchIds` is always present as an array — empty on non-revert
  // entries, populated with the incoming batch's entry ids on reverts.
  isRevert: types.maybe(types.boolean),
  revertsEntryId: types.maybe(types.string),
  triggeringBatchIds: types.array(types.string),
  /**
   * Id of the user who originally generated this entry. Stamped into the
   * Firestore snapshot at upload time, so locally-created entries lack uid
   * until they round-trip via the remote listener (which we skip for our
   * own entries — see existingIds filter in applyHistoryEntries). In
   * practice: present on entries received from other clients, absent on
   * entries created by this client and on legacy pre-feature entries.
   */
  uid: types.maybe(types.string),
})
.volatile(self => ({
  // The value of the map should be the name of the exchange. This is useful
  // for debugging an activeExchange that hasn't been ended.
  // The {name: "activeExchanges"} is a feature of MobX that can also
  // help with debugging.
  activeExchanges: observable.map<string, string>({}, {name: "activeExchanges"}),
  /**
   * How this entry got into this process's local document.history. Default
   * "local" covers entries created via the action middleware. Overridden to
   * "remote" for entries applied from the Firestore listener and to
   * "revert" for system-generated revert entries from rollbackLocalEntries.
   * Volatile because it describes the local arrival path, not the entry
   * itself, so it must not round-trip through Firestore.
   */
  source: "local" as HistoryEntrySource,
}))
.actions(self => ({
  setSource(source: HistoryEntrySource) {
    self.source = source;
  }
}))
.views(self => ({
  get modelActionKey() {
    const modelName = self.model ?? "UnknownModel";
    const pathParts = self.action?.split("/") ?? [];
    const actionName = pathParts.length ? pathParts[pathParts.length - 1] : "unknownAction";
    return `${modelName}.${actionName}`;
  }
}));
export interface HistoryEntrySnapshot extends SnapshotIn<typeof HistoryEntry> {}
export interface HistoryEntryType extends Instance<typeof HistoryEntry> {}

export enum HistoryOperation {
  Undo = "undo",
  Redo = "redo"
}
