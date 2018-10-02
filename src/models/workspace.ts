import { types } from "mobx-state-tree";
import { DocumentModel, DocumentModelType } from "./document";
import { SectionModelType } from "./curriculum/section";

export const SectionWorkspace = "section";
export const LearningLogWorkspace = "learningLog";

export const WorkspaceTypeEnum = types.enumeration("type", [SectionWorkspace, LearningLogWorkspace]);
export type WorkspaceType = typeof WorkspaceTypeEnum.Type;

export const WorkspaceModeEnum = types.enumeration("mode", ["1-up", "4-up"]);
export type WorkspaceMode = typeof WorkspaceModeEnum.Type;

const GhostSectionPrefix = "ghostSection";
export const createGhostSectionDocumentKey = (sectionId: string) => `${GhostSectionPrefix}:${sectionId}`;
export const parseGhostSectionDocumentKey = (documentKey: string) => {
  const [prefix, sectionId, ...rest] = documentKey.split(":");
  return sectionId;
};

export const WorkspaceModel = types
  .model("Workspace", {
    type: WorkspaceTypeEnum,
    mode: WorkspaceModeEnum,
    primaryDocumentKey: types.maybe(types.string),
    comparisonDocumentKey: types.maybe(types.string),
    comparisonVisible: false,
    groupDocumentKeys: types.map(types.string),
  })
  .actions((self) => {
    const setPrimaryDocument = (document?: DocumentModelType) => {
      self.primaryDocumentKey = document && document.key;
    };
    const setComparisonDocument = (document?: DocumentModelType) => {
      self.comparisonDocumentKey = document && document.key;
    };

    return {
      setPrimaryDocument,
      setComparisonDocument,

      toggleMode(override?: WorkspaceMode) {
        self.mode = typeof override === "undefined"
          ? (self.mode === "1-up" ? "4-up" : "1-up")
          : override;
      },

      setGroupDocument(uid: string, document: DocumentModelType) {
        self.groupDocumentKeys.set(uid, document.key);
      },

      clearGroupDocument(uid: string) {
        self.groupDocumentKeys.delete(uid);
      },

      setAvailableDocument(document?: DocumentModelType) {
        if (self.comparisonVisible) {
          setComparisonDocument(document);
        }
        else {
          setPrimaryDocument(document);
        }
      },

      toggleComparisonVisible(override?: boolean) {
        const visible = typeof override !== "undefined" ? override : !self.comparisonVisible;
        self.comparisonVisible = visible;
        if (!visible) {
          self.comparisonDocumentKey = undefined;
        }
      },

      setPrimaryGhostSection(section: SectionModelType) {
        self.primaryDocumentKey = createGhostSectionDocumentKey(section.id);
      },
    };
  });

export type WorkspaceModelType = typeof WorkspaceModel.Type;
