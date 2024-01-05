import { Instance, SnapshotIn, types } from "mobx-state-tree";
import { ENavTab, NavTabModel } from "../view/nav-tabs";

export const NavTabsConfigModel = types
  .model("NavTabsConfig", {
    defaultExpanded: false,
    preventExpandCollapse: false,
    lazyLoadTabContents: false,
    tabSpecs: types.array(NavTabModel),
    showNavPanel: false
  })
  .views(self => ({
    getNavTabSpec(tabId: ENavTab) {
      return self.tabSpecs.find(tab => tabId === tab.tab);
    }
  }))
  .actions(self => ({
    toggleShowNavPanel() {
      self.showNavPanel = !self.showNavPanel;
    }
  }));

export type NavTabConfigModelType = Instance<typeof NavTabsConfigModel>;
export type NavTabConfigSpec = SnapshotIn<typeof NavTabsConfigModel>;
