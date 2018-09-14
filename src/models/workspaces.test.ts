import { SectionWorkspaceModel, SectionWorkspaceModelType, WorkspacesModel, WorkspacesModelType } from "./workspaces";
import { DocumentModel } from "./document";

describe("workspaces model", () => {
  let workspaces: WorkspacesModelType;
  let workspace: SectionWorkspaceModelType;

  beforeEach(() => {
    workspace = SectionWorkspaceModel.create({
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
    workspaces = WorkspacesModel.create({});
    workspaces.addSectionWorkspace(workspace);
  });

  it("has default values", () => {
    expect(workspace.mode).toBe("1-up");
    expect(workspace.tool).toBe("select");
  });

  it("allows the mode to be toggled", () => {
    workspace.toggleMode();
    expect(workspace.mode).toBe("4-up");
    workspace.toggleMode();
    expect(workspace.mode).toBe("1-up");
  });

  it("allows the mode to be explicitly set", () => {
    workspace.toggleMode("1-up");
    expect(workspace.mode).toBe("1-up");
    workspace.toggleMode("4-up");
    expect(workspace.mode).toBe("4-up");
  });

  it("allows the select tool to be toggled", () => {
    workspace.selectTool("select");
    expect(workspace.tool).toBe("select");
    workspace.selectTool("select");
    expect(workspace.tool).toBe("select");
  });

  it("allows the text tool to be toggled", () => {
    workspace.selectTool("text");
    expect(workspace.tool).toBe("text");
    workspace.selectTool("text");
    expect(workspace.tool).toBe("text");
  });

  it("allows the visibility to be toggled", () => {
    workspace.toggleVisibility();
    expect(workspace.visibility).toBe("private");
    workspace.toggleVisibility();
    expect(workspace.visibility).toBe("public");
  });

  it("allows the visibility to be explicity set", () => {
    workspace.toggleVisibility("public");
    expect(workspace.visibility).toBe("public");
    workspace.toggleVisibility("private");
    expect(workspace.visibility).toBe("private");
  });

  it("allows workspaces to be found by section id", () => {
    expect(workspaces.getSectionWorkspace("1")).toBe(workspace);
  });

  it("allows workspaces with new section ids to be added", () => {
    const newWorkspace = SectionWorkspaceModel.create({
      mode: "1-up",
      tool: "select",
      sectionId: "2",
      visibility: "private",
      document: DocumentModel.create({
        uid: "1",
        key: "test",
        createdAt: 1,
        content: {}
      }),
      groupDocuments: {},
    });
    workspaces.addSectionWorkspace(newWorkspace);
    expect(workspaces.getSectionWorkspace("2")).toBe(newWorkspace);
  });

  it("allows ignores adding workspaces with existing section ids", () => {
    const newWorkspace = SectionWorkspaceModel.create({
      mode: "1-up",
      tool: "select",
      sectionId: "1",
      visibility: "private",
      document: DocumentModel.create({
        uid: "1",
        key: "test",
        createdAt: 1,
        content: {}
      }),
      groupDocuments: {},
    });
    workspaces.addSectionWorkspace(newWorkspace);
    expect(workspaces.getSectionWorkspace("1")).toBe(workspace);
  });

});
