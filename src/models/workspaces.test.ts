import { WorkspaceModel, WorkspaceModelType, WorkspacesModel, WorkspacesModelType } from "./workspaces";
import { DocumentModel } from "./document";

describe("workspaces model", () => {
  let workspaces: WorkspacesModelType;
  let workspace: WorkspaceModelType;

  beforeEach(() => {
    workspace = WorkspaceModel.create({
      mode: "1-up",
      tool: "select",
      sectionId: "1",
      visibility: "public",
      userDocument: DocumentModel.create({
        uid: "1",
        key: "test",
        createdAt: 1,
        content: {}
      }),
      groupDocuments: {}
    });
    workspaces = WorkspacesModel.create({});
    workspaces.addWorkspace(workspace);
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
    workspace.toggleTool("select");
    expect(workspace.tool).toBe("select");
    workspace.toggleTool("select");
    expect(workspace.tool).toBe("select");
  });

  it("allows the text tool to be toggled", () => {
    workspace.toggleTool("text");
    expect(workspace.tool).toBe("text");
    workspace.toggleTool("text");
    expect(workspace.tool).toBe("select");
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
    expect(workspaces.getWorkspaceBySectionId("1")).toBe(workspace);
  });

  it("allows workspaces with new section ids to be added", () => {
    const newWorkspace = WorkspaceModel.create({
      mode: "1-up",
      tool: "select",
      sectionId: "2",
      visibility: "private",
      userDocument: DocumentModel.create({
        uid: "1",
        key: "test",
        createdAt: 1,
        content: {}
      }),
      groupDocuments: {},
    });
    workspaces.addWorkspace(newWorkspace);
    expect(workspaces.getWorkspaceBySectionId("2")).toBe(newWorkspace);
  });

  it("allows ignores adding workspaces with existing section ids", () => {
    const newWorkspace = WorkspaceModel.create({
      mode: "1-up",
      tool: "select",
      sectionId: "1",
      visibility: "private",
      userDocument: DocumentModel.create({
        uid: "1",
        key: "test",
        createdAt: 1,
        content: {}
      }),
      groupDocuments: {},
    });
    workspaces.addWorkspace(newWorkspace);
    expect(workspaces.getWorkspaceBySectionId("1")).toBe(workspace);
  });

});
