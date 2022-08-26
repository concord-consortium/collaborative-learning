import { ConfigurationManager } from "./configuration-manager";
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

  const keys = Object.keys(defaults) as Array<keyof typeof defaults>;

  it("can be constructed with just defaults and return those defaults", () => {
    const config = new ConfigurationManager(defaults, []);
    keys.forEach((prop: keyof typeof defaults) => {
      expect(config[prop]).toEqual(defaults[prop]);
    });
  });

  it("can be constructed with defaults and overrides and return the overrides", () => {
    const config = new ConfigurationManager(defaults, [overrides]);
    keys.forEach((prop: keyof typeof defaults) => {
      if (prop === "disabledFeatures") {
        // disabledFeatures are merged
        expect(config[prop]).toEqual(["foo", "bar"]);
      }
      else {
        expect(config[prop]).toEqual(overrides[prop]);
      }
    });
  });
});
