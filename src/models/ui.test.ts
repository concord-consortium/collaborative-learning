import { UIModel, UIModelType } from "./ui";
import { SectionModel, SectionType } from "./curriculum/section";
import { SectionWorkspaceModel } from "./workspaces";
import { DocumentModel } from "./document";

describe("ui model", () => {
  let ui: UIModelType;

  beforeEach(() => {
    ui = UIModel.create({});
  });

  it("has default values", () => {
    expect(ui.allContracted).toBe(true);
    expect(ui.rightNavExpanded).toBe(false);
    expect(ui.leftNavExpanded).toBe(false);
    expect(ui.bottomNavExpanded).toBe(false);
    expect(ui.error).toBe(null);
    expect(ui.activeSectionIndex).toBe(0);
    expect(ui.activeRightNavTab).toBe("My Work");
    expect(ui.showDemoCreator).toBe(false);
  });

  it("uses overtide values", () => {
    ui = UIModel.create({
      rightNavExpanded: true,
      showDemoCreator: true,
      error: "test"
    });
    expect(ui.allContracted).toBe(false);
    expect(ui.rightNavExpanded).toBe(true);
    expect(ui.leftNavExpanded).toBe(false);
    expect(ui.bottomNavExpanded).toBe(false);
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

  it("allows the right nav to be toggled", () => {
    ui.toggleRightNav();
    expect(ui.allContracted).toBe(false);
    expect(ui.rightNavExpanded).toBe(true);
    ui.toggleRightNav();
    expect(ui.allContracted).toBe(true);
    expect(ui.rightNavExpanded).toBe(false);
  });

  it("allows the right nav to be explicitly set", () => {
    ui.toggleRightNav(false);
    expect(ui.allContracted).toBe(true);
    expect(ui.rightNavExpanded).toBe(false);
    ui.toggleRightNav(true);
    expect(ui.allContracted).toBe(false);
    expect(ui.rightNavExpanded).toBe(true);
  });

  it("allows bottom nav to be toggled", () => {
    ui.toggleBottomNav();
    expect(ui.allContracted).toBe(false);
    expect(ui.bottomNavExpanded).toBe(true);
    ui.toggleBottomNav();
    expect(ui.allContracted).toBe(true);
    expect(ui.bottomNavExpanded).toBe(false);
  });

  it("allows bottom nav to be explicitly set", () => {
    ui.toggleBottomNav(false);
    expect(ui.allContracted).toBe(true);
    expect(ui.bottomNavExpanded).toBe(false);
    ui.toggleBottomNav(true);
    expect(ui.allContracted).toBe(false);
    expect(ui.bottomNavExpanded).toBe(true);
  });

  it("only allows some components to be expanded at a time", () => {
    ui.toggleLeftNav();
    expect(ui.leftNavExpanded).toBe(true);
    expect(ui.rightNavExpanded).toBe(false);
    expect(ui.bottomNavExpanded).toBe(false);

    ui.toggleRightNav();
    expect(ui.leftNavExpanded).toBe(false);
    expect(ui.rightNavExpanded).toBe(true);
    expect(ui.bottomNavExpanded).toBe(false);

    ui.toggleBottomNav();
    expect(ui.leftNavExpanded).toBe(false);
    expect(ui.rightNavExpanded).toBe(true);
    expect(ui.bottomNavExpanded).toBe(true);
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

  it("allows activeRightNavTab to be set", () => {
    const activeRightNavTab = "M";
    ui.setActiveRightNavTab(activeRightNavTab);
    expect(ui.activeRightNavTab).toBe(activeRightNavTab);
  });

  it("allows primaryWorkspace to be set", () => {
    const workspace = SectionWorkspaceModel.create({
      mode: "1-up",
      tool: "select",
      sectionId: "1",
      visibility: "public",
      document: DocumentModel.create({
        uid: "1",
        key: "test",
        createdAt: 1,
        content: {}
      }),
      groupDocuments: {},
    });
    ui.setPrimaryWorkspace(workspace);
    expect(ui.primaryWorkspaceDocumentKey).toBe("test");
    ui.setPrimaryWorkspace(undefined);
    expect(ui.primaryWorkspaceDocumentKey).toBe(undefined);
  });

});
