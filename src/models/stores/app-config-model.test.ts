import { SectionModel } from "../curriculum/section";
import { AppConfigModel } from "./app-config-model";
import { unitConfigDefaults, unitConfigOverrides } from "../../test-fixtures/sample-unit-configurations";

describe("ConfigurationManager", () => {

  const excludeProps = ["defaultDocumentTemplate", "navTabs", "planningTemplate", "myResourcesToolbar"];
  type SimpleProps = Exclude<keyof typeof unitConfigDefaults, typeof excludeProps[number]>;
  const keys = Object.keys(unitConfigDefaults).filter(prop => !excludeProps.includes(prop)) as SimpleProps[];

  it("can be constructed with just unitConfigDefaults and return those unitConfigDefaults", () => {
    const appConfig = AppConfigModel.create({ config: unitConfigDefaults });
    keys.forEach((prop: SimpleProps) => {
      expect(appConfig[prop]).toEqual(unitConfigDefaults[prop]);
    });
    expect(appConfig.defaultDocumentTemplate).toBeUndefined();
    expect(appConfig.getSetting("foo")).toBeUndefined();
    expect(appConfig.getSetting("foo", "bar")).toBeUndefined();
  });

  it("can be constructed with unitConfigDefaults and unitConfigOverrides and return the unitConfigOverrides", () => {
    const appConfig = AppConfigModel.create({ config: unitConfigDefaults });
    appConfig.setConfigs([unitConfigOverrides]);
    keys.forEach((prop: SimpleProps) => {
      if (prop === "disabledFeatures") {
        // disabledFeatures are merged
        expect(appConfig[prop]).toEqual(["foo", "bar"]);
      }
      else {
        expect(appConfig[prop]).toEqual(unitConfigOverrides[prop]);
      }
    });
    expect(appConfig.defaultDocumentTemplate).toBeUndefined();
    const section = SectionModel.create({ type: "intro" });
    expect(appConfig.getDisabledFeaturesOfSection(section)).toEqual(["foo", "bar"]);
    expect(appConfig.getDisabledFeaturesOfTile("", section)).toEqual(["foo", "bar"]);
    expect(appConfig.getDisabledFeaturesOfTile("Tile", section)).toEqual([]);
    expect(appConfig.isFeatureSupported("foo")).toBe(false);
    expect(appConfig.isFeatureSupported("baz")).toBe(true);
  });

  it("can be constructed with no props", () => {
    const model = AppConfigModel.create();
    expect(model.config).toBeUndefined();
  });

  it("should return aiEvaluation and aiPrompt from configuration when defined", () => {
    const appConfig = AppConfigModel.create({ config: unitConfigDefaults });
    appConfig.setConfigs([unitConfigOverrides]);
    expect(appConfig.aiPrompt).toEqual({
      mainPrompt: "This is a picture of a student document.\n Please categorize it.",
      categorizationDescription: "The focus area of the document",
      categories: ["user", "environment", "form", "function"],
      keyIndicatorsPrompt: "List of main features or elements of the document that support this categorization",
      discussionPrompt: "Any other relevant information.",
      systemPrompt: "You are a teaching assistant in a middle school science class."
    });
    expect(appConfig.aiEvaluation).toEqual("custom");
  });

  it("should return undefined aiEvaluation and aiPrompt when not configured", () => {
    const appConfig = AppConfigModel.create({ config: unitConfigDefaults });
    expect(appConfig.aiPrompt).toBeUndefined();
    expect(appConfig.aiEvaluation).toBeUndefined();
  });

});
