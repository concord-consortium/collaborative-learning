import { Instance, SnapshotIn, types } from "mobx-state-tree";
import { ENavTab, NavTabModel, NavTabSpec } from "../view/nav-tabs";

export const NavTabsConfigModel = types
  .model("NavTabsConfig", {
    defaultExpanded: false,
    preventExpandCollapse: false,
    lazyLoadTabContents: false,
    tabSpecs: types.array(NavTabModel),
  })
  .views(self => ({
    getNavTabSpec(tabId: ENavTab): NavTabSpec | undefined {
      return self.tabSpecs.find(tab => tabId === tab.tab);
    }
  }));

export type NavTabConfigModelType = Instance<typeof NavTabsConfigModel>;
export type NavTabConfigSpec = SnapshotIn<typeof NavTabsConfigModel>;
