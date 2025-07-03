import { types, Instance } from "mobx-state-tree";
import { IObjectDidChange, observe } from "mobx";

export const DataSetSelectionModel = types
  .model("DataSetSelection", {
    selection: types.map(types.boolean)
  })
  .views(self => ({
    isSelected(id: string) {
      return !!self.selection.get(id);
    },
    getSelected(): string[] {
      const selection = Array.from(self.selection.entries());
      return selection
              .map(entry => entry[1] ? entry[0] : undefined)
              .filter(id => !!id) as string[];
    }
  }))
  .actions(self => ({
    clear() {
      self.selection.clear();
    },
    select(id: string, isSelected: boolean) {
      self.selection.set(id, isSelected);
    },
    toggleSelected(id: string) {
      self.selection.set(id, !self.isSelected(id));
    },
    observe(listener: (change: IObjectDidChange<boolean>) => void) {
      return observe(self.selection, listener);
    }
  }))
  .actions(self => ({
    setSelected(ids: string[]) {
      self.selection.forEach((isSelected, _id) => {
        const id = String(_id);
        if (isSelected && (ids.indexOf(id) < 0)) {
          self.select(id, false);
        }
      });
      ids.forEach(id => self.select(id, true));
    }
  }));

export const SelectionStoreModel = types
  .model("SelectionStore", {
    sets: types.map(DataSetSelectionModel)
  })
  .views(self => ({
    isSelected(setId: string, id: string) {
      const set = self.sets.get(setId);
      return set ? set.isSelected(id) : false;
    },
    getSelected(setId: string) {
      const set = self.sets.get(setId);
      return set ? set.getSelected() : [];
    }
  }))
  .actions(self => ({
    require(setId: string) {
      const set = self.sets.get(setId);
      if (set) return set;
      const newSet = DataSetSelectionModel.create();
      self.sets.set(setId, newSet);
      return newSet;
    }
  }))
  .actions(self => ({
    clear(setId: string) {
      self.require(setId).clear();
    },
    select(setId: string, id: string, isSelected: boolean) {
      self.require(setId).select(id, isSelected);
    },
    toggleSelected(setId: string, id: string) {
      self.require(setId).toggleSelected(id);
    },
    setSelected(setId: string, ids: string[]) {
      self.require(setId).setSelected(ids);
    },
    observe(setId: string, listener: (changes: IObjectDidChange<boolean>) => void) {
      return self.require(setId).observe(listener);
    }
  }));
export type SelectionStoreModelType = Instance<typeof SelectionStoreModel>;
