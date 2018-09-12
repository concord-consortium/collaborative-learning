import { UIModel, UIModelType } from "./ui";
import { SectionModel, SectionType } from "./curriculum/section";

describe("ui model", () => {
  let ui: UIModelType;

  beforeEach(() => {
    ui = UIModel.create({});
  });

  it("has default values", () => {
    expect(ui.allContracted).toBe(true);
    expect(ui.learningLogExpanded).toBe(false);
    expect(ui.leftNavExpanded).toBe(false);
    expect(ui.myWorkExpanded).toBe(false);
    expect(ui.error).toBe(null);
    expect(ui.activeSectionIndex).toBe(0);
    expect(ui.activeLearningLogTab).toBe("LL");
    expect(ui.showDemoCreator).toBe(false);
  });

  it("uses overtide values", () => {
    ui = UIModel.create({
      learningLogExpanded: true,
      showDemoCreator: true,
      error: "test"
    });
    expect(ui.allContracted).toBe(false);
    expect(ui.learningLogExpanded).toBe(true);
    expect(ui.leftNavExpanded).toBe(false);
    expect(ui.myWorkExpanded).toBe(false);
    expect(ui.error).toBe("test");
    expect(ui.showDemoCreator).toBe(true);
  });

  it("allows the left nav to be toggled", () => {
    ui.toggleLeftNav();
    expect(ui.allContracted).toBe(false);
    expect(ui.leftNavExpanded).toBe(true);
    ui.toggleLeftNav();
    expect(ui.allContracted).toBe(true);
    expect(ui.leftNavExpanded).toBe(false);
  });

  it("allows the left nav to be explicitly set", () => {
    ui.toggleLeftNav(false);
    expect(ui.allContracted).toBe(true);
    expect(ui.leftNavExpanded).toBe(false);
    ui.toggleLeftNav(true);
    expect(ui.allContracted).toBe(false);
    expect(ui.leftNavExpanded).toBe(true);
  });

  it("allows the learning log to be toggled", () => {
    ui.toggleLearningLog();
    expect(ui.allContracted).toBe(false);
    expect(ui.learningLogExpanded).toBe(true);
    ui.toggleLearningLog();
    expect(ui.allContracted).toBe(true);
    expect(ui.learningLogExpanded).toBe(false);
  });

  it("allows the learning log to be explicitly set", () => {
    ui.toggleLearningLog(false);
    expect(ui.allContracted).toBe(true);
    expect(ui.learningLogExpanded).toBe(false);
    ui.toggleLearningLog(true);
    expect(ui.allContracted).toBe(false);
    expect(ui.learningLogExpanded).toBe(true);
  });

  it("allows my work to be toggled", () => {
    ui.toggleMyWork();
    expect(ui.allContracted).toBe(false);
    expect(ui.myWorkExpanded).toBe(true);
    ui.toggleMyWork();
    expect(ui.allContracted).toBe(true);
    expect(ui.myWorkExpanded).toBe(false);
  });

  it("allows my work to be explicitly set", () => {
    ui.toggleMyWork(false);
    expect(ui.allContracted).toBe(true);
    expect(ui.myWorkExpanded).toBe(false);
    ui.toggleMyWork(true);
    expect(ui.allContracted).toBe(false);
    expect(ui.myWorkExpanded).toBe(true);
  });

  it("only allows one component to be expanded at a time", () => {
    ui.toggleLeftNav();
    expect(ui.leftNavExpanded).toBe(true);
    expect(ui.learningLogExpanded).toBe(false);
    expect(ui.myWorkExpanded).toBe(false);

    ui.toggleLearningLog();
    expect(ui.leftNavExpanded).toBe(false);
    expect(ui.learningLogExpanded).toBe(true);
    expect(ui.myWorkExpanded).toBe(false);

    ui.toggleMyWork();
    expect(ui.leftNavExpanded).toBe(false);
    expect(ui.learningLogExpanded).toBe(false);
    expect(ui.myWorkExpanded).toBe(true);
  });

  it("allows error to be set", () => {
    const error = "the sky is falling!";
    ui.setError(error);
    expect(ui.error).toBe(error);
    ui.setError(null);
    expect(ui.error).toBe(null);
  });

  it("allows activeSection to be set", () => {
    const section = SectionModel.create({
      type: SectionType.introduction
    });
    ui.setActiveSectionIndex(1);
    expect(ui.activeSectionIndex).toBe(1);
    ui.setActiveSectionIndex(0);
    expect(ui.activeSectionIndex).toBe(0);
  });

  it("allows activeLearningLogTab to be set", () => {
    const activeLearningLogTab = "M";
    ui.setActiveLearningLogTab(activeLearningLogTab);
    expect(ui.activeLearningLogTab).toBe(activeLearningLogTab);
  });

  it("allows activeWorkspaceSectionId to be set", () => {
    const activeWorkspaceSectionId = "1";
    ui.setActiveWorkspaceSectionId(activeWorkspaceSectionId);
    expect(ui.activeWorkspaceSectionId).toBe(activeWorkspaceSectionId);
    ui.setActiveWorkspaceSectionId(undefined);
    expect(ui.activeWorkspaceSectionId).toBe(undefined);
  });

});
