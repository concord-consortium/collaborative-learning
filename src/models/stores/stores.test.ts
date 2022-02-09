import { AppMode } from "./store-types";
import { specStores } from "./spec-stores";
import { isFeatureSupported, getDisabledFeaturesOfTile } from "./stores";
import { UnitModel } from "../curriculum/unit";
import { InvestigationModel } from "../curriculum/investigation";
import { ProblemModel } from "../curriculum/problem";
import { SectionModel, SectionType } from "../curriculum/section";
import { AppConfigModel } from "./app-config-model";
import { UserModel } from "./user";
import { DB } from "../../lib/db";
import { getSnapshot } from "mobx-state-tree";

describe("stores object", () => {

  it("supports creating dummy stores for testing", () => {
    const stores = specStores();
    expect(stores).toBeDefined();
    expect(stores.user).toBeDefined();
    expect(stores.problem).toBeDefined();
    expect(stores.ui).toBeDefined();
    expect(stores.db).toBeDefined();
  });

  it("supports passing in stores for testing", () => {
    const appConfig = AppConfigModel.create({ defaultUnit: "foo", config: {} as any });
    const appMode: AppMode = "dev";
    const id = "1";
    const name = "Colonel Mustard";
    const type = "student";
    const user = UserModel.create({ id, type, name });
    const title = "Test Problem";
    const problem = ProblemModel.create({ ordinal: 1, title });
    const db = new DB();
    const stores = specStores({ appConfig, appMode, user, problem, db });
    expect(stores.appConfig.defaultUnit).toBe("foo");
    expect(stores.appMode).toBe("dev");
    expect(stores.user.id).toBe(id);
    expect(stores.user.type).toBe(type);
    expect(stores.user.name).toBe(name);
    expect(stores.problem.title).toBe(title);
    expect(stores.db).toBe(db);
  });

});

describe("isFeatureSupported()", () => {

  function specIntroductionSection() {
    return SectionModel.create({ type: "introduction" });
  }

  it("defaults to true for arbitrary features", () => {
    const stores = specStores();
    expect(isFeatureSupported(stores, "foo")).toBe(true);
    expect(isFeatureSupported(stores, "foo", specIntroductionSection())).toBe(true);
  });

  it("can disable features at the unit level", () => {
    const stores = specStores({ unit: UnitModel.create({ title: "Unit", disabled: ["foo"] }) });
    expect(isFeatureSupported(stores, "foo")).toBe(false);
    expect(isFeatureSupported(stores, "foo", specIntroductionSection())).toBe(false);
  });

  it("can disable features at the investigation level", () => {
    const investigation = InvestigationModel.create({ ordinal: 1, title: "Investigation", disabled: ["foo"] });
    const stores = specStores({ investigation });
    expect(isFeatureSupported(stores, "foo")).toBe(false);
    expect(isFeatureSupported(stores, "foo", specIntroductionSection())).toBe(false);
  });

  it("can disable features at the problem level", () => {
    const problem = ProblemModel.create({ ordinal: 1, title: "Problem", disabled: ["baz", "foo"] });
    const stores = specStores({ problem });
    expect(isFeatureSupported(stores, "foo")).toBe(false);
    expect(isFeatureSupported(stores, "foo", specIntroductionSection())).toBe(false);
  });

  it("can disable features at the section level", () => {
    const section = SectionModel.create({ type: "introduction" as SectionType, disabled: ["foo"] });
    const problem = ProblemModel.create({ ordinal: 1, title: "Problem", sections: [getSnapshot(section)] });
    const stores = specStores({ problem });
    expect(isFeatureSupported(stores, "foo")).toBe(true);
    expect(isFeatureSupported(stores, "foo", section)).toBe(false);
  });

  it("can disable features at the unit level and reenable them at the problem level", () => {
    const unit = UnitModel.create({ title: "Unit", disabled: ["foo"] });
    const problem = ProblemModel.create({ ordinal: 1, title: "Problem", disabled: ["baz", "!foo"] });
    const stores = specStores({ unit, problem });
    console.log(`disabledFeatures: ${JSON.stringify(stores.appConfig.disabledFeatures)}`);
    expect(isFeatureSupported(stores, "foo")).toBe(true);
    expect(isFeatureSupported(stores, "foo", specIntroductionSection())).toBe(true);
  });

  it("can enable/disable features at every level", () => {
    const unit = UnitModel.create({ title: "Unit", disabled: ["foo"] });
    const investigation = InvestigationModel.create({ ordinal: 1, title: "Investigation", disabled: ["!foo"] });
    const section = SectionModel.create({ type: "introduction" as SectionType, disabled: ["bar", "baz", "!foo"] });
    const problem = ProblemModel.create(
                      { ordinal: 1, title: "Problem", disabled: ["foo"], sections: [getSnapshot(section)] });
    const stores = specStores({ unit, investigation, problem });
    expect(isFeatureSupported(stores, "foo")).toBe(false);
    expect(isFeatureSupported(stores, "foo", section)).toBe(true);
  });

});

describe("getDisabledFeaturesOfTile()", () => {

  it("returns empty array by default", () => {
    const stores = specStores();
    expect(getDisabledFeaturesOfTile(stores, "foo")).toEqual([]);
    expect(getDisabledFeaturesOfTile(stores, "foo", "introduction")).toEqual([]);
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
    const stores = specStores({ unit, investigation, problem });
    expect(getDisabledFeaturesOfTile(stores, "foo")).toEqual(["fooFeature1", "fooFeature3"]);
  });
});
