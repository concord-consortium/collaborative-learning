import { UIModel, UIModelType, UIDialogModelType } from "./ui";
import { SectionModel, SectionType } from "./curriculum/section";
import { SectionWorkspaceModel } from "./workspaces";
import { DocumentModel } from "./document";
import { ToolTileModel } from "./tools/tool-tile";

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
    expect(ui.dialog).toBe(undefined);
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

  it("allows all components to be contracted", () => {
    ui.toggleLeftNav();
    expect(ui.allContracted).toBe(false);
    ui.contractAll();
    expect(ui.allContracted).toBe(true);
  });

  it("allows error to be set", () => {
    const error = "the sky is falling!";
    ui.setError(error);
    expect(ui.error).toBe(error);
    ui.setError(null);
    expect(ui.error).toBe(null);
  });

  it("allows activeSection to be set", () => {
    SectionModel.create({
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

  it("allows available workspace to be set", () => {
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
    ui.setAvailableWorkspace(workspace);
    expect(ui.primaryWorkspaceDocumentKey).toBe("test");
    ui.setAvailableWorkspace(undefined);
    ui.toggleComparisonWorkspaceVisible();
    ui.setAvailableWorkspace(workspace);
    expect(ui.primaryWorkspaceDocumentKey).toBe(undefined);
    expect(ui.comparisonWorkspaceDocumentKey).toBe("test");
  });

  it("allows ComparisonWorkspace to be set", () => {
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
    ui.setComparisonWorkspace(workspace);
    expect(ui.comparisonWorkspaceDocumentKey).toBe("test");
    ui.setComparisonWorkspace(undefined);
    expect(ui.comparisonWorkspaceDocumentKey).toBe(undefined);
  });

  it("allows comparisonWorkspaceVisible to be set", () => {
    ui.toggleComparisonWorkspaceVisible();
    expect(ui.comparisonWorkspaceVisible).toBe(true);
    ui.toggleComparisonWorkspaceVisible();
    expect(ui.comparisonWorkspaceVisible).toBe(false);
    ui.toggleComparisonWorkspaceVisible(true);
    expect(ui.comparisonWorkspaceVisible).toBe(true);
    ui.toggleComparisonWorkspaceVisible(false);
    expect(ui.comparisonWorkspaceVisible).toBe(false);
  });

  it("allows llPrimaryWorkspace to be set", () => {
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
    ui.setLLPrimaryWorkspace(workspace);
    expect(ui.llPrimaryWorkspaceDocumentKey).toBe("test");
    ui.setLLPrimaryWorkspace(undefined);
    expect(ui.llPrimaryWorkspaceDocumentKey).toBe(undefined);
  });

  it("allows LL available workspace to be set", () => {
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
    ui.setAvailableLLWorkspace(workspace);
    expect(ui.llPrimaryWorkspaceDocumentKey).toBe("test");
    ui.setAvailableLLWorkspace(undefined);
    ui.toggleLLComparisonWorkspaceVisible();
    ui.setAvailableLLWorkspace(workspace);
    expect(ui.llPrimaryWorkspaceDocumentKey).toBe(undefined);
    expect(ui.llComparisonWorkspaceDocumentKey).toBe("test");
  });

  it("allows llComparisonWorkspace to be set", () => {
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
    ui.setLLComparisonWorkspace(workspace);
    expect(ui.llComparisonWorkspaceDocumentKey).toBe("test");
    ui.setLLComparisonWorkspace(undefined);
    expect(ui.llComparisonWorkspaceDocumentKey).toBe(undefined);
  });

  it("allows llComparisonWorkspaceVisible to be set", () => {
    ui.toggleLLComparisonWorkspaceVisible();
    expect(ui.llComparisonWorkspaceVisible).toBe(true);
    ui.toggleLLComparisonWorkspaceVisible();
    expect(ui.llComparisonWorkspaceVisible).toBe(false);
    ui.toggleLLComparisonWorkspaceVisible(true);
    expect(ui.llComparisonWorkspaceVisible).toBe(true);
    ui.toggleLLComparisonWorkspaceVisible(false);
    expect(ui.llComparisonWorkspaceVisible).toBe(false);
  });

  it("allows demo creator to be shown", () => {
    expect(ui.showDemoCreator).toBe(false);
    ui.setShowDemoCreator(true);
    expect(ui.showDemoCreator).toBe(true);
  });

  it("allows selected tile to be set", () => {
    expect(ui.selectedTileId).toBe(undefined);
    ui.setSelectedTile(ToolTileModel.create({
      id: "1",
      content: {
        type: "Text",
        text: "test"
      }
    }));
    expect(ui.selectedTileId).toBe("1");
    ui.setSelectedTile();
    expect(ui.selectedTileId).toBe(undefined);
  });

  it("allows alert dialogs", () => {
    expect(ui.dialog).toBe(undefined);
    ui.alert("alert test");
    let dialog = ui.dialog as UIDialogModelType;
    expect(ui.dialog).not.toBe(undefined);
    expect(dialog.type).toBe("alert");
    expect(dialog.text).toBe("alert test");
    expect(dialog.title).toBe(undefined);

    ui.alert("alert test", "Test Alert Title");
    dialog = ui.dialog as UIDialogModelType;
    expect(dialog.title).toBe("Test Alert Title");
  });

  it("allows comfirm dialogs", () => {
    expect(ui.dialog).toBe(undefined);
    ui.confirm("confirm test");
    let dialog = ui.dialog as UIDialogModelType;
    expect(ui.dialog).not.toBe(undefined);
    expect(dialog.type).toBe("confirm");
    expect(dialog.text).toBe("confirm test");
    expect(dialog.title).toBe(undefined);

    ui.confirm("confirm test", "Test Confirm Title");
    dialog = ui.dialog as UIDialogModelType;
    expect(dialog.title).toBe("Test Confirm Title");
  });

  it("allows prompt dialogs", () => {
    expect(ui.dialog).toBe(undefined);
    ui.prompt("prompt test");
    expect(ui.dialog).not.toBe(undefined);
    let dialog = ui.dialog as UIDialogModelType;
    expect(dialog.type).toBe("prompt");
    expect(dialog.text).toBe("prompt test");
    expect(dialog.defaultValue).toBe("");
    expect(dialog.title).toBe(undefined);

    ui.prompt("prompt test", "default value");
    dialog = ui.dialog as UIDialogModelType;
    expect(dialog.defaultValue).toBe("default value");
    expect(dialog.title).toBe(undefined);

    ui.prompt("prompt test", undefined, "Test Prompt Title");
    dialog = ui.dialog as UIDialogModelType;
    expect(dialog.title).toBe("Test Prompt Title");
  });
});
