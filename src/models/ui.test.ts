import { UIModel, UIModelType } from "./ui";
import { SectionModel, SectionType } from "./section";

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
    expect(ui.activeSection).toBe(null);
    expect(ui.activeLearningLogTab).toBe("LL");
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
      id: SectionType.introduction,
      type: SectionType.introduction
    });
    ui.setActiveSection(section);
    expect(ui.activeSection).toBe(section);
    ui.setActiveSection(null);
    expect(ui.activeSection).toBe(null);
  });

  it("allows activeLearningLogTab to be set", () => {
    const activeLearningLogTab = "M";
    ui.setActiveLearningLogTab(activeLearningLogTab);
    expect(ui.activeLearningLogTab).toBe(activeLearningLogTab);
  });

});
