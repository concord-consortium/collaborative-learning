import { SectionModel } from "../curriculum/section";
import { AppConfigModel } from "./app-config-model";
import { unitConfigDefaults, unitConfigOverrides } from "../../test-fixtures/sample-unit-configurations";

describe("ConfigurationManager", () => {

  const excludeProps = ["defaultDocumentTemplate", "navTabs", "planningTemplate"];
  type SimpleProps = Exclude<keyof typeof unitConfigDefaults, typeof excludeProps[number]>;
  const keys = Object.keys(unitConfigDefaults).filter(prop => !excludeProps.includes(prop)) as SimpleProps[];

  it("can be constructed with just unitConfigDefaults and return those unitConfigDefaults", () => {
    const appConfig = AppConfigModel.create({ curriculumBaseUrl: "https://curriculum.example.com", config: unitConfigDefaults });
    keys.forEach((prop: SimpleProps) => {
      expect(appConfig[prop]).toEqual(unitConfigDefaults[prop]);
    });
    expect(appConfig.defaultDocumentTemplate).toBeUndefined();
    expect(appConfig.getSetting("foo")).toBeUndefined();
    expect(appConfig.getSetting("foo", "bar")).toBeUndefined();
  });

  it("can be constructed with unitConfigDefaults and unitConfigOverrides and return the unitConfigOverrides", () => {
    const appConfig = AppConfigModel.create({ curriculumBaseUrl: "https://curriculum.example.com", config: unitConfigDefaults });
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

  describe("unit handling", () => {
    const getAppConfig = () => AppConfigModel.create({
      curriculumBaseUrl: "https://curriculum.example.com",
      config: unitConfigDefaults
    });

    it("can get URLs for remote curriculum content from a unit code", () => {
      const appConfig = getAppConfig();
      const exampleUnitCode = "example-unit-code";
      const exampleUnit = {
        "content": `https://curriculum.example.com/branch/main/${exampleUnitCode}/content.json`,
        "guide": `https://curriculum.example.com/branch/main/${exampleUnitCode}/teacher-guide/content.json`
      };
      expect(appConfig.getUnit(exampleUnitCode)).toStrictEqual(exampleUnit);
      expect(appConfig.getUnitBasePath(exampleUnitCode)).toBe(exampleUnitCode);
    });

    it("can get URLs for remote curriculum content from a unit URL", () => {
      const appConfig = getAppConfig();
      const exampleUnitUrl = "https://concord.org/content.json";
      const exampleUnit = {
        "content": "https://concord.org/content.json",
        "guide": "https://concord.org/teacher-guide/content.json"
      };
      expect(appConfig.getUnit(exampleUnitUrl)).toStrictEqual(exampleUnit);
      // FIXME: This is probably a bug because this base path is used to compute the location of some images
      // by tacking on an /images/... to this base path.
      // With the current code it means the computed URL would be something like:
      //   https://concord.org/content.json/images/...
      expect(appConfig.getUnitBasePath(exampleUnitUrl)).toBe(exampleUnitUrl);
    });

  });
});
