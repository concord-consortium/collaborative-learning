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
    settings: {},
    aiEvaluation: "custom",
    aiPrompt: {
      mainPrompt: "This is a picture of a student document.\n Please categorize it.",
      categorizationDescription: "The focus area of the document",
      categories: ["user", "environment", "form", "function"] as any,
      keyIndicatorsPrompt: "List of main features or elements of the document that support this categorization",
      discussionPrompt: "Any other relevant information.",
      systemPrompt: "You are a teaching assistant in a middle school science class."
    },
  } as UnitConfiguration;

  const baseSettings: Partial<UnitConfiguration> = {
    settings: {
      table: {
        numFormat: ".2~f",
        tools: [
          "set-expression",
          "link-tile",
          ["data-set-view", "DataCard"],
         ]
        }
    }
  };

  const unitSettings: Partial<UnitConfiguration> = {
    settings: {
      table: {
        tools: [
          "delete"
         ]
      }
    }
  };

  const mergedSettings = {
    table: {
      numFormat: ".2~f",
      tools: [
        "delete"
        ]
      }
  };

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

  it("merges settings", () => {
    const config = new ConfigurationManager(defaults, [baseSettings, unitSettings]);
    expect(config.settings).toEqual(mergedSettings);
  });

  it("should return aiEvaluation and aiPrompt from configuration when defined", () => {
    const config = new ConfigurationManager(defaults, [overrides]);
    expect(config.aiPrompt).toEqual({
      mainPrompt: "This is a picture of a student document.\n Please categorize it.",
      categorizationDescription: "The focus area of the document",
      categories: ["user", "environment", "form", "function"],
      keyIndicatorsPrompt: "List of main features or elements of the document that support this categorization",
      discussionPrompt: "Any other relevant information.",
      systemPrompt: "You are a teaching assistant in a middle school science class."
    });
    expect(config.aiEvaluation).toBe("custom");
  });

  it("should return undefined aiEvaluation and aiPrompt when not configured", () => {
    const config = new ConfigurationManager(defaults, []);
    expect(config.aiEvaluation).toBeUndefined();
    expect(config.aiPrompt).toBeUndefined();
  });

  it("should return commentTags when showCommentTag is true", () => {
    const defaultsWithCommentTags = {
      ...defaults,
      showCommentTag: true,
      commentTags: { "tag1": "Tag 1", "tag2": "Tag 2" }
    };
    const configManager = new ConfigurationManager(defaultsWithCommentTags, []);
    expect(configManager.commentTags).toEqual({ "tag1": "Tag 1", "tag2": "Tag 2" });
  });

  it("should return empty object when showCommentTag is false", () => {
    const defaultsWithoutCommentTags = {
      ...defaults,
      showCommentTag: false,
      commentTags: { "tag1": "Tag 1" }
    };
    const configManager = new ConfigurationManager(defaultsWithoutCommentTags, []);
    expect(configManager.commentTags).toEqual({});
  });

  it("should return undefined for groupDocumentsEnabled when not configured", () => {
    const configManager = new ConfigurationManager(defaults, []);
    expect(configManager.groupDocumentsEnabled).toBeUndefined();
  });

  it("should return true for groupDocumentsEnabled when set in config", () => {
    const configWithGroupDocs = {
      ...defaults,
      groupDocumentsEnabled: true
    };
    const configManager = new ConfigurationManager(configWithGroupDocs, []);
    expect(configManager.groupDocumentsEnabled).toBe(true);
  });

  it("should return groupDocumentsEnabled from override config", () => {
    const overrideWithGroupDocs: Partial<UnitConfiguration> = {
      groupDocumentsEnabled: true
    };
    const configManager = new ConfigurationManager(defaults, [overrideWithGroupDocs]);
    expect(configManager.groupDocumentsEnabled).toBe(true);
  });

  it("should return undefined for defaultSharedDocuments when not configured", () => {
    const configManager = new ConfigurationManager(defaults, []);
    expect(configManager.defaultSharedDocuments).toBeUndefined();
  });

  it("should return true for defaultSharedDocuments when set in config", () => {
    const configWithShared = { ...defaults, defaultSharedDocuments: true };
    const configManager = new ConfigurationManager(configWithShared, []);
    expect(configManager.defaultSharedDocuments).toBe(true);
  });

  it("should return false for defaultSharedDocuments when explicitly set to false", () => {
    const configWithShared = { ...defaults, defaultSharedDocuments: false };
    const configManager = new ConfigurationManager(configWithShared, []);
    expect(configManager.defaultSharedDocuments).toBe(false);
  });

  it("should return defaultSharedDocuments from override config", () => {
    const overrideWithShared: Partial<UnitConfiguration> = { defaultSharedDocuments: true };
    const configManager = new ConfigurationManager(defaults, [overrideWithShared]);
    expect(configManager.defaultSharedDocuments).toBe(true);
  });

  it("should return undefined for showTextTitles when not configured", () => {
    const configManager = new ConfigurationManager(defaults, []);
    expect(configManager.showTextTitles).toBeUndefined();
  });

  it("should return true for showTextTitles when set in config", () => {
    const configWithTitles = { ...defaults, showTextTitles: true };
    const configManager = new ConfigurationManager(configWithTitles, []);
    expect(configManager.showTextTitles).toBe(true);
  });

  it("should return showTextTitles from override config", () => {
    const overrideWithTitles: Partial<UnitConfiguration> = { showTextTitles: true };
    const configManager = new ConfigurationManager(defaults, [overrideWithTitles]);
    expect(configManager.showTextTitles).toBe(true);
  });

});
