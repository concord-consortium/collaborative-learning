import { types } from "mobx-state-tree";
import { DocumentModel, DocumentModelType } from "./document";

export const WorkspaceModeEnum = types.enumeration("mode", ["1-up", "4-up"]);
export type WorkspaceMode = typeof WorkspaceModeEnum.Type;

export const WorkspaceToolEnum = types.enumeration("tool", ["delete", "geometry", "select", "text"]);
export type WorkspaceTool = typeof WorkspaceToolEnum.Type;

const selectTool = (tool: WorkspaceTool, document: DocumentModelType) => {
  switch (tool) {
    case "geometry":
      document.content.addGeometryTile();
      break;
    case "text":
      document.content.addTextTile();
      break;
  }
  return tool;
};

export const SectionWorkspaceModel = types
  .model("SectionWorkspace", {
    type: "section",
    mode: WorkspaceModeEnum,
    tool: WorkspaceToolEnum,
    sectionId: types.string,
    document: DocumentModel,
    groupDocuments: types.map(DocumentModel),
    visibility: types.enumeration("VisibilityType", ["public", "private"]),
  })
  .actions((self) => {
    return {
      toggleMode(override?: WorkspaceMode) {
        self.mode = typeof override === "undefined"
          ? (self.mode === "1-up" ? "4-up" : "1-up")
          : override;
      },

      selectTool(tool: WorkspaceTool) {
        self.tool = selectTool(tool, self.document);
      },

      deleteTile(tileId: string) {
        self.document.content.deleteTile(tileId);
      },

      toggleVisibility(overide?: "public" | "private") {
        self.visibility = typeof overide === "undefined"
          ? (self.visibility === "public" ? "private" : "public")
          : overide;
      },

      setGroupDocument(uid: string, document: DocumentModelType) {
        self.groupDocuments.set(uid, document);
      },

      clearGroupDocument(uid: string) {
        self.groupDocuments.delete(uid);
      }
    };
  });

export const LearningLogWorkspaceModel = types
  .model("LearningLogWorkspace", {
    type: "learningLog",
    tool: WorkspaceToolEnum,
    document: DocumentModel,
    title: types.string,
    createdAt: types.number,
  })
  .actions((self) => {
    return {
      selectTool(tool: WorkspaceTool) {
        self.tool = selectTool(tool, self.document);
      },

      deleteTile(tileId: string) {
        self.document.content.deleteTile(tileId);
      },

      setTitle(title: string) {
        self.title = title;
      }
    };
  });

export const WorkspacesModel = types
  .model("Workspaces", {
    sections: types.array(SectionWorkspaceModel),
    learningLogs: types.array(LearningLogWorkspaceModel)
  })
  .actions((self) => {
    const findByDocumentId = (documentKey: string) => {
      return (workspace: WorkspaceModelType) => workspace.document.key === documentKey;
    };
    const getSectionWorkspace = (sectionId: string) => {
      return self.sections.find((workspace) => workspace.sectionId === sectionId);
    };
    const getLearningLogWorkspace = (documentKey: string) => {
      return self.learningLogs.find(findByDocumentId(documentKey));
    };
    const getWorkspace = (documentKey: string) => {
      return self.sections.find(findByDocumentId(documentKey)) || self.learningLogs.find(findByDocumentId(documentKey));
    };

    return {
      getSectionWorkspace,
      getLearningLogWorkspace,
      getWorkspace,

      addSectionWorkspace(workspace: SectionWorkspaceModelType) {
        if (!getSectionWorkspace(workspace.sectionId)) {
          self.sections.push(workspace);
        }
        return workspace;
      },

      addLearningLogWorkspace(learningLog: LearningLogWorkspaceModelType) {
        if (!getLearningLogWorkspace(learningLog.document.key)) {
          self.learningLogs.push(learningLog);
        }
        return learningLog;
      }
    };
  });

export type WorkspacesModelType = typeof WorkspacesModel.Type;
export type SectionWorkspaceModelType = typeof SectionWorkspaceModel.Type;
export type LearningLogWorkspaceModelType = typeof LearningLogWorkspaceModel.Type;
export type WorkspaceModelType = SectionWorkspaceModelType | LearningLogWorkspaceModelType;
