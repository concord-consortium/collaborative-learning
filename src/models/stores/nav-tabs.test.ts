import { ENavTab } from "../view/nav-tabs";
import { NavTabsConfigModel } from "./nav-tabs";

describe("NavTabsConfigModel", () => {
  const config = NavTabsConfigModel.create({
    tabSpecs: [
      { tab: ENavTab.kProblems, label: "Problems" },
      // A hidden tab is defined but not shown in the nav panel.
      { tab: ENavTab.kMyWork, label: "My Work", hidden: true },
    ]
  });

  describe("getNavTabSpec", () => {
    it("returns a visible tab spec", () => {
      expect(config.getNavTabSpec(ENavTab.kProblems)?.tab).toBe(ENavTab.kProblems);
    });

    it("does NOT return a hidden tab spec", () => {
      expect(config.getNavTabSpec(ENavTab.kMyWork)).toBeUndefined();
    });
  });
});
