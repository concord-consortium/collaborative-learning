import { types } from "mobx-state-tree";
import { DocumentModel } from "./document";

export const WorkspaceModeEnum = types.enumeration("mode", ["1-up", "4-up"]);
export type WorkspaceMode = typeof WorkspaceModeEnum.Type;

export const WorkspaceToolEnum = types.enumeration("tool", ["geometry", "select", "text"]);
export type WorkspaceTool = typeof WorkspaceToolEnum.Type;

export const WorkspaceModel = types
  .model("Workspace", {
    mode: WorkspaceModeEnum,
    tool: WorkspaceToolEnum,
    sectionId: types.string,
    userDocument: DocumentModel,
    groupDocuments: types.array(DocumentModel),
    visibility: types.enumeration("VisibilityType", ["public", "private"]),
  })
  .actions((self) => {
    return {
      toggleMode(override?: WorkspaceMode) {
        self.mode = typeof override === "undefined"
          ? (self.mode === "1-up" ? "4-up" : "1-up")
          : override;
      },

      toggleTool(tool: WorkspaceTool) {
        self.tool = tool === self.tool ? "select" : tool;
        switch (tool) {
          case "geometry":
            self.userDocument.content.addGeometryTile();
            break;
          case "text":
            self.userDocument.content.addTextTile();
            break;
        }
      },

      toggleVisibility(overide?: "public" | "private") {
        self.visibility = typeof overide === "undefined"
          ? (self.visibility === "public" ? "private" : "public")
          : overide;
      }
    };
  });

export const WorkspacesModel = types
  .model("Workspaces", {
    workspaces: types.array(WorkspaceModel)
  })
  .actions((self) => {
    const getWorkspaceBySectionId = (sectionId: string) => {
      return self.workspaces.find((workspace) => workspace.sectionId === sectionId);
    };

    return {
      getWorkspaceBySectionId,

      addWorkspace(workspace: WorkspaceModelType) {
        if (!getWorkspaceBySectionId(workspace.sectionId)) {
          self.workspaces.push(workspace);
        }
        return workspace;
      }
    };
  });

export type WorkspacesModelType = typeof WorkspacesModel.Type;
export type WorkspaceModelType = typeof WorkspaceModel.Type;
