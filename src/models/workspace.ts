import { types } from "mobx-state-tree";

export const WorkspaceModeEnum = types.enumeration("mode", ["1-up", "4-up"]);
export type WorkspaceMode = typeof WorkspaceModeEnum.Type;

export const WorkspaceToolEnum = types.enumeration("tool", ["select", "text"]);
export type WorkspaceTool = typeof WorkspaceToolEnum.Type;

export const WorkspaceModel = types
  .model("Workspace", {
    mode: WorkspaceModeEnum,
    tool: WorkspaceToolEnum,
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
      },
    };
  });

export type WorkspaceModelType = typeof WorkspaceModel.Type;
