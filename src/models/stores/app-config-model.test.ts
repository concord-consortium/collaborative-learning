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

  it("should return true for enabled comment roles", () => {
    const appConfig = AppConfigModel.create({
      config: { ...unitConfigDefaults, enableCommentRoles: ["student", "teacher"] }
    });
    expect(appConfig.showCommentPanelFor("student")).toBe(true);
    expect(appConfig.showCommentPanelFor("teacher")).toBe(true);
  });

  it("should return false for disabled comment roles", () => {
    const appConfig = AppConfigModel.create({
      config: { ...unitConfigDefaults, enableCommentRoles: ["student"] }
    });
    expect(appConfig.showCommentPanelFor("teacher")).toBe(false);
    expect(appConfig.showCommentPanelFor("researcher")).toBe(false);
  });

  it("should return false for undefined user type", () => {
    const appConfig = AppConfigModel.create({ config: unitConfigDefaults });
    expect(appConfig.showCommentPanelFor(undefined)).toBeUndefined();
  });

  it("should return placeholder for specific container type", () => {
    const appConfig = AppConfigModel.create({
      config: {
        ...unitConfigDefaults,
        placeholder: { "QuestionContent": "Question placeholder", "default": "Default placeholder" }
      }
    });
    expect(appConfig.getPlaceholder("QuestionContent")).toBe("Question placeholder");
  });

  it("should return default placeholder for DocumentContent", () => {
    const appConfig = AppConfigModel.create({
      config: {
        ...unitConfigDefaults,
        placeholder: { "default": "Default placeholder" }
      }
    });
    expect(appConfig.getPlaceholder("DocumentContent")).toBe("Default placeholder");
  });

  it("should return undefined for non-existent container type", () => {
    const appConfig = AppConfigModel.create({ config: unitConfigDefaults });
    expect(appConfig.getPlaceholder("NonExistent")).toBeUndefined();
  });

  it("should show annotation controls when annotations are enabled", () => {
    const appConfig = AppConfigModel.create({
      config: { ...unitConfigDefaults, annotations: "all" }
    });
    expect(appConfig.showAnnotationControls).toBe(true);
  });

  it("should hide annotation controls when annotations are 'none'", () => {
    const appConfig = AppConfigModel.create({
      config: { ...unitConfigDefaults, annotations: "none" }
    });
    expect(appConfig.showAnnotationControls).toBe(false);
  });

  it("should show annotation controls when toolbar has hide-annotations button", () => {
    const appConfig = AppConfigModel.create({
      config: {
        ...unitConfigDefaults,
        annotations: "none",
        toolbar: [{
          id: "hide-annotations",
          title: "Hide Annotations",
          iconId: "icon-hide-annotations",
          isTileTool: false
        }]
      }
    });
    expect(appConfig.showAnnotationControls).toBe(true);
  });

  describe("getCustomLabel", () => {
    it("should return the label itself when no customLabels is provided", () => {
      const appConfig = AppConfigModel.create({ config: unitConfigDefaults });
      expect(appConfig.getCustomLabel("Group")).toBe("Group");
      expect(appConfig.getCustomLabel("Name")).toBe("Name");
      expect(appConfig.getCustomLabel("AnyLabel")).toBe("AnyLabel");
    });

    it("should return the label itself when customLabels does not have a mapping", () => {
      const appConfig = AppConfigModel.create({
        config: {
          ...unitConfigDefaults,
          customLabels: {
            "Other": "Something"
          }
        }
      });
      expect(appConfig.getCustomLabel("Group")).toBe("Group");
    });

    it("should return custom label when customLabels has a mapping", () => {
      const appConfig = AppConfigModel.create({
        config: {
          ...unitConfigDefaults,
          customLabels: {
            "Group": "Team",
            "Name": "Participant"
          }
        }
      });
      expect(appConfig.getCustomLabel("Group")).toBe("Team");
      expect(appConfig.getCustomLabel("Name")).toBe("Participant");
    });

    it("should return customLabels property", () => {
      const appConfig = AppConfigModel.create({
        config: {
          ...unitConfigDefaults,
          customLabels: {
            "Group": "Team"
          }
        }
      });
      expect(appConfig.customLabels).toEqual({ "Group": "Team" });
    });
  });

});
