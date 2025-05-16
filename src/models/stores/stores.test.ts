import { AppMode } from "./store-types";
import { specStores } from "./spec-stores";
import { UnitModel } from "../curriculum/unit";
import { InvestigationModel } from "../curriculum/investigation";
import { ProblemModel } from "../curriculum/problem";
import { SectionModel, SectionType } from "../curriculum/section";
import { UserModel } from "./user";
import { DB } from "../../lib/db";
import { getSnapshot } from "mobx-state-tree";
import { CurriculumConfig } from "./curriculum-config";

describe("stores object", () => {

  it("supports creating dummy stores for testing", () => {
    const stores = specStores();
    expect(stores).toBeDefined();
    expect(stores.user).toBeDefined();
    expect(stores.problem).toBeDefined();
    expect(stores.persistentUI).toBeDefined();
    expect(stores.db).toBeDefined();
  });

  it("supports passing in stores for testing", () => {
    const curriculumConfig = CurriculumConfig.create({
      curriculumSiteUrl: "",
      defaultUnit: "foo",
    });
    const appMode: AppMode = "dev";
    const id = "1";
    const name = "Colonel Mustard";
    const type = "student";
    const user = UserModel.create({ id, type, name });
    const title = "Test Problem";
    const problem = ProblemModel.create({ ordinal: 1, title });
    const db = new DB();
    const stores = specStores({ curriculumConfig, appMode, user, problem, db });
    expect(stores.curriculumConfig.defaultUnit).toBe("foo");
    expect(stores.appMode).toBe("dev");
    expect(stores.user.id).toBe(id);
    expect(stores.user.type).toBe(type);
    expect(stores.user.name).toBe(name);
    expect(stores.problem.title).toBe(title);
    expect(stores.db).toBe(db);
  });

});

function specIntroductionSection() {
  return SectionModel.create({ type: "introduction" });
}

describe("isFeatureSupported()", () => {

  it("defaults to true for arbitrary features", () => {
    const { appConfig } = specStores();
    expect(appConfig.isFeatureSupported("foo")).toBe(true);
    expect(appConfig.isFeatureSupported("foo", specIntroductionSection())).toBe(true);
  });

  it("can disable features at the unit level", () => {
    const { appConfig } = specStores({ unit: UnitModel.create({ title: "Unit", disabled: ["foo"] }) });
    expect(appConfig.isFeatureSupported("foo")).toBe(false);
    expect(appConfig.isFeatureSupported("foo", specIntroductionSection())).toBe(false);
  });

  it("can disable features at the investigation level", () => {
    const investigation = InvestigationModel.create({ ordinal: 1, title: "Investigation", disabled: ["foo"] });
    const { appConfig } = specStores({ investigation });
    expect(appConfig.isFeatureSupported("foo")).toBe(false);
    expect(appConfig.isFeatureSupported("foo", specIntroductionSection())).toBe(false);
  });

  it("can disable features at the problem level", () => {
    const problem = ProblemModel.create({ ordinal: 1, title: "Problem", disabled: ["baz", "foo"] });
    const { appConfig } = specStores({ problem });
    expect(appConfig.isFeatureSupported("foo")).toBe(false);
    expect(appConfig.isFeatureSupported("foo", specIntroductionSection())).toBe(false);
  });

  it("can disable features at the section level", () => {
    const section = SectionModel.create({ type: "introduction" as SectionType, disabled: ["foo"] });
    const problem = ProblemModel.create({ ordinal: 1, title: "Problem", sections: [getSnapshot(section)] });
    const { appConfig } = specStores({ problem });
    expect(appConfig.isFeatureSupported("foo")).toBe(true);
    expect(appConfig.isFeatureSupported("foo", section)).toBe(false);
  });

  it("can disable features at the unit level and reenable them at the problem level", () => {
    const unit = UnitModel.create({ title: "Unit", disabled: ["foo"] });
    const problem = ProblemModel.create({ ordinal: 1, title: "Problem", disabled: ["baz", "!foo"] });
    const { appConfig } = specStores({ unit, problem });
    expect(appConfig.isFeatureSupported("foo")).toBe(true);
    expect(appConfig.isFeatureSupported("foo", specIntroductionSection())).toBe(true);
  });

  it("can enable/disable features at every level", () => {
    const unit = UnitModel.create({ title: "Unit", disabled: ["foo"] });
    const investigation = InvestigationModel.create({ ordinal: 1, title: "Investigation", disabled: ["!foo"] });
    const section = SectionModel.create({ type: "introduction" as SectionType, disabled: ["bar", "baz", "!foo"] });
    const problem = ProblemModel.create(
                      { ordinal: 1, title: "Problem", disabled: ["foo"], sections: [getSnapshot(section)] });
    const { appConfig } = specStores({ unit, investigation, problem });
    expect(appConfig.isFeatureSupported("foo")).toBe(false);
    expect(appConfig.isFeatureSupported("foo", section)).toBe(true);
  });

});

describe("getDisabledFeaturesOfTile()", () => {

  it("returns empty array by default", () => {
    const { appConfig } = specStores();
    expect(appConfig.getDisabledFeaturesOfTile("foo")).toEqual([]);
    expect(appConfig.getDisabledFeaturesOfTile("foo", specIntroductionSection())).toEqual([]);
  });

  it("returns disabled features from across levels", () => {
    const unit = UnitModel.create({
                  title: "Unit",
                  config: { disabledFeatures: ["fooFeature1", "barFeature", "fooFeature2"] }
                });
    const investigation = InvestigationModel.create(
                            { ordinal: 1, title: "Investigation",
                              disabled: ["!fooFeature2", "fooFeature3", "fooFeature4"] });
    const problem = ProblemModel.create({ ordinal: 1, title: "Problem", disabled: ["!fooFeature4"] });
    const { appConfig } = specStores({ unit, investigation, problem });
    expect(appConfig.getDisabledFeaturesOfTile("foo")).toEqual(["fooFeature1", "fooFeature3"]);
  });
});

describe("isProblemLoaded()", () => {
  it("returns false if the problem is not loaded", () => {
    const { isProblemLoaded } = specStores();
    expect(isProblemLoaded).toBe(false);
  });

  it("returns true if the problem is loaded", () => {
    const { isProblemLoaded } = specStores({ problem: ProblemModel.create({ ordinal: 1, title: "Problem" }) });
    expect(isProblemLoaded).toBe(true);
  });
});
