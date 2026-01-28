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
  state: types.optional(types.enumeration("HistoryEntryState", ["recording", "complete"]), "recording")
})
.volatile(self => ({
  // The value of the map should be the name of the exchange. This is useful
  // for debugging an activeExchange that hasn't been ended.
  // The {name: "activeExchanges"} is a feature of MobX that can also
  // help with debugging.
  activeExchanges: observable.map<string, string>({}, {name: "activeExchanges"}),
  /**
   * Track whether this history entry has been applied to the current tree.
   * This is useful for collaborative documents where multiple users may be
   * making changes and we need to know whether this entry has already been
   * applied or not.
   * TODO: This state duplicates the functionality of TreeManager#numHistoryEventsApplied.
   * That property is used when scanning around in the history with the slider.
   * Using this individual flag on each history entry makes it possible for entries
   * to be applied out of order, which supports collaborative editing better.
   * It seems inefficient for scanning around with history slider to have to change
   * this flag on each entry instead of just using a counter. We should look at how it
   * it is used and see if we can simplify to just one approach.
   */
  applied: false
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
