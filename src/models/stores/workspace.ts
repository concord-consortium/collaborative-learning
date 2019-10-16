import { types } from "mobx-state-tree";
import { DocumentModelType, DocumentModel } from "../document/document";
import { SectionModelType } from "../curriculum/section";
import { LogEventName, Logger } from "../../lib/logger";
import { kGroupVirtualDocumentType, GroupVirtualDocument } from "../document/group-virtual-document";
export const ProblemWorkspace = "problem";
export const LearningLogWorkspace = "learningLog";

export const WorkspaceTypeEnum = types.enumeration("type", [ProblemWorkspace, LearningLogWorkspace]);
export type WorkspaceType = typeof WorkspaceTypeEnum.Type;

export const WorkspaceModeEnum = types.enumeration("mode", ["1-up", "4-up"]);
export type WorkspaceMode = typeof WorkspaceModeEnum.Type;

const GhostSectionPrefix = "ghostSection";
export const createGhostSectionDocumentKey = (sectionId: string) => `${GhostSectionPrefix}:${sectionId}`;
export const parseGhostSectionDocumentKey = (documentKey: string) => {
  const [prefix, sectionId, ...rest] = documentKey.split(":");
  return prefix === GhostSectionPrefix ? sectionId : null;
};

export const WorkspaceModel = types
  .model("Workspace", {
    type: WorkspaceTypeEnum,
    mode: WorkspaceModeEnum,
    primaryDocumentKey: types.maybe(types.string),
    comparisonDocumentKey: types.maybe(types.string),
    comparisonVisible: false,
    hidePrimaryForCompare: false
  })
  .actions((self) => {
    const setPrimaryDocument = (document?: DocumentModelType) => {
      self.primaryDocumentKey = document && document.key;
      if (document) {
        Logger.logDocumentEvent(LogEventName.VIEW_SHOW_DOCUMENT, document);
      }
    };
    const setComparisonDocument = (document?: DocumentModelType | GroupVirtualDocument) => {
      self.comparisonDocumentKey = document && document.key;
      if (document && !(document instanceof GroupVirtualDocument)) {
        Logger.logDocumentEvent(LogEventName.VIEW_SHOW_COMPARISON_DOCUMENT, document);
      }
    };

    return {
      setPrimaryDocument,
      setComparisonDocument,

      toggleMode(override?: WorkspaceMode) {
        self.mode = typeof override === "undefined"
          ? (self.mode === "1-up" ? "4-up" : "1-up")
          : override;

        const logEvent = self.mode === "1-up"
          ? LogEventName.VIEW_ENTER_ONE_UP
          : LogEventName.VIEW_ENTER_FOUR_UP;
        Logger.log(logEvent);
      },

      setAvailableDocument(document?: DocumentModelType) {
        if (self.comparisonVisible) {
          setComparisonDocument(document);
        }
        else {
          setPrimaryDocument(document);
        }
      },

      toggleComparisonVisible({override, muteLog = false, hidePrimary = false}:
          {override?: boolean; muteLog?: boolean, hidePrimary?: boolean} = {}) {
        const visible = typeof override !== "undefined" ? override : !self.comparisonVisible;
        self.comparisonVisible = visible;
        self.hidePrimaryForCompare = hidePrimary;
        if (!visible) {
           self.comparisonDocumentKey = undefined;
        }

        if (!muteLog) {
          const logEvent = self.comparisonVisible
            ? LogEventName.VIEW_SHOW_COMPARISON_PANEL
            : LogEventName.VIEW_HIDE_COMPARISON_PANEL;
          Logger.log(logEvent);
        }
      },

      setPrimaryGhostSection(section: SectionModelType) {
        self.primaryDocumentKey = createGhostSectionDocumentKey(section.type);
      },
    };
  });

export type WorkspaceModelType = typeof WorkspaceModel.Type;
