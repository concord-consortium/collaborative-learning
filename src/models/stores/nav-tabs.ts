import { types } from "mobx-state-tree";
import { NavTabModel } from "../view/nav-tabs";

export const NavTabsConfigModel = types
  .model("NavTabsConfig", {
    defaultExpanded: false,
    preventExpandCollapse: false,
    lazyLoadTabContents: false,
    tabSpecs: types.array(NavTabModel)
  });
