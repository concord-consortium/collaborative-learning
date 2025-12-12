import { addDisposer, applySnapshot, Instance, onSnapshot, types } from "mobx-state-tree";

const kDocEditorSettingsKey = "clue-doc-editor-settings";

export const DocEditorSettings = types.model("DocEditorSettings", {
  showLocalReadOnly: true,
  showRemoteReadOnly: true,
  minimalAISummary: false
})
.views(self => ({
  get anyReadOnly() {
    return self.showLocalReadOnly || self.showRemoteReadOnly;
  }
}))
.actions(self => ({
  afterCreate() {
    // Load value from local storage
    const {localStorage} = window;
    const storageSettings = localStorage.getItem(kDocEditorSettingsKey);
    if (storageSettings) {
      applySnapshot(self, JSON.parse(storageSettings));
    }

    // Save changes to local storage
    addDisposer(self, onSnapshot(self, (snap) => {
      localStorage.setItem(kDocEditorSettingsKey, JSON.stringify(snap));
    }));
  },
  setShowLocalReadOnly(show: boolean) {
    self.showLocalReadOnly = show;
  },
  setShowRemoteReadOnly(show: boolean) {
    self.showRemoteReadOnly = show;
  },
  setMinimalAISummary(minimal: boolean) {
    self.minimalAISummary = minimal;
  }
}));

export interface IDocEditorSettings extends Instance<typeof DocEditorSettings> {}
