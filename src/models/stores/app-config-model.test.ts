import { SectionModel } from "../curriculum/section";
import { AppConfigModel } from "./app-config-model";
import { UnitConfiguration } from "./unit-configuration";

describe("ConfigurationManager", () => {

  const defaults: UnitConfiguration = {
    appName: "Test",
    pageTitle: "Test Page Title",
    demoProblemTitle: "Demo Problem Title",
    defaultProblemOrdinal: "1.1",
    autoAssignStudentsToIndividualGroups: false,
    defaultDocumentType: "personal",
    defaultDocumentTitle: "Untitled Document",
    docTimeStampPropertyName: "timeStamp",
    docDisplayIdPropertyName: "displayId",
    defaultDocumentTemplate: undefined,
    defaultLearningLogTitle: "Default LL Title",
    initialLearningLogTitle: "Initial LL Title",
    defaultLearningLogDocument: false,
    autoSectionProblemDocuments: false,
    documentLabelProperties: [] as any,
    documentLabels: {},
    disablePublish: [] as any,
    copyPreferOriginTitle: true,
    disableTileDrags: true,
    showClassSwitcher: false,
    supportStackedTwoUpView: false,
    showPublishedDocsInPrimaryWorkspace: false,
    comparisonPlaceholderContent: "foo",
    navTabs: {} as any,
    disabledFeatures: ["foo"],
    toolbar: [] as any,
    placeholderText: "Placeholder Text",
    stamps: [] as any,
    settings: {}
  } as UnitConfiguration;

  const overrides: UnitConfiguration = {
    appName: "New Test",
    pageTitle: "New Test Page Title",
    demoProblemTitle: "New Demo Problem Title",
    defaultProblemOrdinal: "9.9",
    autoAssignStudentsToIndividualGroups: true,
    defaultDocumentType: "problem",
    defaultDocumentTitle: "Untitled Problem",
    docTimeStampPropertyName: "dateStamp",
    docDisplayIdPropertyName: "displayIdName",
    defaultDocumentTemplate: undefined,
    defaultLearningLogTitle: "New Default LL Title",
    initialLearningLogTitle: "New Initial LL Title",
    defaultLearningLogDocument: true,
    autoSectionProblemDocuments: true,
    documentLabelProperties: [] as any,
    documentLabels: {},
    disablePublish: [] as any,
    copyPreferOriginTitle: false,
    disableTileDrags: false,
    showClassSwitcher: true,
    supportStackedTwoUpView: true,
    showPublishedDocsInPrimaryWorkspace: true,
    comparisonPlaceholderContent: "bar",
    navTabs: {} as any,
    disabledFeatures: ["bar"],
    toolbar: [] as any,
    placeholderText: "New Placeholder Text",
    stamps: [] as any,
    settings: {}
  } as UnitConfiguration;

  type SimpleProps = Exclude<keyof typeof defaults, "defaultDocumentTemplate" | "navTabs">;
  const excludeProps = ["defaultDocumentTemplate", "navTabs"];
  const keys = Object.keys(defaults).filter(prop => !excludeProps.includes(prop)) as SimpleProps[];

  it("can be constructed with just defaults and return those defaults", () => {
    const appConfig = AppConfigModel.create({ config: defaults });
    keys.forEach((prop: SimpleProps) => {
      expect(appConfig[prop]).toEqual(defaults[prop]);
    });
    expect(appConfig.hasDefaultDocumentTemplate).toBe(false);
    expect(appConfig.getSetting("foo")).toBeUndefined();
    expect(appConfig.getSetting("foo", "bar")).toBeUndefined();
  });

  it("can be constructed with defaults and overrides and return the overrides", () => {
    const appConfig = AppConfigModel.create({ config: defaults });
    appConfig.setConfigs([overrides]);
    keys.forEach((prop: SimpleProps) => {
      if (prop === "disabledFeatures") {
        // disabledFeatures are merged
        expect(appConfig[prop]).toEqual(["foo", "bar"]);
      }
      else {
        expect(appConfig[prop]).toEqual(overrides[prop]);
      }
    });
    expect(appConfig.hasDefaultDocumentTemplate).toBe(false);
    const section = SectionModel.create({ type: "intro" });
    expect(appConfig.getDisabledFeaturesOfSection(section)).toEqual(["foo", "bar"]);
    expect(appConfig.getDisabledFeaturesOfTile("", section)).toEqual(["foo", "bar"]);
    expect(appConfig.getDisabledFeaturesOfTile("Tile", section)).toEqual([]);
    expect(appConfig.isFeatureSupported("foo")).toBe(false);
    expect(appConfig.isFeatureSupported("baz")).toBe(true);
  });

  it("can look up a unit by id", () => {
    const appConfig = AppConfigModel.create({
      config: defaults,
      units: { example: { content: "curriculum/example-curriculum/example-curriculum.json" } },
      defaultUnit: "example"
    });
    expect(appConfig.getUnit("foo")).toBeUndefined();
    expect(appConfig.getUnitBasePath("foo")).toBe("");
    expect(appConfig.getUnit("example")).toBeDefined();
    expect(appConfig.getUnitBasePath("example")).toBe("curriculum/example-curriculum");
  });

  it("can manage default document settings", () => {
    const appConfig = AppConfigModel.create({ config: defaults });
    expect(appConfig.defaultDocumentContent).toBeDefined();
    expect(appConfig.defaultDocumentSpec.type).toBe(appConfig.defaultDocumentType);
    expect(appConfig.getDocumentLabel("personal")).toBe("");
  });
});
